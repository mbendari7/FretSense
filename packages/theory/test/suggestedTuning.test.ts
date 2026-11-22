// Contract v1.2 (contracts/theory-api.md, "Instrument data exports"): SUGGESTED_TUNINGS and
// suggestedTuning(family, strings) supply starting tunings for the custom-instrument form
// (FR-051, FR-053; ADR-0003: tuning data lives with the instrument definitions, not the UI).
//
// HONESTY NOTE: these tests were written AFTER the implementation in src/instrument.ts
// (code-reviewer r2 M2 follow-up), so they were never red against a missing implementation.
// The expected values below were written independently of that code, from published tuning
// conventions, and are cross-checked structurally (intervals, octave relationships) in-test.
//
// Sources for the expected tunings (scientific pitch notation, C4 = middle C, MIDI 60):
// - 6-string guitar standard tuning E2 A2 D3 G3 B3 E4: the universally published standard
//   (e.g. Wikipedia "Standard tuning"; "Guitar tunings"), fourths except the G3-B3 major third.
// - 7-string guitar: standard adds a low B1 a perfect fourth below E2 (Wikipedia "Seven-string
//   guitar", standard tuning B1 E2 A2 D3 G3 B3 E4).
// - 8-string guitar: standard adds F#1 a perfect fourth below B1 (Wikipedia "Eight-string
//   guitar", standard tuning F#1 B1 E2 A2 D3 G3 B3 E4).
// - 4-string bass E1 A1 D2 G2: one octave below the guitar's four lowest strings (Wikipedia
//   "Bass guitar", Tuning).
// - 5-string bass adds a low B0 (Wikipedia "Bass guitar", extended-range: B0 E1 A1 D2 G2).
// - 6-string bass B0 E1 A1 D2 G2 C3: adds a high C3 a perfect fourth above G2 (Wikipedia
//   "Bass guitar", six-string bass tuning).
import { describe, it, expect } from 'vitest';
import { FAMILY_RULES, SUGGESTED_TUNINGS, suggestedTuning, validateProfile, parseNote } from '../src/index';
import type { InstrumentFamily } from '../src/index';
import { STRING_COUNTS, inputFromText, note, refMidi, unwrap } from './arbitraries';

const FAMILIES: readonly InstrumentFamily[] = ['guitar', 'bass'];

/** Published standard tunings, low to high (sources in the header). */
const STANDARD: Readonly<Record<InstrumentFamily, Readonly<Record<number, readonly string[]>>>> = {
  guitar: {
    6: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    7: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    8: ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  bass: {
    4: ['E1', 'A1', 'D2', 'G2'],
    5: ['B0', 'E1', 'A1', 'D2', 'G2'],
    6: ['B0', 'E1', 'A1', 'D2', 'G2', 'C3'],
  },
};

/** Hand-computed MIDI numbers (12 * (octave + 1) + pitch class) for the published tunings. */
const STANDARD_MIDI: Readonly<Record<InstrumentFamily, Readonly<Record<number, readonly number[]>>>> = {
  guitar: {
    6: [40, 45, 50, 55, 59, 64],
    7: [35, 40, 45, 50, 55, 59, 64],
    8: [30, 35, 40, 45, 50, 55, 59, 64],
  },
  bass: {
    4: [28, 33, 38, 43],
    5: [23, 28, 33, 38, 43],
    6: [23, 28, 33, 38, 43, 48],
  },
};

const ALLOWED = FAMILIES.flatMap((family) => {
  const r = FAMILY_RULES[family];
  return Array.from({ length: r.maxStrings - r.minStrings + 1 }, (_, k) => ({ family, strings: r.minStrings + k }));
});

describe('Contract v1.2 / FR-051: SUGGESTED_TUNINGS covers every allowed string count', () => {
  it('FAMILY_RULES allows guitar 6-8 and bass 4-6 (matches the fixture-derived string counts)', () => {
    expect(ALLOWED.map((a) => `${a.family}:${a.strings}`)).toEqual(STRING_COUNTS.map((s) => `${s.family}:${s.stringCount}`));
  });

  it.each(ALLOWED)('$family with $strings strings has a suggested tuning', ({ family, strings }) => {
    expect(suggestedTuning(family, strings)).toBeDefined();
    expect(SUGGESTED_TUNINGS[family][strings]).toBeDefined();
  });

  it.each(FAMILIES)('%s: SUGGESTED_TUNINGS has no entries beyond the allowed counts', (family) => {
    const r = FAMILY_RULES[family];
    const keys = Object.keys(SUGGESTED_TUNINGS[family]).map(Number).sort((a, b) => a - b);
    const expected = Array.from({ length: r.maxStrings - r.minStrings + 1 }, (_, k) => r.minStrings + k);
    expect(keys).toEqual(expected);
  });
});

describe('Contract v1.2: each suggestion is the published standard tuning', () => {
  it.each(ALLOWED)('$family x $strings: exactly that many strings', ({ family, strings }) => {
    expect(suggestedTuning(family, strings)).toHaveLength(strings);
  });

  it.each(ALLOWED)('$family x $strings: equals the standard tuning', ({ family, strings }) => {
    const got = suggestedTuning(family, strings)!;
    // Compare as spelled notes so ASCII vs Unicode accidental text is not what is under test.
    expect(got.map(note)).toEqual(STANDARD[family][strings]!.map(note));
    expect(got.map((t) => refMidi(note(t)))).toEqual(STANDARD_MIDI[family][strings]);
  });

  it.each(ALLOWED)('$family x $strings: suggestedTuning returns the SUGGESTED_TUNINGS entry', ({ family, strings }) => {
    expect(suggestedTuning(family, strings)).toEqual(SUGGESTED_TUNINGS[family][strings]);
  });

  it.each(ALLOWED)('$family x $strings: every string parses with parseNote', ({ family, strings }) => {
    for (const t of suggestedTuning(family, strings)!) {
      const r = parseNote(t);
      expect(r.ok, `parseNote("${t}")`).toBe(true);
      if (r.ok) expect(r.value).toEqual(note(t));
    }
  });

  it.each(ALLOWED)('$family x $strings: strings rise strictly in pitch, low to high', ({ family, strings }) => {
    const m = suggestedTuning(family, strings)!.map((t) => refMidi(note(t)));
    for (let i = 1; i < m.length; i++) expect(m[i]!).toBeGreaterThan(m[i - 1]!);
  });

  it('structural cross-check: guitar strings are perfect fourths (5 semitones) except G3-B3 (4)', () => {
    const m = suggestedTuning('guitar', 8)!.map((t) => refMidi(note(t)));
    const steps = m.slice(1).map((x, i) => x - m[i]!);
    expect(steps).toEqual([5, 5, 5, 5, 5, 4, 5]);
  });

  it('structural cross-check: 4-string bass is one octave below the guitar six-string low four', () => {
    const g = suggestedTuning('guitar', 6)!.slice(0, 4).map((t) => refMidi(note(t)));
    const b = suggestedTuning('bass', 4)!.map((t) => refMidi(note(t)));
    expect(b).toEqual(g.map((x) => x - 12));
  });

  it('structural cross-check: bass strings are all perfect fourths (6-string B0..C3)', () => {
    const m = suggestedTuning('bass', 6)!.map((t) => refMidi(note(t)));
    expect(m.slice(1).map((x, i) => x - m[i]!)).toEqual([5, 5, 5, 5, 5]);
  });

  it('extended ranges nest: each larger count keeps the smaller tuning as a contiguous run', () => {
    expect(suggestedTuning('guitar', 7)!.slice(1)).toEqual(suggestedTuning('guitar', 6));
    expect(suggestedTuning('guitar', 8)!.slice(1)).toEqual(suggestedTuning('guitar', 7));
    expect(suggestedTuning('bass', 5)!.slice(1)).toEqual(suggestedTuning('bass', 4));
    expect(suggestedTuning('bass', 6)!.slice(0, 5)).toEqual(suggestedTuning('bass', 5));
  });
});

describe('Contract v1.2 / FR-053: every suggestion passes validateProfile for its family', () => {
  it.each(ALLOWED)('$family x $strings: valid at the family default fret count', ({ family, strings }) => {
    const tuning = [...suggestedTuning(family, strings)!];
    const prof = unwrap(validateProfile(inputFromText(family, tuning, FAMILY_RULES[family].defaultFretCount)));
    expect(prof.family).toBe(family);
    expect(prof.stringCount).toBe(strings);
  });
});

describe('Contract v1.2: counts the family does not allow return undefined', () => {
  const OUT_OF_RANGE: ReadonlyArray<{ family: InstrumentFamily; strings: number }> = [
    { family: 'guitar', strings: 5 },
    { family: 'guitar', strings: 9 },
    { family: 'guitar', strings: 4 },
    { family: 'guitar', strings: 0 },
    { family: 'guitar', strings: -6 },
    { family: 'guitar', strings: 6.5 },
    { family: 'guitar', strings: Number.NaN },
    { family: 'bass', strings: 3 },
    { family: 'bass', strings: 7 },
    { family: 'bass', strings: 8 },
    { family: 'bass', strings: 0 },
    { family: 'bass', strings: 4.5 },
  ];

  it.each(OUT_OF_RANGE)('$family x $strings -> undefined', ({ family, strings }) => {
    expect(suggestedTuning(family, strings)).toBeUndefined();
  });
});
