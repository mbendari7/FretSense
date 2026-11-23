/**
 * T093a (red, test-first): legacy drill-id migration at the application level, on load and on
 * import [FR-043, FR-041, FR-066a, SC-013; spec.md Clarifications 2026-11-22 (provisional,
 * product-owner) "How are attempts stored by the v0.1 pre-release (4695363) under the old
 * drill-type ids handled?"; data-model §3.1, §4].
 *
 * Uses the real FretSenseApp over memoryRepository() with a fixed clock, deterministic ids and a
 * node:crypto SHA-256 hasher (helpers copied from app.test.ts). v0.1 records are written straight
 * into the repository (as the committed v0.1 build stored them) or into an export file built from
 * a real export with v0.1 attempts swapped in. Their shapes come from
 * `git show 4695363:apps/web/src/domain/records.ts` and `.../drills/generate.ts`.
 *
 * Expected values come from the clarification:
 *  - bass-arpeggio → arpeggio, bass-walking → walking-bass (drillType, prompt.drillType, itemKey);
 *  - old root–fifth–octave keys and every bass-octave-shapes attempt → drillType 'legacy',
 *    prompt { drillType: 'legacy', legacyDrillType, root, qualityId | null }, itemKey `lg|<old drillType>|<q>`
 *    (the encoding chosen in domain/migrate.test.ts);
 *  - legacy attempts are kept (history and totals); a v0.1 export imports whole in restore and copy
 *    mode; re-export writes the migrated ids; restoring the same old file onto an already-migrated
 *    profile is "nothing new" (hashes agree); an unmapped drill type still rejects the whole file.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { payloadOf } from '../domain/canonicalJson';
import { attemptSchema, type AttemptRecord } from '../domain/records';
import { parseExport } from '../domain/exportFormat';

// ---------- test rig (copied from app.test.ts) ----------
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
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
async function makeApp(prefix: string) {
  const clock = { t: T0, now() { return this.t; } };
  const { repo, writes } = spyRepo();
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  const tick = (ms = 1000) => { clock.t += ms; };
  return { app, writes, tick, repo, clock };
}
type Ctx = Awaited<ReturnType<typeof makeApp>>;
const recordOps = (writes: WriteOp[][]) => writes.reduce((n, ops) => n + ops.length, 0);
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};
async function preview(ctx: Ctx, exp: unknown) {
  ctx.tick();
  const r = await ctx.app.previewImport(fileOf(exp));
  if (!r.ok) throw new Error(`preview rejected: ${r.reason}`);
  return r.preview;
}
const nothingNew = (c: { added: number; restored: number; updated: number; hidden: number }) => c.added + c.restored + c.updated + c.hidden === 0;

// ---------- v0.1 attempts (commit 4695363 shapes) ----------
type Raw = Record<string, unknown>;
const OLD_IDS = ['bass-root-fifth-octave', 'bass-arpeggio', 'bass-walking', 'bass-octave-shapes'];
const WRITER = '22222222-0000-4000-8000-000000000002';
const hlcAt = (s: number) => `2026-11-21T10:00:${String(s).padStart(2, '0')}.000Z-0000-${WRITER}`;
const root = { string: 3, fret: 3 };

function oldAttempt(pid: string, instrumentId: string, geometryId: string, n: number, drillType: string, prompt: Raw, itemKey: string, over: Raw = {}): Raw {
  const base: Raw = {
    id: `dddddddd-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    localProfileId: pid,
    created: hlcAt(n),
    updated: hlcAt(n),
    schemaVersion: 1,
    deleted: false,
    drillType,
    instrumentId,
    geometryId,
    modality: 'tap',
    prompt,
    answer: [{ string: 3, fret: 5 }],
    outcome: n % 2 ? 'incorrect' : 'correct',
    responseMs: 1500 + n,
    timestamp: `2026-11-21T10:00:${String(n).padStart(2, '0')}.000Z`,
    lessonId: null,
    drillId: null,
    itemKey,
    ...over,
  };
  return { ...base, payloadHash: sha(payloadOf(base)) };
}

/** A bass instrument plus six v0.1 attempts (5 live, 1 tombstoned) for ctx's profile. */
async function v01(ctx: Ctx) {
  await ctx.app.addPreset('bass4-standard');
  const inst = ctx.app.activeInstrument()!;
  const pid = ctx.app.getState().profile!.id;
  const g = inst.profile.geometryId;
  const mk = (n: number, t: string, prompt: Raw, key: string, over: Raw = {}) => oldAttempt(pid, inst.id, g, n, t, prompt, key, over);
  const attempts = {
    rfo: mk(1, 'bass-root-fifth-octave', { drillType: 'bass-root-fifth-octave', root, qualityId: 'major' }, 'bs|bass-root-fifth-octave|major'),
    arp: mk(2, 'bass-arpeggio', { drillType: 'bass-arpeggio', root, qualityId: 'minor' }, 'bs|bass-arpeggio|minor'),
    walk: mk(3, 'bass-walking', { drillType: 'bass-walking', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }, { root: 'G', quality: 'dom7' }] }, 'bs|bass-walking|dom7'),
    oct: mk(4, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root }, 'bs|bass-octave-shapes|major'),
    octDeleted: mk(5, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root: { string: 4, fret: 0 } }, 'bs|bass-octave-shapes|major', { deleted: true, updated: hlcAt(30) }),
    nf: mk(6, 'note-finding', { drillType: 'note-finding', pitchClass: 5, string: 3, midi: null }, `nf|${g}|3|5`),
  };
  /** The v0.1 export: a real export of this profile with the v0.1 attempts in it. */
  const file = (extra: Raw[] = []) => ({ ...ctx.app.exportProfile(false), attempts: [...Object.values(attempts), ...extra] });
  return { attempts, file, pid, inst, mk };
}
/** Writes v0.1 records straight into the store, as the committed v0.1 build did, then reloads. */
async function seedAndReload(ctx: Ctx, records: Raw[], prefix: string): Promise<FretSenseApp> {
  const meta = await ctx.repo.loadMeta();
  await ctx.repo.write(records.map((r) => ({ store: 'attempts', record: r as unknown as AttemptRecord })), meta!);
  const app = new FretSenseApp(ctx.repo, ctx.clock, idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}

/** Hand-written expected migrations (from the clarification, not from the code under test). */
const strip = (a: Raw) => {
  const { payloadHash: _h, ...rest } = a;
  return rest;
};
const expectedHash = (old: Raw, drillType: string, prompt: Raw, itemKey: string) => sha(payloadOf({ ...strip(old), drillType, prompt, itemKey }));

function expectMigrated(attempts: readonly AttemptRecord[]) {
  for (const a of attempts) {
    expect(OLD_IDS).not.toContain(a.drillType);
    expect(OLD_IDS).not.toContain((a.prompt as Raw).drillType);
    expect(a.itemKey).not.toMatch(/^bs\|bass-/);
    const { payloadHash, ...rest } = a;
    expect(payloadHash, `hash of ${a.id}`).toBe(sha(payloadOf(rest)));
    const parsed = attemptSchema.safeParse(a);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  }
}
const byType = (xs: readonly AttemptRecord[]) => xs.reduce<Record<string, number>>((m, a) => ({ ...m, [a.drillType]: (m[a.drillType] ?? 0) + 1 }), {});

// =============================================================================================
describe('FR-043 T093a migration on load (attempts stored by the v0.1 build)', () => {
  it('loads every stored v0.1 attempt, migrated, with fresh valid hashes; none dropped', async () => {
    const ctx = await makeApp('a0000001');
    const { attempts } = await v01(ctx);
    const app = await seedAndReload(ctx, Object.values(attempts), 'a0000011');
    const s = app.getState();
    expect(s.status).toBe('ready');
    expect(s.attempts).toHaveLength(6);
    expectMigrated(s.attempts);
    expect(byType(s.attempts)).toEqual({ legacy: 3, arpeggio: 1, 'walking-bass': 1, 'note-finding': 1 });
    expect(s.attempts.filter((a) => !a.deleted)).toHaveLength(5);
  });

  it('the migrated values match the clarification exactly', async () => {
    const ctx = await makeApp('a0000002');
    const { attempts } = await v01(ctx);
    const app = await seedAndReload(ctx, Object.values(attempts), 'a0000012');
    const get = (old: Raw) => app.getState().attempts.find((a) => a.id === old.id)!;
    expect(get(attempts.arp)).toMatchObject({ drillType: 'arpeggio', itemKey: 'bs|arpeggio|minor', prompt: { drillType: 'arpeggio', root, qualityId: 'minor' } });
    expect(get(attempts.walk)).toMatchObject({ drillType: 'walking-bass', itemKey: 'bs|walking-bass|dom7', prompt: { drillType: 'walking-bass' } });
    expect(get(attempts.rfo)).toMatchObject({ drillType: 'legacy', itemKey: 'lg|bass-root-fifth-octave|major', prompt: { drillType: 'legacy', legacyDrillType: 'bass-root-fifth-octave', root, qualityId: 'major' } });
    expect(get(attempts.oct)).toMatchObject({ drillType: 'legacy', itemKey: 'lg|bass-octave-shapes|major', prompt: { drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root, qualityId: null } });
    expect(get(attempts.octDeleted).deleted).toBe(true);
    expect(get(attempts.nf).payloadHash).toBe(attempts.nf.payloadHash); // untouched record keeps its hash
    // Hashes recomputed from hand-written expected payloads.
    expect(get(attempts.arp).payloadHash).toBe(expectedHash(attempts.arp, 'arpeggio', { drillType: 'arpeggio', root, qualityId: 'minor' }, 'bs|arpeggio|minor'));
    expect(get(attempts.oct).payloadHash).toBe(expectedHash(attempts.oct, 'legacy', { drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root, qualityId: null }, 'lg|bass-octave-shapes|major'));
  });

  it('a second load gives identical records (the migration is idempotent)', async () => {
    const ctx = await makeApp('a0000003');
    const { attempts } = await v01(ctx);
    const first = await seedAndReload(ctx, Object.values(attempts), 'a0000013');
    const again = new FretSenseApp(ctx.repo, ctx.clock, idsWith('a0000023'), sha256);
    await again.bootstrap();
    const sort = (xs: readonly AttemptRecord[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(again.getState().attempts)).toEqual(sort(first.getState().attempts));
  });

  it('re-export after load writes the migrated ids and is a valid current export', async () => {
    const ctx = await makeApp('a0000004');
    const { attempts } = await v01(ctx);
    const app = await seedAndReload(ctx, Object.values(attempts), 'a0000014');
    const exp = app.exportProfile(false);
    expect(exp.attempts).toHaveLength(6);
    expectMigrated(exp.attempts);
    const parsed = parseExport(JSON.stringify(exp));
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
  });
});

// =============================================================================================
describe('FR-043 T093a a v0.1-shaped export imports whole (zero rejections)', () => {
  it('restore mode: accepted; counts every record; applied records are migrated', async () => {
    const ctx = await makeApp('b0000001');
    const { file } = await v01(ctx);
    const p = await preview(ctx, file());
    expect(p.mode).toBe('restore');
    // spec FR-066a: "(6) no local copy, incoming copy tombstoned ⇒ not written and not counted in any preview count
    // (it hides nothing)". octDeleted has no local copy here, so hidden is 0 and only the 5 live attempts are stored.
    expect(p.counts).toEqual({ added: 5, restored: 0, updated: 0, hidden: 0, unchanged: 1 }); // 5 live attempts; the instrument
    await p.apply();
    const s = ctx.app.getState();
    expect(s.attempts).toHaveLength(5);
    expect(s.attempts.some((a) => a.deleted)).toBe(false);
    expectMigrated(s.attempts);
    expect(byType(s.attempts)).toEqual({ legacy: 2, arpeggio: 1, 'walking-bass': 1, 'note-finding': 1 });
  });

  it('copy mode: accepted; every live attempt added; copied attempts are migrated and re-hashed', async () => {
    const src = await makeApp('b0000002');
    const { file } = await v01(src);
    const dst = await makeApp('b0000003');
    const p = await preview(dst, file());
    expect(p.mode).toBe('copy');
    expect(p.counts.added).toBe(6); // 1 instrument + 5 live attempts
    await p.apply();
    const s = dst.app.getState();
    // Spec Clarifications, Owner decisions 2026-11-22 (2): "Copy import (FR-066a copy mode) drops records
    // that are deleted (tombstoned) in the file: they are not written and not counted". The tombstoned
    // octDeleted is dropped, leaving the 5 live attempts (rfo, arp, walk, oct, nf); legacy = rfo + oct = 2.
    expect(s.attempts).toHaveLength(5);
    expect(s.attempts.some((a) => a.deleted)).toBe(false);
    expect(s.attempts.every((a) => a.localProfileId === s.profile!.id)).toBe(true);
    expectMigrated(s.attempts);
    expect(byType(s.attempts)).toEqual({ legacy: 2, arpeggio: 1, 'walking-bass': 1, 'note-finding': 1 });
  });

  it('re-export after a restore writes the migrated ids, and that file imports cleanly elsewhere', async () => {
    const ctx = await makeApp('b0000004');
    const { file } = await v01(ctx);
    await (await preview(ctx, file())).apply();
    const exp = ctx.app.exportProfile(false);
    expectMigrated(exp.attempts);
    const parsed = parseExport(JSON.stringify(exp));
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
    const other = await makeApp('b0000005');
    const p = await preview(other, exp);
    expect(p.mode).toBe('copy');
    await p.apply();
    expectMigrated(other.app.getState().attempts);
  });
});

// =============================================================================================
describe('FR-066a / SC-013 T093a hashes agree after migration on every path', () => {
  it('restoring the same v0.1 file onto an already-migrated profile is "nothing new" and writes nothing', async () => {
    const ctx = await makeApp('c0000001');
    const { attempts, file } = await v01(ctx);
    const app = await seedAndReload(ctx, Object.values(attempts), 'c0000011');
    const ctx2 = { ...ctx, app };
    const p = await preview(ctx2, file());
    expect(p.mode).toBe('restore');
    expect(nothingNew(p.counts)).toBe(true);
    expect(p.counts.unchanged).toBe(7); // 6 attempts + 1 instrument
    const before = recordOps(ctx.writes);
    await p.apply();
    expect(recordOps(ctx.writes)).toBe(before);
  });

  it('migrated on load and migrated on restore-import give the same payloadHash per attempt id', async () => {
    // Same id prefix ⇒ same profile and instrument ids in both apps.
    const x = await makeApp('c0000002');
    const vx = await v01(x);
    const loaded = await seedAndReload(x, Object.values(vx.attempts), 'c0000012');
    const y = await makeApp('c0000002');
    const vy = await v01(y);
    await (await preview(y, vy.file())).apply();
    // spec FR-066a "(6) no local copy, incoming copy tombstoned ⇒ not written": restore drops the unmatched
    // tombstone (octDeleted) while load keeps the stored one, so compare only ids present on both paths.
    const hashes = (xs: readonly AttemptRecord[], ids: ReadonlySet<string>) => Object.fromEntries(xs.filter((a) => ids.has(a.id)).map((a) => [a.id, a.payloadHash]));
    const yIds = new Set(y.app.getState().attempts.map((a) => a.id));
    const both = new Set(loaded.getState().attempts.map((a) => a.id).filter((id) => yIds.has(id)));
    expect(both.size).toBe(5); // the 5 live attempts
    expect(both.has(String(vx.attempts.octDeleted.id))).toBe(false);
    expect(hashes(y.app.getState().attempts, both)).toEqual(hashes(loaded.getState().attempts, both));
  });
});

// =============================================================================================
describe('FR-043 T093a unmapped or damaged v0.1 data still rejects the whole file', () => {
  it('an unknown drill type rejects the file in restore mode; nothing is written', async () => {
    const ctx = await makeApp('e0000001');
    const { file, mk } = await v01(ctx);
    const bad = mk(40, 'bass-slap', { drillType: 'bass-slap', root }, 'bs|bass-slap|major');
    const before = recordOps(ctx.writes);
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file([bad])));
    expect(r.ok).toBe(false);
    expect(recordOps(ctx.writes)).toBe(before);
    expect(ctx.app.getState().attempts).toHaveLength(0);
  });

  it('an unknown drill type rejects the file in copy mode; nothing is written', async () => {
    const src = await makeApp('e0000002');
    const { file, mk } = await v01(src);
    const bad = mk(41, 'bass-slap', { drillType: 'bass-slap', root }, 'bs|bass-slap|major');
    const dst = await makeApp('e0000003');
    const before = recordOps(dst.writes);
    dst.tick();
    const r = await dst.app.previewImport(fileOf(file([bad])));
    expect(r.ok).toBe(false);
    expect(recordOps(dst.writes)).toBe(before);
  });

  it('a v0.1 attempt whose checksum does not match its ORIGINAL payload is reported as damaged', async () => {
    const ctx = await makeApp('e0000004');
    const { file, attempts } = await v01(ctx);
    const tampered = { ...attempts.arp, outcome: attempts.arp.outcome === 'correct' ? 'incorrect' : 'correct' };
    const exp = file();
    exp.attempts = exp.attempts.map((a) => ((a as Raw).id === attempts.arp.id ? tampered : a)) as typeof exp.attempts;
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(exp));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/damaged|checksum/i);
  });
});
