import { parseHlc } from '../domain/hlc';
import { migrateSettings } from '../domain/migrate';
import { localProfileSchema, type AttemptRecord, type Common, type LocalProfileRecord } from '../domain/records';
import { RECORD_STORES, type DeviceMeta, type IdGenerator, type ProfileData, type Repository, type StoreName, type WriteOp } from './ports';
import { DEFAULT_PROFILE_NAME, newProfile, newSettingsRecord } from './profileDefaults';
import type { Session } from './session';

/** Outcome of a user action: ok (with extras) or a plain-language reason (FR-001). */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

export interface ProfileServiceDeps {
  readonly session: Session;
  readonly repo: Repository;
  readonly ids: IdGenerator;
  /** Runs on every profile load (the 001 v0.1 attempt migration), so there is one load path (R13). */
  readonly loadAttempts?: (stored: readonly AttemptRecord[]) => Promise<readonly AttemptRecord[]>;
}

export interface ProfileService {
  /** Startup (data-model lifecycle "Active profile"): loads meta, picks or creates the active profile. */
  start(): Promise<void>;
  /** Live profiles. */
  list(): Promise<LocalProfileRecord[]>;
  /** Tombstoned profiles, so "Erase permanently" can still reach them. */
  listDeleted(): Promise<LocalProfileRecord[]>;
  /** Adds a profile; does not switch to it (the UI switches explicitly). */
  create(name: string): Promise<Result<{ id: string }>>;
  rename(id: string, name: string): Promise<Result>;
  /** Waits for pending saves, then shows only that profile's data (FR-002). */
  switchTo(id: string): Promise<Result>;
  /** Hides the profile and all its live records (deletedBy 'profile') in one transaction (FR-003). */
  delete(id: string): Promise<Result<{ activeId: string }>>;
  /** Removes every record of the profile from every store and meta (FR-003, SC-009). */
  erase(id: string): Promise<Result<{ activeId: string }>>;
}

const fail = (reason: string) => ({ ok: false, reason }) as const;
const nameSchema = localProfileSchema.shape.displayName;

/** NFC first (016 Clarifications: normalised, not rejected), then trim, then the record's name rules. */
function cleanName(raw: string): Result<{ name: string }> {
  const name = raw.normalize('NFC').trim();
  if (!name) return fail('Give the profile a name.');
  if (name.length > 60) return fail('Keep the name to 60 characters or fewer.');
  if (!nameSchema.safeParse(name).success) return fail('Use plain letters, numbers and punctuation in the name.');
  return { ok: true, name };
}

/** When a record was last updated, by time and counter only: the writer id says who, not when. */
const updatedAt = (p: LocalProfileRecord): [number, number] => {
  const h = parseHlc(p.updated);
  return h ? [h.wall, h.counter] : [0, 0];
};
/** Most recently updated live profile, ties broken by lowest id (data-model lifecycle). */
const pickActive = (live: readonly LocalProfileRecord[]): LocalProfileRecord | undefined =>
  [...live].sort((a, b) => {
    const [aw, ac] = updatedAt(a);
    const [bw, bc] = updatedAt(b);
    return bw - aw || bc - ac || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  })[0];

/** The records of one store in a loaded profile, as a list. */
function recordsOf(data: ProfileData, store: Exclude<StoreName, 'localProfiles'>): Common[] {
  const pick: Record<Exclude<StoreName, 'localProfiles'>, unknown> = {
    profileSettings: data.settings, instruments: data.instruments, attempts: data.attempts, lessonCompletion: data.completion,
    gear: data.gear, onboarding: data.onboarding, paths: data.paths, pathItems: data.pathItems, packs: data.packs,
  };
  const v = pick[store];
  return (Array.isArray(v) ? v : v ? [v] : []) as Common[];
}

/** Undoes one action's own change to meta, applied to the meta current at failure time. */
type Undo = (m: DeviceMeta) => DeviceMeta;
/** Removes a writer id this action added (a failed create leaves no ghost writer id). */
const dropWriter = (profileId: string): Undo => (m) => {
  const { [profileId]: _added, ...writerIds } = m.writerIds;
  return { ...m, writerIds };
};
/** Puts the active profile back, but only if it is still the one this action set. */
const undoActive = (setTo: string, prev: string | undefined): Undo => (m) =>
  m.activeLocalProfileId === setTo ? withActive(m, prev !== undefined && m.writerIds[prev] ? prev : undefined) : m;
const both = (a: Undo, b: Undo | undefined): Undo => (b ? (m) => b(a(m)) : a);

/** Meta without a key, so an optional field is absent rather than undefined. */
function withActive(m: DeviceMeta, id: string | undefined): DeviceMeta {
  const { activeLocalProfileId: _old, ...rest } = m;
  return id === undefined ? rest : { ...rest, activeLocalProfileId: id };
}

/**
 * Local profiles (016 US1, T012/T013). Sits on the shared Session (R13), so every action is one
 * ordered commit and stamps stay monotonic across profiles.
 */
export function createProfileService({ session, repo, ids, loadAttempts }: ProfileServiceDeps): ProfileService {
  const live = async () => (await repo.listProfiles()).filter((p) => !p.deleted);

  /** Replaces the whole profile view at once, so no state ever mixes two profiles (SC-001). */
  async function loadInto(profile: LocalProfileRecord): Promise<void> {
    const data = await repo.loadProfile(profile.id);
    session.set({
      status: 'ready',
      durable: repo.durable,
      profile,
      settings: data?.settings ? migrateSettings(data.settings) : newSettingsRecord(session.common(profile.id)),
      instruments: data?.instruments ?? [],
      attempts: loadAttempts ? await loadAttempts(data?.attempts ?? []) : (data?.attempts ?? []),
      completion: data?.completion ?? [],
      error: undefined,
    });
  }

  /** Puts the writer ids and active profile back as they were (the HLC keeps moving forward). */
  function restore(before: DeviceMeta): void {
    session.setMeta(withActive({ ...session.getMeta(), writerIds: before.writerIds }, before.activeLocalProfileId));
  }

  /** Nothing of an erased profile may stay on screen, where a later save could write it back (privacy). */
  function clearView(): void {
    session.set({ profile: undefined, settings: undefined, instruments: [], attempts: [], completion: [] });
  }

  /**
   * Runs a write; on failure undoes only what this action changed in meta, applied to the meta as it
   * is THEN (never a snapshot copied back: an erase that ran meanwhile must stay erased; r3 MINOR).
   */
  async function guarded(undo: Undo | undefined, ops: readonly WriteOp[]): Promise<boolean> {
    try {
      await session.write(ops);
      return true;
    } catch {
      if (undo) session.setMeta(undo(session.getMeta()));
      return false;
    }
  }

  /** Makes `next` active (or a new default when there is none), adding `ops` to the same transaction. */
  async function activate(next: LocalProfileRecord | undefined, ops: WriteOp[]): Promise<Result<{ activeId: string }>> {
    let target = next;
    let added: string | undefined;
    if (!target) {
      const created = newProfile(session, ids, DEFAULT_PROFILE_NAME);
      target = created.profile;
      added = target.id;
      ops.push(...created.ops);
    }
    const prev = session.getMeta().activeLocalProfileId;
    session.setMeta(withActive(session.getMeta(), target.id));
    const undo = both(undoActive(target.id, prev), added ? dropWriter(added) : undefined);
    if (!(await guarded(undo, ops))) return fail('Couldn’t save that change. Try again.');
    await loadInto(target);
    return { ok: true, activeId: target.id };
  }

  return {
    async start() {
      const stored = await repo.loadMeta();
      session.setMeta(stored ?? { deviceId: ids.uuid(), writerIds: {}, hlc: { wall: 0, counter: 0 } });
      const profiles = await live();
      let profile = profiles.find((p) => p.id === stored?.activeLocalProfileId) ?? pickActive(profiles);
      const ops: WriteOp[] = [];
      if (!profile) {
        const created = newProfile(session, ids, DEFAULT_PROFILE_NAME);
        profile = created.profile;
        ops.push(...created.ops);
      }
      // Every live profile gets a writer id now, so rename/delete never meet a missing one (code-reviewer #4).
      const missing = profiles.filter((p) => !session.getMeta().writerIds[p.id]);
      for (const p of missing) {
        const m = session.getMeta();
        session.setMeta({ ...m, writerIds: { ...m.writerIds, [p.id]: ids.uuid() } });
      }
      session.setMeta(withActive(session.getMeta(), profile.id));
      // Persist the fallback choice, new writer ids or a new default profile (one transaction).
      if (!stored || ops.length || missing.length || stored.activeLocalProfileId !== profile.id) await session.write(ops);
      await loadInto(profile);
    },

    list: live,
    async listDeleted() {
      return (await repo.listProfiles()).filter((p) => p.deleted);
    },

    async create(name) {
      const n = cleanName(name);
      if (!n.ok) return n;
      const created = newProfile(session, ids, n.name);
      if (!(await guarded(dropWriter(created.profile.id), created.ops))) return fail('Couldn’t save the new profile. Try again.');
      return { ok: true, id: created.profile.id };
    },

    async rename(id, name) {
      const n = cleanName(name);
      if (!n.ok) return n;
      const p = (await live()).find((x) => x.id === id);
      if (!p) return fail('That profile isn’t on this device.');
      const record: LocalProfileRecord = { ...p, displayName: n.name, updated: session.stamp(id) };
      if (!(await guarded(undefined, [{ store: 'localProfiles', record }]))) return fail('Couldn’t save the new name. Try again.');
      if (session.getState().profile?.id === id) session.set({ profile: record });
      return { ok: true };
    },

    async switchTo(id) {
      await session.drain();
      const p = (await live()).find((x) => x.id === id);
      if (!p) return fail('That profile isn’t on this device.');
      if (session.getMeta().activeLocalProfileId === id && session.getState().profile?.id === id) return { ok: true };
      const prev = session.getMeta().activeLocalProfileId;
      session.setMeta(withActive(session.getMeta(), id));
      if (!(await guarded(undoActive(id, prev), []))) return fail('Couldn’t switch profiles. Try again.');
      await loadInto(p);
      return { ok: true };
    },

    async delete(id) {
      let refused: string | undefined;
      let next: LocalProfileRecord | undefined;
      try {
        // Read, stamp and write inside the queue, so no save can land between the read and the tombstones.
        await session.commit(async () => {
          // Taken here, inside the queue, so a create queued earlier isn't rolled back on failure.
          const before = session.getMeta();
          const profiles = await live();
          const p = profiles.find((x) => x.id === id);
          if (!p) { refused = 'That profile isn’t on this device.'; return; }
          const data = await repo.loadProfile(id);
          const ops: WriteOp[] = [];
          const hide = (store: StoreName, r: Common) => {
            // Records the user already deleted keep their tombstone and stamp (R3: they stay deleted on restore).
            if (r.deleted) return;
            ops.push({ store, record: { ...r, deleted: true, deletedBy: 'profile', updated: session.stamp(id) } } as WriteOp);
          };
          hide('localProfiles', p);
          if (data) for (const s of RECORD_STORES) if (s !== 'localProfiles') for (const r of recordsOf(data, s)) hide(s, r);
          if (session.getMeta().activeLocalProfileId === id) {
            next = pickActive(profiles.filter((x) => x.id !== id));
            if (!next) {
              const created = newProfile(session, ids, DEFAULT_PROFILE_NAME);
              next = created.profile;
              ops.push(...created.ops);
            }
            session.setMeta(withActive(session.getMeta(), next.id));
          }
          try {
            await repo.write(ops, session.getMeta());
          } catch (e) {
            restore(before);
            throw e;
          }
          session.closeProfile(id);
        });
      } catch (e) {
        session.set({ error: `Couldn’t save: ${(e as Error).message}` });
        return fail('Couldn’t delete the profile. Try again.');
      }
      if (refused) return fail(refused);
      if (next) {
        await loadInto(next);
        return { ok: true, activeId: next.id };
      }
      return { ok: true, activeId: session.getMeta().activeLocalProfileId ?? session.getState().profile!.id };
    },

    async erase(id) {
      const p = (await repo.listProfiles()).find((x) => x.id === id);
      if (!p) return fail('That profile isn’t on this device.');
      let wasActive = false;
      try {
        // Inside the queue (architecture-reviewer): every earlier save lands first, and meta is
        // stripped once, right here, so nothing after this can write the erased writer id back.
        await session.commit(async () => {
          const m = session.getMeta();
          wasActive = m.activeLocalProfileId === id;
          const { [id]: _gone, ...writerIds } = m.writerIds;
          const stripped = withActive({ ...m, writerIds }, wasActive ? undefined : m.activeLocalProfileId);
          session.setMeta(stripped);
          try {
            await repo.purgeProfile(id, stripped);
            session.closeProfile(id);
          } catch (e) {
            // Nothing was erased: the profile keeps its writer id and stays active (code/architecture #1/#2).
            session.setMeta(m);
            throw e;
          }
        });
      } catch {
        return fail('Couldn’t erase the profile. Try again.');
      }
      if (!wasActive) return { ok: true, activeId: session.getMeta().activeLocalProfileId ?? session.getState().profile!.id };
      // Second transaction (R8 revised): the next profile, or a new default. A crash here is healed by start().
      const res = await activate(pickActive(await live()), []);
      if (!res.ok) clearView();
      return res.ok ? res : fail('The profile was erased, but another one couldn’t be opened. Reload to continue.');
    },
  };
}
