/**
 * Gate round 1 red tests, T006 [FR-019] (code-reviewer #1): read-time migration of profileSettings
 * through FretSenseApp.bootstrap(), and mergeSettings carrying max(schemaVersion).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FretSenseApp } from './app';
import type { DeviceMeta, Hasher, IdGenerator, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { mergeSettings } from '../domain/merge';
import type { ProfileSettingsRecord } from '../domain/records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const H2 = `2026-11-22T12:00:05.000Z-0000-${W}`;
const P = '11111111-1111-4111-8111-111111111111';
const U = (n: number) => `${n.toString(16).padStart(8, '0')}-2222-4222-8222-222222222222`;
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const sha: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const ids = (): IdGenerator => { let i = 0; return { uuid: () => `f0000000-0000-4000-8000-${(++i).toString(16).padStart(12, '0')}` }; };

const v1: any = {
  id: U(8), localProfileId: P, created: H1, updated: H1, schemaVersion: 1, deleted: false,
  fieldUpdated: { activeInstrumentId: H1, octaveMode: H1, adaptiveWeighting: H1, stagePreference: H1, activePackId: H1, display: H1, explorer: H1, autoAdvanceMs: H1 },
  activeInstrumentId: null, octaveMode: 'exact', adaptiveWeighting: false, stagePreference: ['drill', 'read'], activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'left', labelMode: 'notes', textSize: 3, fretSpacing: 'uniform', theme: 'dark' },
  explorer: { root: 'D', kind: 'scale', typeId: 'dorian' }, autoAdvanceMs: 1500,
};

describe('[T006][FR-019] bootstrap reads settings as v2', () => {
  it('a stored v1 settings record reads as schemaVersion 2, every other field identical', async () => {
    const repo = memoryRepository();
    const profile = { id: P, localProfileId: P, created: H1, updated: H1, schemaVersion: 1, deleted: false, displayName: 'Me' };
    const meta: DeviceMeta = { deviceId: 'd', writerIds: { [P]: W }, hlc: { wall: T0, counter: 0 } };
    await repo.write([{ store: 'localProfiles', record: profile }, { store: 'profileSettings', record: v1 }] as unknown as WriteOp[], meta);
    const app = new FretSenseApp(repo, { now: () => T0 }, ids(), sha);
    await app.bootstrap();
    expect(app.getState().settings).toEqual({ ...v1, schemaVersion: 2 });
  });

  it("a brand-new profile's settings are schemaVersion 2", async () => {
    const app = new FretSenseApp(memoryRepository(), { now: () => T0 }, ids(), sha);
    await app.bootstrap();
    expect(app.getState().settings!.schemaVersion).toBe(2);
  });
});

describe('[T006][FR-019] mergeSettings schemaVersion', () => {
  const rec = (o: object): ProfileSettingsRecord => ({ ...structuredClone(v1), ...o }) as ProfileSettingsRecord;
  const written = (r: ReturnType<typeof mergeSettings>) => { if (r.kind !== 'write') throw new Error(`expected write, got ${r.kind}`); return r.record as any; };

  it('v1 local + v2 incoming carrying activePathId merges to schemaVersion 2 with activePathId', () => {
    const incoming = rec({ schemaVersion: 2, activePathId: U(50), fieldUpdated: { ...v1.fieldUpdated, activePathId: H2 } });
    const out = written(mergeSettings(rec({}), incoming));
    expect(out.schemaVersion).toBe(2);
    expect(out.activePathId).toBe(U(50));
    expect(out.fieldUpdated.activePathId).toBe(H2);
  });

  it('v2 local + v1 incoming with a newer field keeps schemaVersion 2', () => {
    const local = rec({ schemaVersion: 2 });
    const incoming = rec({ octaveMode: 'any', fieldUpdated: { ...v1.fieldUpdated, octaveMode: H2 } });
    const out = written(mergeSettings(local, incoming));
    expect(out.schemaVersion).toBe(2);
    expect(out.octaveMode).toBe('any');
  });

  it('v1 + v1 stays schemaVersion 1', () => {
    const incoming = rec({ octaveMode: 'any', fieldUpdated: { ...v1.fieldUpdated, octaveMode: H2 } });
    expect(written(mergeSettings(rec({}), incoming)).schemaVersion).toBe(1);
  });
});
