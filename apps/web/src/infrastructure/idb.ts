import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { RECORD_STORES, STORES, type DeviceMeta, type ProfileData, type Repository, type StoreName, type WriteOp } from '../application/ports';
import type { LocalProfileRecord } from '../domain/records';

/** IndexedDB database `fretsense` v2 (001 data-model §3, ADR-0008; 016 research R2: additive over v1). */
export const DB_VERSION = 2;
export const UPDATED_MESSAGE = 'FretSense was updated. Reload to continue.';
export const BLOCKED_MESSAGE = 'Close other FretSense tabs to finish updating.';

/** Why the database could not open; `version` means newer data than this code (reload, never fall back). */
export class DbOpenError extends Error {
  constructor(readonly kind: 'version' | 'unavailable', message: string) {
    super(message);
    this.name = 'DbOpenError';
  }
}
export const isDbOpenError = (e: unknown): e is DbOpenError => e instanceof DbOpenError;

export interface DbHandlers {
  /** Another tab still holds an older version open, so this upgrade waits. */
  onBlocked?: (message: string) => void;
  /** A newer version wants to open: this connection has been closed and the page must reload. */
  onBlocking?: (message: string) => void;
}


// Upgrade transactions are typed loosely by idb without a schema type.
type UpgradeTx = IDBPTransaction<unknown, ArrayLike<string>, 'versionchange'>;

function upgrade(d: IDBPDatabase, oldVersion: number, tx: UpgradeTx) {
  if (oldVersion < 1) {
    d.createObjectStore('meta');
    d.createObjectStore('localProfiles', { keyPath: 'id' });
    d.createObjectStore('profileSettings', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId', { unique: true });
    d.createObjectStore('instruments', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId');
    const a = d.createObjectStore('attempts', { keyPath: 'id' });
    a.createIndex('byTime', ['localProfileId', 'timestamp']);
    a.createIndex('byItem', ['localProfileId', 'itemKey']);
    d.createObjectStore('lessonCompletion', { keyPath: 'id' }).createIndex('byLesson', ['localProfileId', 'lessonId'], { unique: true });
  }
  if (oldVersion < 2) {
    // Additive only: no v1 record is rewritten inside the version-change transaction (R2).
    const lc = tx.objectStore('lessonCompletion');
    if (!lc.indexNames.contains('localProfileId')) lc.createIndex('localProfileId', 'localProfileId');
    const inst = tx.objectStore('instruments');
    if (!inst.indexNames.contains('localProfileId')) inst.createIndex('localProfileId', 'localProfileId');
    d.createObjectStore('gear', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId');
    d.createObjectStore('onboarding', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId', { unique: true });
    d.createObjectStore('paths', { keyPath: 'id' }).createIndex('localProfileId', 'localProfileId');
    const pi = d.createObjectStore('pathItems', { keyPath: 'id' });
    pi.createIndex('localProfileId', 'localProfileId');
    pi.createIndex('pathId', 'pathId');
    const pk = d.createObjectStore('packs', { keyPath: 'id' });
    pk.createIndex('localProfileId', 'localProfileId');
    pk.createIndex('packId', ['localProfileId', 'packId']);
  }
}

export async function openIdbRepository(name = 'fretsense', handlers: DbHandlers = {}): Promise<Repository> {
  let db: IDBPDatabase;
  try {
    db = await openDB(name, DB_VERSION, {
      upgrade: (d, oldVersion, _newVersion, tx) => upgrade(d, oldVersion, tx as unknown as UpgradeTx),
      blocked: () => handlers.onBlocked?.(BLOCKED_MESSAGE),
      blocking: () => {
        db.close();
        handlers.onBlocking?.(UPDATED_MESSAGE);
      },
    });
  } catch (e) {
    // Old cached code, newer database: never fall back silently to memory (R2).
    if (e instanceof DOMException && e.name === 'VersionError') throw new DbOpenError('version', UPDATED_MESSAGE);
    throw new DbOpenError('unavailable', e instanceof Error ? e.message : String(e));
  }

  /** Every [id, anything] key: arrays sort above every other key type, so [id] < [id, x] < [id, []]. */
  const range = (id: string) => IDBKeyRange.bound([id], [id, []]);
  /**
   * How each record store lists one profile's keys (016 FR-003, R13). Typed over StoreName, so a store
   * added to RECORD_STORES without an entry here is a compile error and "Erase permanently" can't miss it.
   */
  type Tx = IDBPTransaction<unknown, string[], 'readwrite'>;
  const PROFILE_KEYS: { [S in StoreName]: (tx: Tx, id: string) => Promise<IDBValidKey[]> } = {
    localProfiles: async (tx, id) => ((await tx.objectStore('localProfiles').getKey(id)) !== undefined ? [id] : []),
    profileSettings: (tx, id) => tx.objectStore('profileSettings').index('localProfileId').getAllKeys(id),
    instruments: (tx, id) => tx.objectStore('instruments').index('localProfileId').getAllKeys(id),
    attempts: (tx, id) => tx.objectStore('attempts').index('byTime').getAllKeys(range(id)),
    lessonCompletion: (tx, id) => tx.objectStore('lessonCompletion').index('localProfileId').getAllKeys(id),
    gear: (tx, id) => tx.objectStore('gear').index('localProfileId').getAllKeys(id),
    onboarding: (tx, id) => tx.objectStore('onboarding').index('localProfileId').getAllKeys(id),
    paths: (tx, id) => tx.objectStore('paths').index('localProfileId').getAllKeys(id),
    pathItems: (tx, id) => tx.objectStore('pathItems').index('localProfileId').getAllKeys(id),
    packs: (tx, id) => tx.objectStore('packs').index('localProfileId').getAllKeys(id),
  };
  return {
    durable: true,
    loadMeta: async () => (await db.get('meta', 'device')) as DeviceMeta | undefined,
    listProfiles: async () => (await db.getAll('localProfiles')) as LocalProfileRecord[],
    async loadProfile(id) {
      const tx = db.transaction([...RECORD_STORES], 'readonly');
      const profile = await tx.objectStore('localProfiles').get(id);
      if (!profile) return undefined;
      const byProfile = (s: Exclude<StoreName, 'attempts' | 'localProfiles'>) => tx.objectStore(s).index('localProfileId').getAll(id);
      const [settings, instruments, attempts, completion, gear, onboarding, paths, pathItems, packs] = await Promise.all([
        tx.objectStore('profileSettings').index('localProfileId').get(id),
        byProfile('instruments'),
        tx.objectStore('attempts').index('byTime').getAll(range(id)),
        byProfile('lessonCompletion'),
        byProfile('gear'),
        tx.objectStore('onboarding').index('localProfileId').get(id),
        byProfile('paths'),
        byProfile('pathItems'),
        byProfile('packs'),
      ]);
      return { profile, settings, instruments, attempts, completion, gear, onboarding, paths, pathItems, packs } as ProfileData;
    },
    async write(ops: readonly WriteOp[], meta: DeviceMeta) {
      const tx = db.transaction([...STORES], 'readwrite');
      for (const op of ops) void tx.objectStore(op.store).put(op.record);
      void tx.objectStore('meta').put(meta, 'device');
      await tx.done;
    },
    async purgeProfile(id, meta) {
      const tx = db.transaction([...STORES], 'readwrite') as unknown as Tx;
      const keys = await Promise.all(RECORD_STORES.map(async (s) => [s, await PROFILE_KEYS[s](tx, id)] as const));
      for (const [s, ks] of keys) for (const k of ks) void tx.objectStore(s).delete(k);
      void tx.objectStore('meta').put(meta, 'device');
      await tx.done;
    },
    async findForeignIds(store, ids, localProfileId) {
      if (!ids.length) return [];
      const tx = db.transaction(store, 'readonly');
      const found = await Promise.all(ids.map((i) => tx.objectStore(store).get(i) as Promise<{ localProfileId?: string } | undefined>));
      await tx.done;
      return ids.filter((_, n) => found[n] && found[n]!.localProfileId !== localProfileId);
    },
  };
}

/** Fallback when IndexedDB is unavailable: the app stays usable; progress isn't saved (Edge Cases). */
export function memoryRepository(): Repository {
  let meta: DeviceMeta | undefined;
  const stores = new Map<string, Map<string, { id: string; localProfileId?: string }>>(RECORD_STORES.map((s) => [s, new Map()]));
  const all = (s: string) => [...stores.get(s)!.values()];
  return {
    durable: false,
    loadMeta: async () => meta,
    listProfiles: async () => all('localProfiles') as LocalProfileRecord[],
    async loadProfile(id) {
      const profile = stores.get('localProfiles')!.get(id);
      if (!profile) return undefined;
      const mine = (s: string) => all(s).filter((r) => r.localProfileId === id).map((r) => structuredClone(r));
      return {
        profile, settings: mine('profileSettings')[0], instruments: mine('instruments'), attempts: mine('attempts'), completion: mine('lessonCompletion'),
        gear: mine('gear'), onboarding: mine('onboarding')[0], paths: mine('paths'), pathItems: mine('pathItems'), packs: mine('packs'),
      } as unknown as ProfileData;
    },
    async write(ops, m) {
      for (const op of ops) stores.get(op.store)!.set(op.record.id, structuredClone(op.record));
      meta = structuredClone(m);
    },
    async purgeProfile(id, m) {
      for (const [s, recs] of stores) for (const [k, r] of recs) if (r.localProfileId === id || (s === 'localProfiles' && k === id)) recs.delete(k);
      meta = structuredClone(m);
    },
    async findForeignIds(store, ids, localProfileId) {
      const recs = stores.get(store)!;
      return ids.filter((i) => { const r = recs.get(i); return !!r && r.localProfileId !== localProfileId; });
    },
  };
}
