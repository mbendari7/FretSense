/**
 * T005 (red, test-first): v2 record schemas [FR-005, FR-006, FR-008, FR-010, FR-012, FR-014, FR-019].
 * Every bound below is read off specs/016-personalization/data-model.md §1 (OrderKey) and §2
 * (store table); nothing is derived from the implementation. Valid records are written by hand.
 *
 * Targeted exports of records.ts: gearSchema, onboardingSchema, pathSchema, pathItemSchema,
 * userPackSchema, profileSettingsSchema (now schemaVersion 1 | 2).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  gearSchema, onboardingSchema, pathItemSchema, pathSchema, profileSettingsSchema, userPackSchema,
} from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const H2 = `2026-11-22T12:00:01.000Z-0003-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const U = (n: number) => `${n.toString().padStart(8, '0')}-2222-4222-8222-222222222222`;
const common = (id: string) => ({ id, localProfileId: PID, created: H1, updated: H2, schemaVersion: 1, deleted: false });

const channel = { index: 1, label: 'Input 1', hint: 'instrument', signal: 'dry' };
const gearInterface = { ...common(U(1)), kind: 'interface', name: 'USB interface', channels: [channel], directMonitoring: true };
const gearCamera = { ...common(U(2)), kind: 'camera', name: 'Desk camera', placement: 'Left of the music stand' };
const gearOutput = { ...common(U(3)), kind: 'output', name: 'Headphones' };

const onboarding = {
  ...common(U(4)),
  goals: ['songs-i-like'],
  instrumentIds: [U(10)],
  level: 'intermediate',
  genres: ['genre:rock'],
  practiceHoursPerWeek: 3.5,
  answeredAt: H1,
  fieldUpdated: { goals: H1, instrumentIds: H1, level: H1, genres: H1, practiceHoursPerWeek: H1 },
};
const path = { ...common(U(5)), name: 'Start here', origin: 'default' };
const pathItem = {
  ...common(U(6)), pathId: U(5), ref: { kind: 'lesson', lessonId: 'notes-on-the-neck' },
  reason: 'part of General Theory', fallback: false, orderKey: 'a',
};
const pack = {
  ...common(U(7)), packId: 'my-book', title: 'My book', source: 'Some Book, ch. 1',
  sections: [{ title: 'Chapter 1', label: 'Ch 1', lessons: ['notes-on-the-neck'] }],
};
const settingsV1 = {
  ...common(U(8)),
  fieldUpdated: {
    activeInstrumentId: H1, octaveMode: H1, adaptiveWeighting: H1, stagePreference: H1, activePackId: H1, display: H1, explorer: H1, autoAdvanceMs: H1,
  },
  activeInstrumentId: U(10), octaveMode: 'any', adaptiveWeighting: true, stagePreference: ['read', 'see', 'drill'], activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
  explorer: { root: 'C', kind: 'scale', typeId: 'major' }, autoAdvanceMs: 600,
};

type S = { safeParse: (v: unknown) => { success: boolean } };
const ok = (s: S, v: unknown) => s.safeParse(v).success;
const str = (n: number, c = 'a') => c.repeat(n);

const NEW_STORES = [
  ['gear', gearSchema, gearInterface],
  ['onboarding', onboardingSchema, onboarding],
  ['paths', pathSchema, path],
  ['pathItems', pathItemSchema, pathItem],
  ['packs', userPackSchema, pack],
] as const;

describe.each(NEW_STORES)('[T005][FR-019] common fields and strictness: %s', (_n, schema, valid) => {
  it('accepts the hand-written valid record', () => expect(ok(schema, valid)).toBe(true));
  it('rejects unknown keys', () => expect(ok(schema, { ...valid, extra: 1 })).toBe(false));
  it.each(['id', 'localProfileId', 'created', 'updated', 'schemaVersion', 'deleted'])('requires %s', (k) => {
    const { [k as keyof typeof valid]: _drop, ...rest } = valid as Record<string, unknown>;
    expect(ok(schema, rest)).toBe(false);
  });
  it('schemaVersion is exactly 1 for new stores', () => {
    expect(ok(schema, { ...valid, schemaVersion: 2 })).toBe(false);
    expect(ok(schema, { ...valid, schemaVersion: 0 })).toBe(false);
  });
  it("deletedBy is optional and only 'user' | 'profile' (research R3)", () => {
    expect(ok(schema, { ...valid, deleted: true, deletedBy: 'user' })).toBe(true);
    expect(ok(schema, { ...valid, deleted: true, deletedBy: 'profile' })).toBe(true);
    expect(ok(schema, { ...valid, deletedBy: 'admin' })).toBe(false);
    expect(ok(schema, { ...valid, deletedBy: null })).toBe(false);
  });
  it('rejects a non-uuid id and a malformed HLC', () => {
    expect(ok(schema, { ...valid, id: 'not-a-uuid' })).toBe(false);
    expect(ok(schema, { ...valid, updated: '2026-11-22' })).toBe(false);
  });
});

describe('[T005][FR-005,FR-006,FR-008] gear', () => {
  it('accepts interface, camera and output records', () => {
    expect(ok(gearSchema, gearInterface)).toBe(true);
    expect(ok(gearSchema, gearCamera)).toBe(true);
    expect(ok(gearSchema, gearOutput)).toBe(true);
  });
  it('kind is the 3-value enum', () => {
    expect(ok(gearSchema, { ...gearOutput, kind: 'amp' })).toBe(false);
    expect(ok(gearSchema, { ...gearOutput, kind: undefined })).toBe(false);
  });
  it('name is 1-60 characters', () => {
    expect(ok(gearSchema, { ...gearOutput, name: '' })).toBe(false);
    expect(ok(gearSchema, { ...gearOutput, name: 'a' })).toBe(true);
    expect(ok(gearSchema, { ...gearOutput, name: str(60) })).toBe(true);
    expect(ok(gearSchema, { ...gearOutput, name: str(61) })).toBe(false);
  });
  it('namePattern is optional, <= 64', () => {
    expect(ok(gearSchema, { ...gearOutput, namePattern: str(64) })).toBe(true);
    expect(ok(gearSchema, { ...gearOutput, namePattern: str(65) })).toBe(false);
  });
  it('notes is optional, <= 200', () => {
    expect(ok(gearSchema, { ...gearOutput, notes: str(200) })).toBe(true);
    expect(ok(gearSchema, { ...gearOutput, notes: str(201) })).toBe(false);
  });
  it('presetOrigin is an optional kebab preset id', () => {
    expect(ok(gearSchema, { ...gearOutput, presetOrigin: 'some-preset' })).toBe(true);
    expect(ok(gearSchema, { ...gearOutput, presetOrigin: 'Not Kebab' })).toBe(false);
  });
  it('camera placement is <= 200', () => {
    expect(ok(gearSchema, { ...gearCamera, placement: str(200) })).toBe(true);
    expect(ok(gearSchema, { ...gearCamera, placement: str(201) })).toBe(false);
  });
  it('interface requires channels and directMonitoring (data-model: non-optional)', () => {
    const { channels: _c, ...noChannels } = gearInterface;
    const { directMonitoring: _d, ...noDm } = gearInterface;
    expect(ok(gearSchema, noChannels)).toBe(false);
    expect(ok(gearSchema, noDm)).toBe(false);
    expect(ok(gearSchema, { ...gearInterface, directMonitoring: 'yes' })).toBe(false);
  });
  it('channels: <= 32 entries (0 allowed, 33 rejected)', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...channel, index: i + 1 }));
    expect(ok(gearSchema, { ...gearInterface, channels: many(32) })).toBe(true);
    expect(ok(gearSchema, { ...gearInterface, channels: many(33) })).toBe(false);
  });
  it('channel index is an integer >= 1', () => {
    const w = (index: number) => ({ ...gearInterface, channels: [{ ...channel, index }] });
    expect(ok(gearSchema, w(1))).toBe(true);
    expect(ok(gearSchema, w(0))).toBe(false);
    expect(ok(gearSchema, w(-1))).toBe(false);
    expect(ok(gearSchema, w(1.5))).toBe(false);
  });
  it('channel label <= 40; hint and signal are enums; channel is strict', () => {
    const w = (c: object) => ({ ...gearInterface, channels: [{ ...channel, ...c }] });
    expect(ok(gearSchema, w({ label: str(40) }))).toBe(true);
    expect(ok(gearSchema, w({ label: str(41) }))).toBe(false);
    for (const hint of ['instrument', 'line', 'mic']) expect(ok(gearSchema, w({ hint }))).toBe(true);
    expect(ok(gearSchema, w({ hint: 'drums' }))).toBe(false);
    for (const signal of ['dry', 'processed']) expect(ok(gearSchema, w({ signal }))).toBe(true);
    expect(ok(gearSchema, w({ signal: 'wet' }))).toBe(false);
    expect(ok(gearSchema, w({ extra: 1 }))).toBe(false);
  });
});

describe('[T005][FR-010] onboarding', () => {
  it('level is optional, enum beginner|intermediate|advanced', () => {
    const { level: _l, ...none } = onboarding;
    expect(ok(onboardingSchema, none)).toBe(true);
    for (const level of ['beginner', 'intermediate', 'advanced']) expect(ok(onboardingSchema, { ...onboarding, level })).toBe(true);
    expect(ok(onboardingSchema, { ...onboarding, level: 'expert' })).toBe(false);
  });
  it('practiceHoursPerWeek is optional, 0-40 in steps of 0.5', () => {
    const { practiceHoursPerWeek: _p, ...none } = onboarding;
    expect(ok(onboardingSchema, none)).toBe(true);
    for (const v of [0, 0.5, 1, 39.5, 40]) expect(ok(onboardingSchema, { ...onboarding, practiceHoursPerWeek: v })).toBe(true);
    for (const v of [-0.5, 40.5, 41, 0.25, 0.3, Number.NaN, Infinity]) expect(ok(onboardingSchema, { ...onboarding, practiceHoursPerWeek: v })).toBe(false);
  });
  it('property: accepted iff a multiple of 0.5 within [0, 40]', () => {
    fc.assert(fc.property(fc.integer({ min: -20, max: 100 }), fc.constantFrom(0, 0.1, 0.25, 0.5), (n, frac) => {
      const v = n / 2 + (frac === 0.5 ? 0 : frac);
      const expected = v >= 0 && v <= 40 && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
      return ok(onboardingSchema, { ...onboarding, practiceHoursPerWeek: v }) === expected;
    }));
  });
  it('goals are kebab goal ids; instrumentIds are uuids', () => {
    expect(ok(onboardingSchema, { ...onboarding, goals: ['Not Kebab'] })).toBe(false);
    expect(ok(onboardingSchema, { ...onboarding, goals: [] })).toBe(true);
    expect(ok(onboardingSchema, { ...onboarding, instrumentIds: ['nope'] })).toBe(false);
  });
  it('answeredAt must be an HLC; fieldUpdated keys are limited to the answer fields', () => {
    expect(ok(onboardingSchema, { ...onboarding, answeredAt: 'yesterday' })).toBe(false);
    expect(ok(onboardingSchema, { ...onboarding, fieldUpdated: { ...onboarding.fieldUpdated, bogus: H1 } })).toBe(false);
  });
});

describe('[T005][FR-011,FR-011a,FR-012] paths', () => {
  it('name is 1-60 characters', () => {
    expect(ok(pathSchema, { ...path, name: '' })).toBe(false);
    expect(ok(pathSchema, { ...path, name: str(60) })).toBe(true);
    expect(ok(pathSchema, { ...path, name: str(61) })).toBe(false);
  });
  it('origin is generated | default | manual', () => {
    for (const origin of ['generated', 'default', 'manual']) expect(ok(pathSchema, { ...path, origin })).toBe(true);
    expect(ok(pathSchema, { ...path, origin: 'imported' })).toBe(false);
  });
});

describe('[T005][FR-012,FR-015] pathItems', () => {
  it('ref union: lesson | drill, strict, content ids kebab', () => {
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'lesson', lessonId: 'a-b' } })).toBe(true);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'drill', lessonId: 'a-b', drillId: 'c-d' } })).toBe(true);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'drill', lessonId: 'a-b' } })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'lesson', lessonId: 'a-b', drillId: 'c-d' } })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'song', lessonId: 'a-b' } })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'lesson', lessonId: 'Bad Id' } })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, ref: { kind: 'lesson', lessonId: str(65) } })).toBe(false);
  });
  it('pathId is a uuid; fallback is boolean', () => {
    expect(ok(pathItemSchema, { ...pathItem, pathId: 'x' })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, fallback: 'no' })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, fallback: true })).toBe(true);
  });
  it('reason is <= 200', () => {
    expect(ok(pathItemSchema, { ...pathItem, reason: str(200) })).toBe(true);
    expect(ok(pathItemSchema, { ...pathItem, reason: str(201) })).toBe(false);
  });
  const KEY = /^[0-9A-Za-z]{0,23}[1-9A-Za-z]$/; // data-model §1, written here independently
  it('orderKey: valid examples and boundary lengths', () => {
    for (const k of ['a', '1', 'Zz5', '0a', '00001', str(24), `${str(23, '0')}1`]) expect(ok(pathItemSchema, { ...pathItem, orderKey: k })).toBe(true);
  });
  it('orderKey: invalid examples (empty, trailing 0, 25 chars, symbols, non-string)', () => {
    for (const k of ['', '0', 'a0', 'a00', str(25), 'a-b', 'a_', 'a b', 'é', 'a\n']) expect(ok(pathItemSchema, { ...pathItem, orderKey: k })).toBe(false);
    expect(ok(pathItemSchema, { ...pathItem, orderKey: 5 })).toBe(false);
  });
  it('property: schema agrees with the data-model regex on arbitrary short strings', () => {
    const alpha = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_ é';
    fc.assert(fc.property(fc.array(fc.constantFrom(...alpha), { maxLength: 26 }).map((a) => a.join('')), (k) =>
      ok(pathItemSchema, { ...pathItem, orderKey: k }) === KEY.test(k)));
  });
});

describe('[T005][FR-014] user packs (store `packs`)', () => {
  it('packId is kebab, <= 64', () => {
    expect(ok(userPackSchema, { ...pack, packId: str(64) })).toBe(true);
    expect(ok(userPackSchema, { ...pack, packId: str(65) })).toBe(false);
    expect(ok(userPackSchema, { ...pack, packId: 'Not Kebab' })).toBe(false);
    expect(ok(userPackSchema, { ...pack, packId: 'trailing-' })).toBe(false);
  });
  it('title <= 120; source optional <= 200 (001 packSchema)', () => {
    expect(ok(userPackSchema, { ...pack, title: str(120) })).toBe(true);
    expect(ok(userPackSchema, { ...pack, title: str(121) })).toBe(false);
    const { source: _s, ...noSource } = pack;
    expect(ok(userPackSchema, noSource)).toBe(true);
    expect(ok(userPackSchema, { ...pack, source: str(201) })).toBe(false);
  });
  const sec = (o: object = {}) => ({ title: 'S', lessons: ['a-b'], ...o });
  it('sections <= 500', () => {
    expect(ok(userPackSchema, { ...pack, sections: Array.from({ length: 500 }, () => sec()) })).toBe(true);
    expect(ok(userPackSchema, { ...pack, sections: Array.from({ length: 501 }, () => sec()) })).toBe(false);
  });
  it('section title <= 120, label optional <= 40, lessons <= 200 kebab ids, strict', () => {
    const w = (o: object) => ({ ...pack, sections: [sec(o)] });
    expect(ok(userPackSchema, w({ title: str(120) }))).toBe(true);
    expect(ok(userPackSchema, w({ title: str(121) }))).toBe(false);
    expect(ok(userPackSchema, w({ label: str(40) }))).toBe(true);
    expect(ok(userPackSchema, w({ label: str(41) }))).toBe(false);
    expect(ok(userPackSchema, w({ lessons: Array.from({ length: 200 }, () => 'a-b') }))).toBe(true);
    expect(ok(userPackSchema, w({ lessons: Array.from({ length: 201 }, () => 'a-b') }))).toBe(false);
    expect(ok(userPackSchema, w({ lessons: ['Bad Id'] }))).toBe(false);
    expect(ok(userPackSchema, w({ extra: 1 }))).toBe(false);
  });
});

describe('[T005][FR-019] profileSettings schemaVersion 1 | 2', () => {
  const v2 = (o: object, fu: object = {}) => ({
    ...settingsV1, schemaVersion: 2, ...o, fieldUpdated: { ...settingsV1.fieldUpdated, ...fu },
  });
  it('a v1 record still parses and gains no new keys', () => {
    const r = profileSettingsSchema.safeParse(settingsV1);
    expect(r.success).toBe(true);
    if (r.success) for (const k of ['activePathId', 'defaultInterfaceId', 'defaultCameraId', 'defaultOutputId']) expect(k in r.data).toBe(false);
  });
  it('a v2 record without the new fields parses', () => expect(ok(profileSettingsSchema, v2({}))).toBe(true));
  it('schemaVersion 3 and 0 are rejected', () => {
    expect(ok(profileSettingsSchema, { ...settingsV1, schemaVersion: 3 })).toBe(false);
    expect(ok(profileSettingsSchema, { ...settingsV1, schemaVersion: 0 })).toBe(false);
  });
  it.each(['activePathId', 'defaultInterfaceId', 'defaultCameraId', 'defaultOutputId'])('%s: uuid, with its own fieldUpdated entry', (k) => {
    expect(ok(profileSettingsSchema, v2({ [k]: U(20) }, { [k]: H2 }))).toBe(true);
    expect(ok(profileSettingsSchema, v2({ [k]: 'not-a-uuid' }, { [k]: H2 }))).toBe(false);
    // data-model §2: "each with its own fieldUpdated entry" (set without a stamp cannot merge per field)
    expect(ok(profileSettingsSchema, v2({ [k]: U(20) }))).toBe(false);
  });
  it('still strict: unknown keys and unknown fieldUpdated keys are rejected', () => {
    expect(ok(profileSettingsSchema, v2({ extra: 1 }))).toBe(false);
    expect(ok(profileSettingsSchema, v2({}, { bogus: H1 }))).toBe(false);
  });
});
