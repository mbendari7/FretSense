import { openDB, type IDBPDatabase } from 'idb';
import type { DeviceMeta, ProfileData, Repository, WriteOp } from '../application/ports';
import type { LocalProfileRecord } from '../domain/records';

/** IndexedDB database `fretsense` v1 (data-model §3, ADR-0008). */
const STORES = ['localProfiles', 'profileSettings', 'instruments', 'attempts', 'lessonCompletion'] as const;

export async function openIdbRepository(name = 'fretsense'): Promise<Repository> {
  const db: IDBPDatabase = await openDB(name, 1, {
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
  return {
    durable: true,
    loadMeta: async () => (await db.get('meta', 'device')) as DeviceMeta | undefined,
    listProfiles: async () => (await db.getAll('localProfiles')) as LocalProfileRecord[],
    async loadProfile(id) {
      const tx = db.transaction([...STORES], 'readonly');
      const profile = await tx.objectStore('localProfiles').get(id);
      if (!profile) return undefined;
      const byProfile = (s: (typeof STORES)[number]) => tx.objectStore(s).getAll();
      const [settings, instruments, attempts, completion] = await Promise.all([
        tx.objectStore('profileSettings').index('localProfileId').get(id),
        byProfile('instruments'),
        tx.objectStore('attempts').index('byTime').getAll(IDBKeyRange.bound([id, ''], [id, '\uffff'])),
        byProfile('lessonCompletion'),
      ]);
      const mine = <T extends { localProfileId: string }>(xs: T[]) => xs.filter((x) => x.localProfileId === id);
      return { profile, settings, instruments: mine(instruments), attempts, completion: mine(completion) } as ProfileData;
    },
    async write(ops: readonly WriteOp[], meta: DeviceMeta) {
      const tx = db.transaction(['meta', ...STORES], 'readwrite');
      for (const op of ops) void tx.objectStore(op.store).put(op.record);
      void tx.objectStore('meta').put(meta, 'device');
      await tx.done;
    },
  };
}

/** Fallback when IndexedDB is unavailable: the app stays usable; progress isn't saved (Edge Cases). */
export function memoryRepository(): Repository {
  let meta: DeviceMeta | undefined;
  const stores = new Map<string, Map<string, { id: string; localProfileId?: string }>>(STORES.map((s) => [s, new Map()]));
  const all = (s: string) => [...stores.get(s)!.values()];
  return {
    durable: false,
    loadMeta: async () => meta,
    listProfiles: async () => all('localProfiles') as LocalProfileRecord[],
    async loadProfile(id) {
      const profile = stores.get('localProfiles')!.get(id);
      if (!profile) return undefined;
      const mine = (s: string) => all(s).filter((r) => r.localProfileId === id);
      return { profile, settings: mine('profileSettings')[0], instruments: mine('instruments'), attempts: mine('attempts'), completion: mine('lessonCompletion') } as unknown as ProfileData;
    },
    async write(ops, m) {
      for (const op of ops) stores.get(op.store)!.set(op.record.id, structuredClone(op.record));
      meta = structuredClone(m);
    },
  };
}
