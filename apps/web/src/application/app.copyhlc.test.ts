/**
 * T092/T093 privacy-auditor r2, red tests: copy import and the hybrid logical clock, and duplicate
 * natural keys inside one file [FR-043, FR-066, FR-066a].
 *
 * Spec facts used as expected values:
 *  - FR-066a "Ordering": "newest" always means the greatest HLC value (wall time, then counter,
 *    then writer id), so ordering holds under clock skew, within the clock bound.
 *  - FR-066a "Clock bound": a timestamp more than 24 hours ahead rejects the file; 23 h is inside it.
 *    So a file 23 h ahead is accepted, and every HLC it carries into the profile has been
 *    "received": a later local edit must order after all of them (research R5 receive rule).
 *  - FR-066 natural key for lesson completion is (localProfileId, lessonId); FR-043 validates the
 *    whole file before writing. A file with two completion records for one lessonId must be
 *    rejected with nothing written, or (accepted alternative) leave exactly one record for it.
 *
 * HLC comparison is done here, independently: "<ISO ms>-<counter>-<writer>" compared as
 * (wall ms, counter, writer id).
 * Helpers copied from app.test.ts.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import type { ProfileExport } from '../domain/exportFormat';

// ---------- test rig (copied from app.test.ts) ----------
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const HOUR = 3600 * 1000;
const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
function idsWith(prefix: string): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
}
function spyRepo() {
  const inner = memoryRepository();
  const writes: WriteOp[][] = [];
  const repo: Repository = {
    durable: inner.durable,
    loadMeta: () => inner.loadMeta(),
    listProfiles: () => inner.listProfiles(),
    loadProfile: (id) => inner.loadProfile(id),
    write: async (ops, meta) => {
      writes.push([...ops]);
      await inner.write(ops, meta);
    },
  };
  return { repo, writes };
}
async function makeApp(prefix: string, start = T0) {
  const clock = { t: start, now() { return this.t; } };
  const { repo, writes } = spyRepo();
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  const tick = (ms = 1000) => { clock.t += ms; };
  return { app, writes, tick };
}
type Ctx = Awaited<ReturnType<typeof makeApp>>;
async function mark(ctx: Ctx, lessonId: string, stage: 'read' | 'see' | 'drill') {
  ctx.tick();
  await ctx.app.markStage(lessonId, stage);
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};
const recordOps = (writes: WriteOp[][]) => writes.reduce((n, ops) => n + ops.length, 0);

// ---------- independent HLC parsing and ordering ----------
const HLC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-(\d+)-(.+)$/;
function hlcKey(h: string): [number, number, string] {
  const m = HLC.exec(h);
  if (!m) throw new Error(`not an HLC: ${h}`);
  return [Date.parse(m[1]!), Number(m[2]), m[3]!];
}
function hlcGreater(a: string, b: string): boolean {
  const [wa, ca, xa] = hlcKey(a);
  const [wb, cb, xb] = hlcKey(b);
  return wa !== wb ? wa > wb : ca !== cb ? ca > cb : xa > xb;
}
/** Every HLC held in the app's state (records' created/updated, stage times, settings field stamps). */
function allHlcs(app: FretSenseApp): string[] {
  const s = app.getState();
  const out: string[] = [];
  for (const r of [...s.instruments, ...s.attempts, ...s.completion]) out.push(r.created, r.updated);
  for (const c of s.completion) out.push(...Object.values(c.stages).filter((x): x is string => typeof x === 'string'));
  if (s.settings) out.push(s.settings.created, s.settings.updated, ...Object.values(s.settings.fieldUpdated));
  return out;
}

// =============================================================================================
describe('FR-066a / FR-043 copy import receives the HLCs it carries', () => {
  it('a file 23 h ahead of the target clock: a later local settings edit orders after every copied HLC', async () => {
    const src = await makeApp('aaaaaaaa', T0 + 23 * HOUR);
    await src.app.addPreset('guitar6-standard');
    await mark(src, 'lesson-a', 'read');
    await mark(src, 'lesson-b', 'see');
    const exp = src.app.exportProfile(false);
    // Brute-force check that the file really is ~23 h ahead of the target (and inside the 24 h bound).
    const fileWalls = [exp.exportedAt, ...exp.lessonCompletion.flatMap((c) => Object.values(c.stages) as string[])].map((h) => hlcKey(h)[0]);
    expect(Math.max(...fileWalls) - T0).toBeGreaterThanOrEqual(23 * HOUR);
    expect(Math.max(...fileWalls) - T0).toBeLessThan(24 * HOUR);

    const dst = await makeApp('bbbbbbbb', T0);
    dst.tick();
    const r = await dst.app.previewImport(fileOf(exp));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.preview.mode).toBe('copy');
    await r.preview.apply();

    const carried = allHlcs(dst.app);
    // The copied stage times keep their (future) wall time, so they are among the carried HLCs.
    expect(Math.max(...carried.map((h) => hlcKey(h)[0])) - T0).toBeGreaterThanOrEqual(23 * HOUR);

    dst.tick();
    await dst.app.updateSettings({ autoAdvanceMs: 0 });
    const edit = dst.app.getState().settings!.fieldUpdated.autoAdvanceMs;
    for (const h of carried) expect(hlcGreater(edit, h), `local edit ${edit} must order after copied ${h}`).toBe(true);
  });
});

// =============================================================================================
describe('FR-066 / FR-043 a file with two completion records for one lessonId', () => {
  async function fileWithDuplicate(prefix: string): Promise<{ src: Ctx; exp: ProfileExport }> {
    const src = await makeApp(prefix);
    await mark(src, 'lesson-a', 'read');
    const exp = src.app.exportProfile(false);
    expect(exp.lessonCompletion).toHaveLength(1);
    const first = exp.lessonCompletion[0]!;
    const dup = { ...first, id: 'ffffffff-0000-4000-8000-0000000000ff', stages: { see: first.updated } };
    return { src, exp: { ...exp, lessonCompletion: [first, dup] } as ProfileExport };
  }

  /** Rejected with nothing written, or applied leaving exactly one record for the lesson. */
  async function expectRejectedOrOne(target: Ctx, exp: ProfileExport) {
    const before = recordOps(target.writes);
    target.tick();
    const r = await target.app.previewImport(fileOf(exp));
    if (!r.ok) {
      expect(recordOps(target.writes)).toBe(before);
      expect(target.app.getState().completion.filter((c) => c.lessonId === 'lesson-a' && !c.deleted).length).toBeLessThanOrEqual(1);
      return;
    }
    await r.preview.apply();
    const rows = target.app.getState().completion.filter((c) => c.lessonId === 'lesson-a');
    expect(rows, 'exactly one completion record per (profile, lessonId)').toHaveLength(1);
  }

  it('copy import (other profile): rejected, or exactly one record for lesson-a', async () => {
    const { exp } = await fileWithDuplicate('cccccccc');
    const dst = await makeApp('dddddddd');
    await expectRejectedOrOne(dst, exp);
  });

  it('restore import (same profile): rejected, or exactly one record for lesson-a', async () => {
    const { src, exp } = await fileWithDuplicate('eeeeeeee');
    await expectRejectedOrOne(src, exp);
  });
});
