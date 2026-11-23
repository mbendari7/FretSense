/**
 * T090 (red, test-first): drill prompt wording [FR-030, FR-036, FR-032].
 *
 * Expected strings are taken from spec.md (FR-030 examples "Find G on string 6, low E",
 * "string 5, low B", "string 4, D"; FR-036 example "Find the ♭7th of the A dominant 7th chord (A7),
 * frets 5 to 8" and its quality-name table), never from the implementation.
 * Open-string spellings are read straight from each profile's tuning (letter + accidental), and
 * the lowest / highest strings are found by brute-force MIDI comparison
 * (MIDI = 12·(octave + 1) + letter + accidental). Chord formulas and function labels are typed out
 * below from FR-005 / FR-006.
 *
 * Accidentals are compared in ASCII (b, #, bb, ##): the spec allows the UI to render ♭/♯ (FR-005),
 * so both renderings are accepted and normalised before comparing.
 */
import { describe, expect, it } from 'vitest';
import { presetById, presets, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question } from './types';

// ---------- independent helpers ----------
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
/** String 1 is the highest pitched: it is the last entry of the low → high tuning. */
const openNote = (p: InstrumentProfile, s: number) => p.tuning[p.stringCount - s]!;
const openName = (p: InstrumentProfile, s: number) => openNote(p, s).letter + ACC[openNote(p, s).accidental];
const pcOf = (m: number) => ((m % 12) + 12) % 12;
/** Normalises ♭ ♯ 𝄫 𝄪 to ASCII so either rendering of the spec's wording is accepted. */
const ascii = (s: string) => s.replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##').replace(/♭/g, 'b').replace(/♯/g, '#');

function lowestHighest(p: InstrumentProfile): { lowest: number; highest: number } {
  let lowest = 1, highest = 1;
  for (let s = 1; s <= p.stringCount; s++) {
    if (noteMidi(openNote(p, s)) < noteMidi(openNote(p, lowest))) lowest = s;
    if (noteMidi(openNote(p, s)) > noteMidi(openNote(p, highest))) highest = s;
  }
  return { lowest, highest };
}
/** FR-030: "string N, <low|high >Open". */
function expectedStringPart(p: InstrumentProfile, s: number): string {
  const { lowest, highest } = lowestHighest(p);
  const qual = s === lowest ? 'low ' : s === highest ? 'high ' : '';
  return `string ${s}, ${qual}${openName(p, s)}`;
}

const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const nf = (p: InstrumentProfile, over: Partial<DrillSettings> = {}): DrillSettings => ({
  type: 'note-finding', strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 20, octaveMode: 'any', ...over,
});
function gen(p: InstrumentProfile, s: DrillSettings, seed = 1): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}

const std6 = presetById('guitar6-standard')!.profile;
const dropD = presetById('guitar6-drop-d')!.profile;
const eb6 = presetById('guitar6-eb')!.profile;
const bass5 = presetById('bass5-beadg')!.profile;
const PRESETS = presets();

// =============================================================================================
describe('FR-030 note-finding prompt names the string by number and open note (spec examples)', () => {
  it('6-string Standard, G on string 6: "Find G on string 6, low E"', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], count: 5 }));
    expect(ascii(q!.text)).toBe('Find G on string 6, low E');
  });

  it('5-string bass, string 5: "…string 5, low B"', () => {
    const [q] = gen(bass5, nf(bass5, { strings: [5], notes: [4], count: 5 }));
    expect(ascii(q!.text)).toBe('Find E on string 5, low B');
  });

  it('Drop D, string 4 (an inner string) has no low/high qualifier: "…string 4, D"', () => {
    const [q] = gen(dropD, nf(dropD, { strings: [4], notes: [7], count: 5 }));
    expect(ascii(q!.text)).toBe('Find G on string 4, D');
  });

  it('Drop D, string 6 is the lowest: "…string 6, low D"', () => {
    const [q] = gen(dropD, nf(dropD, { strings: [6], notes: [4], count: 5 }));
    expect(ascii(q!.text)).toBe('Find E on string 6, low D');
  });

  it('highest string carries "high": 6-string Standard string 1 is "high E"', () => {
    const [q] = gen(std6, nf(std6, { strings: [1], notes: [7], count: 5 }));
    expect(ascii(q!.text)).toBe('Find G on string 1, high E');
  });

  it('open note is spelled as the instrument spells it (Eb tuning: "low Eb", never "low D#")', () => {
    const [q] = gen(eb6, nf(eb6, { strings: [6], notes: [7], count: 5 }));
    expect(ascii(q!.text)).toBe('Find G on string 6, low Eb');
    const [q2] = gen(eb6, nf(eb6, { strings: [4], notes: [7], count: 5 }));
    expect(ascii(q2!.text)).toBe('Find G on string 4, Db'); // Eb2 Ab2 Db3 …: string 4 is Db3
  });

  it('exact-octave mode names the octave in the prompted note only: "Find G2 on string 6, low E"', () => {
    // G on string 6 (E2) within frets 0–12 exists only at fret 3 = G2.
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], count: 5, octaveMode: 'exact' }));
    expect(ascii(q!.text)).toBe('Find G2 on string 6, low E');
  });

  it.each(PRESETS.map((pr) => [pr.presetId, pr.profile] as const))(
    'every string of %s is named "string N, <low|high> <open>" (all InstrumentProfiles)',
    (_id, p) => {
      for (const s of allStrings(p)) {
        const qs = gen(p, nf(p, { strings: [s], count: 5 }), s);
        for (const q of qs) {
          const t = ascii(q.text);
          expect(t).toMatch(/^Find [A-G](bb|b|##|#)? on /);
          expect(t.endsWith(` on ${expectedStringPart(p, s)}`)).toBe(true);
        }
      }
    },
  );
});

// =============================================================================================
/** FR-036 quality-name table, keyed by the spec's short names, with the theory-engine id. */
const QUALITY_TABLE: { spec: string; id: string; name: string; suffix: string; fns: string[] }[] = [
  // symbols: FR-005 ("shown for C": C, Cm, Cdim, Caug, Csus2, Csus4, C7, Cmaj7, Cm7, Cm7b5, Cdim7, Cadd9)
  // functions: FR-006 labels (R, b3, 3, 2, 4, b5, 5, #5, bb7, b7, 7, 9) applied to each formula
  { spec: 'maj', id: 'major', name: 'major', suffix: '', fns: ['R', '3', '5'] },
  { spec: 'min', id: 'minor', name: 'minor', suffix: 'm', fns: ['R', 'b3', '5'] },
  { spec: 'dim', id: 'dim', name: 'diminished', suffix: 'dim', fns: ['R', 'b3', 'b5'] },
  { spec: 'aug', id: 'aug', name: 'augmented', suffix: 'aug', fns: ['R', '3', '#5'] },
  { spec: 'sus2', id: 'sus2', name: 'suspended 2nd', suffix: 'sus2', fns: ['R', '2', '5'] },
  { spec: 'sus4', id: 'sus4', name: 'suspended 4th', suffix: 'sus4', fns: ['R', '4', '5'] },
  { spec: '7', id: 'dom7', name: 'dominant 7th', suffix: '7', fns: ['R', '3', '5', 'b7'] },
  { spec: 'maj7', id: 'maj7', name: 'major 7th', suffix: 'maj7', fns: ['R', '3', '5', '7'] },
  { spec: 'm7', id: 'min7', name: 'minor 7th', suffix: 'm7', fns: ['R', 'b3', '5', 'b7'] },
  { spec: 'm7b5', id: 'm7b5', name: 'half-diminished 7th', suffix: 'm7b5', fns: ['R', 'b3', 'b5', 'b7'] },
  { spec: 'dim7', id: 'dim7', name: 'diminished 7th', suffix: 'dim7', fns: ['R', 'b3', 'b5', 'bb7'] },
  { spec: 'add9', id: 'add9', name: 'add 9', suffix: 'add9', fns: ['R', '3', '5', '9'] },
];
/** Semitones above the root for each function label (standard interval sizes). */
const FN_SEMI: Record<string, number> = { R: 0, '2': 2, b3: 3, '3': 4, '4': 5, b5: 6, '5': 7, '#5': 8, bb7: 9, b7: 10, '7': 11, '9': 14 };
/** FR-036: the function as an ordinal ("the root", "the 3rd", "the b7th"), from the function label. */
const ORDINAL_SUFFIX: Record<string, string> = { '2': 'nd', '3': 'rd', '4': 'th', '5': 'th', '7': 'th', '9': 'th' };
const ordinal = (fn: string) => (fn === 'R' ? 'the root' : `the ${fn}${ORDINAL_SUFFIX[fn.replace(/[b#]/g, '')]}`);

const ct = (p: InstrumentProfile, over: Partial<DrillSettings>): DrillSettings => ({
  // Fret range starts at 1: the spec does not say how a window starting at fret 0 is worded.
  type: 'chord-tone', strings: allStrings(p), fromFret: 1, toFret: Math.min(12, p.fretCount), count: 5, octaveMode: 'any', ...over,
});
const PROMPT_RE = /^Find (the [^ ]+) of the ([A-G](?:bb|b|##|#)?) (.+) chord \(([^)]+)\), frets (\d+) to (\d+)$/;

describe('FR-036 chord-tone prompt: chord in words + symbol, function as an ordinal, window stated', () => {
  it('spec example: "Find the b7th of the A dominant 7th chord (A7), frets S to S+3" with default width 4', () => {
    const qs = gen(std6, ct(std6, { roots: ['A'], qualities: ['dom7'], functions: ['b7'] }));
    for (const q of qs) {
      const m = PROMPT_RE.exec(ascii(q.text));
      expect(m, `prompt was "${q.text}"`).not.toBeNull();
      const [, ord, root, words, symbol, s, e] = m!;
      expect([ord, root, words, symbol]).toEqual(['the b7th', 'A', 'dominant 7th', 'A7']);
      const from = Number(s), to = Number(e);
      expect(to - from + 1).toBe(4); // inclusive window [s, s + w − 1], default w = 4
      expect(from).toBeGreaterThanOrEqual(1);
      expect(to).toBeLessThanOrEqual(12);
    }
  });

  it('the stated window is the window that is judged: valid answers = every G inside frets S..E (brute force)', () => {
    const qs = gen(std6, ct(std6, { roots: ['A'], qualities: ['dom7'], functions: ['b7'] }), 7);
    for (const q of qs) {
      const m = PROMPT_RE.exec(ascii(q.text))!;
      expect(m).not.toBeNull();
      const from = Number(m[5]), to = Number(m[6]);
      const expected: FretPosition[] = [];
      for (const s of allStrings(std6)) for (let f = from; f <= to; f++) if (pcOf(noteMidi(openNote(std6, s)) + f) === 7) expected.push({ string: s, fret: f });
      expect(expected.length).toBeGreaterThan(0); // FR-061: the window contains the tone
      const key = (x: FretPosition) => `${x.string}:${x.fret}`;
      expect(q.steps[0]!.valid.map(key).sort()).toEqual(expected.map(key).sort());
    }
  });

  it.each(QUALITY_TABLE.flatMap((qt) => qt.fns.map((fn) => [qt.spec, fn, qt] as const)))(
    'quality %s, function %s: words from the FR-036 table and the ordinal from the function label',
    (_spec, fn, qt) => {
      const qs = gen(std6, ct(std6, { roots: ['C'], qualities: [qt.id], functions: [fn] }));
      for (const q of qs) {
        const m = PROMPT_RE.exec(ascii(q.text));
        expect(m, `prompt was "${q.text}"`).not.toBeNull();
        expect(m![1]).toBe(ordinal(fn));
        expect(m![2]).toBe('C');
        expect(m![3]).toBe(qt.name);
        expect(m![4]).toBe(`C${qt.suffix}`);
        // the tone asked for is the function's pitch class above C
        expect(q.steps[0]!.accepts).toEqual([pcOf(FN_SEMI[fn]!)]);
      }
    },
  );

  it('min 3rd is "the b3rd" (FR-036: the ordinal uses the function label)', () => {
    const [q] = gen(std6, ct(std6, { roots: ['G'], qualities: ['minor'], functions: ['b3'] }));
    expect(PROMPT_RE.exec(ascii(q!.text))?.slice(1, 5)).toEqual(['the b3rd', 'G', 'minor', 'Gm']);
  });

  it('the root of a flat-root chord keeps its spelling in words and symbol (Bb major ⇒ "Bb major chord (Bb)")', () => {
    const [q] = gen(std6, ct(std6, { roots: ['Bb'], qualities: ['major'], functions: ['R'] }));
    expect(PROMPT_RE.exec(ascii(q!.text))?.slice(1, 5)).toEqual(['the root', 'Bb', 'major', 'Bb']);
  });
});

// =============================================================================================
describe('FR-032 one spelling per question (generator side: prompt and step labels)', () => {
  it('note-finding: the step label is the prompted spelling, for every pitch class on every preset', () => {
    for (const pr of PRESETS) {
      const qs = gen(pr.profile, nf(pr.profile, { count: 60 }), 3);
      for (const q of qs) {
        const prompted = /^Find ([A-G](?:bb|b|##|#)?)/.exec(ascii(q.text))![1]!;
        expect(ascii(q.steps[0]!.label)).toBe(prompted);
      }
    }
  });

  it('chord-tone: the tone of Gm b3 is spelled Bb everywhere in the question, never A#', () => {
    const qs = gen(std6, ct(std6, { roots: ['G'], qualities: ['minor'], functions: ['b3'] }));
    for (const q of qs) {
      for (const s of [q.text, ...q.steps.map((x) => x.label)]) expect(ascii(s)).not.toMatch(/A#/);
      expect(ascii(q.steps[0]!.label)).toMatch(/Bb/);
    }
  });
});
