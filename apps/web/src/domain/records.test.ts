/**
 * T021: persisted record schemas (data-model §3, §3.1) [FR-040, FR-066, FR-067, SC-013].
 * Written test-after: the implementation already existed. Valid and invalid examples are written
 * by hand from data-model.md; nothing is derived from the implementation's output.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { presets } from '@fretsense/theory';
import {
  attemptSchema, instrumentSchema, itemKey, ITEM_KEY_PATTERN, lessonCompletionSchema, localProfileSchema, profileSettingsSchema, promptSchema,
} from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const H2 = `2026-11-22T12:00:01.000Z-0003-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const common = (id: string) => ({ id, localProfileId: PID, created: H1, updated: H2, schemaVersion: 1, deleted: false });
const COMMON_FIELDS = ['id', 'localProfileId', 'created', 'updated', 'schemaVersion', 'deleted'];

const guitar = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;

const localProfile = { ...common(PID), displayName: 'Me' };
const settings = {
  ...common('22222222-2222-4222-8222-222222222222'),
  fieldUpdated: {
    activeInstrumentId: H1, octaveMode: H1, adaptiveWeighting: H1, stagePreference: H1, activePackId: H1, display: H1, explorer: H1, autoAdvanceMs: H1,
  },
  activeInstrumentId: '33333333-3333-4333-8333-333333333333',
  octaveMode: 'any',
  adaptiveWeighting: true,
  stagePreference: ['read', 'see', 'drill'],
  activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
  explorer: { root: 'C', kind: 'scale', typeId: 'major' },
  autoAdvanceMs: 600,
};
const instrument = {
  ...common('33333333-3333-4333-8333-333333333333'),
  name: 'My Strat',
  profile: JSON.parse(JSON.stringify(guitar)),
  presetOrigin: 'guitar6-standard',
};
const attempt = {
  ...common('44444444-4444-4444-8444-444444444444'),
  drillType: 'note-finding',
  instrumentId: '33333333-3333-4333-8333-333333333333',
  geometryId: guitar.geometryId,
  modality: 'tap',
  prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
  answer: [{ string: 6, fret: 3 }],
  outcome: 'correct',
  responseMs: 812,
  timestamp: '2026-11-22T12:00:00.000Z',
  lessonId: null,
  drillId: null,
  itemKey: `nf|${guitar.geometryId}|6|7`,
  payloadHash: '0123456789abcdef'.repeat(4),
};
const completion = { ...common('55555555-5555-4555-8555-555555555555'), lessonId: 'notes-on-the-neck', stages: { read: H1, drill: H2 } };

const SCHEMAS = [
  ['localProfiles', localProfileSchema, localProfile],
  ['profileSettings', profileSettingsSchema, settings],
  ['instruments', instrumentSchema, instrument],
  ['attempts', attemptSchema, attempt],
  ['lessonCompletion', lessonCompletionSchema, completion],
] as const;

describe('FR-066 / SC-013 every store carries the common fields', () => {
  it.each(SCHEMAS)('%s accepts a valid record', (_n, schema, rec) => {
    const r = schema.safeParse(rec);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it.each(SCHEMAS)('%s declares all six common fields', (_n, schema) => {
    for (const f of COMMON_FIELDS) expect(Object.keys(schema.shape)).toContain(f);
  });

  it.each(SCHEMAS)('%s rejects a record missing any common field', (_n, schema, rec) => {
    for (const f of COMMON_FIELDS) {
      const copy: Record<string, unknown> = { ...rec };
      delete copy[f];
      expect(schema.safeParse(copy).success, `missing ${f}`).toBe(false);
    }
  });

  it.each(SCHEMAS)('%s is strict: an unknown top-level key is rejected', (_n, schema, rec) => {
    expect(schema.safeParse({ ...rec, extra: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...rec, deviceId: 'x' }).success).toBe(false);
  });

  it.each(SCHEMAS)('%s rejects a non-UUID id and a malformed HLC', (_n, schema, rec) => {
    expect(schema.safeParse({ ...rec, id: 'not-a-uuid' }).success).toBe(false);
    expect(schema.safeParse({ ...rec, localProfileId: 'x' }).success).toBe(false);
    expect(schema.safeParse({ ...rec, updated: '2026-11-22T12:00:00.000Z' }).success).toBe(false);
    expect(schema.safeParse({ ...rec, created: `2026-11-22T12:00:00.000Z-1-${W}` }).success).toBe(false);
  });

  it.each(SCHEMAS)('%s rejects an HLC whose date part fails Date.parse (contracts/profile-export.md)', (_n, schema, rec) => {
    expect(schema.safeParse({ ...rec, updated: `2026-13-45T99:99:99.999Z-0000-${W}` }).success).toBe(false);
  });

  it.each(SCHEMAS)('%s rejects an HLC whose writer id is not an 8-4-4-4-12 UUID', (_n, schema, rec) => {
    expect(schema.safeParse({ ...rec, updated: `2026-11-22T12:00:00.000Z-0000-${'-'.repeat(36)}` }).success).toBe(false);
  });

  it.each(SCHEMAS)('%s: deleted must be boolean and schemaVersion an integer', (_n, schema, rec) => {
    expect(schema.safeParse({ ...rec, deleted: 'false' }).success).toBe(false);
    expect(schema.safeParse({ ...rec, schemaVersion: 1.5 }).success).toBe(false);
  });
});

describe('FR-066 local profile', () => {
  it('display name is 1–60 characters', () => {
    expect(localProfileSchema.safeParse({ ...localProfile, displayName: '' }).success).toBe(false);
    expect(localProfileSchema.safeParse({ ...localProfile, displayName: 'x'.repeat(60) }).success).toBe(true);
    expect(localProfileSchema.safeParse({ ...localProfile, displayName: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('FR-067 / FR-064 profile settings', () => {
  it('stage preference must be non-empty and from the known stages', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, stagePreference: [] }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, stagePreference: ['play'] }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, stagePreference: ['drill', 'read'] }).success).toBe(true);
  });

  it('stage preference is a subset: a repeated stage is rejected', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, stagePreference: ['read', 'read'] }).success).toBe(false);
  });

  it('octave mode is any | exact', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, octaveMode: 'exact' }).success).toBe(true);
    expect(profileSettingsSchema.safeParse({ ...settings, octaveMode: 'nearest' }).success).toBe(false);
  });

  it('fieldUpdated holds HLCs and rejects unknown fields', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, fieldUpdated: { ...settings.fieldUpdated, bogus: H1 } }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, fieldUpdated: { ...settings.fieldUpdated, octaveMode: 'yesterday' } }).success).toBe(false);
  });

  it('display is strict', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, display: { ...settings.display, zoom: 2 } }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, display: { ...settings.display, textSize: 4 } }).success).toBe(false);
  });

  it('active pack id is kebab-case, ≤ 64 characters', () => {
    expect(profileSettingsSchema.safeParse({ ...settings, activePackId: 'General_Theory' }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, activePackId: 'a'.repeat(64) }).success).toBe(true);
    expect(profileSettingsSchema.safeParse({ ...settings, activePackId: 'a'.repeat(65) }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...settings, activePackId: 'a--b' }).success).toBe(false);
  });
});

describe('FR-051 / FR-053 instrument records', () => {
  it.each(presets().map((p) => [p.presetId, p.profile] as const))('%s profile is accepted', (_id, p) => {
    expect(instrumentSchema.safeParse({ ...instrument, profile: JSON.parse(JSON.stringify(p)) }).success).toBe(true);
  });

  it('name is 1–60 characters and the nested profile is strict', () => {
    expect(instrumentSchema.safeParse({ ...instrument, name: '' }).success).toBe(false);
    expect(instrumentSchema.safeParse({ ...instrument, name: 'n'.repeat(61) }).success).toBe(false);
    expect(instrumentSchema.safeParse({ ...instrument, profile: { ...instrument.profile, capo: 2 } }).success).toBe(false);
  });

  it('fret count outside 12–24 is rejected', () => {
    expect(instrumentSchema.safeParse({ ...instrument, profile: { ...instrument.profile, fretCount: 11 } }).success).toBe(false);
    expect(instrumentSchema.safeParse({ ...instrument, profile: { ...instrument.profile, fretCount: 25 } }).success).toBe(false);
  });

  it('presetOrigin is optional', () => {
    const { presetOrigin: _drop, ...noPreset } = instrument;
    expect(instrumentSchema.safeParse(noPreset).success).toBe(true);
  });
});

describe('FR-040 attempt records', () => {
  it('instrument id may be null (temporary lesson preset)', () => {
    expect(attemptSchema.safeParse({ ...attempt, instrumentId: null }).success).toBe(true);
  });

  it('modality is tap in 001; outcome is correct | incorrect', () => {
    expect(attemptSchema.safeParse({ ...attempt, modality: 'audio' }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, outcome: 'skipped' }).success).toBe(false);
  });

  it('response time is a non-negative integer of milliseconds', () => {
    expect(attemptSchema.safeParse({ ...attempt, responseMs: -1 }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, responseMs: 12.5 }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, responseMs: 0 }).success).toBe(true);
  });

  it('payloadHash is 64 lowercase hex characters', () => {
    expect(attemptSchema.safeParse({ ...attempt, payloadHash: 'AB'.repeat(32) }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, payloadHash: 'ab'.repeat(31) }).success).toBe(false);
  });

  it('lesson and drill ids follow the content id format', () => {
    expect(attemptSchema.safeParse({ ...attempt, lessonId: 'notes-on-the-neck', drillId: 'nf-1' }).success).toBe(true);
    expect(attemptSchema.safeParse({ ...attempt, lessonId: 'Notes On The Neck' }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, drillId: '-x' }).success).toBe(false);
  });

  it('answer positions are strict objects', () => {
    expect(attemptSchema.safeParse({ ...attempt, answer: [{ string: 6, fret: 3, x: 1 }] }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, answer: [{ string: 0, fret: 3 }] }).success).toBe(false);
  });

  it('timestamp is an ISO wall time', () => {
    expect(attemptSchema.safeParse({ ...attempt, timestamp: 'yesterday' }).success).toBe(false);
  });
});

describe('FR-040 prompt: a strict discriminated union per drillType (data-model §3.1)', () => {
  const pos = { string: 5, fret: 3 };
  it.each([
    { drillType: 'note-finding', pitchClass: 0, string: 2, midi: 60 },
    { drillType: 'interval', root: pos, interval: 'M3' },
    { drillType: 'chord-tone', root: 'A', qualityId: 'dom7', function: 'b7' },
    { drillType: 'bass-root-fifth-octave', root: pos, qualityId: 'major' },
    { drillType: 'bass-arpeggio', root: pos, qualityId: 'min7' },
    { drillType: 'bass-walking', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'maj7' }, { root: 'A', quality: 'min7' }] },
    { drillType: 'bass-octave-shapes', root: pos },
  ])('accepts $drillType', (p) => {
    expect(promptSchema.safeParse(p).success).toBe(true);
  });

  it('rejects an unknown drill type', () => {
    expect(promptSchema.safeParse({ drillType: 'sight-reading', root: pos }).success).toBe(false);
  });

  it('rejects unknown keys at every level', () => {
    expect(promptSchema.safeParse({ drillType: 'interval', root: pos, interval: 'M3', hint: 'x' }).success).toBe(false);
    expect(promptSchema.safeParse({ drillType: 'interval', root: { ...pos, z: 1 }, interval: 'M3' }).success).toBe(false);
    expect(promptSchema.safeParse({ drillType: 'bass-walking', key: { tonic: 'C', mode: 'major', x: 1 }, chords: [] }).success).toBe(false);
  });

  it('note-finding pitch class is 0–11', () => {
    expect(promptSchema.safeParse({ drillType: 'note-finding', pitchClass: 12, string: 1, midi: null }).success).toBe(false);
  });

  it('a prompt shape belonging to another drill type is rejected', () => {
    expect(promptSchema.safeParse({ drillType: 'chord-tone', root: pos }).success).toBe(false);
  });
});

describe('FR-041 itemKey grammar (data-model §3.1)', () => {
  it.each([
    'nf|guitar:E2-A2-D3-G3-B3-E4|6|7',
    'nf|guitar:Eb2-Ab2-Db3-Gb3-Bb3-Eb4|1|11',
    'nf|bass:B0-E1-A1-D2-G2|5|0',
    'iv|M3|up',
    'iv|P8|down',
    'ct|dom7|b7',
    'ct|major|R',
    'bs|bass-walking|min7',
    'bs|bass-root-fifth-octave|major',
  ])('accepts %s', (k) => {
    expect(ITEM_KEY_PATTERN.test(k)).toBe(true);
  });

  it.each([
    ['unknown prefix', 'xx|M3|up'],
    ['bad direction', 'iv|M3|sideways'],
    ['empty function', 'ct|dom7|'],
    ['trailing space', 'iv|M3|up '],
    ['missing pitch class', 'nf|guitar:E2-A2-D3-G3-B3-E4|6'],
    ['pitch class 12', 'nf|guitar:E2-A2-D3-G3-B3-E4|6|12'],
    ['pitch class 99', 'nf|guitar:E2-A2-D3-G3-B3-E4|6|99'],
  ])('rejects %s', (_l, k) => {
    expect(ITEM_KEY_PATTERN.test(k)).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, itemKey: k }).success).toBe(false);
  });

  it('builders produce the frozen grammar', () => {
    expect(itemKey.noteFinding('guitar:E2-A2-D3-G3-B3-E4', 6, 7)).toBe('nf|guitar:E2-A2-D3-G3-B3-E4|6|7');
    expect(itemKey.interval('M3', 'down')).toBe('iv|M3|down');
    expect(itemKey.chordTone('dom7', 'b7')).toBe('ct|dom7|b7');
    expect(itemKey.bass('bass-arpeggio', 'min7')).toBe('bs|bass-arpeggio|min7');
  });

  it('property: every note-finding key over every preset, string and pitch class matches the grammar', () => {
    const all = presets();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: all.length - 1 }), fc.integer({ min: 0, max: 11 }), fc.nat(), (pi, pc, sRaw) => {
        const p = all[pi]!.profile;
        const s = 1 + (sRaw % p.stringCount);
        expect(ITEM_KEY_PATTERN.test(itemKey.noteFinding(p.geometryId, s, pc))).toBe(true);
      }),
    );
  });
});

describe('FR-028 / FR-043 lesson completion', () => {
  it('stages are a strict subset of read / see / drill, each an HLC', () => {
    expect(lessonCompletionSchema.safeParse({ ...completion, stages: {} }).success).toBe(true);
    expect(lessonCompletionSchema.safeParse({ ...completion, stages: { play: H1 } }).success).toBe(false);
    expect(lessonCompletionSchema.safeParse({ ...completion, stages: { read: 'today' } }).success).toBe(false);
  });

  it('lesson id is kebab-case', () => {
    expect(lessonCompletionSchema.safeParse({ ...completion, lessonId: 'Lesson 1' }).success).toBe(false);
  });
});
