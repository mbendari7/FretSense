import type { HlcState } from '../domain/hlc';
import type {
  AttemptRecord, GearRecord, InstrumentRecord, LessonCompletionRecord, LocalProfileRecord, OnboardingRecord, PathItemRecord,
  PathRecord, ProfileSettingsRecord, UserPackRecord,
} from '../domain/records';

/** Ports (clean architecture): the application depends on these, infrastructure implements them. */
export interface DeviceMeta {
  readonly deviceId: string;
  readonly writerIds: Record<string, string>;
  readonly hlc: HlcState;
  /** The profile in use on this device (016 data-model "meta (changed)"); absent → startup fallback. */
  readonly activeLocalProfileId?: string;
}

/** Record stores (v2, 016 research R2 / R13). `meta` is device-local and keyed apart. */
export const RECORD_STORES = [
  'localProfiles', 'profileSettings', 'instruments', 'attempts', 'lessonCompletion', 'gear', 'onboarding', 'paths', 'pathItems', 'packs',
] as const;
/** Every IndexedDB store, from one constant: transactions take their store list from here (R13). */
export const STORES = ['meta', ...RECORD_STORES] as const;
export type StoreName = (typeof RECORD_STORES)[number];
export type RecordOf<S extends StoreName> = S extends 'localProfiles' ? LocalProfileRecord
  : S extends 'profileSettings' ? ProfileSettingsRecord
  : S extends 'instruments' ? InstrumentRecord
  : S extends 'attempts' ? AttemptRecord
  : S extends 'lessonCompletion' ? LessonCompletionRecord
  : S extends 'gear' ? GearRecord
  : S extends 'onboarding' ? OnboardingRecord
  : S extends 'paths' ? PathRecord
  : S extends 'pathItems' ? PathItemRecord
  : UserPackRecord;

export type WriteOp = { [S in StoreName]: { store: S; record: RecordOf<S> } }[StoreName];

export interface ProfileData {
  profile: LocalProfileRecord;
  settings: ProfileSettingsRecord | undefined;
  instruments: InstrumentRecord[];
  attempts: AttemptRecord[];
  completion: LessonCompletionRecord[];
  gear: GearRecord[];
  onboarding: OnboardingRecord | undefined;
  paths: PathRecord[];
  pathItems: PathItemRecord[];
  packs: UserPackRecord[];
}

export interface Repository {
  /** True when data survives a reload (false for the in-memory fallback). */
  readonly durable: boolean;
  loadMeta(): Promise<DeviceMeta | undefined>;
  listProfiles(): Promise<LocalProfileRecord[]>;
  loadProfile(localProfileId: string): Promise<ProfileData | undefined>;
  /** Applies every op and the new meta in ONE transaction (data-model §3 "Writes"). */
  write(ops: readonly WriteOp[], meta: DeviceMeta): Promise<void>;
  /**
   * Erase permanently (016 FR-003, R8): hard-deletes every record of the profile in every store,
   * tombstones included, and the localProfiles record, and writes `meta`, in ONE transaction.
   * The caller passes `meta` already stripped of the profile's `writerIds` entry and with
   * `activeLocalProfileId` reset; the repository does not edit `meta` (SC-009, privacy-auditor).
   */
  purgeProfile(localProfileId: string, meta: DeviceMeta): Promise<void>;
  /** Of `ids`, those already present in `store` under a DIFFERENT profile (import clash check, FR-020). */
  findForeignIds(store: StoreName, ids: readonly string[], localProfileId: string): Promise<string[]>;
}

export interface Clock { now(): number }
export interface IdGenerator { uuid(): string }
export interface Hasher { sha256Hex(text: string): Promise<string> }
