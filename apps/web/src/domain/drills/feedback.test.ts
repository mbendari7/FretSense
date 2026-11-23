/**
 * T090 (red, test-first): feedback text [FR-032, FR-049].
 *
 * There is no feedback-text domain module yet (the wording is built inline in
 * ui/screens/DrillRunner.tsx). These tests target the expected export
 *
 *   feedbackText(input: { profile: InstrumentProfile; question: Question; tap: FretPosition; correct: boolean }): string
 *
 * from `apps/web/src/domain/drills/feedback.ts` (name chosen by the caller for T091; the signature
 * is the smallest one that carries what FR-049 needs: the question holds the prompted spelling, the
 * octave mode (prompt.midi !== null ⇔ exact octave) and the correct positions inside the
 * question's fret range).
 *
 * Expected strings are the spec's own examples:
 *   FR-049  "Correct, G on string 6 fret 3"; (fret range 0–15, after a tap at fret 1) "Incorrect. You tapped F at
 *           fret 1; G on string 6 is at frets 3 and 15"; "incorrect feedback names the tapped note and its
 *           position first, spelled by FR-060 relative to the prompted note and following this octave
 *           rule" (CR-B2-15, owner-approved 2026-11-22); exact-octave and other drills include the
 *           octave: "Correct, G2 on string 6 fret 3".
 *   FR-060  outside notes are spelled from the root by the fixed map 1 b2 2 b3 3 4 #4 5 b6 6 b7 7
 *           (double accidentals allowed). `fr060()` below re-implements that table independently.
 *   Multi-string drills (test-writer decision, CR-B2-15): the tapped position is named
 *   "at string S fret F" (note-finding names "at fret F", since only the prompted string is judged).
 *   FR-032  6-string Standard, prompt "B♭" ⇒ "Correct, B♭ on string 5 fret 1", never "A♯"; "B♭2" in exact-octave mode.
 * Positions and octaves are recomputed by brute force (MIDI = 12·(octave + 1) + letter + accidental + fret).
 * Accidentals are compared in ASCII (♭ ⇒ b, ♯ ⇒ #), since FR-005 lets the UI render either.
 */
import { describe, expect, it } from 'vitest';
import { presetById, presets, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { feedbackText } from './feedback';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string) => s.replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##').replace(/♭/g, 'b').replace(/♯/g, '#');
/** A note name immediately followed by an octave digit (e.g. "G2", "Bb-1"). */
const NOTE_WITH_OCTAVE = /\b[A-G](?:bb|b|##|#)?-?\d/;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACC_OF: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const ACC_STR: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const mod12 = (x: number) => ((x % 12) + 12) % 12;
/** FR-060 letter steps per semitone above the root: 1 b2 2 b3 3 4 #4 5 b6 6 b7 7. */
const FR060_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
/** FR-060 spelling of pitch class `pc` relative to the root note name `root` (e.g. "G", "Bb"), ASCII. */
function fr060(root: string, pc: number): { letter: string; acc: number; name: string } {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(root)!;
  const rootPc = mod12(LETTER_PC[m[1]!]! + ACC_OF[m[2] ?? '']!);
  const letter = LETTERS[(LETTERS.indexOf(m[1]!) + FR060_STEPS[mod12(pc - rootPc)]!) % 7]!;
  const acc = mod12(pc - LETTER_PC[letter]! + 6) - 6;
  return { letter, acc, name: letter + ACC_STR[acc]! };
}
/** Letter (scientific pitch) octave of a spelled note sounding at MIDI `m`. */
const letterOct = (n: { letter: string; acc: number }, m: number) => (m - LETTER_PC[n.letter]! - n.acc) / 12 - 1;

function gen(p: InstrumentProfile, s: DrillSettings, seed = 1): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
const nf = (p: InstrumentProfile, over: Partial<DrillSettings> = {}): DrillSettings => ({
  type: 'note-finding', strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 5, octaveMode: 'any', ...over,
});
const fb = (profile: InstrumentProfile, question: Question, tap: FretPosition, correct: boolean) => ascii(feedbackText({ profile, question, tap, correct }));
const promptedNote = (q: Question) => /^Find ([A-G](?:bb|b|##|#)?-?\d*)/.exec(ascii(q.text))![1]!;

const std6 = presetById('guitar6-standard')!.profile;

// =============================================================================================
describe('FR-049 note-finding feedback, any-octave mode: no octave numbers', () => {
  it('correct: "Correct, G on string 6 fret 3"', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7] }));
    expect(fb(std6, q!, { string: 6, fret: 3 }, true)).toBe('Correct, G on string 6 fret 3');
  });

  // spec FR-049 (CR-B2-15): "(fret range 0–15, after a tap at fret 1) "Incorrect. You tapped F at fret 1; G on string 6 is at frets 3 and 15""
  it('incorrect, fret range 0–15, tap at fret 1: "Incorrect. You tapped F at fret 1; G on string 6 is at frets 3 and 15"', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], toFret: 15 }));
    expect(fb(std6, q!, { string: 6, fret: 1 }, false)).toBe('Incorrect. You tapped F at fret 1; G on string 6 is at frets 3 and 15');
  });

  it('incorrect, tap at fret 5 (A, the 2nd above G by FR-060): "Incorrect. You tapped A at fret 5; G on string 6 is at frets 3 and 15"', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], toFret: 15 }));
    expect(fb(std6, q!, { string: 6, fret: 5 }, false)).toBe('Incorrect. You tapped A at fret 5; G on string 6 is at frets 3 and 15');
  });

  it('the tapped note is spelled by FR-060 relative to the prompted note: prompt Bb on string 5, tap fret 2 (pc 11) is "Cb" (b2 of Bb), never "B"', () => {
    const [q] = gen(std6, nf(std6, { strings: [5], notes: [10] }));
    const name = promptedNote(q!);
    const expected = fr060(name, 11).name; // Bb ⇒ Cb; A# ⇒ B
    expect(fb(std6, q!, { string: 5, fret: 2 }, false)).toBe(`Incorrect. You tapped ${expected} at fret 2; ${name} on string 5 is at fret 1`);
  });

  it('incorrect lists only the correct frets inside the question\'s fret range (0–12 ⇒ fret 3 only, not 15)', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], toFret: 12 }));
    const t = fb(std6, q!, { string: 6, fret: 5 }, false);
    expect(t.startsWith('Incorrect. You tapped A at fret 5; G on string 6 is at fret')).toBe(true);
    expect(t.slice(t.indexOf(' is at ')).match(/\d+/g)).toEqual(['3']);
  });

  it.each(presets().map((pr) => [pr.presetId, pr.profile] as const))(
    '%s: every correct and incorrect feedback uses the prompted spelling and no octave (all InstrumentProfiles)',
    (_id, p) => {
      const qs = gen(p, nf(p, { count: 40 }), 11);
      for (const q of qs) {
        const name = promptedNote(q);
        const s = q.promptedString!;
        // brute force: frets on the prompted string, inside 0..min(12, fretCount), with this pitch class
        const frets: number[] = [];
        const pc = q.steps[0]!.accepts[0]!;
        for (let f = 0; f <= Math.min(12, p.fretCount); f++) if ((openMidi(p, s) + f) % 12 === pc) frets.push(f);
        const right = fb(p, q, { string: s, fret: frets[0]! }, true);
        expect(right).toBe(`Correct, ${name} on string ${s} fret ${frets[0]}`);
        expect(right).not.toMatch(NOTE_WITH_OCTAVE);
        const wrongFret = [...Array(Math.min(12, p.fretCount) + 1).keys()].find((f) => !frets.includes(f))!;
        const wrong = fb(p, q, { string: s, fret: wrongFret }, false);
        // CR-B2-15: the tapped note first, FR-060 relative to the prompted note, no octave (any-octave mode).
        const tapped = fr060(name, mod12(openMidi(p, s) + wrongFret)).name;
        expect(wrong.startsWith(`Incorrect. You tapped ${tapped} at fret ${wrongFret}; ${name} on string ${s} is at fret`), wrong).toBe(true);
        expect(wrong).not.toMatch(NOTE_WITH_OCTAVE);
        expect(wrong.slice(wrong.indexOf(' is at ')).match(/\d+/g)!.map(Number)).toEqual(frets); // ascending
      }
    },
  );
});

describe('FR-049 note-finding feedback, exact-octave mode: includes the octave', () => {
  it('correct: "Correct, G2 on string 6 fret 3"', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], octaveMode: 'exact' }));
    expect(fb(std6, q!, { string: 6, fret: 3 }, true)).toBe('Correct, G2 on string 6 fret 3');
  });

  // spec FR-049 (CR-B2-15): the tapped note "follow[s] this octave rule": exact-octave mode includes the octave.
  it('incorrect, frets 0–15, tap at fret 1: "Incorrect. You tapped F2 at fret 1; G2 on string 6 is at fret 3" (E2 + 1 = F2)', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], toFret: 15, octaveMode: 'exact' }));
    expect(promptedNote(q!)).toBe('G2');
    expect(fb(std6, q!, { string: 6, fret: 1 }, false)).toBe('Incorrect. You tapped F2 at fret 1; G2 on string 6 is at fret 3');
  });

  it('incorrect, the right letter in the wrong octave: "Incorrect. You tapped G3 at fret 15; G2 on string 6 is at fret 3" (E2 + 15 = MIDI 55 = G3)', () => {
    const [q] = gen(std6, nf(std6, { strings: [6], notes: [7], toFret: 15, octaveMode: 'exact' }));
    expect(fb(std6, q!, { string: 6, fret: 15 }, false)).toBe('Incorrect. You tapped G3 at fret 15; G2 on string 6 is at fret 3');
  });

  it.each(presets().map((pr) => [pr.presetId, pr.profile] as const))(
    '%s: the tapped note carries its letter octave, spelled by FR-060 relative to the prompt (all InstrumentProfiles)',
    (_id, p) => {
      const top = Math.min(12, p.fretCount);
      for (const q of gen(p, nf(p, { count: 30, octaveMode: 'exact' }), 5)) {
        const prompted = promptedNote(q); // e.g. "Bb2"
        const root = prompted.replace(/-?\d+$/, '');
        const s = q.promptedString!;
        const right = new Set(q.steps[0]!.valid.filter((v) => v.string === s).map((v) => v.fret));
        const f = [...Array(top + 1).keys()].find((x) => !right.has(x));
        if (f === undefined) continue;
        const m = openMidi(p, s) + f;
        const sp = fr060(root, mod12(m));
        const wrong = fb(p, q, { string: s, fret: f }, false);
        expect(wrong.startsWith(`Incorrect. You tapped ${sp.name}${letterOct(sp, m)} at fret ${f}; `), wrong).toBe(true);
      }
    },
  );
});

// =============================================================================================
describe('FR-032 one spelling per question across prompt and feedback', () => {
  it('6-string Standard, pitch class 10 on string 5: the feedback uses the prompt\'s spelling (spec: "B♭" ⇒ "Correct, B♭ on string 5 fret 1")', () => {
    const [q] = gen(std6, nf(std6, { strings: [5], notes: [10] }));
    const name = promptedNote(q!);
    expect(['Bb', 'A#']).toContain(name);
    expect(fb(std6, q!, { string: 5, fret: 1 }, true)).toBe(`Correct, ${name} on string 5 fret 1`);
    const other = name === 'Bb' ? 'A#' : 'Bb';
    const wrong = fb(std6, q!, { string: 5, fret: 3 }, false);
    expect(wrong).not.toContain(other);
    // CR-B2-15: fret 3 on A2 is C, the 2nd above Bb (or B# above A#) by FR-060.
    expect(wrong.startsWith(`Incorrect. You tapped ${fr060(name, 0).name} at fret 3; `), wrong).toBe(true);
  });

  it('exact-octave: "Correct, <spelling>2 on string 5 fret 1" (A2 + 1 semitone = MIDI 46, octave 2)', () => {
    const [q] = gen(std6, nf(std6, { strings: [5], notes: [10], octaveMode: 'exact' }));
    const name = promptedNote(q!); // e.g. "Bb2"
    expect(name).toMatch(/^(Bb|A#)2$/);
    expect(fb(std6, q!, { string: 5, fret: 1 }, true)).toBe(`Correct, ${name} on string 5 fret 1`);
  });

  it('interval drill: the answer is the reference transposed by the interval (F2 + m3 = Ab2, never G#2), with octave', () => {
    // String 6 frets 1–4: the only reference with a minor 3rd above inside the range is F2 (fret 1); Ab2 is fret 4.
    const s: DrillSettings = { type: 'interval', strings: [6], fromFret: 1, toFret: 4, count: 5, octaveMode: 'any', intervals: ['m3'], direction: 'up' };
    const [q] = gen(std6, s);
    expect(q!.reference).toEqual([{ string: 6, fret: 1 }]);
    const t = fb(std6, q!, { string: 6, fret: 4 }, true);
    expect(t).toBe('Correct, Ab2 on string 6 fret 4');
    expect(t).not.toContain('G#');
  });

  it('chord-tone drill: the b3 of Gm is Bb (chord spelling, FR-005) in feedback, with octave', () => {
    // String 5 (A2), frets 1–4: the window is frets 1 to 4; Bb2 is fret 1.
    const s: DrillSettings = { type: 'chord-tone', strings: [5], fromFret: 1, toFret: 4, count: 5, octaveMode: 'any', roots: ['G'], qualities: ['minor'], functions: ['b3'] };
    const [q] = gen(std6, s);
    expect(fb(std6, q!, { string: 5, fret: 1 }, true)).toBe('Correct, Bb2 on string 5 fret 1');
    const wrong = fb(std6, q!, { string: 5, fret: 2 }, false);
    expect(wrong).not.toContain('A#');
  });

  // CR-B2-15 in multi-string drills (test-writer decision): "Incorrect. You tapped <note><octave> at string S fret F; " + the old remainder.
  it('interval drill, incorrect: "Incorrect. You tapped Gb2 at string 6 fret 2; Ab2 is at string 6 fret 4" (F#/Gb is b7 of Ab and b2 of F: Gb either way)', () => {
    const s: DrillSettings = { type: 'interval', strings: [6], fromFret: 1, toFret: 4, count: 5, octaveMode: 'any', intervals: ['m3'], direction: 'up' };
    const [q] = gen(std6, s);
    expect(fb(std6, q!, { string: 6, fret: 2 }, false)).toBe('Incorrect. You tapped Gb2 at string 6 fret 2; Ab2 is at string 6 fret 4');
  });
});
