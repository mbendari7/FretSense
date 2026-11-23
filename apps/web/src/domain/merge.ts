import { compareHlc, maxHlc, type Hlc } from './hlc';
import {
  SETTINGS_FIELDS, type AttemptRecord, type InstrumentRecord, type LessonCompletionRecord, type ProfileSettingsRecord,
} from './records';

/** FR-066a merge rules (data-model §4). Pure; `freshUpdated` supplies a new local HLC when needed. */
export type MergeResult<T> = { kind: 'keep' } | { kind: 'write'; record: T; change: 'added' | 'restored' | 'updated' | 'hidden' } | { kind: 'conflict'; reason: string };

export function mergeAttempt(local: AttemptRecord | undefined, incoming: AttemptRecord, freshUpdated: () => Hlc): MergeResult<AttemptRecord> {
  // FR-066a (6): no local copy and an incoming tombstone hides nothing: not written, not counted.
  if (!local) return incoming.deleted ? { kind: 'keep' } : { kind: 'write', record: incoming, change: 'added' };
  if (local.payloadHash !== incoming.payloadHash) return { kind: 'conflict', reason: `attempt ${incoming.id} has different content in the file` };
  if (local.deleted && !incoming.deleted) return { kind: 'write', record: { ...local, deleted: false, updated: freshUpdated() }, change: 'restored' };
  if (!local.deleted && incoming.deleted && compareHlc(incoming.updated, local.updated) > 0) return { kind: 'write', record: { ...local, deleted: true, updated: incoming.updated }, change: 'hidden' };
  return { kind: 'keep' };
}

export function mergeInstrument(local: InstrumentRecord | undefined, incoming: InstrumentRecord, freshUpdated: () => Hlc): MergeResult<InstrumentRecord> {
  if (!local) return incoming.deleted ? { kind: 'keep' } : { kind: 'write', record: incoming, change: 'added' }; // FR-066a (6)
  if (local.deleted && !incoming.deleted) return { kind: 'write', record: { ...incoming, updated: freshUpdated() }, change: 'restored' };
  if (local.deleted && incoming.deleted) return { kind: 'keep' }; // FR-066a (5)
  if (compareHlc(incoming.updated, local.updated) > 0) return { kind: 'write', record: incoming, change: incoming.deleted ? 'hidden' : 'updated' };
  return { kind: 'keep' };
}

export function mergeSettings(local: ProfileSettingsRecord, incoming: ProfileSettingsRecord): MergeResult<ProfileSettingsRecord> {
  const out: Record<string, unknown> = { ...local, fieldUpdated: { ...local.fieldUpdated } };
  let changed = false;
  for (const f of SETTINGS_FIELDS) {
    const li = local.fieldUpdated[f];
    const ii = incoming.fieldUpdated[f];
    if (ii && (!li || compareHlc(ii, li) > 0)) {
      out[f] = incoming[f];
      (out.fieldUpdated as Record<string, Hlc>)[f] = ii;
      changed = true;
    }
  }
  if (!changed) return { kind: 'keep' };
  const updated = Object.values(out.fieldUpdated as Record<string, Hlc>).reduce(maxHlc, local.updated);
  return { kind: 'write', record: { ...(out as ProfileSettingsRecord), updated }, change: 'updated' };
}

export function mergeCompletion(local: LessonCompletionRecord | undefined, incoming: LessonCompletionRecord): MergeResult<LessonCompletionRecord> {
  if (!local) return incoming.deleted ? { kind: 'keep' } : { kind: 'write', record: incoming, change: 'added' }; // FR-066a (6)
  // Tombstones follow the attempt rules (FN-10, provisional): an incoming tombstone applies only if newer;
  // a live incoming record un-deletes a local tombstone (restore after reset).
  if (incoming.deleted) {
    return !local.deleted && compareHlc(incoming.updated, local.updated) > 0
      ? { kind: 'write', record: { ...local, deleted: true, updated: incoming.updated }, change: 'hidden' }
      : { kind: 'keep' };
  }
  if (local.deleted) {
    // FR-043: completion merges as a union (earliest time per stage kept), also when un-deleting.
    const stages = { ...local.stages };
    for (const s of ['read', 'see', 'drill'] as const) {
      const a = local.stages[s], b = incoming.stages[s];
      if (b && (!a || compareHlc(b, a) < 0)) stages[s] = b;
    }
    return { kind: 'write', record: { ...local, deleted: false, stages, updated: maxHlc(local.updated, incoming.updated) }, change: 'restored' };
  }
  const stages = { ...local.stages };
  let changed = false;
  for (const s of ['read', 'see', 'drill'] as const) {
    const a = local.stages[s];
    const b = incoming.stages[s];
    if (b && (!a || compareHlc(b, a) < 0)) {
      stages[s] = b;
      changed = true;
    }
  }
  return changed ? { kind: 'write', record: { ...local, stages, updated: maxHlc(local.updated, incoming.updated) }, change: 'updated' } : { kind: 'keep' };
}
