/**
 * T091/T093 code-reviewer r1 (MAJOR) and theory-checker r1 follow-ups, red tests: feedback
 * spelling and octave [FR-049, FR-032, FR-035, FR-036, FR-056].
 *
 * FR-049: "in exact-octave mode and in the other drills it includes the octave ("Correct, G2 on
 * string 6 fret 3")". The octave belongs to the SPELLED note, so it is the letter-based
 * (scientific pitch notation) octave, not floor(MIDI / 12) - 1:
 *   MIDI = 12 * (octave + 1) + LETTER_PC[letter] + accidental      (C4 = 60)
 *   Cb3 = 12*4 + 0 - 1 = 47 (sounds like B2);  B#2 = 12*3 + 11 + 1 = 48 (sounds like C3);
 *   Cb4 = 59;  Cbb4 = 12*5 + 0 - 2 = 58;  Cb5 = 71.
 * Every position's MIDI value below is recomputed by brute force from the profile's open strings.
 *
 * Signature extension (smallest one that carries a multi-step drill's current step):
 *
 *   feedbackText(input: {
 *     profile: InstrumentProfile; question: Question; tap: FretPosition; correct: boolean;
 *     stepIndex?: number;   // the step the tap answered; defaults to 0
 *   }): string
 *
 * Feedback for step k uses step k's spelling (`steps[k].spelled`, else a spelling of
 * `steps[k].accepts`) and step k's valid positions, never steps[0].
 *
 * Incorrect answers in non-note-finding drills must show octaves too: every note name in the
 * text carries an octave, and each such note is one that sounds at a valid position of the step.
 *
 * CR-B2-15 (owner-approved 2026-11-22), spec FR-049: "incorrect feedback names the tapped note and
 * its position first, spelled by FR-060 relative to the prompted note and following this octave
 * rule". Multi-string drills (test-writer decision): "Incorrect. You tapped <note><octave> at
 * string S fret F; " followed by the old remainder. So the first note token of an incorrect text
 * is the TAPPED note (it sounds at the tap); every later token is a valid answer of the step.
 */
import { describe, expect, it } from 'vitest';
import { presetById, presets, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { feedbackText } from './feedback';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question, Step } from './types';

// ---- independent brute-force helpers (not taken from the implementation) ----
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const midiAt = (p: InstrumentProfile, pos: FretPosition) => openMidi(p, pos.string) + pos.fret;
const ascii = (s: string) => s.replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##').replace(/♭/g, 'b').replace(/♯/g, '#');
/** Letter-based MIDI of a token like "Cb3" (undefined when the token has no octave). */
function tokenMidi(tok: { letter: string; acc: string; octave?: string }): number | undefined {
  if (tok.octave === undefined) return undefined;
  return 12 * (Number(tok.octave) + 1) + LETTER_PC[tok.letter]! + ACC[tok.acc]!;
}
/** Every note-name token in a feedback text ("Correct" or "Bb" in "Bbx" are not tokens). */
function noteTokens(text: string) {
  const re = /\b([A-G])(bb|b|##|#)?(-?\d+)?(?![A-Za-z])/g;
  const out: { raw: string; letter: string; acc: string; octave?: string }[] = [];
  for (const m of text.matchAll(re)) out.push({ raw: m[0], letter: m[1]!, acc: m[2] ?? '', ...(m[3] !== undefined ? { octave: m[3] } : {}) });
  return out;
}
/** Brute-force positions sounding `m` on `strings` inside [from, to]. */
function positionsOfMidi(p: InstrumentProfile, m: number, strings: readonly number[], from: number, to: number): FretPosition[] {
  const out: FretPosition[] = [];
  for (const s of strings) for (let f = from; f <= Math.min(to, p.fretCount); f++) if (openMidi(p, s) + f === m) out.push({ string: s, fret: f });
  return out;
}
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

type FbInput = Parameters<typeof feedbackText>[0] & { stepIndex?: number };
const fb = (profile: InstrumentProfile, question: Question, tap: FretPosition, correct: boolean, stepIndex?: number) =>
  ascii(feedbackText({ profile, question, tap, correct, ...(stepIndex !== undefined ? { stepIndex } : {}) } as FbInput));

function gen(p: InstrumentProfile, s: DrillSettings, seed = 1): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
const ct = (over: Partial<DrillSettings>): DrillSettings => ({
  type: 'chord-tone', strings: [5], fromFret: 1, toFret: 4, count: 5, octaveMode: 'any', ...over,
});

const std6 = presetById('guitar6-standard')!.profile;

// Brute-force sanity checks on the expected values themselves.
describe('expected values (brute force, scientific pitch notation)', () => {
  it('Cb3 = 47, B#2 = 48, Cb4 = 59, Cbb4 = 58, Cb5 = 71, Ab3 = 56', () => {
    expect(noteMidi({ letter: 'C', accidental: -1, octave: 3 } as Note)).toBe(47);
    expect(noteMidi({ letter: 'B', accidental: 1, octave: 2 } as Note)).toBe(48);
    expect(noteMidi({ letter: 'C', accidental: -1, octave: 4 } as Note)).toBe(59);
    expect(noteMidi({ letter: 'C', accidental: -2, octave: 4 } as Note)).toBe(58);
    expect(noteMidi({ letter: 'C', accidental: -1, octave: 5 } as Note)).toBe(71);
    expect(noteMidi({ letter: 'A', accidental: -1, octave: 3 } as Note)).toBe(56);
    expect(midiAt(std6, { string: 5, fret: 2 })).toBe(47);
    expect(midiAt(std6, { string: 5, fret: 3 })).toBe(48);
    expect(midiAt(std6, { string: 2, fret: 0 })).toBe(59);
    expect(midiAt(std6, { string: 3, fret: 3 })).toBe(58);
    expect(midiAt(std6, { string: 1, fret: 7 })).toBe(71);
    expect(midiAt(std6, { string: 3, fret: 1 })).toBe(56);
  });
});

// =============================================================================================
describe('FR-049 the octave belongs to the spelled note (letter octave)', () => {
  it('Abm b3 = Cb on string 5 fret 2 (MIDI 47) is "Cb3", never "Cb2"', () => {
    const [q] = gen(std6, ct({ roots: ['Ab'], qualities: ['minor'], functions: ['b3'] }));
    expect(q!.steps[0]!.valid).toEqual([{ string: 5, fret: 2 }]);
    const right = fb(std6, q!, { string: 5, fret: 2 }, true);
    expect(right).toBe('Correct, Cb3 on string 5 fret 2');
    const wrong = fb(std6, q!, { string: 5, fret: 3 }, false);
    expect(wrong).toContain('Cb3');
    expect(wrong).not.toContain('Cb2');
  });

  it('Abm b3 = Cb on string 2 fret 0 (MIDI 59) is "Cb4", never "Cb3"', () => {
    const [q] = gen(std6, ct({ strings: [2], fromFret: 0, toFret: 3, roots: ['Ab'], qualities: ['minor'], functions: ['b3'] }));
    expect(q!.steps[0]!.valid).toEqual([{ string: 2, fret: 0 }]);
    const right = fb(std6, q!, { string: 2, fret: 0 }, true);
    expect(right.startsWith('Correct, Cb4 on string 2')).toBe(true);
    expect(right).not.toContain('Cb3');
    const wrong = fb(std6, q!, { string: 2, fret: 2 }, false);
    expect(wrong).toContain('Cb4');
    expect(wrong).not.toContain('Cb3');
  });

  it('G# major 3rd = B# on string 5 fret 3 (MIDI 48) is "B#2": the letter octave is one below the MIDI octave', () => {
    const [q] = gen(std6, ct({ roots: ['G#'], qualities: ['major'], functions: ['3'] }));
    expect(q!.steps[0]!.valid).toEqual([{ string: 5, fret: 3 }]);
    // floor(48 / 12) - 1 = 3 is the MIDI octave; B# is spelled one letter-octave lower.
    expect(Math.floor(48 / 12) - 1).toBe(3);
    const right = fb(std6, q!, { string: 5, fret: 3 }, true);
    expect(right).toBe('Correct, B#2 on string 5 fret 3');
    expect(right).not.toContain('B#3');
    const wrong = fb(std6, q!, { string: 5, fret: 1 }, false);
    expect(wrong).toContain('B#2');
    expect(wrong).not.toContain('B#3');
  });

  it('Db dim7 bb7 = Cbb on string 3 fret 3 (MIDI 58) is "Cbb4"', () => {
    const [q] = gen(std6, ct({ strings: [3], roots: ['Db'], qualities: ['dim7'], functions: ['bb7'] }));
    expect(q!.steps[0]!.valid).toEqual([{ string: 3, fret: 3 }]);
    const right = fb(std6, q!, { string: 3, fret: 3 }, true);
    expect(right).toBe('Correct, Cbb4 on string 3 fret 3');
    const wrong = fb(std6, q!, { string: 3, fret: 1 }, false);
    expect(wrong).toContain('Cbb4');
    expect(wrong).not.toContain('Cbb3');
  });

  it('interval Ab4 + m3 up: the answer at MIDI 71 (string 1 fret 7) is "Cb5", never "B4"', () => {
    // Hand-built question: reference Ab4 at string 1 fret 4 (MIDI 68); Ab + m3 = Cb (letter A -> C, 3 semitones).
    const ref = { string: 1, fret: 4 };
    expect(midiAt(std6, ref)).toBe(68);
    const valid = positionsOfMidi(std6, 71, allStrings(std6), 0, 12);
    const q: Question = {
      drillType: 'interval',
      itemKey: 'iv|m3|up',
      prompt: { drillType: 'interval', root: ref, interval: 'm3' } as Question['prompt'],
      text: 'Find the minor 3rd above this Ab',
      steps: [{ label: 'minor 3rd', valid, accepts: [71 % 12], spelled: { letter: 'C', accidental: -1 } }],
      reference: [ref],
      group: 'minor 3rd up',
    };
    expect(fb(std6, q, { string: 1, fret: 7 }, true)).toBe('Correct, Cb5 on string 1 fret 7');
    const wrong = fb(std6, q, { string: 1, fret: 8 }, false);
    expect(wrong).toContain('Cb5');
    expect(wrong).not.toMatch(/\bB4\b|Cb4/);
  });
});

// =============================================================================================
describe('FR-049 / FR-032 interval questions carry no context: spelling still comes from the step', () => {
  // String 4 frets 1-3 and string 3: the only reference with a m3 above inside the range is F3
  // (string 4 fret 3, MIDI 53); F + m3 = Ab, and Ab3 (MIDI 56) is string 3 fret 1.
  const s: DrillSettings = { type: 'interval', strings: [4, 3], fromFret: 1, toFret: 3, count: 5, octaveMode: 'any', intervals: ['m3'], direction: 'up' };

  it('reference F3 at string 4 fret 3, m3 up, tap string 3 fret 1: "Correct, Ab3 on string 3 fret 1" (never G#)', () => {
    const [q] = gen(std6, s);
    expect(q!.context).toBeUndefined();
    expect(q!.reference).toEqual([{ string: 4, fret: 3 }]);
    const t = fb(std6, q!, { string: 3, fret: 1 }, true);
    expect(t).toBe('Correct, Ab3 on string 3 fret 1');
    expect(t).not.toContain('G#');
  });

  it('F2 at string 6 fret 1 + m3 = Ab2 (MIDI 44, string 6 fret 4); string 3 fret 1 is Ab3 (MIDI 56), the wrong octave (FR-035 exact pitch), so it is incorrect and names Ab2', () => {
    const [q] = gen(std6, { ...s, strings: [6], fromFret: 1, toFret: 4 });
    expect(q!.reference).toEqual([{ string: 6, fret: 1 }]);
    const wrong = fb(std6, q!, { string: 6, fret: 3 }, false);
    // spec FR-049 (CR-B2-15): "incorrect feedback names the tapped note and its position first"
    expect(wrong.startsWith('Incorrect. You tapped G2 at string 6 fret 3; '), wrong).toBe(true); // G = b7 of Ab, 2 of F
    expect(wrong).toContain('Ab2');
    expect(wrong).not.toContain('G#');
  });
});

// =============================================================================================
describe('FR-049 incorrect answers in interval, chord-tone and bass drills include octaves', () => {
  it('interval F2 + m3: incorrect text names Ab2 with its octave', () => {
    const [q] = gen(std6, { type: 'interval', strings: [6], fromFret: 1, toFret: 4, count: 5, octaveMode: 'any', intervals: ['m3'], direction: 'up' });
    const wrong = fb(std6, q!, { string: 6, fret: 2 }, false);
    // spec FR-049 (CR-B2-15): "incorrect feedback names the tapped note and its position first, spelled by FR-060 relative to the prompted note"
    // F#/Gb (MIDI 42): b7 of Ab (target) and b2 of F (reference) are both Gb.
    expect(wrong).toBe('Incorrect. You tapped Gb2 at string 6 fret 2; Ab2 is at string 6 fret 4');
  });

  // Tap moved from fret 2 (B: "B" from root G, "Cb" from the prompted Bb, ambiguous for chord drills)
  // to fret 3 (C3: the 4 of G and the 2 of Bb, so "C" under either reading of FR-060's root).
  it('chord-tone Gm b3 on string 5 frets 1-4: incorrect text is "Incorrect. You tapped C3 at string 5 fret 3; Bb2 is at string 5 fret 1"', () => {
    const [q] = gen(std6, ct({ roots: ['G'], qualities: ['minor'], functions: ['b3'] }));
    // spec FR-049 (CR-B2-15): "incorrect feedback names the tapped note and its position first"
    expect(fb(std6, q!, { string: 5, fret: 3 }, false)).toBe('Incorrect. You tapped C3 at string 5 fret 3; Bb2 is at string 5 fret 1');
  });
});

// =============================================================================================
describe('FR-049 multi-step drills: feedback for step k uses step k, not steps[0]', () => {
  const near = (strings: readonly number[], m: number) => positionsOfMidi(std6, m, strings, 2, 8);

  // Root-fifth-octave from A2 (string 6 fret 5, MIDI 45): 5th = E3 (52), octave = A3 (57).
  const ref = { string: 6, fret: 5 };
  const rfoSteps: Step[] = [
    { label: '5', valid: near(allStrings(std6), 52), accepts: [52 % 12], spelled: { letter: 'E', accidental: 0 } },
    { label: 'octave', valid: near(allStrings(std6), 57), accepts: [57 % 12], spelled: { letter: 'A', accidental: 0 } },
  ];
  const rfo: Question = {
    drillType: 'root-fifth-octave',
    itemKey: 'rfo|9',
    prompt: { drillType: 'root-fifth-octave', root: ref, qualityId: 'major' } as Question['prompt'],
    text: 'Play the 5th, then the octave, from this root (A)',
    steps: rfoSteps,
    reference: [ref],
    context: { root: { letter: 'A', accidental: 0 }, qualityId: 'major' },
    group: 'Root A',
  };

  it('brute force: A3 (MIDI 57) is at string 4 fret 7 and string 3 fret 2 inside frets 2-8', () => {
    expect(midiAt(std6, ref)).toBe(45);
    expect(rfoSteps[1]!.valid).toEqual(expect.arrayContaining([{ string: 4, fret: 7 }, { string: 3, fret: 2 }]));
  });

  it('root-fifth-octave step 0 (the 5th): "Correct, E3 on string 5 fret 7"', () => {
    expect(fb(std6, rfo, { string: 5, fret: 7 }, true, 0)).toBe('Correct, E3 on string 5 fret 7');
  });

  it('root-fifth-octave step 1 (the octave): "Correct, A3 on string 4 fret 7", not E3', () => {
    const t = fb(std6, rfo, { string: 4, fret: 7 }, true, 1);
    expect(t).toBe('Correct, A3 on string 4 fret 7');
    expect(t).not.toContain('E');
  });

  it('root-fifth-octave step 1 incorrect: names A3 at step 1\'s positions, not the 5th\'s', () => {
    const t = fb(std6, rfo, { string: 4, fret: 5 }, false, 1);
    // CR-B2-15: D3 + 5 = G3 (the b7 of A, FR-060), named first.
    expect(t.startsWith('Incorrect. You tapped G3 at string 4 fret 5; '), t).toBe(true);
    expect(t).toContain('A3');
    expect(t).not.toMatch(/\bE3\b/);
    expect(t).toContain('string 4 fret 7');
    expect(t).not.toContain('string 5 fret 7'); // that's the 5th (step 0)
  });

  // Abm arpeggio from Ab2 (string 6 fret 4, MIDI 44): b3 = Cb3 (47), 5 = Eb3 (51), octave = Ab3 (56).
  const aref = { string: 6, fret: 4 };
  const arpSteps: Step[] = [
    { label: 'b3', valid: near(allStrings(std6), 47), accepts: [47 % 12], spelled: { letter: 'C', accidental: -1 } },
    { label: '5', valid: near(allStrings(std6), 51), accepts: [51 % 12], spelled: { letter: 'E', accidental: -1 } },
    { label: 'octave', valid: near(allStrings(std6), 56), accepts: [56 % 12], spelled: { letter: 'A', accidental: -1 } },
  ];
  const arp: Question = {
    drillType: 'arpeggio',
    itemKey: 'bs|arpeggio|minor',
    prompt: { drillType: 'arpeggio', root: aref, qualityId: 'minor' } as Question['prompt'],
    text: 'Play the Abm arpeggio up from this root (Ab)',
    steps: arpSteps,
    reference: [aref],
    context: { root: { letter: 'A', accidental: -1 }, qualityId: 'minor' },
    group: 'Minor',
  };

  it('brute force: Cb3 at string 5 fret 2, Eb3 at string 5 fret 6, Ab3 at string 4 fret 6', () => {
    expect(midiAt(std6, aref)).toBe(44);
    expect(arpSteps[0]!.valid).toContainEqual({ string: 5, fret: 2 });
    expect(arpSteps[1]!.valid).toContainEqual({ string: 5, fret: 6 });
    expect(arpSteps[2]!.valid).toContainEqual({ string: 4, fret: 6 });
  });

  it.each([
    [0, { string: 5, fret: 2 }, 'Correct, Cb3 on string 5 fret 2'],
    [1, { string: 5, fret: 6 }, 'Correct, Eb3 on string 5 fret 6'],
    [2, { string: 4, fret: 6 }, 'Correct, Ab3 on string 4 fret 6'],
  ] as const)('arpeggio step %i: %j -> "%s"', (k, tap, expected) => {
    expect(fb(std6, arp, tap, true, k)).toBe(expected);
  });

  it('arpeggio step 2 incorrect names Ab3 (letter octave), not Cb', () => {
    const t = fb(std6, arp, { string: 4, fret: 4 }, false, 2);
    // CR-B2-15: D3 + 4 = F#3/Gb3 (MIDI 54): b7 of Ab, so "Gb3", named first.
    expect(t.startsWith('Incorrect. You tapped Gb3 at string 4 fret 4; '), t).toBe(true);
    expect(t).toContain('Ab3');
    expect(t).not.toContain('Cb');
  });

  it('omitting stepIndex still means step 0 (backward compatible)', () => {
    expect(fb(std6, arp, { string: 5, fret: 2 }, true)).toBe('Correct, Cb3 on string 5 fret 2');
  });
});

// =============================================================================================
describe.each(presets().map((pr) => [pr.presetId, pr.profile] as const))(
  'FR-049 invariants over generated questions, %s (all InstrumentProfiles)',
  (_id, p) => {
    const top = Math.min(12, p.fretCount);
    const drills: DrillSettings[] = [
      { type: 'chord-tone', strings: allStrings(p), fromFret: 0, toFret: top, count: 30, octaveMode: 'any', roots: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'G#', 'C#'], qualities: ['major', 'minor', 'dim7', 'aug'] },
      { type: 'interval', strings: allStrings(p), fromFret: 0, toFret: top, count: 30, octaveMode: 'any', intervals: ['m2', 'm3', 'M3', 'P4', 'd5', 'm6', 'm7'], direction: 'both' },
      { type: 'arpeggio', strings: allStrings(p), fromFret: 0, toFret: top, count: 15, octaveMode: 'any', qualities: ['major', 'minor', 'dim', 'aug'] },
      { type: 'root-fifth-octave', strings: allStrings(p), fromFret: 0, toFret: top, count: 15, octaveMode: 'any' },
    ];

    it.each(drills.map((d) => [d.type, d] as const))('%s: every step\'s feedback names the step\'s note with its letter octave', (_t, d) => {
      const qs = gen(p, d, 7);
      for (const q of qs) {
        q.steps.forEach((step, k) => {
          if (!step.valid.length) return;
          const tap = step.valid[0]!;
          // Correct: the one note token sounds exactly at the tapped position and is one of the step's pitch classes.
          const right = fb(p, q, tap, true, k);
          expect(right.startsWith('Correct, ')).toBe(true);
          const [tok] = noteTokens(right.slice('Correct, '.length));
          expect(tok, right).toBeDefined();
          const m = tokenMidi(tok!);
          expect(m, `${right} (step ${k}, ${q.text})`).toBe(midiAt(p, tap));
          expect(step.accepts).toContain(((m! % 12) + 12) % 12);
          // Incorrect: every note token has an octave and sounds at one of the step's valid positions.
          const validMidis = new Set(step.valid.map((v) => midiAt(p, v)));
          const wrongPos = [...Array(top + 1).keys()].map((f) => ({ string: tap.string, fret: f })).find((x) => !validMidis.has(midiAt(p, x)));
          if (!wrongPos) return;
          const wrong = fb(p, q, wrongPos, false, k);
          // spec FR-049 (CR-B2-15): "incorrect feedback names the tapped note and its position first ... following this octave rule"
          const lead = /^Incorrect\. You tapped (\S+) at string (\d+) fret (\d+); /.exec(wrong);
          expect(lead, wrong).toBeTruthy();
          expect([Number(lead![2]), Number(lead![3])], wrong).toEqual([wrongPos.string, wrongPos.fret]);
          const [tapTok] = noteTokens(lead![1]!);
          expect(tapTok?.octave, `${wrong}: the tapped note has no octave`).toBeDefined();
          expect(tokenMidi(tapTok!), `${wrong}: the tapped note does not sound at the tap`).toBe(midiAt(p, wrongPos));
          const rest = wrong.slice(lead![0].length);
          if (rest.startsWith('Outside frets')) return; // FR-036 reason: the right tone outside the window names no other note
          const toks = noteTokens(rest);
          expect(toks.length, wrong).toBeGreaterThan(0);
          for (const t of toks) {
            expect(t.octave, `${wrong}: "${t.raw}" has no octave`).toBeDefined();
            expect(validMidis.has(tokenMidi(t)!), `${wrong}: "${t.raw}" is not a valid answer of step ${k}`).toBe(true);
          }
        });
      }
    });
  },
);
