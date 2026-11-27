/**
 * T009 (red, test-first): Repository port v2 [FR-001, FR-003, FR-020; research R13].
 * Run against memoryRepository() AND the IndexedDB repository (fake-indexeddb, test-setup.ts), so
 * both implementations obey one contract. Expected values come from data-model.md §2 / "Erase
 * permanently" and personalisation research R13.
 *
 * Seams chosen (stub signatures the implementation must provide):
 *   ports.ts      export const STORES: readonly [...]  // meta + every v2 store, one constant
 *   Repository    purgeProfile(localProfileId: string, meta: DeviceMeta): Promise<void>
 *                 findForeignIds(store: StoreName, ids: readonly string[], localProfileId: string): Promise<string[]>
 *   ProfileData   gains gear: GearRecord[]; onboarding: OnboardingRecord | undefined;
 *                 paths: PathRecord[]; pathItems: PathItemRecord[]; packs: UserPackRecord[]
 *   WriteOp       accepts { store: 'gear' | 'onboarding' | 'paths' | 'pathItems' | 'packs', record }
 */
import { describe, expect, it } from 'vitest';
import { STORES, type DeviceMeta, type Repository, type WriteOp } from './ports';
import { memoryRepository, openIdbRepository } from '../infrastructure/idb';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H = `2026-11-22T12:00:00.000Z-0000-${W}`;
const A = 'a0000000-0000-4000-8000-00000000000a';
const B = 'b0000000-0000-4000-8000-00000000000b';
const meta = (tag: string): DeviceMeta => ({ deviceId: `dev-${tag}`, writerIds: { [A]: W, [B]: W }, hlc: { wall: 1, counter: 0 } });

const DATA_STORES = ['profileSettings', 'instruments', 'attempts', 'lessonCompletion', 'gear', 'onboarding', 'paths', 'pathItems', 'packs'] as const;
let n = 0;
const rec = (store: string, profile: string, extra: object = {}) => ({
  id: `${store.length.toString(16).padStart(2, '0')}${(++n).toString(16).padStart(6, '0')}-0000-4000-8000-${profile.slice(0, 12)}`.slice(0, 36),
  localProfileId: profile, created: H, updated: H, schemaVersion: 1, deleted: false,
  ...(store === 'attempts' ? { timestamp: '2026-11-22T12:00:00.000Z', itemKey: 'nf|x|1|0' } : {}),
  ...(store === 'lessonCompletion' ? { lessonId: `lesson-${n}` } : {}),
  ...(store === 'pathItems' ? { pathId: 'p' } : {}),
  ...(store === 'packs' ? { packId: `pack-${n}` } : {}),
  ...extra,
});
const profileRec = (id: string) => ({ id, localProfileId: id, created: H, updated: H, schemaVersion: 1, deleted: false, displayName: id === A ? 'Ann' : 'Bob' });
const ops = (profile: string): WriteOp[] => [
  { store: 'localProfiles', record: profileRec(profile) },
  ...DATA_STORES.map((s) => ({ store: s, record: rec(s, profile) })),
] as unknown as WriteOp[];

let dbn = 0;
const makers: [string, () => Promise<Repository>][] = [
  ['memoryRepository', async () => memoryRepository()],
  ['openIdbRepository', () => openIdbRepository(`t009-${++dbn}-${Math.random()}`)],
];

describe('[T009][FR-001] STORES constant', () => {
  it('lists meta and every v2 store exactly once', () => {
    expect([...STORES].sort()).toEqual([
      'attempts', 'gear', 'instruments', 'lessonCompletion', 'localProfiles', 'meta', 'onboarding', 'packs', 'pathItems', 'paths', 'profileSettings',
    ]);
  });
});

describe.each(makers)('[T009] Repository v2 over %s', (_name, make) => {
  it('[FR-001] loadProfile returns the v2 stores, isolated per profile', async () => {
    const repo = await make();
    const a = ops(A);
    const b = ops(B);
    await repo.write([...a, ...b], meta('1'));
    const da = (await repo.loadProfile(A))! as any;
    const db = (await repo.loadProfile(B))! as any;
    const idsOf = (o: WriteOp[], s: string) => o.filter((x) => x.store === s).map((x) => (x.record as any).id);
    for (const s of ['gear', 'paths', 'pathItems', 'packs', 'instruments', 'attempts']) {
      const key = s === 'attempts' ? 'attempts' : s;
      expect(da[key].map((r: any) => r.id), `${s} of A`).toEqual(idsOf(a, s));
      expect(db[key].map((r: any) => r.id), `${s} of B`).toEqual(idsOf(b, s));
    }
    expect(da.onboarding.id).toBe(idsOf(a, 'onboarding')[0]);
    expect(db.onboarding.id).toBe(idsOf(b, 'onboarding')[0]);
    expect(da.settings.id).toBe(idsOf(a, 'profileSettings')[0]);
    expect(da.completion.map((r: any) => r.id)).toEqual(idsOf(a, 'lessonCompletion'));
  });

  it('[FR-001] a profile with no v2 records loads empty arrays and no onboarding', async () => {
    const repo = await make();
    await repo.write([{ store: 'localProfiles', record: profileRec(A) } as unknown as WriteOp], meta('1'));
    const d = (await repo.loadProfile(A))! as any;
    expect([d.gear, d.paths, d.pathItems, d.packs]).toEqual([[], [], [], []]);
    expect(d.onboarding).toBeUndefined();
  });

  it('[FR-003] purgeProfile removes every record of that profile in every store and the profile record, and writes meta', async () => {
    const repo = await make();
    await repo.write([...ops(A), ...ops(B)], meta('1'));
    await repo.purgeProfile(A, meta('after-purge'));

    expect((await repo.listProfiles()).map((p) => p.id)).toEqual([B]);
    expect(await repo.loadProfile(A)).toBeUndefined();
    expect(await repo.loadMeta()).toEqual(meta('after-purge'));

    // Orphan check: re-add only the profile record; nothing else may reappear under A.
    await repo.write([{ store: 'localProfiles', record: profileRec(A) } as unknown as WriteOp], meta('2'));
    const d = (await repo.loadProfile(A))! as any;
    expect([d.instruments, d.attempts, d.completion, d.gear, d.paths, d.pathItems, d.packs]).toEqual([[], [], [], [], [], [], []]);
    expect(d.settings).toBeUndefined();
    expect(d.onboarding).toBeUndefined();

    // The other profile is untouched.
    const db = (await repo.loadProfile(B))! as any;
    expect(db.gear).toHaveLength(1);
    expect(db.pathItems).toHaveLength(1);
    expect(db.attempts).toHaveLength(1);
    expect(db.onboarding).toBeTruthy();
  });

  it('[FR-003] purgeProfile also removes tombstoned records', async () => {
    const repo = await make();
    const dead = [...ops(A)].map((o) => ({ ...o, record: { ...o.record, deleted: true, deletedBy: 'profile' } })) as unknown as WriteOp[];
    await repo.write(dead, meta('1'));
    await repo.purgeProfile(A, meta('2'));
    await repo.write([{ store: 'localProfiles', record: profileRec(A) } as unknown as WriteOp], meta('3'));
    const d = (await repo.loadProfile(A))! as any;
    expect([d.gear, d.paths, d.pathItems, d.packs, d.attempts]).toEqual([[], [], [], [], []]);
  });

  it('[FR-003] purging an unknown profile is a no-op that still writes meta', async () => {
    const repo = await make();
    await repo.write(ops(B), meta('1'));
    await repo.purgeProfile(A, meta('2'));
    expect(await repo.loadMeta()).toEqual(meta('2'));
    expect((await repo.loadProfile(B))).toBeTruthy();
  });

  describe('[FR-020] findForeignIds', () => {
    it('returns ids that exist under a DIFFERENT profile, in any v2 store', async () => {
      const repo = await make();
      const a = ops(A);
      const b = ops(B);
      await repo.write([...a, ...b], meta('1'));
      const idOf = (o: WriteOp[], s: string) => (o.find((x) => x.store === s)!.record as any).id as string;
      for (const s of ['gear', 'paths', 'pathItems', 'packs', 'instruments', 'attempts', 'lessonCompletion'] as const) {
        expect(await repo.findForeignIds(s, [idOf(a, s), idOf(b, s)], A), s).toEqual([idOf(b, s)]);
      }
    });

    it('does not return ids that are unknown or that belong to the same profile; empty input gives []', async () => {
      const repo = await make();
      const a = ops(A);
      await repo.write(a, meta('1'));
      const own = (a.find((x) => x.store === 'paths')!.record as any).id as string;
      expect(await repo.findForeignIds('paths', [own, 'ffffffff-0000-4000-8000-000000000000'], A)).toEqual([]);
      expect(await repo.findForeignIds('paths', [], A)).toEqual([]);
    });

    it('counts tombstoned records of another profile', async () => {
      const repo = await make();
      const b = ops(B).map((o) => ({ ...o, record: { ...o.record, deleted: true, deletedBy: 'user' } })) as unknown as WriteOp[];
      await repo.write(b, meta('1'));
      const id = (b.find((x) => x.store === 'gear')!.record as any).id as string;
      expect(await repo.findForeignIds('gear', [id], A)).toEqual([id]);
    });

    it('checks only the named store (an id in another store does not match)', async () => {
      const repo = await make();
      const b = ops(B);
      await repo.write(b, meta('1'));
      const gearId = (b.find((x) => x.store === 'gear')!.record as any).id as string;
      expect(await repo.findForeignIds('paths', [gearId], A)).toEqual([]);
    });
  });
});

describe('[T009][FR-003] gate r1: purge of malformed attempts (idb)', () => {
  it('purgeProfile removes an attempt whose timestamp is not a string (a raw record bypassing schemas)', async () => {
    const repo = await openIdbRepository(`t009-raw-${Math.random()}`);
    const bad = { ...rec('attempts', A), timestamp: 5 };
    await repo.write([{ store: 'localProfiles', record: profileRec(A) }, { store: 'attempts', record: bad }] as unknown as WriteOp[], meta('1'));
    await repo.purgeProfile(A, meta('2'));
    expect(await repo.findForeignIds('attempts', [bad.id], B)).toEqual([]); // no longer present under any profile
    await repo.write([{ store: 'localProfiles', record: profileRec(A) }] as unknown as WriteOp[], meta('3'));
    expect(((await repo.loadProfile(A))! as any).attempts).toEqual([]);
  });
});

describe('[T009][FR-003] gate r1: purge completeness read directly from IndexedDB (not via loadProfile)', () => {
  it('after purgeProfile no store holds a record of the profile, and the localProfiles record is gone', async () => {
    const { openDB } = await import('idb');
    const { RECORD_STORES } = await import('./ports');
    const name = `t009-direct-${Math.random()}`;
    const repo = await openIdbRepository(name);
    const seeded = RECORD_STORES.map((s) => ({ store: s, record: s === 'localProfiles' ? profileRec(A) : rec(s, A) }));
    const others = RECORD_STORES.map((s) => ({ store: s, record: s === 'localProfiles' ? profileRec(B) : rec(s, B) }));
    await repo.write([...seeded, ...others] as unknown as WriteOp[], meta('1'));
    await repo.purgeProfile(A, meta('2'));

    const db = await openDB(name);
    for (const s of RECORD_STORES) {
      const all = (await db.getAll(s)) as { id: string; localProfileId: string }[];
      expect(all.filter((r) => r.localProfileId === A), `${s} still holds profile A`).toEqual([]);
      expect(all.filter((r) => r.localProfileId === B), `${s} lost profile B`).toHaveLength(1);
    }
    expect(await db.get('localProfiles', A)).toBeUndefined();
    db.close();
  });
});
