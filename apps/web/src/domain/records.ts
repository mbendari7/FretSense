import { z } from 'zod';
import type { InstrumentProfile } from '@fretsense/theory';
import { FORBIDDEN_CHARS, safeText } from './safeText';

/** Persisted records (data-model §3). Every record carries the FR-066 common fields. */
export const HLC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-\d{4}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const hlc = z.string().regex(HLC_PATTERN).refine((h) => !Number.isNaN(Date.parse(h.slice(0, 24))), 'invalid date in HLC');
/**
 * The one shared UI-safe character filter (security-reviewer T093 r2 N5): C0 and C1 controls, DEL,
 * U+061C (Arabic letter mark), zero-width and bidi controls, and U+FEFF. Used for stored names and
 * for every reason text echoed to the UI.
 */
export const UNSAFE_CHARS = FORBIDDEN_CHARS;
export const hasUnsafeChars = (s: string): boolean => UNSAFE_CHARS.test(s);
export const stripUnsafeChars = (s: string): string => s.replace(new RegExp(UNSAFE_CHARS.source, 'gu'), '');
/** Display names: NFC, no control or invisible characters (FR-053, threat model). */
export const safeName = z.string().min(1).max(60)
  .refine((s) => s === s.normalize('NFC'), 'name must be NFC')
  .refine((s) => !hasUnsafeChars(s), 'name has control or invisible characters');
const contentId = z.string().max(64).regex(ID_PATTERN);

export const commonShape = {
  id: uuid,
  localProfileId: uuid,
  created: hlc,
  updated: hlc,
  schemaVersion: z.literal(1),
  deleted: z.boolean(),
  /** Why a tombstone exists (016 data-model line 5, R3): set with every tombstone, absent on v1 records. */
  deletedBy: z.enum(['user', 'profile']).optional(),
};
export type DeletedBy = 'user' | 'profile';
export type Common = { id: string; localProfileId: string; created: string; updated: string; schemaVersion: 1; deleted: boolean; deletedBy?: DeletedBy };

export const STAGES = ['read', 'see', 'drill'] as const;
export type Stage = (typeof STAGES)[number];

export const localProfileSchema = z.strictObject({ ...commonShape, displayName: safeName });
export type LocalProfileRecord = z.infer<typeof localProfileSchema>;

export const displaySchema = z.strictObject({
  window: z.tuple([z.number().int().min(0).max(24), z.number().int().min(0).max(24)]),
  handedness: z.enum(['right', 'left']),
  labelMode: z.enum(['notes', 'degrees', 'none']),
  textSize: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  fretSpacing: z.enum(['uniform', 'proportional']),
  theme: z.enum(['system', 'light', 'dark']),
});
export type DisplaySettings = z.infer<typeof displaySchema>;

export const explorerStateSchema = z.strictObject({
  root: z.string().max(4),
  kind: z.enum(['scale', 'chord']),
  typeId: z.string().max(40),
});
export type ExplorerState = z.infer<typeof explorerStateSchema>;

export const SETTINGS_FIELDS = [
  'activeInstrumentId', 'octaveMode', 'adaptiveWeighting', 'stagePreference', 'activePackId', 'display', 'explorer', 'autoAdvanceMs',
  // 016 (schemaVersion 2, research R2): optional, each with its own fieldUpdated entry when set.
  'activePathId', 'defaultInterfaceId', 'defaultCameraId', 'defaultOutputId',
] as const;
/** The four optional profileSettings fields added in schemaVersion 2 (016 data-model §2). */
export const SETTINGS_V2_FIELDS = ['activePathId', 'defaultInterfaceId', 'defaultCameraId', 'defaultOutputId'] as const;
export type SettingsField = (typeof SETTINGS_FIELDS)[number];

export const profileSettingsSchema = z.strictObject({
  ...commonShape,
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  // The 001 fields are always stamped; the v2 fields only once set (016 R2).
  fieldUpdated: z.strictObject({
    activeInstrumentId: hlc, octaveMode: hlc, adaptiveWeighting: hlc, stagePreference: hlc,
    activePackId: hlc, display: hlc, explorer: hlc, autoAdvanceMs: hlc,
    activePathId: hlc.optional(), defaultInterfaceId: hlc.optional(), defaultCameraId: hlc.optional(), defaultOutputId: hlc.optional(),
  }),
  activeInstrumentId: uuid.nullable(),
  octaveMode: z.enum(['any', 'exact']),
  adaptiveWeighting: z.boolean(),
  stagePreference: z.array(z.enum(STAGES)).min(1).max(3).refine((a) => new Set(a).size === a.length, 'stages must not repeat'),
  activePackId: contentId,
  display: displaySchema,
  explorer: explorerStateSchema,
  autoAdvanceMs: z.union([z.literal(0), z.literal(600), z.literal(1500)]),
  activePathId: uuid.optional(),
  defaultInterfaceId: uuid.optional(),
  defaultCameraId: uuid.optional(),
  defaultOutputId: uuid.optional(),
}).superRefine((s, ctx) => {
  // Per-field LWW needs a stamp for every field that is set (016 data-model §2).
  for (const k of SETTINGS_V2_FIELDS) {
    if (s[k] !== undefined && !s.fieldUpdated[k]) ctx.addIssue({ code: 'custom', path: ['fieldUpdated', k], message: `${k} needs its own fieldUpdated entry` });
  }
});
export type ProfileSettingsRecord = z.infer<typeof profileSettingsSchema>;

const note = z.strictObject({
  letter: z.enum(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
  accidental: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]),
  octave: z.number().int().min(-1).max(9),
});
export const instrumentProfileSchema = z.strictObject({
  family: z.enum(['guitar', 'bass']),
  stringCount: z.number().int().min(4).max(8),
  tuning: z.array(note).min(4).max(8),
  fretCount: z.number().int().min(12).max(24),
  scaleLengthMm: z.number().positive().max(2000),
  pitchRange: z.strictObject({ lowMidi: z.number().int(), highMidi: z.number().int() }),
  geometryId: z.string().max(200),
});

export const instrumentSchema = z.strictObject({
  ...commonShape,
  name: safeName,
  profile: instrumentProfileSchema,
  presetOrigin: contentId.optional(),
});
export type InstrumentRecord = Omit<z.infer<typeof instrumentSchema>, 'profile'> & { profile: InstrumentProfile };

export const DRILL_TYPES = [
  'note-finding', 'interval', 'chord-tone', 'root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock',
] as const;
export type DrillType = (typeof DRILL_TYPES)[number];

const pos = z.strictObject({ string: z.number().int().min(1).max(8), fret: z.number().int().min(0).max(24) });
const pcNote = z.string().regex(/^[A-G](bb|b|#|##)?$/);
/** Free-text ids in prompts (quality, function): the data-model §3.1 bound, ≤ 64 characters (security r2 N4). */
const promptText = z.string().max(64);
/** Frozen prompt union per drillType (data-model §3.1). */
export const promptSchema = z.discriminatedUnion('drillType', [
  z.strictObject({ drillType: z.literal('note-finding'), pitchClass: z.number().int().min(0).max(11), string: z.number().int().nullable(), midi: z.number().int().nullable() }),
  z.strictObject({ drillType: z.literal('interval'), root: pos, interval: z.string().regex(/^-?[PMmAd]\d{1,2}$/) }),
  z.strictObject({ drillType: z.literal('chord-tone'), root: pcNote, qualityId: promptText, function: promptText }),
  z.strictObject({ drillType: z.literal('root-fifth-octave'), root: pos, qualityId: promptText }),
  z.strictObject({ drillType: z.literal('arpeggio'), root: pos, qualityId: promptText }),
  z.strictObject({ drillType: z.literal('walking-bass'), key: z.strictObject({ tonic: pcNote, mode: z.enum(['major', 'minor']) }), chords: z.array(z.strictObject({ root: pcNote, quality: promptText })).min(1).max(8) }),
  /** T093a: v0.1 attempts with no spec successor; history and totals only, never a drill or a weighting input. */
  z.strictObject({ drillType: z.literal('legacy'), legacyDrillType: z.enum(['bass-root-fifth-octave', 'bass-octave-shapes']), root: pos, qualityId: promptText.nullable() }),
  z.strictObject({ drillType: z.literal('chord-tone-lock'), key: z.strictObject({ tonic: pcNote, mode: z.enum(['major', 'minor']) }), chords: z.array(z.strictObject({ root: pcNote, quality: promptText })).min(1).max(8) }),
]);
export type AttemptPrompt = z.infer<typeof promptSchema>;

/** One hour: a sane upper bound on a recorded response time (security r2 N4; the spec sets no max). */
export const MAX_RESPONSE_MS = 3_600_000;

export const ITEM_KEY_PATTERN = /^(nf\|[a-z]+:[A-G#b0-9-]+\|\d\|(?:1[01]|\d)|iv\|-?[PMmAd]\d{1,2}\|(up|down)|ct\|[a-z0-9]+\|[#b]*[0-9R]+|rfo\|(?:1[01]|\d)|lg\|bass-(?:root-fifth-octave|octave-shapes)\|[a-z0-9]+|bs\|(?:arpeggio|walking-bass|chord-tone-lock)\|[a-z0-9]+)$/;

export const attemptObjectSchema = z.strictObject({
  ...commonShape,
  drillType: z.enum([...DRILL_TYPES, 'legacy']),
  instrumentId: uuid.nullable(),
  geometryId: z.string().max(200),
  modality: z.literal('tap'),
  prompt: promptSchema,
  answer: z.array(pos).max(200),
  outcome: z.enum(['correct', 'incorrect']),
  responseMs: z.number().int().min(0).max(MAX_RESPONSE_MS),
  timestamp: z.string().datetime(),
  lessonId: contentId.nullable(),
  drillId: contentId.nullable(),
  itemKey: z.string().regex(ITEM_KEY_PATTERN),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
});

/** FR-041 / SC-013: the itemKey prefix each drill type owns (data-model §3.1). */
function itemKeyPrefix(a: { drillType: string; prompt: { drillType: string; legacyDrillType?: string } }): string {
  switch (a.drillType) {
    case 'note-finding': return 'nf|';
    case 'interval': return 'iv|';
    case 'chord-tone': return 'ct|';
    case 'root-fifth-octave': return 'rfo|';
    case 'legacy': return `lg|${a.prompt.legacyDrillType ?? ''}|`;
    default: return `bs|${a.drillType}|`;
  }
}

/**
 * Cross-field checks (FR-041, SC-013, security-reviewer r1 #2): prompt.drillType equals drillType,
 * and the itemKey prefix names the attempt's own drill type (and, for legacy, its legacyDrillType).
 */
export function checkAttemptConsistency(
  a: { drillType: string; prompt: { drillType: string; legacyDrillType?: string }; itemKey: string },
  ctx: z.RefinementCtx,
): void {
  if (a.prompt.drillType !== a.drillType) {
    ctx.addIssue({ code: 'custom', path: ['prompt', 'drillType'], message: 'prompt drill type does not match drillType' });
    return;
  }
  if (!a.itemKey.startsWith(itemKeyPrefix(a))) {
    ctx.addIssue({ code: 'custom', path: ['itemKey'], message: 'item key does not match drillType' });
  }
}

export const attemptSchema = attemptObjectSchema.superRefine(checkAttemptConsistency);
export type AttemptRecord = z.infer<typeof attemptSchema>;

export const lessonCompletionSchema = z.strictObject({
  ...commonShape,
  lessonId: contentId,
  stages: z.strictObject({ read: hlc.optional(), see: hlc.optional(), drill: hlc.optional() }),
});
export type LessonCompletionRecord = z.infer<typeof lessonCompletionSchema>;

/** Item keys (frozen grammar, data-model §3.1). */
export const itemKey = {
  noteFinding: (geometryId: string, string: number, pc: number) => `nf|${geometryId}|${string}|${pc}`,
  interval: (interval: string, direction: 'up' | 'down') => `iv|${interval}|${direction}`,
  chordTone: (qualityId: string, fn: string) => `ct|${qualityId}|${fn}`,
  /** FR-041: root–fifth–octave items are (root-fifth-octave, root pitch class). */
  rootFifthOctave: (rootPc: number) => `rfo|${rootPc}`,
  /** FR-041: arpeggio, walking-bass and chord-tone-lock items are (drill type, quality). */
  bass: (drillType: DrillType, qualityId: string) => `bs|${drillType}|${qualityId}`,
};

// ---------------------------------------------------------------------------------------------
// 016 personalisation v2 stores (data-model §2). New stores: schemaVersion 1, optional deletedBy
// (research R3), every free-text field through safeText (research R6, T004).

/** Common fields of the stores added in v2: 001's common fields plus the tombstone origin. */
export const v2CommonShape = commonShape;
/** A display name: 1–60 characters after NFC, no control or invisible characters. */
const name60 = z.string().min(1).pipe(safeText(60)).refine((s) => s.trim().length > 0, 'name needs a visible character');
const kebab = (max: number) => z.string().max(max).regex(ID_PATTERN);
/** data-model §1 `OrderKey`. */
export const ORDER_KEY_PATTERN = /^[0-9A-Za-z]{0,23}[1-9A-Za-z]$/;
const tag = z.string().max(96).regex(/^(goal|genre|topic|level-hint):[a-z0-9]+(-[a-z0-9]+)*$/);

const gearBase = {
  ...v2CommonShape,
  name: name60,
  presetOrigin: contentId.optional(),
  namePattern: safeText(64).optional(),
  notes: safeText(200).optional(),
};
const channelSchema = z.strictObject({
  index: z.number().int().min(1).max(32),
  label: safeText(40),
  hint: z.enum(['instrument', 'line', 'mic']),
  signal: z.enum(['dry', 'processed']),
});
export const gearSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...gearBase, kind: z.literal('interface'), directMonitoring: z.boolean(),
    channels: z.array(channelSchema).max(32).refine((cs) => new Set(cs.map((c) => c.index)).size === cs.length, 'channel numbers must not repeat'),
  }),
  z.strictObject({ ...gearBase, kind: z.literal('camera'), placement: safeText(200).optional() }),
  z.strictObject({ ...gearBase, kind: z.literal('output') }),
]);
export type GearRecord = z.infer<typeof gearSchema>;

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
/** A bounded list without duplicates (016 Phase 2 security #1: imported answers can't be unbounded). */
function uniqueArray<T extends z.ZodType<string>>(item: T, max: number) {
  return z.array(item).max(max).refine((xs) => new Set(xs).size === xs.length, 'entries must not repeat');
}
export const ONBOARDING_FIELDS = ['goals', 'instrumentIds', 'level', 'genres', 'practiceHoursPerWeek'] as const;
export const onboardingSchema = z.strictObject({
  ...v2CommonShape,
  goals: uniqueArray(kebab(64), 32),
  instrumentIds: uniqueArray(uuid, 32),
  level: z.enum(LEVELS).optional(),
  genres: uniqueArray(tag, 32),
  practiceHoursPerWeek: z.number().min(0).max(40).refine((v) => Number.isInteger(v * 2), 'hours go in steps of 0.5').optional(),
  answeredAt: hlc,
  fieldUpdated: z.partialRecord(z.enum(ONBOARDING_FIELDS), hlc),
});
export type OnboardingRecord = z.infer<typeof onboardingSchema>;

export const pathSchema = z.strictObject({
  ...v2CommonShape,
  name: name60,
  origin: z.enum(['generated', 'default', 'manual']),
});
export type PathRecord = z.infer<typeof pathSchema>;

export const pathItemRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('lesson'), lessonId: contentId }),
  z.strictObject({ kind: z.literal('drill'), lessonId: contentId, drillId: contentId }),
]);
export type PathItemRef = z.infer<typeof pathItemRefSchema>;
export const pathItemSchema = z.strictObject({
  ...v2CommonShape,
  pathId: uuid,
  ref: pathItemRefSchema,
  reason: safeText(200),
  fallback: z.boolean(),
  orderKey: z.string().regex(ORDER_KEY_PATTERN),
});
export type PathItemRecord = z.infer<typeof pathItemSchema>;

export const userPackSchema = z.strictObject({
  ...v2CommonShape,
  packId: kebab(64),
  title: safeText(120),
  source: safeText(200).optional(),
  sections: z.array(z.strictObject({
    title: safeText(120),
    label: safeText(40).optional(),
    lessons: z.array(contentId).max(200),
  })).max(500),
});
export type UserPackRecord = z.infer<typeof userPackSchema>;
