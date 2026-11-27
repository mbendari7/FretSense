/**
 * Shared test world for ProfileService (T012, T013). Test-only helper; not a test file.
 *
 * SEAM ASSUMED (stub signatures the implementation must provide; `application/ProfileService.ts`):
 *
 *   export interface ProfileServiceDeps { session: Session; repo: Repository; clock: Clock; ids: IdGenerator }
 *   export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };
 *   export interface ProfileService {
 *     start(): Promise<void>;                              // startup per data-model "Lifecycle": loads meta, picks/creates the active profile, state 'ready'
 *     list(): LocalProfileRecord[] | Promise<...>;         // LIVE profiles only
 *     listDeleted(): Promise<LocalProfileRecord[]>;        // tombstoned profiles (so "Erase permanently" can be offered)
 *     create(name: string): Promise<Result<{ id: string }>>;   // does NOT switch
 *     rename(id: string, name: string): Promise<Result>;
 *     switchTo(id: string): Promise<Result>;               // drains the queue first
 *     delete(id: string): Promise<Result<{ activeId: string }>>;
 *     erase(id: string): Promise<Result<{ activeId: string }>>;
 *   }
 *   export function createProfileService(deps: ProfileServiceDeps): ProfileService;
 *
 * and in ports.ts:  DeviceMeta gains `readonly activeLocalProfileId?: string` (data-model "meta (changed)").
 * `list()` may be sync or async; the tests `await` it.
 */
import { openDB } from 'idb';
import { memoryRepository, openIdbRepository } from '../../infrastructure/idb';
import { createSession, type Session } from '../session';
import type { Clock, DeviceMeta, IdGenerator, Repository, WriteOp } from '../ports';
import { createProfileService } from '../ProfileService';

export type Meta = DeviceMeta & { activeLocalProfileId?: string };
export type Kind = 'memory' | 'idb';
export const KINDS: readonly Kind[] = ['memory', 'idb'];

let n = 0;
export const dbName = () => `t012-${++n}-${Math.random().toString(36).slice(2)}`;

/** Deterministic, uuid-shaped (hex only) ids, offset by `base` so worlds never collide. */
export const makeIds = (base = 0x100): IdGenerator => {
  let i = base;
  return { uuid: () => `00000000-0000-4000-8000-${(++i).toString(16).padStart(12, '0')}` };
};

export const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
export const hlcAt = (wall: number, writer: string, counter = 0) =>
  `${new Date(wall).toISOString()}-${String(counter).padStart(4, '0')}-${writer}`;

export interface World {
  kind: Kind;
  name: string;
  /** The repository the service sees (write / purgeProfile calls are recorded). */
  repo: Repository;
  /** The raw repository underneath (reads that must not be recorded). */
  raw: Repository;
  session: Session;
  svc: ReturnType<typeof createProfileService>;
  writes: { ops: readonly WriteOp[]; meta: DeviceMeta }[];
  purges: { id: string; meta: DeviceMeta }[];
  /** Order of repository mutations: 'write' | 'purge'. */
  events: ('write' | 'purge')[];
  clock: { t: number; now(): number };
  advance(ms?: number): void;
  meta(): Meta;
}

export async function makeWorld(kind: Kind, opts: { dbName?: string; idBase?: number; raw?: Repository } = {}): Promise<World> {
  const name = opts.dbName ?? dbName();
  const raw = opts.raw ?? (kind === 'idb' ? await openIdbRepository(name) : memoryRepository());
  const writes: World['writes'] = [];
  const purges: World['purges'] = [];
  const events: World['events'] = [];
  const repo: Repository = {
    durable: raw.durable,
    loadMeta: () => raw.loadMeta(),
    listProfiles: () => raw.listProfiles(),
    loadProfile: (id) => raw.loadProfile(id),
    findForeignIds: (s, ids, p) => raw.findForeignIds(s, ids, p),
    write: async (ops, meta) => { events.push('write'); writes.push({ ops, meta }); return raw.write(ops, meta); },
    purgeProfile: async (id, meta) => { events.push('purge'); purges.push({ id, meta }); return raw.purgeProfile(id, meta); },
  };
  const clock = { t: T0, now() { return this.t; } };
  const ids = makeIds(opts.idBase);
  const session = createSession({ repo, clock, ids, meta: { deviceId: 'dev-1', writerIds: {}, hlc: { wall: 0, counter: 0 } } });
  const svc = createProfileService({ session, repo, ids });
  return { kind, name, repo, raw, session, svc, writes, purges, events, clock, advance: (ms = 1000) => { clock.t += ms; }, meta: () => session.getMeta() as Meta };
}

/** A world with three profiles: the default ("Me", from start()), "Bo" and "Cy". Active = the default. */
export async function threeProfiles(kind: Kind) {
  const w = await makeWorld(kind);
  await w.svc.start();
  const a = w.session.getState().profile!.id;
  w.advance();
  const b = (await w.svc.create('Bo')) as { ok: true; id: string };
  w.advance();
  const c = (await w.svc.create('Cy')) as { ok: true; id: string };
  w.advance();
  return { w, a, b: b.id, c: c.id };
}

/** Every record id written for a profile, by store (the "expected" side of every isolation check). */
export type Seeded = Record<string, string[]>;

/**
 * Writes one record into each of the ten record stores for profile `pid` (attempts: `attempts` of them),
 * through the shared session so stamps and the commit queue behave as in the app. `tag` makes the content
 * unique, so a leak between profiles is visible by value as well as by id.
 */
export async function seedProfile(w: World, pid: string, tag: string, attempts: number): Promise<Seeded> {
  const c = () => w.session.common(pid);
  const out: Seeded = {};
  const ops: WriteOp[] = [];
  const add = (store: string, rec: Record<string, unknown>) => {
    (out[store] ??= []).push(rec.id as string);
    ops.push({ store, record: rec } as unknown as WriteOp);
  };
  const inst = { ...c(), name: `Inst-${tag}`, profile: { family: 'guitar', tuning: [40, 45, 50, 55, 59, 64], fretCount: 22, stringCount: 6, scaleLengthMm: 648, geometryId: `g-${tag}` } };
  add('instruments', inst);
  for (let i = 0; i < attempts; i++) {
    add('attempts', { ...c(), drillType: 'note-finding', instrumentId: inst.id, timestamp: `2026-11-22T12:0${i}:00.000Z`, itemKey: `nf|n:${tag}|6|${i}`, outcome: i % 2 ? 'incorrect' : 'correct', responseMs: 500 + i, payloadHash: `h-${tag}-${i}` });
  }
  const lc = c();
  add('lessonCompletion', { ...lc, lessonId: `lesson-${tag}`, stages: { read: lc.created } });
  add('gear', { ...c(), kind: 'output', name: `Gear-${tag}` });
  add('onboarding', { ...c(), goals: [], instrumentIds: [inst.id], genres: [], answeredAt: lc.created, fieldUpdated: {} });
  const path = { ...c(), name: `Path-${tag}`, origin: 'manual' };
  add('paths', path);
  add('pathItems', { ...c(), pathId: path.id, ref: { kind: 'lesson', lessonId: `lesson-${tag}` }, reason: '', fallback: false, orderKey: 'V' });
  add('packs', { ...c(), packId: `pack-${tag}`, title: `Pack ${tag}`, sections: [] });
  await w.session.write(ops);
  // The profile's own two records already exist (create / start wrote them); report them too.
  const data = (await w.raw.loadProfile(pid))!;
  out.localProfiles = [data.profile.id];
  if (data.settings) out.profileSettings = [data.settings.id];
  return out;
}

/** Everything the repository holds for a profile, by store, as plain arrays of records. */
export async function dump(w: World, pid: string): Promise<Record<string, unknown[]>> {
  const d = (await w.raw.loadProfile(pid))!;
  return {
    localProfiles: [d.profile], profileSettings: d.settings ? [d.settings] : [], instruments: d.instruments, attempts: d.attempts,
    lessonCompletion: d.completion, gear: d.gear, onboarding: d.onboarding ? [d.onboarding] : [], paths: d.paths, pathItems: d.pathItems, packs: d.packs,
  };
}

/** SC-009 scan: reads EVERY IndexedDB store (keys and values), including `meta`, as raw JSON text. */
export async function scanIdb(name: string): Promise<{ stores: string[]; text: Record<string, string> }> {
  const db = await openDB(name);
  const stores = [...db.objectStoreNames];
  const text: Record<string, string> = {};
  for (const s of stores) {
    const tx = db.transaction(s, 'readonly');
    const [keys, vals] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
    text[s] = JSON.stringify({ keys, vals });
  }
  db.close();
  return { stores, text };
}

/** Pre-existing device data (as a returning user's database), written straight to the repository. */
export async function preseed(w: World, profiles: { id: string; writer: string; name: string; wall: number; deleted?: boolean }[], active?: string) {
  const ops = profiles.flatMap((p) => {
    const t = hlcAt(p.wall, p.writer);
    const common = { localProfileId: p.id, created: t, updated: t, schemaVersion: 1, deleted: !!p.deleted };
    return [
      { store: 'localProfiles', record: { ...common, id: p.id, displayName: p.name } },
      { store: 'profileSettings', record: { ...common, id: p.id.replace(/^./, 'e'), schemaVersion: 2, activePackId: 'general-theory', activeInstrumentId: null } },
    ];
  });
  const meta: Meta = {
    deviceId: 'dev-0', writerIds: Object.fromEntries(profiles.map((p) => [p.id, p.writer])), hlc: { wall: T0, counter: 0 },
    ...(active ? { activeLocalProfileId: active } : {}),
  };
  await w.raw.write(ops as never, meta);
}
