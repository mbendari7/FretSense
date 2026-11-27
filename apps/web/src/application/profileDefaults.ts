import type { Common, LocalProfileRecord, ProfileSettingsRecord, SettingsField } from '../domain/records';
import type { IdGenerator, WriteOp } from './ports';
import type { Session } from './session';

/** A new profile's settings (001 data-model; 016 R2: schemaVersion 2). */
export const DEFAULT_SETTINGS = {
  activeInstrumentId: null,
  octaveMode: 'any',
  adaptiveWeighting: true,
  stagePreference: ['read', 'see', 'drill'],
  activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
  explorer: { root: 'C', kind: 'scale', typeId: 'major' },
  autoAdvanceMs: 600,
} as const satisfies Pick<ProfileSettingsRecord, SettingsField>;

/** The name the app gives a profile it creates on its own (first start, last profile erased). */
export const DEFAULT_PROFILE_NAME = 'Me';

/** Settings for a new profile from fresh common fields; every default field stamped at creation. */
export function newSettingsRecord(c: Common): ProfileSettingsRecord {
  const fieldUpdated = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, c.created])) as ProfileSettingsRecord['fieldUpdated'];
  return structuredClone({ ...c, schemaVersion: 2, ...DEFAULT_SETTINGS, fieldUpdated }) as unknown as ProfileSettingsRecord;
}

/**
 * The one create-profile path (016 T012/T013; architecture-reviewer: bootstrap, "Add profile" and
 * erase-last share it, so crash recovery after an erase is the same code). Adds a fresh writer id to
 * the session meta (built from the CURRENT meta, so an erased writer id can't come back) and returns
 * the profile, its settings and the ops; the caller writes them in one transaction.
 */
export function newProfile(session: Session, ids: IdGenerator, displayName: string) {
  const id = ids.uuid();
  const m = session.getMeta();
  session.setMeta({ ...m, writerIds: { ...m.writerIds, [id]: ids.uuid() } });
  const t = session.stamp(id);
  const profile: LocalProfileRecord = { id, localProfileId: id, created: t, updated: t, schemaVersion: 1, deleted: false, displayName };
  const settings = newSettingsRecord(session.common(id));
  const ops: WriteOp[] = [{ store: 'localProfiles', record: profile }, { store: 'profileSettings', record: settings }];
  return { profile, settings, ops };
}
