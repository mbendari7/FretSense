/**
 * T098 (red, test-first) [FR-059, FR-040, FR-041]: chord-tone lock drill, at the generator level.
 *
 * spec-us6-bass-patterns.md FR-059: "The chord-tone lock drill MUST take a progression (with a declared
 * key) and accept one note per chord. Chord tones are correct; otherwise the chord's tones are revealed.
 * [...] take the same strings and fret-range settings as the other drills [...] Reveals [...] use that
 * range." FR-058: outside a lesson the built-in progression is | I | vi | ii | V | of diatonic triads.
 * US6 scenario 4: chord tones are correct and non-chord tones are flagged with the chord's actual tones
 * revealed. FR-041 / data-model: item key is (drill type, quality) = `bs|chord-tone-lock|<quality>`.
 * Contract text (owner brief 2026-11-25): `Play one chord tone of <symbol> (bar <n> of <total>)`,
 * group = chord symbol, one step whose `valid` is every position (inside the settings' strings and fret
 * range) whose pitch class is a chord tone.
 *
 * Independent sources only: chord tones are typed out by hand from the triad formulas (major 0 4 7, minor
 * 0 3 7, dominant 7th 0 4 7 10), key signatures from the circle of fifths, pitches from MIDI =
 * 12·(octave + 1) + letter, brute-forced over every position. Nothing is read from the implementation.
 *
 * Hand-derived pitch classes (C = 0): D major = D F# A = {2,6,9}; B minor = B D F# = {11,2,6};
 * E minor = E G B = {4,7,11}; A major = A C# E = {9,1,4}; C major = C E G = {0,4,7};
 * A minor = A C E = {9,0,4}; D minor = D F A = {2,5,9}; G major = G B D = {7,11,2};
 * F major = F A C = {5,9,0}; G7 = G B D F = {7,11,2,5}.
 */
import { describe, expect, it } from 'vitest';
import { presets, presetById, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions, judgeTap, validateSettings } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const k = (x: FretPosition) => `${x.string}/${x.fret}`;
const byK = (a: FretPosition, b: FretPosition) => a.string - b.string || a.fret - b.fret;
const bass4 = presetById('bass4-standard')!.profile;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

/** Brute force: every position on the chosen strings/frets whose pitch class is in `pcs`. */
function positionsWith(p: InstrumentProfile, strings: readonly number[], from: number, to: number, pcs: readonly number[]): FretPosition[] {
  const out: FretPosition[] = [];
  for (const s of strings) for (let f = from; f <= to; f++) if (pcs.includes(pcOf(openMidi(p, s) + f))) out.push({ string: s, fret: f });
  return out.sort(byK);
}

function lock(p: InstrumentProfile, over: Partial<DrillSettings>, seed = 1): Question[] {
  const s: DrillSettings = { type: 'chord-tone-lock', strings: allStrings(p), fromFret: 0, toFret: 12, count: 8, octaveMode: 'any', key: { tonic: 'C', mode: 'major' }, ...over };
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}

describe('FR-059 chord-tone lock: built-in progression (absent chords)', () => {
  it('C major: questions cycle C, Am, Dm, G in bar order, count = settings.count', () => {
    const qs = lock(bass4, { count: 9 });
    expect(qs).toHaveLength(9);
    const expected = ['C', 'Am', 'Dm', 'G'];
    qs.forEach((q, i) => {
      expect(q.drillType).toBe('chord-tone-lock');
      expect(q.group).toBe(expected[i % 4]);
      expect(q.text).toBe(`Play one chord tone of ${expected[i % 4]} (bar ${(i % 4) + 1} of 4)`);
    });
  });

  it('D major (two sharps: F#, C#): D, Bm, Em, A; item keys use the quality', () => {
    const qs = lock(bass4, { key: { tonic: 'D', mode: 'major' }, count: 8 });
    const sym = ['D', 'Bm', 'Em', 'A'];
    const quality = ['major', 'minor', 'minor', 'major'];
    qs.forEach((q, i) => {
      expect(q.group).toBe(sym[i % 4]);
      expect(q.itemKey).toBe(`bs|chord-tone-lock|${quality[i % 4]}`);
    });
  });

  it('prompt carries the key and the whole progression', () => {
    const [q] = lock(bass4, {});
    expect(q!.prompt).toEqual({
      drillType: 'chord-tone-lock',
      key: { tonic: 'C', mode: 'major' },
      chords: [
        { root: 'C', quality: 'major' },
        { root: 'A', quality: 'minor' },
        { root: 'D', quality: 'minor' },
        { root: 'G', quality: 'major' },
      ],
    });
  });

  it('Eb major: the progression is Eb, Cm, Fm, Bb (roots spelled in the key)', () => {
    const qs = lock(bass4, { key: { tonic: 'Eb', mode: 'major' }, count: 5 });
    expect(qs.slice(0, 4).map((q) => q.group)).toEqual(['Eb', 'Cm', 'Fm', 'Bb']);
    expect(qs[4]!.group).toBe('Eb');
  });
});

describe('FR-059 chord-tone lock: one step, valid = every chord-tone position in range', () => {
  it('bass4 frets 0–5, C major: hand-listed positions (E1 28 / A1 33 / D2 38 / G2 43 strings 4..1)', () => {
    // C E G = pcs 0 4 7. String 4 (E1=28..33): E f0, G f3. String 3 (A1=33..38): C f3. String 2 (D2=38..43): E f2, G f5.
    // String 1 (G2=43..48): G f0, C f5.
    const [q] = lock(bass4, { fromFret: 0, toFret: 5 });
    expect(q!.steps).toHaveLength(1);
    expect([...q!.steps[0]!.valid].sort(byK).map(k)).toEqual(['1/0', '1/5', '2/2', '2/5', '3/3', '4/0', '4/3']);
  });

  it('bass4 frets 0–5, A minor: A C E positions', () => {
    // String 4: E f0, A f5. String 3: A f0, C f3. String 2: E f2. String 1: A f2, C f5.
    const q = lock(bass4, { fromFret: 0, toFret: 5 })[1]!;
    expect(q.group).toBe('Am');
    expect([...q.steps[0]!.valid].sort(byK).map(k)).toEqual(['1/2', '1/5', '2/2', '3/0', '3/3', '4/0', '4/5']);
  });

  for (const preset of presets()) {
    it(`${preset.presetId}: every question's valid set equals the brute-force chord-tone positions (strings and fret range respected)`, () => {
      const p = preset.profile;
      const strings = allStrings(p).filter((s) => s !== 2);
      const pcsByBar = [[0, 4, 7], [9, 0, 4], [2, 5, 9], [7, 11, 2]];
      const qs = lock(p, { strings, fromFret: 2, toFret: 9, count: 8 });
      qs.forEach((q, i) => {
        const want = positionsWith(p, strings, 2, 9, pcsByBar[i % 4]!).map(k);
        expect(q.steps).toHaveLength(1);
        expect([...q.steps[0]!.valid].sort(byK).map(k), `question ${i}`).toEqual(want);
      });
    });
  }

  it('custom progression Am, F, G7 (3 bars): cycles by bar, text counts the total, quality in the item key', () => {
    const chords = [{ root: 'A', quality: 'minor' }, { root: 'F', quality: 'major' }, { root: 'G', quality: 'dom7' }];
    const qs = lock(bass4, { chords, count: 7 });
    const sym = ['Am', 'F', 'G7'];
    const quality = ['minor', 'major', 'dom7'];
    const pcs = [[9, 0, 4], [5, 9, 0], [7, 11, 2, 5]];
    qs.forEach((q, i) => {
      expect(q.text).toBe(`Play one chord tone of ${sym[i % 3]} (bar ${(i % 3) + 1} of 3)`);
      expect(q.group).toBe(sym[i % 3]);
      expect(q.itemKey).toBe(`bs|chord-tone-lock|${quality[i % 3]}`);
      expect([...q.steps[0]!.valid].sort(byK).map(k)).toEqual(positionsWith(bass4, allStrings(bass4), 0, 12, pcs[i % 3]!).map(k));
    });
    expect(qs[0]!.prompt).toMatchObject({ drillType: 'chord-tone-lock', chords });
  });
});

describe('FR-059 / US6 scenario 4: judging and the reveal', () => {
  it('a chord tone is correct, a non-chord tone is wrong, and the revealed set is exactly the chord tones', () => {
    const q = lock(bass4, {})[0]!; // C: C E G
    const tones = [0, 4, 7];
    for (const s of allStrings(bass4)) {
      for (let f = 0; f <= 12; f++) {
        const isTone = tones.includes(pcOf(openMidi(bass4, s) + f));
        expect(judgeTap(q, 0, { string: s, fret: f }), `string ${s} fret ${f}`).toBe(isTone);
      }
    }
    // D on string 2 fret 0 (D2) is the 9th/2nd of C, not a chord tone: wrong, and the reveal lists only C E G positions.
    expect(judgeTap(q, 0, { string: 2, fret: 0 })).toBe(false);
    const revealed = q.steps[0]!.valid.map((v) => pcOf(openMidi(bass4, v.string) + v.fret));
    expect(new Set(revealed)).toEqual(new Set(tones));
  });

  it('the next bar (Am) accepts C and E too but rejects the G that C accepted', () => {
    const q = lock(bass4, {})[1]!; // Am: A C E
    expect(judgeTap(q, 0, { string: 3, fret: 3 })).toBe(true); // C2
    expect(judgeTap(q, 0, { string: 1, fret: 0 })).toBe(false); // G2 is not in A minor
  });
});

describe('FR-059 settings validation', () => {
  it('accepts a valid lock configuration', () => {
    const s: DrillSettings = { type: 'chord-tone-lock', strings: [1, 2, 3, 4], fromFret: 0, toFret: 12, count: 8, octaveMode: 'any', key: { tonic: 'C', mode: 'major' } };
    expect(validateSettings(bass4, s)).toEqual({ ok: true });
  });
  it('rejects counts outside 5–100 and a missing key (a declared key is required)', () => {
    const s: DrillSettings = { type: 'chord-tone-lock', strings: [1, 2, 3, 4], fromFret: 0, toFret: 12, count: 4, octaveMode: 'any', key: { tonic: 'C', mode: 'major' } };
    expect(validateSettings(bass4, s).ok).toBe(false);
    const { key: _key, ...noKey } = { ...s, count: 8 };
    expect(validateSettings(bass4, noKey as DrillSettings).ok).toBe(false);
  });
});
