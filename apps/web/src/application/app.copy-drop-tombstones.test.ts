/**
 * Owner decision 2026-11-22 (2) (red, test-first) [FR-043, FR-066a copy mode]. spec.md Clarifications
 * "Owner decisions 2026-11-22": "Copy import (FR-066a copy mode) drops records that are deleted
 * (tombstoned) in the file: they are not written and not counted ("Copy import drops deleted")."
 *
 * Rig as in app.restore-tombstone.test.ts (real FretSenseApp, spying memoryRepository, fixed clock,
 * node:crypto SHA-256). The file is hand-built for a DIFFERENT local profile (so copy mode), holding
 * one live attempt plus a tombstoned attempt, instrument and lesson completion that the target has
 * never seen. Expected values follow from the decision: only the live attempt is written or counted.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { payloadOf } from '../domain/canonicalJson';
import { EXPORT_FORMAT } from '../domain/exportFormat';

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
    write: async (ops, meta) => { writes.push([...ops]); await inner.write(ops, meta); },
  };
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  return { app, repo, writes, tick: () => { clock.t += 1000; } };
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};

const SRC = 'cccccccc-0000-4000-8000-000000000001';
const W = 'cdcdcdcd-0000-4000-8000-000000000001';
const H = `2026-11-22T11:00:00.000Z-0000-${W}`;
const common = (n: number, deleted: boolean) => ({ id: `cccccccc-0000-4000-8000-${n.toString(16).padStart(12, '0')}`, localProfileId: SRC, created: H, updated: H, schemaVersion: 1 as const, deleted });
function attempt(n: number, deleted: boolean) {
  const base = {
    ...common(n, deleted),
    drillType: 'note-finding', instrumentId: null, geometryId: 'guitar:E2-A2-D3-G3-B3-E4', modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }],
    outcome: 'correct', responseMs: 800 + n, timestamp: '2026-11-22T11:00:00.000Z', lessonId: null, drillId: null,
    itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7',
  };
  return { ...base, payloadHash: sha(payloadOf(base)) };
}
function file(opts: { live: boolean }) {
  return {
    format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: H,
    localProfile: { ...common(1, false), id: SRC, displayName: 'Source' },
    instruments: [{ ...common(2, true), name: 'Sold bass', profile: structuredClone(presetById('bass4-standard')!.profile) }],
    attempts: [attempt(3, true), ...(opts.live ? [attempt(4, false)] : [])],
    lessonCompletion: [{ ...common(5, true), lessonId: 'triads', stages: { read: H } }],
  };
}
const writtenRecords = (writes: WriteOp[][], from: number) => writes.slice(from).flat().map((op) => ({ store: op.store, record: op.record as { deleted?: boolean } }));

describe('owner decision 2026-11-22 (2): copy import drops records tombstoned in the file', () => {
  it('preview: copy mode; only the live attempt is counted (added 1), the tombstones are in no count', async () => {
    const ctx = await makeApp('d0000001');
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file({ live: true })));
    if (!r.ok) throw new Error(r.reason);
    expect(r.preview.mode).toBe('copy');
    expect(r.preview.counts).toEqual({ added: 1, restored: 0, updated: 0, hidden: 0, unchanged: 0 });
  });

  it('confirm: no tombstoned record is written; the target holds only the one live copied attempt', async () => {
    const ctx = await makeApp('d0000002');
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file({ live: true })));
    if (!r.ok) throw new Error(r.reason);
    const w0 = ctx.writes.length;
    await r.preview.apply();
    const written = writtenRecords(ctx.writes, w0);
    expect(written.filter((x) => x.record.deleted).map((x) => x.store), 'tombstones written').toEqual([]);
    const pid = ctx.app.getState().profile!.id;
    const stored = (await ctx.repo.loadProfile(pid))!;
    expect(stored.attempts.map((a) => a.deleted)).toEqual([false]);
    expect(stored.instruments.filter((i) => i.name === 'Sold bass')).toEqual([]);
    expect(stored.completion.filter((c) => c.lessonId === 'triads')).toEqual([]);
  });

  it('a file holding only tombstones: nothing new, and confirming writes nothing', async () => {
    const ctx = await makeApp('d0000003');
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(file({ live: false })));
    if (!r.ok) throw new Error(r.reason);
    expect(r.preview.counts).toEqual({ added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 0 });
    const w0 = ctx.writes.length;
    await r.preview.apply();
    expect(writtenRecords(ctx.writes, w0)).toEqual([]);
  });
});
