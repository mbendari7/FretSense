/**
 * security-reviewer T093 r2 N3 and N4 (red, test-first) [FR-043; threat model: bounded input]
 * (specs/001-theory-fretboard-lessons/reviews/2026-11-22-security-reviewer-T093-r2.md).
 *
 *  N3: "A v0.1 payloadHash given as an object makes `String()` throw. parseExport throws". Expected:
 *      parseExport never throws; an object payloadHash gives { ok: false, reason }.
 *      ({"toString":1,"valueOf":1} has no callable toString or valueOf, so String() raises TypeError.)
 *  N4: "qualityId, function, chord quality and responseMs are unbounded (a 5 MB qualityId is
 *      accepted)." Expected: over 64 characters is rejected; 64 is accepted (the data-model §3.1
 *      content-id bound, "≤ 64 characters", applied as the reviewer asks). responseMs has a sane max:
 *      the reviewer's example is "≤ 3,600,000", so 3,600,000 (one hour) must be accepted and absurd
 *      values (1e10 ms ≈ 116 days, Number.MAX_SAFE_INTEGER) rejected. The exact max is not in the spec
 *      (gap reported), so nothing between 3,600,001 and 1e10 is asserted.
 */
import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, parseExport } from './exportFormat';

const PID = '11111111-1111-4111-8111-111111111111';
const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H = `2026-11-22T12:00:00.000Z-0000-${W}`;
const common = (n: number) => ({ id: `dddddddd-0000-4000-8000-${n.toString(16).padStart(12, '0')}`, localProfileId: PID, created: H, updated: H, schemaVersion: 1, deleted: false });
const base = {
  instrumentId: null, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap', answer: [{ string: 3, fret: 3 }],
  outcome: 'correct', responseMs: 1500, timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null,
  payloadHash: 'a'.repeat(64),
};
const file = (attempts: unknown[]) => JSON.stringify({
  format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: H,
  localProfile: { ...common(0), id: PID, displayName: 'Me' },
  instruments: [], attempts, lessonCompletion: [],
});
const R = { string: 3, fret: 3 };
/** One current attempt per prompt shape that carries a free-text quality or function. */
const withQuality = (q: string) => ({
  'chord-tone qualityId': { ...common(1), ...base, drillType: 'chord-tone', prompt: { drillType: 'chord-tone', root: 'C', qualityId: q, function: 'R' }, itemKey: 'ct|maj|R' },
  'chord-tone function': { ...common(2), ...base, drillType: 'chord-tone', prompt: { drillType: 'chord-tone', root: 'C', qualityId: 'maj', function: q }, itemKey: 'ct|maj|R' },
  'root-fifth-octave qualityId': { ...common(3), ...base, drillType: 'root-fifth-octave', prompt: { drillType: 'root-fifth-octave', root: R, qualityId: q }, itemKey: 'rfo|0' },
  'arpeggio qualityId': { ...common(4), ...base, drillType: 'arpeggio', prompt: { drillType: 'arpeggio', root: R, qualityId: q }, itemKey: 'bs|arpeggio|minor' },
  'walking-bass chord quality': { ...common(5), ...base, drillType: 'walking-bass', prompt: { drillType: 'walking-bass', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: q }] }, itemKey: 'bs|walking-bass|major' },
  'chord-tone-lock chord quality': { ...common(6), ...base, drillType: 'chord-tone-lock', prompt: { drillType: 'chord-tone-lock', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: q }] }, itemKey: 'bs|chord-tone-lock|major' },
  'legacy qualityId': { ...common(7), ...base, drillType: 'legacy', prompt: { drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root: R, qualityId: q }, itemKey: 'lg|bass-octave-shapes|minor' },
});
const CASES = Object.keys(withQuality('x')) as (keyof ReturnType<typeof withQuality>)[];
const safeParse = (text: string) => {
  try { return { threw: undefined, r: parseExport(text) }; } catch (e) { return { threw: e as Error, r: undefined }; }
};

describe('security r2 N4: quality, function and chord-quality strings are bounded at 64 characters', () => {
  it.each(CASES)('%s: 64 characters accepted (control)', (k) => {
    const r = parseExport(file([withQuality('a'.repeat(64))[k]]));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });
  it.each(CASES)('%s: 65 characters rejected with a reason', (k) => {
    const r = parseExport(file([withQuality('a'.repeat(65))[k]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
  it('a 1,000,000-character qualityId is rejected (the reviewer\'s "5 MB qualityId", scaled down)', () => {
    expect(parseExport(file([withQuality('a'.repeat(1_000_000))['chord-tone qualityId']])).ok).toBe(false);
  });
  it('a v0.1 bass-arpeggio attempt with a 65-character qualityId is rejected (bound holds after migration)', () => {
    const v01 = { ...common(8), ...base, drillType: 'bass-arpeggio', prompt: { drillType: 'bass-arpeggio', root: R, qualityId: 'a'.repeat(65) }, itemKey: 'bs|bass-arpeggio|minor' };
    const { threw, r } = safeParse(file([v01]));
    expect(threw).toBeUndefined();
    expect(r?.ok).toBe(false);
  });
});

describe('security r2 N4: responseMs has a sane maximum', () => {
  const arp = (ms: number) => ({ ...withQuality('minor')['arpeggio qualityId'], responseMs: ms });
  it.each([0, 1500, 120_000, 3_600_000])('responseMs %d is accepted', (ms) => {
    const r = parseExport(file([arp(ms)]));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });
  it.each([1e10, Number.MAX_SAFE_INTEGER])('responseMs %d is rejected with a reason', (ms) => {
    const r = parseExport(file([arp(ms)]));
    expect(r.ok).toBe(false);
  });
});

describe('security r2 N3: a v0.1 attempt whose payloadHash is not a string', () => {
  const v01 = (payloadHash: unknown) => ({
    ...common(9), ...base, drillType: 'bass-arpeggio', prompt: { drillType: 'bass-arpeggio', root: R, qualityId: 'minor' },
    itemKey: 'bs|bass-arpeggio|minor', payloadHash,
  });
  it('control: String({toString:1,valueOf:1}) really throws (so the fixture exercises the bug)', () => {
    expect(() => String(JSON.parse('{"toString":1,"valueOf":1}'))).toThrow(TypeError);
  });
  it('{"toString":1,"valueOf":1}: parseExport does not throw and returns ok: false with a reason', () => {
    const { threw, r } = safeParse(file([v01({ toString: 1, valueOf: 1 })]));
    expect(threw, threw?.message).toBeUndefined();
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
  it.each([
    ['{}', {}],
    ['an array', ['a'.repeat(64)]],
    ['a number', 5],
    ['null', null],
    ['{"toString":{}}', { toString: {} }],
  ])('payloadHash as %s: parseExport does not throw', (_n, v) => {
    const { threw } = safeParse(file([v01(v)]));
    expect(threw, threw?.message).toBeUndefined();
  });
});
