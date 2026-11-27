import { attemptObjectSchema, checkAttemptConsistency, type AttemptRecord } from './records';

/**
 * T093a: one versioned migration step for attempts stored by the v0.1 pre-release (4695363) under
 * the old drill-type ids (spec Clarifications 2026-11-22, provisional; data-model §3.1).
 * Pure and deterministic: no hashing here. The caller checks the ORIGINAL payloadHash, then
 * re-hashes the migrated payload, so every device migrates the same record to the same hash.
 */
export const LEGACY_DRILL_TYPE = 'legacy';

/** The three v0.1 ids that have a spec successor. */
export const DRILL_TYPE_RENAMES: Readonly<Record<string, string>> = Object.freeze({
  'bass-root-fifth-octave': 'root-fifth-octave',
  'bass-arpeggio': 'arpeggio',
  'bass-walking': 'walking-bass',
});

export type MigratedAttempt = Omit<AttemptRecord, 'payloadHash'>;
type Result = { ok: true; attempt: MigratedAttempt; changed: boolean } | { ok: false; reason: string };
type Raw = Record<string, unknown>;

const currentShape = attemptObjectSchema.omit({ payloadHash: true }).superRefine(checkAttemptConsistency);
/** v0.1 prompt keys per old drill type (strict objects). */
const OLD_PROMPT_KEYS: Record<string, readonly string[]> = {
  'bass-root-fifth-octave': ['drillType', 'qualityId', 'root'],
  'bass-arpeggio': ['drillType', 'qualityId', 'root'],
  'bass-walking': ['chords', 'drillType', 'key'],
  'bass-octave-shapes': ['drillType', 'root'],
};
const OLD_KEY = /^bs\|([a-z-]+)\|([a-z0-9]+)$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Names an attempt in a reason: its id only when it is a well-formed UUID (ids are untrusted text). */
const label = (id: unknown) => (typeof id === 'string' && UUID.test(id) ? `attempt ${id}` : 'an attempt with an invalid id');
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

function validated(candidate: Raw, changed: boolean): Result {
  const r = currentShape.safeParse(candidate);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { ok: false, reason: `${label(candidate.id)}: ${i.path.join('.') || 'record'}: ${i.message}` };
  }
  return { ok: true, attempt: r.data, changed };
}

/** Cheap pre-check: only records with a v0.1 drill id need migration (perf-auditor MAJOR 1). */
export function isV01Attempt(raw: unknown): boolean {
  const t = isObj(raw) ? raw.drillType : undefined;
  return typeof t === 'string' && Object.hasOwn(OLD_PROMPT_KEYS, t);
}

export function migrateAttempt(raw: unknown): Result {
  if (!isObj(raw)) return { ok: false, reason: 'an attempt is not an object' };
  const { payloadHash: _h, ...rest } = raw;
  const old = rest.drillType;
  // Own keys only: no prototype-chain lookups (security-reviewer r1 #5).
  if (typeof old !== 'string' || !Object.hasOwn(OLD_PROMPT_KEYS, old)) return validated(rest, false);

  const prompt = rest.prompt;
  if (!isObj(prompt) || prompt.drillType !== old) return { ok: false, reason: `${label(rest.id)}: prompt does not match drill type ${old}` };
  const keys = Object.keys(prompt).sort();
  const want = OLD_PROMPT_KEYS[old]!;
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) return { ok: false, reason: `${label(rest.id)}: unexpected v0.1 prompt fields` };
  const m = typeof rest.itemKey === 'string' ? OLD_KEY.exec(rest.itemKey) : null;
  if (!m || m[1] !== old) return { ok: false, reason: `${label(rest.id)}: item key does not match drill type ${old}` };
  const quality = m[2]!;

  if (old === 'bass-root-fifth-octave' || old === 'bass-octave-shapes') {
    // No root pitch class can be recovered for per-root items: kept as legacy history only.
    return validated({
      ...rest,
      drillType: LEGACY_DRILL_TYPE,
      prompt: { drillType: LEGACY_DRILL_TYPE, legacyDrillType: old, root: prompt.root, qualityId: old === 'bass-octave-shapes' ? null : prompt.qualityId },
      itemKey: `lg|${old}|${quality}`,
    }, true);
  }
  const next = DRILL_TYPE_RENAMES[old]!;
  return validated({ ...rest, drillType: next, prompt: { ...prompt, drillType: next }, itemKey: `bs|${next}|${quality}` }, true);
}

/**
 * 016 research R2: read-time profileSettings v1 → v2. The v2 fields are optional and absent on a v1
 * record, so only the schemaVersion changes; v2 passes through. Pure and idempotent; never mutates.
 */
export function migrateSettings<T extends { schemaVersion: number }>(record: T): T & { schemaVersion: 2 } {
  if (record.schemaVersion === 2) return record as T & { schemaVersion: 2 };
  return { ...record, schemaVersion: 2 };
}
