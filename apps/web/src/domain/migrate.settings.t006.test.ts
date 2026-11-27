/**
 * T006 (red, test-first): migrateSettings v1 -> v2 and SETTINGS_FIELDS [FR-019; research R2].
 * Expected values are written out from research R2 / data-model §2: a v1 record reads as v2 with
 * the four new fields ABSENT; everything else identical; a v2 record passes through unchanged.
 */
import { describe, expect, it } from 'vitest';
import { migrateSettings } from './migrate';
import { SETTINGS_FIELDS } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const U = (n: number) => `${n.toString().padStart(8, '0')}-2222-4222-8222-222222222222`;
const v1 = {
  id: U(8), localProfileId: U(9), created: H1, updated: H1, schemaVersion: 1, deleted: false,
  fieldUpdated: { activeInstrumentId: H1, octaveMode: H1, adaptiveWeighting: H1, stagePreference: H1, activePackId: H1, display: H1, explorer: H1, autoAdvanceMs: H1 },
  activeInstrumentId: U(10), octaveMode: 'any', adaptiveWeighting: true, stagePreference: ['read', 'see', 'drill'], activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
  explorer: { root: 'C', kind: 'scale', typeId: 'major' }, autoAdvanceMs: 600,
};
const NEW = ['activePathId', 'defaultInterfaceId', 'defaultCameraId', 'defaultOutputId'];

describe('[T006][FR-019] SETTINGS_FIELDS', () => {
  it('lists the original 8 and the 4 new fields', () => {
    for (const f of ['activeInstrumentId', 'octaveMode', 'adaptiveWeighting', 'stagePreference', 'activePackId', 'display', 'explorer', 'autoAdvanceMs', ...NEW]) {
      expect(SETTINGS_FIELDS as readonly string[]).toContain(f);
    }
    expect(SETTINGS_FIELDS.length).toBe(12);
  });
});

describe('[T006][FR-019] migrateSettings', () => {
  it('v1 -> v2: schemaVersion 2, new fields absent, everything else identical', () => {
    const out = migrateSettings(structuredClone(v1)) as Record<string, unknown>;
    expect(out.schemaVersion).toBe(2);
    for (const k of NEW) expect(Object.hasOwn(out, k)).toBe(false);
    expect(out).toEqual({ ...v1, schemaVersion: 2 });
  });
  it('does not mutate its input', () => {
    const input = structuredClone(v1);
    migrateSettings(input);
    expect(input).toEqual(v1);
  });
  it('v2 passes through unchanged (including the new fields)', () => {
    const v2 = { ...v1, schemaVersion: 2, activePathId: U(20), fieldUpdated: { ...v1.fieldUpdated, activePathId: H1 } };
    expect(migrateSettings(structuredClone(v2))).toEqual(v2);
  });
  it('is idempotent', () => {
    const once = migrateSettings(structuredClone(v1));
    expect(migrateSettings(structuredClone(once))).toEqual(once);
  });
  it('the result is accepted by profileSettingsSchema', async () => {
    const { profileSettingsSchema } = await import('./records');
    expect(profileSettingsSchema.safeParse(migrateSettings(structuredClone(v1))).success).toBe(true);
  });
});
