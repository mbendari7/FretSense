/**
 * FR-066a restore precedence rule (6), spec change (code-reviewer T091 r1 #6, provisional) (red),
 * application level: "(6) no local copy, incoming copy tombstoned ⇒ not written and not counted in
 * any preview count (it hides nothing)". FR-066a: when added, restored, updated and hidden are all 0
 * the preview says "This file has nothing new to import" and confirming writes nothing.
 *
 * Rig as in app.migrate.test.ts: real FretSenseApp over a spying memoryRepository(), fixed clock,
 * deterministic ids, node:crypto SHA-256. The file is a real export of the same profile (restore
 * mode) whose only records are hand-built tombstones with ids the profile has never seen.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { payloadOf } from '../domain/canonicalJson';

const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(prefix: string) {
  const clock = { t: T0, now() { return this.t; } };
  const inner = memoryRepository();
  const writes: WriteOp[][] = [];
  const repo: Repository = {
    durable: inner.durable,
    loadMeta: () => inner.loadMeta(),
    listProfiles: () => inner.listProfiles(),
    loadProfile: (id) => inner.loadProfile(id),
    purgeProfile: (id, meta) => inner.purgeProfile(id, meta),
    findForeignIds: (store, ids, pid) => inner.findForeignIds(store, ids, pid),
    write: async (ops, meta) => { writes.push([...ops]); await inner.write(ops, meta); },
  };
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  return { app, writes, tick: () => { clock.t += 1000; } };
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};
const recordOps = (writes: WriteOp[][]) => writes.reduce((n, ops) => n + ops.length, 0);

async function tombstoneOnlyFile(ctx: Awaited<ReturnType<typeof makeApp>>) {
  const exp = ctx.app.exportProfile(false);
  const pid = exp.localProfile.id;
  const at = exp.exportedAt;
  const common = { localProfileId: pid, created: at, updated: at, schemaVersion: 1 as const, deleted: true };
  const attemptBase = {
    id: 'eeeeeeee-0000-4000-8000-000000000001', ...common,
    drillType: 'note-finding', instrumentId: null, geometryId: 'guitar:E2-A2-D3-G3-B3-E4', modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }],
    outcome: 'correct', responseMs: 800, timestamp: '2026-11-22T11:00:00.000Z', lessonId: null, drillId: null,
    itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7',
  };
  const attempt = { ...attemptBase, payloadHash: sha(payloadOf(attemptBase)) };
  const instrument = { id: 'eeeeeeee-0000-4000-8000-000000000002', ...common, name: 'Old bass', profile: presetById('bass4-standard')!.profile };
  const completion = { id: 'eeeeeeee-0000-4000-8000-000000000003', ...common, lessonId: 'notes-on-the-neck', stages: { read: at } };
  return { ...exp, attempts: [attempt], instruments: [instrument], lessonCompletion: [completion] };
}

describe('FR-066a rule (6): restore of tombstones with no local copy', () => {
  it('the preview is restore mode and has nothing new (added, restored, updated, hidden all 0)', async () => {
    const ctx = await makeApp('e0000001');
    const file = await tombstoneOnlyFile(ctx);
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.preview.mode).toBe('restore');
    const c = r.preview.counts;
    expect({ added: c.added, restored: c.restored, updated: c.updated, hidden: c.hidden }).toEqual({ added: 0, restored: 0, updated: 0, hidden: 0 });
  });

  it('"not counted in any preview count": unchanged is 0 as well', async () => {
    const ctx = await makeApp('e0000002');
    const file = await tombstoneOnlyFile(ctx);
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file));
    if (!r.ok) throw new Error(r.reason);
    expect(r.preview.counts).toEqual({ added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 0 });
  });

  it('confirming writes 0 records and the state has no new records', async () => {
    const ctx = await makeApp('e0000003');
    const before = ctx.app.getState();
    const counts = { a: before.attempts.length, i: before.instruments.length, c: before.completion.length };
    const file = await tombstoneOnlyFile(ctx);
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file));
    if (!r.ok) throw new Error(r.reason);
    const w0 = recordOps(ctx.writes);
    await r.preview.apply();
    expect(recordOps(ctx.writes) - w0).toBe(0);
    const after = ctx.app.getState();
    expect({ a: after.attempts.length, i: after.instruments.length, c: after.completion.length }).toEqual(counts);
  });
});
