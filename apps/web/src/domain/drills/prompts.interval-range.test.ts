/**
 * T100 / CR-B2-13 (red, test-first) [FR-035].
 *
 * spec.md FR-035 (provisional, product-owner 2026-11-22): "The prompt states the fret range in play,
 * as FR-036 does for windows: "Find the perfect 5th above this D, frets 0 to 12"."
 *
 * The range in play is the drill's fret range clamped to the instrument's fret count (FR-035
 * defaults: "frets 0–12 (clamped)"). The interval words are FR-035's (m2 "minor 2nd" … P8
 * "octave"); the reference note in the prompt is checked against the reference position's pitch
 * class by brute force. Parameterised over every InstrumentProfile preset.
 */
import { describe, expect, it } from 'vitest';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string) => s.replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##').replace(/♭/g, 'b').replace(/♯/g, '#');
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const WORDS: Record<string, string> = {
  m2: 'minor 2nd', M2: 'major 2nd', m3: 'minor 3rd', M3: 'major 3rd', P4: 'perfect 4th', A4: 'augmented 4th',
  d5: 'diminished 5th', P5: 'perfect 5th', m6: 'minor 6th', M6: 'major 6th', m7: 'minor 7th', M7: 'major 7th', P8: 'octave',
};

function gen(p: InstrumentProfile, s: DrillSettings, seed = 3): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
const interval = (p: InstrumentProfile, from: number, to: number): DrillSettings => ({
  type: 'interval', strings: allStrings(p), fromFret: from, toFret: to, count: 20, octaveMode: 'any',
  intervals: Object.keys(WORDS), direction: 'both',
});

describe('FR-035 (CR-B2-13) the spec example', () => {
  it('6-string Standard, P5 up, frets 0–12, reference D: "Find the perfect 5th above this D, frets 0 to 12"', () => {
    const std6 = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
    const qs = gen(std6, { ...interval(std6, 0, 12), intervals: ['P5'], direction: 'up', count: 40 });
    const d = qs.find((q) => /this D\b/.test(ascii(q.text)));
    expect(d, 'no question with a D reference in 40').toBeTruthy();
    expect(ascii(d!.text)).toBe('Find the perfect 5th above this D, frets 0 to 12');
  });
});

describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-035 (CR-B2-13) interval prompts state the fret range, %s', (_id, p) => {
  const top = Math.min(12, p.fretCount);
  it.each([[0, top], [3, Math.min(9, p.fretCount)], [5, p.fretCount]] as const)('frets %i to %i', (from, to) => {
    for (const q of gen(p, interval(p, from, to))) {
      const t = ascii(q.text);
      const m = /^Find the (.+) (above|below) this ([A-G])(bb|b|##|#)?, frets (\d+) to (\d+)$/.exec(t);
      expect(m, `"${t}"`).toBeTruthy();
      expect(Object.values(WORDS)).toContain(m![1]);
      expect([Number(m![5]), Number(m![6])], t).toEqual([from, to]);
      const ref = q.reference[0]!;
      expect((LETTER_PC[m![3]!]! + ACC[m![4] ?? '']! + 120) % 12, `${t}: reference note vs string ${ref.string} fret ${ref.fret}`).toBe((openMidi(p, ref.string) + ref.fret) % 12);
    }
  });
});
