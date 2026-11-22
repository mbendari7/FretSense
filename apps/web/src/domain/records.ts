import { z } from 'zod';
import type { InstrumentProfile } from '@fretsense/theory';

/** Persisted records (data-model §3). Every record carries the FR-066 common fields. */
export const HLC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-\d{4}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const hlc = z.string().regex(HLC_PATTERN).refine((h) => !Number.isNaN(Date.parse(h.slice(0, 24))), 'invalid date in HLC');
/** Display names: NFC, no control or invisible characters (FR-053, threat model). */
export const safeName = z.string().min(1).max(60)
  .refine((s) => s === s.normalize('NFC'), 'name must be NFC')
  .refine((s) => !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\u200b-\u200f]/.test(s), 'name has control or invisible characters');
const contentId = z.string().max(64).regex(ID_PATTERN);

export const commonShape = {
  id: uuid,
  localProfileId: uuid,
  created: hlc,
  updated: hlc,
  schemaVersion: z.literal(1),
  deleted: z.boolean(),
};
export type Common = { id: string; localProfileId: string; created: string; updated: string; schemaVersion: 1; deleted: boolean };

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
] as const;
export type SettingsField = (typeof SETTINGS_FIELDS)[number];

export const profileSettingsSchema = z.strictObject({
  ...commonShape,
  fieldUpdated: z.record(z.enum(SETTINGS_FIELDS), hlc),
  activeInstrumentId: uuid.nullable(),
  octaveMode: z.enum(['any', 'exact']),
  adaptiveWeighting: z.boolean(),
  stagePreference: z.array(z.enum(STAGES)).min(1).max(3).refine((a) => new Set(a).size === a.length, 'stages must not repeat'),
  activePackId: contentId,
  display: displaySchema,
  explorer: explorerStateSchema,
  autoAdvanceMs: z.union([z.literal(0), z.literal(600), z.literal(1500)]),
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
  'note-finding', 'interval', 'chord-tone', 'bass-root-fifth-octave', 'bass-arpeggio', 'bass-walking', 'bass-octave-shapes',
] as const;
export type DrillType = (typeof DRILL_TYPES)[number];

const pos = z.strictObject({ string: z.number().int().min(1).max(8), fret: z.number().int().min(0).max(24) });
const pcNote = z.string().regex(/^[A-G](bb|b|#|##)?$/);
/** Frozen prompt union per drillType (data-model §3.1). */
export const promptSchema = z.discriminatedUnion('drillType', [
  z.strictObject({ drillType: z.literal('note-finding'), pitchClass: z.number().int().min(0).max(11), string: z.number().int().nullable(), midi: z.number().int().nullable() }),
  z.strictObject({ drillType: z.literal('interval'), root: pos, interval: z.string().regex(/^-?[PMmAd]\d{1,2}$/) }),
  z.strictObject({ drillType: z.literal('chord-tone'), root: pcNote, qualityId: z.string(), function: z.string() }),
  z.strictObject({ drillType: z.literal('bass-root-fifth-octave'), root: pos, qualityId: z.string() }),
  z.strictObject({ drillType: z.literal('bass-arpeggio'), root: pos, qualityId: z.string() }),
  z.strictObject({ drillType: z.literal('bass-walking'), key: z.strictObject({ tonic: pcNote, mode: z.enum(['major', 'minor']) }), chords: z.array(z.strictObject({ root: pcNote, quality: z.string() })).min(1).max(8) }),
  z.strictObject({ drillType: z.literal('bass-octave-shapes'), root: pos }),
]);
export type AttemptPrompt = z.infer<typeof promptSchema>;

export const ITEM_KEY_PATTERN = /^(nf\|[a-z]+:[A-G#b0-9-]+\|\d\|(?:1[01]|\d)|iv\|-?[PMmAd]\d{1,2}\|(up|down)|ct\|[a-z0-9]+\|[#b]*[0-9R]+|bs\|[a-z-]+\|[a-z0-9]+)$/;

export const attemptSchema = z.strictObject({
  ...commonShape,
  drillType: z.enum(DRILL_TYPES),
  instrumentId: uuid.nullable(),
  geometryId: z.string().max(200),
  modality: z.literal('tap'),
  prompt: promptSchema,
  answer: z.array(pos).max(200),
  outcome: z.enum(['correct', 'incorrect']),
  responseMs: z.number().int().min(0),
  timestamp: z.string().datetime(),
  lessonId: contentId.nullable(),
  drillId: contentId.nullable(),
  itemKey: z.string().regex(ITEM_KEY_PATTERN),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
});
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
  bass: (drillType: DrillType, qualityId: string) => `bs|${drillType}|${qualityId}`,
};
