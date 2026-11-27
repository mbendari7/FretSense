/**
 * Gate round 1 red tests, T005 [FR-004, FR-005, FR-010]: onboarding caps (security-reviewer #1,
 * provisional data-model amendment: goals, instrumentIds, genres each <= 32, no duplicates),
 * gear channel index <= 32 and unique per record, genre tag <= 96 characters, whitespace-only names.
 */
import { describe, expect, it } from 'vitest';
import { gearSchema, onboardingSchema, pathSchema } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const U = (n: number) => `${n.toString(16).padStart(8, '0')}-2222-4222-8222-222222222222`;
const common = (id: string) => ({ id, localProfileId: PID, created: H1, updated: H1, schemaVersion: 1, deleted: false });
const onboarding = {
  ...common(U(4)), goals: ['songs-i-like'], instrumentIds: [U(10)], genres: ['genre:rock'], answeredAt: H1, fieldUpdated: { goals: H1 },
};
const channel = (index: number) => ({ index, label: `In ${index}`, hint: 'instrument', signal: 'dry' });
const gear = { ...common(U(1)), kind: 'interface', name: 'USB interface', channels: [channel(1)], directMonitoring: true };
const path = { ...common(U(5)), name: 'Start here', origin: 'default' };
const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;
const seq = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i));

describe('[T005][FR-010] onboarding array caps (<= 32) and uniqueness', () => {
  const CASES = [
    ['goals', (i: number) => `goal-${i}`],
    ['instrumentIds', (i: number) => U(100 + i)],
    ['genres', (i: number) => `genre:g${i}`],
  ] as const;
  it.each(CASES)('%s: 32 accepted, 33 rejected', (k, f) => {
    expect(ok(onboardingSchema, { ...onboarding, [k]: seq(32, f) })).toBe(true);
    expect(ok(onboardingSchema, { ...onboarding, [k]: seq(33, f) })).toBe(false);
  });
  it.each(CASES)('%s: duplicates rejected', (k, f) => {
    expect(ok(onboardingSchema, { ...onboarding, [k]: [f(1), f(2)] })).toBe(true);
    expect(ok(onboardingSchema, { ...onboarding, [k]: [f(1), f(2), f(1)] })).toBe(false);
  });
  it('genre tag strings are <= 96 characters', () => {
    const tag = (n: number) => `genre:${'a'.repeat(n - 6)}`;
    expect(ok(onboardingSchema, { ...onboarding, genres: [tag(96)] })).toBe(true);
    expect(ok(onboardingSchema, { ...onboarding, genres: [tag(97)] })).toBe(false);
  });
});

describe('[T005][FR-005] gear channel indexes', () => {
  it('index <= 32 (32 accepted, 33 rejected)', () => {
    expect(ok(gearSchema, { ...gear, channels: [channel(32)] })).toBe(true);
    expect(ok(gearSchema, { ...gear, channels: [channel(33)] })).toBe(false);
  });
  it('indexes are unique within a record', () => {
    expect(ok(gearSchema, { ...gear, channels: [channel(1), channel(2)] })).toBe(true);
    expect(ok(gearSchema, { ...gear, channels: [channel(2), channel(2)] })).toBe(false);
  });
});

describe('[T005][FR-004] names reject whitespace-only', () => {
  it.each(['   ', ' '])('gear.name and paths.name reject %j', (n) => {
    expect(ok(gearSchema, { ...gear, name: n })).toBe(false);
    expect(ok(pathSchema, { ...path, name: n })).toBe(false);
  });
  it('a name with inner spaces is still fine', () => {
    expect(ok(gearSchema, { ...gear, name: 'My USB interface' })).toBe(true);
    expect(ok(pathSchema, { ...path, name: 'Start here' })).toBe(true);
  });
});
