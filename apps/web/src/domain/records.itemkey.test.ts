/**
 * code-reviewer T091-T093 r2 MINOR #11 and security-reviewer T093 r1 MAJOR #2 (red, test-first)
 * [FR-041, FR-043, SC-013]: the itemKey grammar and the itemKey / prompt / drillType cross-checks.
 *
 * Frozen grammar, data-model §3.1 (expected values written by hand from it):
 *  - `nf|<geometryId>|<string>|<pc>` note-finding, `iv|<interval>|<up|down>` interval,
 *    `ct|<qualityId>|<function>` chord-tone, `rfo|<root pc 0-11>` root-fifth-octave,
 *    `bs|<drillType>|<qualityId>` for exactly arpeggio, walking-bass and chord-tone-lock,
 *    `lg|<old drillType>|<q>` for drillType 'legacy' (T093a), where <old drillType> is the
 *    prompt's legacyDrillType.
 *  - "`drillType` is exactly the spec's seven ids"; every prompt is a strict union per drillType,
 *    so an attempt's prompt.drillType equals its drillType.
 * Attempts are hand-built; payloadHash is not checked by the schema (it is a format check only).
 */
import { describe, expect, it } from 'vitest';
import { presets } from '@fretsense/theory';
import { attemptSchema, ITEM_KEY_PATTERN } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const guitar = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
const pos = { string: 5, fret: 1 };
const chords = { key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }] };

type Raw = Record<string, unknown>;
const PROMPTS: Record<string, Raw> = {
  'note-finding': { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
  interval: { drillType: 'interval', root: pos, interval: 'm3' },
  'chord-tone': { drillType: 'chord-tone', root: 'G', qualityId: 'minor', function: 'b3' },
  'root-fifth-octave': { drillType: 'root-fifth-octave', root: pos, qualityId: 'major' },
  arpeggio: { drillType: 'arpeggio', root: pos, qualityId: 'min7' },
  'walking-bass': { drillType: 'walking-bass', ...chords },
  'chord-tone-lock': { drillType: 'chord-tone-lock', ...chords },
  legacy: { drillType: 'legacy', legacyDrillType: 'bass-root-fifth-octave', root: pos, qualityId: 'major' },
};
const KEYS: Record<string, string> = {
  'note-finding': `nf|${guitar.geometryId}|6|7`,
  interval: 'iv|m3|up',
  'chord-tone': 'ct|minor|b3',
  'root-fifth-octave': 'rfo|10',
  arpeggio: 'bs|arpeggio|min7',
  'walking-bass': 'bs|walking-bass|major',
  'chord-tone-lock': 'bs|chord-tone-lock|major',
  legacy: 'lg|bass-root-fifth-octave|major',
};
const attempt = (drillType: string, over: Raw = {}): Raw => ({
  id: '44444444-4444-4444-8444-444444444444',
  localProfileId: PID,
  created: H1,
  updated: H1,
  schemaVersion: 1,
  deleted: false,
  drillType,
  instrumentId: null,
  geometryId: guitar.geometryId,
  modality: 'tap',
  prompt: PROMPTS[drillType],
  answer: [{ string: 5, fret: 4 }],
  outcome: 'correct',
  responseMs: 812,
  timestamp: '2026-11-22T12:00:00.000Z',
  lessonId: null,
  drillId: null,
  itemKey: KEYS[drillType],
  payloadHash: '0123456789abcdef'.repeat(4),
  ...over,
});
const ok = (a: Raw) => attemptSchema.safeParse(a).success;
const TYPES = Object.keys(PROMPTS);

describe('FR-041 / data-model §3.1 `bs|` keys name only arpeggio, walking-bass and chord-tone-lock', () => {
  it.each(['bs|arpeggio|min7', 'bs|walking-bass|dom7', 'bs|chord-tone-lock|major'])('accepts %s', (k) => {
    expect(ITEM_KEY_PATTERN.test(k)).toBe(true);
  });

  it.each([
    ['a v0.1 id that was migrated away', 'bs|bass-walking|x'],
    ['root-fifth-octave (its key is rfo|<pc>)', 'bs|root-fifth-octave|major'],
    ['a v0.1 arpeggio id', 'bs|bass-arpeggio|minor'],
    ['note-finding', 'bs|note-finding|major'],
    ['interval', 'bs|interval|major'],
    ['chord-tone', 'bs|chord-tone|major'],
    ['legacy', 'bs|legacy|major'],
    ['an invented drill', 'bs|made-up-drill|major'],
  ])('rejects %s: %s', (_l, k) => {
    expect(ITEM_KEY_PATTERN.test(k)).toBe(false);
  });
});

describe('FR-041 / SC-013 every drill type accepts its own well-formed attempt (control)', () => {
  it.each(TYPES)('%s', (t) => {
    const r = attemptSchema.safeParse(attempt(t));
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues[0])).toBe(true);
  });
});

describe('FR-041 / SC-013 itemKey prefix must match drillType (security-reviewer r1 #2)', () => {
  // Every (drillType, other type's key) pair, with the drillType's own prompt: always rejected.
  const pairs = TYPES.flatMap((t) => TYPES.filter((u) => u !== t).map((u) => [t, u, KEYS[u]!] as const));
  it.each(pairs)('drillType %s with the %s key %s is rejected', (t, _u, k) => {
    expect(ok(attempt(t, { itemKey: k }))).toBe(false);
  });

  it('drillType arpeggio with "iv|M3|up" is rejected', () => {
    expect(ok(attempt('arpeggio', { itemKey: 'iv|M3|up' }))).toBe(false);
  });

  it('drillType legacy with "rfo|0" is rejected', () => {
    expect(ok(attempt('legacy', { itemKey: 'rfo|0' }))).toBe(false);
  });

  it('`bs|<drillType>|` names the attempt\'s own drill type (arpeggio with bs|walking-bass|… is rejected)', () => {
    expect(ok(attempt('arpeggio', { itemKey: 'bs|walking-bass|min7' }))).toBe(false);
    expect(ok(attempt('walking-bass', { itemKey: 'bs|chord-tone-lock|major' }))).toBe(false);
    expect(ok(attempt('chord-tone-lock', { itemKey: 'bs|arpeggio|major' }))).toBe(false);
  });

  it('legacy `lg|<x>|` must equal prompt.legacyDrillType', () => {
    expect(ok(attempt('legacy', { itemKey: 'lg|bass-octave-shapes|major' }))).toBe(false);
    const oct = { drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root: pos, qualityId: null };
    expect(ok(attempt('legacy', { prompt: oct, itemKey: 'lg|bass-octave-shapes|major' }))).toBe(true);
    expect(ok(attempt('legacy', { prompt: oct, itemKey: 'lg|bass-root-fifth-octave|major' }))).toBe(false);
  });

  it('a legacy `lg|` key on a non-legacy drill type is rejected', () => {
    expect(ok(attempt('root-fifth-octave', { itemKey: 'lg|bass-root-fifth-octave|major' }))).toBe(false);
  });
});

describe('FR-041 / SC-013 prompt.drillType must equal drillType (security-reviewer r1 #2)', () => {
  it('drillType arpeggio with a legacy prompt (and an arpeggio key) is rejected', () => {
    expect(ok(attempt('arpeggio', { prompt: PROMPTS.legacy }))).toBe(false);
  });

  it('drillType legacy with an arpeggio prompt is rejected', () => {
    expect(ok(attempt('legacy', { prompt: PROMPTS.arpeggio }))).toBe(false);
  });

  const pairs = TYPES.flatMap((t) => TYPES.filter((u) => u !== t).map((u) => [t, u] as const));
  it.each(pairs)('drillType %s with a %s prompt is rejected', (t, u) => {
    expect(ok(attempt(t, { prompt: PROMPTS[u] }))).toBe(false);
  });
});
