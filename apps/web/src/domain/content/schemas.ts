import { z } from 'zod';
import { chordQualities, presets, scaleTypes } from '@fretsense/theory';
import { DRILL_TYPES, ID_PATTERN } from '../records';

/** Content schemas (contracts/content-formats.md), shared by the build validator and the app. */
const id = z.string().max(64).regex(ID_PATTERN, 'must be kebab-case');
const SCALE_IDS = new Set(scaleTypes().map((s) => s.id));
const CHORD_IDS = new Set(chordQualities().map((c) => c.id));
const PRESET_IDS = new Set(presets().map((p) => p.presetId));
const pcNote = z.string().regex(/^[A-G](bb|b|#|##)?$/, 'must be a note name like F#');

export const tagVocabularySchema = z.strictObject({
  goal: z.array(id),
  genre: z.array(id),
  topic: z.array(id),
  'level-hint': z.array(id),
});
export type TagVocabulary = z.infer<typeof tagVocabularySchema>;

export const fretboardPresetSchema = z
  .strictObject({
    root: pcNote,
    scale: z.string().optional(),
    chord: z.string().optional(),
    labels: z.enum(['notes', 'degrees', 'none']).default('notes'),
    frets: z.tuple([z.number().int().min(0).max(24), z.number().int().min(0).max(24)]).optional(),
    preset: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!!v.scale === !!v.chord) ctx.addIssue({ code: 'custom', message: 'needs exactly one of scale or chord' });
    if (v.scale && !SCALE_IDS.has(v.scale)) ctx.addIssue({ code: 'custom', path: ['scale'], message: `unknown scale "${v.scale}"` });
    if (v.chord && !CHORD_IDS.has(v.chord)) ctx.addIssue({ code: 'custom', path: ['chord'], message: `unknown chord "${v.chord}"` });
    if (v.preset && !PRESET_IDS.has(v.preset)) ctx.addIssue({ code: 'custom', path: ['preset'], message: `unknown preset "${v.preset}"` });
    if (v.frets && v.frets[0] > v.frets[1]) ctx.addIssue({ code: 'custom', path: ['frets'], message: 'start must be ≤ end' });
  });

const instruments = z.union([z.tuple([z.literal('any')]), z.array(z.enum(['guitar', 'bass'])).min(1)]);

export const drillDefinitionSchema = z
  .strictObject({
    id,
    // FN-7 (provisional): walking bass is hidden until full FR-058 ships.
    type: z.enum(DRILL_TYPES).refine((t) => t !== 'bass-walking', 'walking-bass drills are not available yet'),
    title: z.string().max(120).optional(),
    instruments,
    params: z
      .strictObject({
        strings: z.array(z.number().int().min(1).max(8)).optional(),
        frets: z.tuple([z.number().int().min(0).max(24), z.number().int().min(0).max(24)]).optional(),
        count: z.number().int().min(5).max(100).optional(),
        notes: z.array(pcNote).optional(),
        intervals: z.array(z.string().regex(/^[PMmAd]\d{1,2}$/)).optional(),
        direction: z.enum(['up', 'down', 'both']).optional(),
        roots: z.array(pcNote).optional(),
        qualities: z.array(z.string()).optional(),
        functions: z.array(z.string()).optional(),
        key: z.strictObject({ tonic: pcNote, mode: z.enum(['major', 'minor']) }).optional(),
        chords: z.array(z.strictObject({ root: pcNote, quality: z.string() })).min(2).max(8).optional(),
      })
      .default({}),
  })
  .superRefine((d, ctx) => {
    for (const q of [...(d.params.qualities ?? []), ...(d.params.chords ?? []).map((c) => c.quality)]) {
      if (!CHORD_IDS.has(q)) ctx.addIssue({ code: 'custom', path: ['params'], message: `unknown chord quality "${q}"` });
    }
    if (d.params.chords && !d.params.key) ctx.addIssue({ code: 'custom', path: ['params', 'key'], message: 'a progression needs a key' });
  });
export type DrillDefinition = z.infer<typeof drillDefinitionSchema>;

export const lessonFrontmatterSchema = z
  .strictObject({
    id,
    title: z.string().min(1).max(120),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string().regex(/^(goal|genre|topic|level-hint):[a-z0-9]+(-[a-z0-9]+)*$/, 'tags are namespace:value')),
    instruments,
    concepts: z.array(id),
    summary: z.string().max(200).optional(),
    fretboard_preset: fretboardPresetSchema.optional(),
    drills: z.array(drillDefinitionSchema),
    songs: z.array(z.strictObject({ title: z.string().max(120), note: z.string().max(200).optional() })).optional(),
    needs: z.array(z.enum(['audio-input', 'camera'])).default([]),
    play: z.record(z.string(), z.unknown()).optional(),
    camera_coach: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((l, ctx) => {
    const ids = l.drills.map((d) => d.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['drills'], message: 'drill ids must be unique in a lesson' });
    if (l.needs.length === 1 && l.needs[0] === 'camera') ctx.addIssue({ code: 'custom', path: ['needs'], message: 'camera can’t be needed on its own' });
  });
export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export interface CompiledLesson extends Omit<LessonFrontmatter, 'play' | 'camera_coach'> {
  readonly readHtml: string;
  readonly seeHtml: string;
}

export const packSchema = z.strictObject({
  id,
  title: z.string().min(1).max(120),
  source: z.string().max(200).optional(),
  schema_version: z.literal(1),
  sections: z.array(z.strictObject({ title: z.string().min(1).max(120), label: z.string().max(40).optional(), lessons: z.array(id) })).min(1),
});
export type CurriculumPack = z.infer<typeof packSchema>;

export interface CompiledContent {
  readonly lessons: readonly CompiledLesson[];
  readonly packs: readonly CurriculumPack[];
  readonly tags: TagVocabulary;
}
