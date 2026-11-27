/**
 * security-reviewer T093 r1 MAJOR #1 (red, test-first) [FR-043, FR-066a, SC-013]: previewImport
 * rejects a file with duplicate ids within attempts or within instruments, and writes nothing.
 *
 * Exploit covered: a valid v0.1 attempt with id X (its original payloadHash correct) plus a
 * current-format attempt with the same id X and payloadHash '0'.repeat(64). Migration records X as
 * "migrated", so a by-id lookup would re-hash the forged attempt and skip its checksum check.
 * A record id is a primary key (data-model §3), so a file holding one id twice is malformed.
 * Rig as in app.migrate.test.ts (v0.1 shape from commit 4695363, copied from there).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
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
  await app.addPreset('bass4-standard');
  return { app, writes, tick: () => { clock.t += 1000; } };
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};
const recordOps = (writes: WriteOp[][]) => writes.reduce((n, ops) => n + ops.length, 0);

type Raw = Record<string, unknown>;
const X = 'dddddddd-0000-4000-8000-000000000001';
const WRITER = '22222222-0000-4000-8000-000000000002';
const hlc = `2026-11-21T10:00:01.000Z-0000-${WRITER}`;

function base(pid: string, instrumentId: string, geometryId: string, over: Raw): Raw {
  return {
    id: X, localProfileId: pid, created: hlc, updated: hlc, schemaVersion: 1, deleted: false,
    instrumentId, geometryId, modality: 'tap', answer: [{ string: 3, fret: 5 }], outcome: 'correct', responseMs: 1500,
    timestamp: '2026-11-21T10:00:01.000Z', lessonId: null, drillId: null, ...over,
  };
}
const hashed = (r: Raw) => ({ ...r, payloadHash: sha(payloadOf(r)) });

async function setup(prefix: string) {
  const ctx = await makeApp(prefix);
  const exp = ctx.app.exportProfile(false);
  const inst = exp.instruments[0]!;
  const pid = exp.localProfile.id;
  const v01 = hashed(base(pid, inst.id, inst.profile.geometryId, {
    drillType: 'bass-arpeggio', prompt: { drillType: 'bass-arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' }, itemKey: 'bs|bass-arpeggio|minor',
  }));
  const forged = {
    ...base(pid, inst.id, inst.profile.geometryId, {
      drillType: 'arpeggio', prompt: { drillType: 'arpeggio', root: { string: 4, fret: 7 }, qualityId: 'minor' }, itemKey: 'bs|arpeggio|minor', outcome: 'incorrect', responseMs: 1,
    }),
    payloadHash: '0'.repeat(64),
  };
  return { ctx, exp, v01, forged };
}

async function expectRejectedNoWrites(ctx: Awaited<ReturnType<typeof makeApp>>, file: unknown) {
  ctx.tick();
  const w0 = recordOps(ctx.writes);
  const r = await ctx.app.previewImport(fileOf(file));
  expect(r.ok, 'file with a duplicate id must be rejected').toBe(false);
  expect(recordOps(ctx.writes) - w0).toBe(0);
  return r;
}

describe('FR-043 / SC-013 duplicate ids in an import file reject the whole file', () => {
  it('control: the v0.1 attempt alone imports (its original hash is valid)', async () => {
    const { ctx, exp, v01 } = await setup('a1000001');
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf({ ...exp, attempts: [v01] }));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });

  it('exploit: v0.1 attempt X + current-format attempt X with payloadHash 0…0 is rejected, nothing written', async () => {
    const { ctx, exp, v01, forged } = await setup('a1000002');
    await expectRejectedNoWrites(ctx, { ...exp, attempts: [v01, forged] });
  });

  it('exploit, reversed order: forged attempt first, then the v0.1 attempt', async () => {
    const { ctx, exp, v01, forged } = await setup('a1000003');
    await expectRejectedNoWrites(ctx, { ...exp, attempts: [forged, v01] });
  });

  it('two current-format attempts with the same id (both with valid hashes) are rejected', async () => {
    const { ctx, exp, forged } = await setup('a1000004');
    const { payloadHash: _h, ...rest } = forged as Raw;
    const a = hashed(rest);
    const b = hashed({ ...rest, responseMs: 2 });
    await expectRejectedNoWrites(ctx, { ...exp, attempts: [a, b] });
  });

  it('two instruments with the same id are rejected', async () => {
    const { ctx, exp } = await setup('a1000005');
    const inst = exp.instruments[0]!;
    await expectRejectedNoWrites(ctx, { ...exp, instruments: [inst, { ...inst, name: 'Twin' }] });
  });
});
