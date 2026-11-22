import type { HlcState } from '../domain/hlc';
import type {
  AttemptRecord, InstrumentRecord, LessonCompletionRecord, LocalProfileRecord, ProfileSettingsRecord,
} from '../domain/records';

/** Ports (clean architecture): the application depends on these, infrastructure implements them. */
export interface DeviceMeta {
  readonly deviceId: string;
  readonly writerIds: Record<string, string>;
  readonly hlc: HlcState;
}

export type StoreName = 'localProfiles' | 'profileSettings' | 'instruments' | 'attempts' | 'lessonCompletion';
export type RecordOf<S extends StoreName> = S extends 'localProfiles' ? LocalProfileRecord
  : S extends 'profileSettings' ? ProfileSettingsRecord
  : S extends 'instruments' ? InstrumentRecord
  : S extends 'attempts' ? AttemptRecord
  : LessonCompletionRecord;

export type WriteOp = { [S in StoreName]: { store: S; record: RecordOf<S> } }[StoreName];

export interface ProfileData {
  profile: LocalProfileRecord;
  settings: ProfileSettingsRecord | undefined;
  instruments: InstrumentRecord[];
  attempts: AttemptRecord[];
  completion: LessonCompletionRecord[];
}

export interface Repository {
  /** True when data survives a reload (false for the in-memory fallback). */
  readonly durable: boolean;
  loadMeta(): Promise<DeviceMeta | undefined>;
  listProfiles(): Promise<LocalProfileRecord[]>;
  loadProfile(localProfileId: string): Promise<ProfileData | undefined>;
  /** Applies every op and the new meta in ONE transaction (data-model §3 "Writes"). */
  write(ops: readonly WriteOp[], meta: DeviceMeta): Promise<void>;
}

export interface Clock { now(): number }
export interface IdGenerator { uuid(): string }
export interface Hasher { sha256Hex(text: string): Promise<string> }
