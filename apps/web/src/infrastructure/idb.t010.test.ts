/**
 * T010 (red, test-first): IndexedDB v2 [FR-019, FR-020; research R2 "Upgrade safety"].
 * fake-indexeddb is already a devDependency and is loaded globally by src/test-setup.ts.
 *
 * Seams chosen (stub signatures the implementation must provide):
 *   openIdbRepository(name = 'fretsense', handlers: {
 *     onBlocked?: (message: string) => void;   // "Close other FretSense tabs to finish updating."
 *     onBlocking?: (message: string) => void;  // "FretSense was updated. Reload to continue."
 *   } = {}): Promise<Repository>
 *   - rejects with an object { kind: 'version', message: string } when the stored DB is NEWER than
 *     the code (VersionError). It never resolves to a memory repository; the fallback decision
 *     stays in main.tsx (composition root), which is not unit-tested here (needs a DOM mount).
 *   - on `blocking` (another tab wants a higher version) the connection is CLOSED, then onBlocking.
 * The "v2 DB opened by v1 code" case of research R2 is exercised from the other side: the stored DB
 * is made newer than the current code (version 3) and the current code must refuse it. Index names
 * are not part of the contract; indexes are looked up by key path.
 */
import { describe, expect, it, vi } from 'vitest';
import { openDB } from 'idb';
import { openIdbRepository } from './idb';

let n = 0;
const dbName = () => `t010-${++n}-${Math.random().toString(36).slice(2)}`;
const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H = `2026-11-22T12:00:00.000Z-0000-${W}`;
const P = '11111111-1111-4111-8111-111111111111';
const common = (id: string) => ({ id, localProfileId: P, created: H, updated: H, schemaVersion: 1, deleted: false });

const profile = { ...common(P), displayName: 'Me' };
const settings = { ...common('22222222-2222-4222-8222-222222222222'), activePackId: 'general-theory' };
const instrument = { ...common('33333333-3333-4333-8333-333333333333'), name: 'Strat' };
const attempt = { ...common('44444444-4444-4444-8444-444444444444'), timestamp: '2026-11-22T12:00:00.000Z', itemKey: 'nf|x|6|7' };
const completion = { ...common('55555555-5555-4555-8555-555555555555'), lessonId: 'notes-on-the-neck', stages: { read: H } };
const META = { deviceId: 'dev', writerIds: { [P]: W }, hlc: { wall: 5, counter: 1 } };

/** Builds a database with the exact v1 layout of the shipped v0.1 build (data-model v1 / idb.ts at HEAD). */
async function buildV1(name: string) {
  const db = await openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore('meta');
      d.createObjectStore('localProfiles', { keyPath: 'id' });
      d.createObjectStore('profileSettings', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId', { unique: true });
      d.createObjectStore('instruments', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId');
      const a = d.createObjectStore('attempts', { keyPath: 'id' });
      a.createIndex('byTime', ['localProfileId', 'timestamp']);
      a.createIndex('byItem', ['localProfileId', 'itemKey']);
      d.createObjectStore('lessonCompletion', { keyPath: 'id' }).createIndex('byLesson', ['localProfileId', 'lessonId'], { unique: true });
    },
  });
  await db.put('localProfiles', profile);
  await db.put('profileSettings', settings);
  await db.put('instruments', instrument);
  await db.put('attempts', attempt);
  await db.put('lessonCompletion', completion);
  await db.put('meta', META, 'device');
  db.close();
}

type IndexInfo = { keyPath: string | string[]; unique: boolean };
async function inspect(name: string) {
  const db = await openDB(name);
  const out: Record<string, IndexInfo[]> = {};
  const tx = db.transaction([...db.objectStoreNames], 'readonly');
  for (const s of db.objectStoreNames) {
    const st = tx.objectStore(s);
    out[s] = [...st.indexNames].map((i) => ({ keyPath: st.index(i).keyPath as string | string[], unique: st.index(i).unique }));
  }
  const version = db.version;
  db.close();
  return { stores: out, version };
}
const has = (idx: IndexInfo[], keyPath: string | string[], unique?: boolean) =>
  idx.some((i) => JSON.stringify(i.keyPath) === JSON.stringify(keyPath) && (unique === undefined || i.unique === unique));

describe('[T010][FR-019] v1 database upgrades to v2', () => {
  it('keeps every v1 record and the device meta intact', async () => {
    const name = dbName();
    await buildV1(name);
    const repo = await openIdbRepository(name);
    expect(await repo.loadMeta()).toEqual(META);
    expect((await repo.listProfiles()).map((p) => p.id)).toEqual([P]);
    const d = (await repo.loadProfile(P))! as any;
    expect(d.profile).toEqual(profile);
    expect(d.settings).toEqual(settings);
    expect(d.instruments).toEqual([instrument]);
    expect(d.attempts).toEqual([attempt]);
    expect(d.completion).toEqual([completion]);
    expect(d.gear).toEqual([]);
    expect(d.paths).toEqual([]);
    expect(d.pathItems).toEqual([]);
    expect(d.packs).toEqual([]);
    expect(d.onboarding).toBeUndefined();
  });

  it('creates the v2 stores and indexes (R2, data-model §2) and bumps the version to 2', async () => {
    const name = dbName();
    await buildV1(name);
    await openIdbRepository(name);
    const { stores, version } = await inspect(name);
    expect(version).toBe(2);
    expect(Object.keys(stores).sort()).toEqual(
      ['attempts', 'gear', 'instruments', 'lessonCompletion', 'localProfiles', 'meta', 'onboarding', 'packs', 'pathItems', 'paths', 'profileSettings'],
    );
    for (const s of ['instruments', 'lessonCompletion', 'gear', 'paths', 'pathItems', 'packs']) {
      expect(has(stores[s]!, 'localProfileId'), `${s} localProfileId index`).toBe(true);
    }
    expect(has(stores.onboarding!, 'localProfileId', true), 'onboarding localProfileId unique').toBe(true);
    expect(has(stores.pathItems!, 'pathId'), 'pathItems pathId').toBe(true);
    expect(has(stores.packs!, ['localProfileId', 'packId']), 'packs [localProfileId, packId]').toBe(true);
    // v1 indexes survive.
    expect(has(stores.profileSettings!, 'localProfileId', true)).toBe(true);
    expect(has(stores.attempts!, ['localProfileId', 'timestamp'])).toBe(true);
    expect(has(stores.attempts!, ['localProfileId', 'itemKey'])).toBe(true);
    expect(has(stores.lessonCompletion!, ['localProfileId', 'lessonId'], true)).toBe(true);
  });

  it('a fresh database opens at v2 with the same stores', async () => {
    const name = dbName();
    await openIdbRepository(name);
    const { stores, version } = await inspect(name);
    expect(version).toBe(2);
    expect(Object.keys(stores)).toContain('pathItems');
    expect(has(stores.instruments!, 'localProfileId')).toBe(true);
  });

  it('re-opening an upgraded database is a no-op and keeps data', async () => {
    const name = dbName();
    await buildV1(name);
    await openIdbRepository(name);
    const repo = await openIdbRepository(name);
    expect((await repo.loadProfile(P))!.instruments).toEqual([instrument]);
  });

  it('v2 stores accept writes after the upgrade and load back isolated by profile', async () => {
    const name = dbName();
    await buildV1(name);
    const repo = await openIdbRepository(name);
    const g = { ...common('66666666-6666-4666-8666-666666666666'), kind: 'output', name: 'Phones' };
    await repo.write([{ store: 'gear', record: g } as any], META);
    expect(((await repo.loadProfile(P))! as any).gear).toEqual([g]);
  });
});

describe('[T010][FR-019] a database newer than the code', () => {
  it('rejects with a typed version error and never resolves to a memory fallback', async () => {
    const name = dbName();
    await openIdbRepository(name); // v2
    const newer = await openDB(name, 3); // a future build upgraded it
    newer.close();
    await expect(openIdbRepository(name)).rejects.toMatchObject({ kind: 'version' });
  });

  it('the rejection carries a readable message', async () => {
    const name = dbName();
    await openDB(name, 3).then((d) => d.close());
    const err = await openIdbRepository(name).then(() => undefined, (e: unknown) => e as { kind: string; message: string });
    expect(err?.kind).toBe('version');
    expect(typeof err?.message).toBe('string');
    expect(err!.message.length).toBeGreaterThan(0);
  });
});

describe('[T010][FR-020] blocking and blocked handlers', () => {
  it('blocking: closes the connection and reports "FretSense was updated. Reload to continue."', async () => {
    const name = dbName();
    const onBlocking = vi.fn();
    const repo = await openIdbRepository(name, { onBlocking });
    // Another tab upgrades; it can only proceed if our connection closes itself.
    const other = await openDB(name, 3);
    expect(onBlocking).toHaveBeenCalledWith('FretSense was updated. Reload to continue.');
    other.close();
    await expect(repo.loadMeta()).rejects.toBeDefined(); // the old connection is closed
  });

  it('blocked: reports "Close other FretSense tabs to finish updating." and then completes once the other tab closes', async () => {
    const name = dbName();
    await buildV1(name);
    const holder = await openDB(name, 1); // an old tab that does not close
    const onBlocked = vi.fn();
    const opening = openIdbRepository(name, { onBlocked });
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledWith('Close other FretSense tabs to finish updating.'));
    holder.close();
    const repo = await opening;
    expect((await repo.loadProfile(P))!.instruments).toEqual([instrument]);
  });
});

describe('[T010][FR-019] gate r1: DbOpenError is a real Error subclass', () => {
  it('a newer database rejects with an instanceof DbOpenError (an Error) whose kind is "version"', async () => {
    const { DbOpenError } = await import('./idb');
    const name = dbName();
    await openDB(name, 3).then((d) => d.close());
    const err = await openIdbRepository(name).then(() => undefined, (e: unknown) => e);
    expect(err).toBeInstanceOf(DbOpenError);
    expect(err).toBeInstanceOf(Error);
    expect((err as { kind: string }).kind).toBe('version');
  });
  it('isDbOpenError is false for a plain object that merely looks like one', async () => {
    const { isDbOpenError } = await import('./idb');
    expect(isDbOpenError({ kind: 'version', message: 'x' })).toBe(false);
    expect(isDbOpenError(new Error('x'))).toBe(false);
    expect(isDbOpenError(undefined)).toBe(false);
  });
});
