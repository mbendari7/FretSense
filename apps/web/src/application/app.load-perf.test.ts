/**
 * perf-auditor T095 + T093a r1, MAJOR 1 (regression guard) [FR-043, FR-066a; T093a].
 *
 * Finding: "`migrateStored` zod-parsed every attempt on every load and reload, then threw the result
 * away: 350–450 ms of main thread at 50k attempts." The applied fix pre-checks with `isV01Attempt`,
 * so current-shape records skip migration (and its schema parse) entirely. This test pins that:
 * loading a profile that holds 50,000 current-shape attempts never calls `migrateAttempt`, on first
 * load and on a second load of the same repository. It also checks that a v0.1 record still goes
 * through migration (so the guard cannot pass by never migrating anything).
 *
 * The attempts are hand-built current-shape records (same shape as merge.rule6.test.ts), written
 * straight into memoryRepository(). No timing is asserted (that is perf-auditor's bench, T057).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import type { AttemptRecord } from '../domain/records';
import * as migrate from '../domain/migrate';

vi.mock('../domain/migrate', async (importOriginal) => {
  const real = await importOriginal<typeof import('../domain/migrate')>();
  return { ...real, migrateAttempt: vi.fn(real.migrateAttempt) };
});

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
const idsWith = (prefix: string): IdGenerator => { let n = 0; return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` }; };
const N = 50_000;
const uuid = (i: number) => `${(0x10000000 + i).toString(16)}-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
const HLC = (sec: number) => `${new Date(Date.UTC(2026, 10, 22, 12) + sec * 1000).toISOString()}-0000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

function current(pid: string, i: number): AttemptRecord {
  return {
    id: uuid(i), localProfileId: pid, created: HLC(i % 1000), updated: HLC(i % 1000), schemaVersion: 1, deleted: false,
    drillType: 'note-finding', instrumentId: null, geometryId: 'guitar:E2-A2-D3-G3-B3-E4', modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }],
    outcome: 'correct', responseMs: 800, timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null,
    itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7', payloadHash: 'a'.repeat(64),
  } as AttemptRecord;
}

afterEach(() => vi.mocked(migrate.migrateAttempt).mockClear());

describe('perf-auditor MAJOR 1: loading current-shape attempts never runs the v0.1 migration', () => {
  it(`${N} current-shape attempts: bootstrap (first load and a reload of the same repository) never calls migrateAttempt`, async () => {
    const repo = memoryRepository();
    let t = Date.UTC(2026, 10, 22, 12);
    const first = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith('f0f0f0f0'), sha256);
    await first.bootstrap();
    const pid = first.getState().profile!.id;
    const meta = await repo.loadMeta();
    await repo.write(Array.from({ length: N }, (_, i) => ({ store: 'attempts' as const, record: current(pid, i) })), meta!);
    vi.mocked(migrate.migrateAttempt).mockClear();

    const a = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith('f1f1f1f1'), sha256);
    await a.bootstrap();
    expect(a.getState().attempts).toHaveLength(N);
    const b = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith('f2f2f2f2'), sha256);
    await b.bootstrap();
    expect(b.getState().attempts).toHaveLength(N);
    expect(migrate.migrateAttempt).not.toHaveBeenCalled();
  }, 60_000);

  it('control: a v0.1 attempt (drill type bass-arpeggio) on load does go through migrateAttempt', async () => {
    const repo = memoryRepository();
    let t = Date.UTC(2026, 10, 22, 12);
    const first = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith('f3f3f3f3'), sha256);
    await first.bootstrap();
    const pid = first.getState().profile!.id;
    const old = {
      ...current(pid, 1), drillType: 'bass-arpeggio',
      prompt: { drillType: 'bass-arpeggio', root: { string: 4, fret: 5 }, qualityId: 'minor' }, itemKey: 'bs|bass-arpeggio|minor',
    } as unknown as AttemptRecord;
    await repo.write([{ store: 'attempts', record: old }, ...Array.from({ length: 10 }, (_, i) => ({ store: 'attempts' as const, record: current(pid, 100 + i) }))], (await repo.loadMeta())!);
    vi.mocked(migrate.migrateAttempt).mockClear();
    const a = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith('f4f4f4f4'), sha256);
    await a.bootstrap();
    expect(migrate.migrateAttempt).toHaveBeenCalledTimes(1);
  });
});
