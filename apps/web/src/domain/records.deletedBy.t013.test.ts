/**
 * T013 (red, test-first): the five 001 record schemas gain an OPTIONAL `deletedBy: 'user' | 'profile'`
 * [FR-003; product-owner decision 2026-11-27, spec Clarifications; data-model "Delete profile"].
 * "Delete profile" tombstones every record of the profile with deletedBy 'profile', including records
 * in the 001 stores, so a deleted profile must still parse (restore-import, export). Records written
 * before 016 (no deletedBy) must keep parsing. Valid records are written by hand from data-model.md.
 */
import { describe, expect, it } from 'vitest';
import { presets } from '@fretsense/theory';
import { attemptSchema, instrumentSchema, lessonCompletionSchema, localProfileSchema, profileSettingsSchema } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const H2 = `2026-11-22T12:00:01.000Z-0003-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const common = (id: string) => ({ id, localProfileId: PID, created: H1, updated: H2, schemaVersion: 1, deleted: false });
const guitar = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
const IID = '33333333-3333-4333-8333-333333333333';

const records = {
  localProfiles: [localProfileSchema, { ...common(PID), displayName: 'Me' }],
  profileSettings: [profileSettingsSchema, {
    ...common('22222222-2222-4222-8222-222222222222'),
    fieldUpdated: { activeInstrumentId: H1, octaveMode: H1, adaptiveWeighting: H1, stagePreference: H1, activePackId: H1, display: H1, explorer: H1, autoAdvanceMs: H1 },
    activeInstrumentId: IID, octaveMode: 'any', adaptiveWeighting: true, stagePreference: ['read', 'see', 'drill'], activePackId: 'general-theory',
    display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
    explorer: { root: 'C', kind: 'scale', typeId: 'major' }, autoAdvanceMs: 600,
  }],
  instruments: [instrumentSchema, { ...common(IID), name: 'My Strat', profile: JSON.parse(JSON.stringify(guitar)), presetOrigin: 'guitar6-standard' }],
  attempts: [attemptSchema, {
    ...common('44444444-4444-4444-8444-444444444444'), drillType: 'note-finding', instrumentId: IID, geometryId: guitar.geometryId, modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }], outcome: 'correct', responseMs: 812,
    timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null, itemKey: `nf|${guitar.geometryId}|6|7`, payloadHash: '0123456789abcdef'.repeat(4),
  }],
  lessonCompletion: [lessonCompletionSchema, { ...common('55555555-5555-4555-8555-555555555555'), lessonId: 'notes-on-the-neck', stages: { read: H1, drill: H2 } }],
} as const;

describe.each(Object.entries(records))('[T013][FR-003] %s: optional deletedBy', (_store, [schema, rec]) => {
  const ok = (v: unknown) => (schema as { safeParse: (x: unknown) => { success: boolean } }).safeParse(v).success;

  it('a record without deletedBy (written before 016) still parses', () => expect(ok(rec)).toBe(true));
  it("deletedBy 'profile' parses, on a tombstone", () => expect(ok({ ...rec, deleted: true, deletedBy: 'profile' })).toBe(true));
  it("deletedBy 'user' parses, on a tombstone", () => expect(ok({ ...rec, deleted: true, deletedBy: 'user' })).toBe(true));
  it.each([['admin'], [''], ['PROFILE'], [null], [1], [true], [['profile']]])('deletedBy %j is rejected', (v) => {
    expect(ok({ ...rec, deleted: true, deletedBy: v })).toBe(false);
  });
  it('the schema stays strict about other unknown fields', () => expect(ok({ ...rec, extra: 1 })).toBe(false));
});
