import { formatHlc, hlcSend, type Hlc } from '../domain/hlc';
import type {
  AttemptRecord, Common, InstrumentRecord, LessonCompletionRecord, LocalProfileRecord, ProfileSettingsRecord,
} from '../domain/records';
import type { Clock, DeviceMeta, IdGenerator, Repository, WriteOp } from './ports';

/** Application state read by the UI through useSyncExternalStore (001 research R3). */
export interface AppState {
  readonly status: 'loading' | 'ready';
  readonly durable: boolean;
  readonly profile?: LocalProfileRecord;
  readonly settings?: ProfileSettingsRecord;
  readonly instruments: readonly InstrumentRecord[];
  readonly attempts: readonly AttemptRecord[];
  readonly completion: readonly LessonCompletionRecord[];
  readonly error?: string;
}

export const INITIAL_STATE: AppState = { status: 'loading', durable: false, instruments: [], attempts: [], completion: [] };

/**
 * The shared application core (016 research R13): observable state, device meta and the one HLC,
 * fresh common fields, and the serialising commit queue. FretSenseApp and the 016 services sit on
 * one Session so every user action stays one ordered commit (FR-020) and stamps stay monotonic.
 */
export interface Session {
  subscribe(fn: () => void): () => void;
  getState(): AppState;
  /** Replaces state immutably and notifies listeners. */
  set(patch: Partial<AppState>): void;
  /** Replaces state without notifying (bootstrap, before the first render). */
  replace(state: AppState): void;
  /** HLC send rule; the writer id is the TARGET profile's (copy import, profile switches). */
  stamp(profileId: string): Hlc;
  common(profileId: string): Common;
  /** Runs `fn` after every earlier commit has settled; a failure rejects only its own caller. */
  commit<T>(fn: () => Promise<T> | T): Promise<T>;
  /**
   * One user action = one repository transaction (FR-020): writes in queue order with the meta current
   * WHEN IT RUNS (never a stale copy: an erase queued earlier has already stripped its writer id;
   * architecture-reviewer T013 r2), and on failure shows "Couldn’t save: …" in state and rethrows.
   */
  write(ops: readonly WriteOp[]): Promise<void>;
  /**
   * Marks a profile deleted or erased: from now on a queued write carrying any of its records is
   * refused when it runs, so a late save can't leave a live record in it (016 T013, FR-003).
   * `reopenProfile` undoes this (a restore, 016 T015).
   */
  closeProfile(profileId: string): void;
  reopenProfile(profileId: string): void;
  /** Resolves once every queued commit has settled (drain before a profile switch, R13). */
  drain(): Promise<void>;
  getMeta(): DeviceMeta;
  setMeta(meta: DeviceMeta): void;
}

export function createSession(deps: { repo: Repository; clock: Clock; ids: IdGenerator; meta: DeviceMeta }): Session {
  let state = INITIAL_STATE;
  let meta = deps.meta;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const closed = new Set<string>();

  const stamp = (profileId: string): Hlc => {
    const writer = meta.writerIds[profileId];
    // Fail here, not later as a malformed HLC far from the cause (016 Phase 2 review).
    if (!writer) throw new Error(`No writer id for profile ${profileId}`);
    const next = hlcSend(meta.hlc, deps.clock.now());
    meta = { ...meta, hlc: next };
    return formatHlc(next.wall, next.counter, writer);
  };

  const set = (patch: Partial<AppState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };
  const commit = <T,>(fn: () => Promise<T> | T): Promise<T> => {
    const p = queue.then(fn);
    queue = p.catch(() => undefined);
    return p;
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    getState: () => state,
    set,
    replace(next) { state = next; },
    stamp,
    common(profileId) {
      const t = stamp(profileId);
      return { id: deps.ids.uuid(), localProfileId: profileId, created: t, updated: t, schemaVersion: 1, deleted: false };
    },
    commit,
    write(ops) {
      return commit(() => {
        // Checked when the write runs, not when it was queued: a delete queued earlier wins.
        const gone = ops.find((op) => closed.has(op.record.localProfileId));
        if (gone) throw new Error('that profile was deleted');
        return deps.repo.write(ops, meta);
      }).catch((e: unknown) => {
        set({ error: `Couldn’t save: ${(e as Error).message}` });
        throw e;
      });
    },
    drain: () => queue.then(() => undefined),
    closeProfile(profileId) { closed.add(profileId); },
    reopenProfile(profileId) { closed.delete(profileId); },
    getMeta: () => meta,
    setMeta(m) { meta = m; },
  };
}
