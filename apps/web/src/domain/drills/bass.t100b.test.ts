/**
 * T100b (red, test-first) [FR-056, FR-056a, FR-057]: root–fifth–octave valid-shape judging,
 * wrong-tap charging, and arpeggio window fit / prompt, at the generator + session level.
 *
 * spec.md FR-056 (product-owner 2026-11-22, provisional): "A **valid shape** is a root position R on
 * a selected string within the fret range, plus a position sounding exactly R + 7 semitones (the 5th)
 * and one sounding exactly R + 12 (the octave), all on selected strings within the fret range, whose
 * frets span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret 0). Any octave of
 * the root pitch class may be the root. A tap is **accepted** if at least one valid shape contains it
 * together with every earlier accepted or revealed position in the question; otherwise it is a wrong
 * tap (FR-056a). [...] The prompt states the fret range in play, as FR-035 does: "Play a
 * root–fifth–octave shape for C, frets 0 to 12"."
 * spec.md FR-056a: "[a wrong tap is] charged to one pending step: to Step 2 (5th) if the tap has the
 * 5th's pitch class and Step 2 is pending; to the lowest-numbered pending of Step 1 (root) and Step 3
 * (octave) if it has the root's pitch class; otherwise to the lowest-numbered pending step. That step
 * is marked missed [...] and its correct position revealed, from a valid shape containing every
 * accepted and revealed position (if several fit, the first in this order: lowest-pitched root; then
 * root at the lower fret, then on the higher string number; then the same two tests for the 5th's
 * position, then for the octave's). Revealed positions count as fixed for the rest of the question.
 * [...] the question ends when all three steps are judged. [...] The question is recorded as one
 * attempt (FR-040) when its last step is judged [...] answer positions are every judged tap in tap
 * order [...] A tap on a position already tapped or revealed in this question is ignored (not judged,
 * charged or recorded)." FR-056a also: "If a placed tap exists when a wrong tap arrives, it is
 * resolved first: the reveal shape is chosen (preferring shapes in which the placed tap is the root,
 * then the reveal order below), the placed tap takes its role in that shape and is marked correct".
 * FR-056: "Only positions inside the fret range are drawn as targets, so no out-of-range reason
 * exists." (Clarifications "test-writer T100b gaps", 2026-11-22.)
 * spec.md FR-057: "inside an inclusive fret window [s, s + w − 1] (default w = 5), where the lowest
 * root is the lowest-pitched position of the root pitch class on a selected string inside the window.
 * The generator chooses s (within the fret range) only where every step's exact pitch, ascending from
 * that lowest root, has at least one position on a selected string inside the window [...] The prompt
 * names the chord as FR-036 does and states the window: "Play the A minor 7th arpeggio (Am7) up from
 * its lowest A, frets 5 to 9"." FR-036 quality names: maj "major", min "minor", dim "diminished", aug
 * "augmented", sus2 "suspended 2nd", sus4 "suspended 4th", 7 "dominant 7th", maj7 "major 7th", m7
 * "minor 7th", m7b5 "half-diminished 7th", dim7 "diminished 7th", add9 "add 9".
 *
 * Independent sources only: pitches are MIDI = 12·(octave + 1) + letter + accidental from each
 * profile's open strings, plus the fret; chord formulas (semitones above the root) are standard
 * theory, typed out below. The FR-056 shapes are brute-forced over every position triple.
 *
 * Fixture area (brute-forced in the first test): 4-string EADG (E1 A1 D2 G2 = MIDI 28 33 38 43),
 * strings 1–3, frets 0–20, root C. Exactly two valid shapes exist, with different root pitches, so
 * FR-056a's "lowest-pitched root" reveal is always unique here:
 *   S1: root C2 (36) string 3 fret 3, 5th G2 (43) string 2 fret 5, octave C3 (48) string 1 fret 5
 *   S4: root C3 (48) string 3 fret 15, 5th G3 (55) string 2 fret 17, octave C4 (60) string 1 fret 17
 * (S1 and S4 are the "C2 root" and "C3 root" shapes: FR-056 "any octave of the root may be the root".)
 *
 * In this 4-string fixture no root-pitch-class tap is ever "placed" (each has at most one role). The
 * placed case uses 5-string BEADG (US6 scenario 13), brute-forced in its own block below. The session
 * is driven only through its public tap()/snapshot().
 */
import { describe, expect, it } from 'vitest';
import { presetById, presets, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions, validateSettings } from './generate';
import { mulberry32 } from '../prng';
import { DrillSession } from './session';
import type { DrillSettings, Question } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const posMidi = (p: InstrumentProfile, x: FretPosition) => openMidi(p, x.string) + x.fret;
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const k = (x: FretPosition) => `${x.string}/${x.fret}`;
const ascii = (s: string) => s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/𝄫/g, 'bb').replace(/𝄪/g, '##');
const pcOfName = (n: string) => pcOf(LETTER_PC[n[0]!]! + (n.slice(1) === '#' ? 1 : n.slice(1) === 'b' ? -1 : n.slice(1) === '##' ? 2 : n.slice(1) === 'bb' ? -2 : 0));

const bass4 = presetById('bass4-standard')!.profile;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

function area(p: InstrumentProfile, strings: readonly number[], from: number, to: number): (FretPosition & { midi: number })[] {
  const out: (FretPosition & { midi: number })[] = [];
  for (const s of strings) for (let f = from; f <= to; f++) out.push({ string: s, fret: f, midi: openMidi(p, s) + f });
  return out;
}
type Shape = { r: FretPosition & { midi: number }; f: FretPosition & { midi: number }; o: FretPosition & { midi: number } };
/** FR-056 valid shapes for root pitch class pc, brute-forced over every position triple. */
function shapes(p: InstrumentProfile, strings: readonly number[], from: number, to: number, pc: number): Shape[] {
  const A = area(p, strings, from, to);
  const out: Shape[] = [];
  for (const r of A) {
    if (pcOf(r.midi) !== pc) continue;
    for (const f of A) {
      if (f.midi !== r.midi + 7) continue;
      for (const o of A) {
        if (o.midi !== r.midi + 12) continue;
        const fr = [r.fret, f.fret, o.fret];
        if (Math.max(...fr) - Math.min(...fr) <= 3) out.push({ r, f, o });
      }
    }
  }
  return out;
}

function gen(p: InstrumentProfile, s: DrillSettings, seed: number): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
function findQ(p: InstrumentProfile, s: DrillSettings, pred: (q: Question) => boolean): Question | undefined {
  for (let seed = 1; seed <= 60; seed++) {
    const q = gen(p, s, seed).find(pred);
    if (q) return q;
  }
  return undefined;
}

/** Plays taps on a fresh session; returns how many taps it took to finish and each step's outcome. */
function play(q: Question, taps: readonly FretPosition[]) {
  const session = new DrillSession([q], 0);
  for (const [i, t] of taps.entries()) {
    const r = session.tap(t, 100 * (i + 1));
    if (r?.finished) {
      const results = session.snapshot().stepResults;
      return { tapsUsed: i + 1, correct: r.finished.correct, steps: [0, 1, 2].map((j) => (results[j] ? results[j]!.correct : undefined)), stepCount: results.length };
    }
  }
  return { tapsUsed: undefined, correct: undefined, steps: [], stepCount: session.snapshot().stepResults.length };
}

const P = (string: number, fret: number): FretPosition => ({ string, fret });
// Named positions in the fixture area (MIDI from E1 A1 D2 G2 open strings).
const C2_s3f3 = P(3, 3), G2_s2f5 = P(2, 5), C3_s1f5 = P(1, 5);
const C3_s3f15 = P(3, 15), G3_s2f17 = P(2, 17), C4_s1f17 = P(1, 17);
const E3_s1f9 = P(1, 9), G3_s1f12 = P(1, 12);

const C_SETTINGS: DrillSettings = { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 20, count: 100, octaveMode: 'any', qualities: ['major'] };
const cQuestion = () => {
  const q = findQ(bass4, C_SETTINGS, (x) => x.itemKey === 'rfo|0');
  expect(q, 'no root-fifth-octave question for C (item rfo|0) on 4-string EADG strings 1–3, frets 0–20').toBeDefined();
  return q!;
};

describe('FR-056 brute-force preconditions (4-string EADG, strings 1–3, frets 0–20, root C)', () => {
  it('exactly two valid shapes: S1 C2 3/3, G2 2/5, C3 1/5 and S4 C3 3/15, G3 2/17, C4 1/17', () => {
    const got = shapes(bass4, [1, 2, 3], 0, 20, 0).map(({ r, f, o }) => [k(r), r.midi, k(f), f.midi, k(o), o.midi]);
    expect(got).toEqual([['3/3', 36, '2/5', 43, '1/5', 48], ['3/15', 48, '2/17', 55, '1/17', 60]]);
    expect([E3_s1f9, G3_s1f12].map((x) => posMidi(bass4, x))).toEqual([52, 55]);
  });
  it('4-string EADG fret count covers fret 20', () => {
    expect(bass4.fretCount).toBeGreaterThanOrEqual(20);
  });
});

describe('FR-056 prompt names the root pitch class (no octave) and the fret range', () => {
  it.each(presets().map((p) => [p.presetId, p.profile] as const))('%s: "Play a root–fifth–octave shape for <pc>, frets 0 to <top>"', (_id, p) => {
    const top = Math.min(12, p.fretCount);
    const s: DrillSettings = { type: 'root-fifth-octave', strings: allStrings(p), fromFret: 0, toFret: top, count: 40, octaveMode: 'any', qualities: ['major'] };
    for (const seed of [1, 2, 3]) {
      for (const q of gen(p, s, seed)) {
        const m = new RegExp(`^Play a root–fifth–octave shape for ([A-G](?:##|#|bb|b)?), frets 0 to ${top}$`).exec(ascii(q.text));
        expect(m, `prompt "${q.text}"`).not.toBeNull();
        expect(q.itemKey).toBe(`rfo|${pcOfName(m![1]!)}`);
      }
    }
  });
  it('the spec\'s example on 4-string EADG, frets 0 to 12: "Play a root–fifth–octave shape for C, frets 0 to 12"', () => {
    const q = findQ(bass4, { ...C_SETTINGS, strings: [1, 2, 3, 4], toFret: 12 }, (x) => x.itemKey === 'rfo|0');
    expect(q).toBeDefined();
    expect(ascii(q!.text)).toBe('Play a root–fifth–octave shape for C, frets 0 to 12');
  });
});

describe('FR-056 valid shapes: any octave of the root, exact pitches, span ≤ 3', () => {
  const orders = (a: FretPosition, b: FretPosition, c: FretPosition) => [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

  it.each([
    ['S1 (root C2)', C2_s3f3, G2_s2f5, C3_s1f5],
    ['S4 (root C3)', C3_s3f15, G3_s2f17, C4_s1f17],
  ])('%s in all 6 tap orders: finished after 3 taps, all three steps correct', (_n, r, f, o) => {
    const q = cQuestion();
    for (const seq of orders(r, f, o)) {
      expect(play(q, seq), seq.map(k).join(' ')).toEqual({ tapsUsed: 3, correct: true, steps: [true, true, true], stepCount: 3 });
    }
  });

  it('the same C question accepts both octaves of the root: every generated C question takes S1 and S4', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of gen(bass4, C_SETTINGS, seed).filter((x) => x.itemKey === 'rfo|0')) {
        expect(play(q, [C2_s3f3, G2_s2f5, C3_s1f5]).correct, `seed ${seed}: S1`).toBe(true);
        expect(play(q, [C3_s3f15, G3_s2f17, C4_s1f17]).correct, `seed ${seed}: S4`).toBe(true);
      }
    }
  });
});

describe('FR-056a wrong-tap charging, reveal and fixing; exactly 3 step results per question', () => {
  // Each row: taps, then the expected outcome of Steps 1 (root), 2 (5th), 3 (octave), derived by hand
  // from the two brute-forced shapes and FR-056a's rules (reasoning in the row's name).
  it.each([
    // C2, G2 accepted (S1); C3 at 3/15 is the exact octave pitch but 12 frets away: wrong, root pc,
    // Step 1 done → Step 3 missed (reveal 1/5 from S1).
    ['C2 3/3, G2 2/5, C3 3/15 (span 12)', [C2_s3f3, G2_s2f5, C3_s3f15], 3, [true, true, false]],
    // G3 at 1/12 fits no shape with C2 3/3: wrong, 5th pc, Step 2 pending → Step 2 missed (reveal 2/5);
    // then C3 1/5 fits S1 with the fixed C2 and G2 → octave correct, C2 fixed as the root.
    ['C2 3/3, G3 1/12, C3 1/5', [C2_s3f3, G3_s1f12, C3_s1f5], 3, [true, false, true]],
    // Steps 1 and 2 done; G3 1/12 has the 5th's pitch class but Step 2 is not pending → lowest pending (3).
    ['C2 3/3, G2 2/5, G3 1/12', [C2_s3f3, G2_s2f5, G3_s1f12], 3, [true, true, false]],
    // G2 2/5 accepted (5th at once); C3 3/15 fits no shape with it: root pc → lowest pending of 1 and 3
    // = Step 1, missed (reveal C2 3/3 from S1); C3 1/5 then fits S1 → octave correct.
    ['G2 2/5, C3 3/15, C3 1/5', [G2_s2f5, C3_s3f15, C3_s1f5], 3, [false, true, true]],
    // E3: neither pitch class → lowest pending (Step 1), revealed from the lowest-pitched root (S1, C2
    // 3/3), now fixed. C4 1/17 would fit S4 but not with the fixed C2 → Step 3 missed (reveal 1/5). G3
    // 2/17 would fit S4 but not with the fixed S1 positions → Step 2 missed. Three wrong taps, done.
    ['E3 1/9, C4 1/17, G3 2/17 (revealed positions are fixed)', [E3_s1f9, C4_s1f17, G3_s2f17], 3, [false, false, false]],
    // After E3 reveals S1's root, S1's 5th and octave are accepted.
    ['E3 1/9, G2 2/5, C3 1/5', [E3_s1f9, G2_s2f5, C3_s1f5], 3, [false, true, true]],
  ] as const)('%s', (_n, taps, used, steps) => {
    const r = play(cQuestion(), taps);
    expect(r.tapsUsed, 'the question ends when all three steps are judged').toBe(used);
    expect(r.steps).toEqual(steps);
    expect(r.stepCount, 'exactly 3 step results').toBe(3);
    expect(r.correct).toBe(steps.every(Boolean));
  });

  it('wrong octave of the 5th (4-string EADG, all strings, frets 0–12): C2 3/3, C3 1/5, then G1 4/3 (R − 5, not R + 7) misses Step 2', () => {
    expect(posMidi(bass4, P(4, 3))).toBe(31); // G1
    const q = findQ(bass4, { ...C_SETTINGS, strings: [1, 2, 3, 4], toFret: 12 }, (x) => x.itemKey === 'rfo|0')!;
    expect(play(q, [C2_s3f3, C3_s1f5, P(4, 3)])).toEqual({ tapsUsed: 3, correct: false, steps: [true, false, true], stepCount: 3 });
  });

  // The earlier "outside the fret range" test is removed: FR-056 (2026-11-22) "Only positions inside
  // the fret range are drawn as targets, so no out-of-range reason exists" makes that input
  // unreachable; DrillRunner.rfo-scenarios.test.tsx checks that no such target is drawn.

  it('FR-056a / FR-040: the finished answer lists every judged tap in tap order; a repeat tap is ignored (not judged or recorded)', () => {
    const q = cQuestion();
    const session = new DrillSession([q], 0);
    session.tap(E3_s1f9, 100); // Not C or G → Step 1 missed, C2 3/3 revealed
    const before = session.snapshot().stepResults.map((x) => x?.correct);
    session.tap(E3_s1f9, 200); // repeat of a wrong tap: ignored
    session.tap(C2_s3f3, 300); // the revealed root: ignored
    expect(session.snapshot().stepResults.map((x) => x?.correct), 'repeats change no step').toEqual(before);
    session.tap(G2_s2f5, 400);
    const r = session.tap(C3_s1f5, 500);
    expect(r?.finished, 'the question ends at its last judged step').toBeTruthy();
    expect(r!.finished!.taps.map(k)).toEqual(['1/9', '2/5', '1/5']);
    expect(r!.finished!.correct).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// US6 scenario 13 (product-owner 2026-11-22, provisional): 5-string BEADG, chord C, all strings,
// frets 0 to 12. Open strings B0 E1 A1 D2 G2 = MIDI 23 28 33 38 43 (string 5 … string 1).
describe('FR-056 / FR-056a placed tap on 5-string BEADG (US6 scenario 13), session level', () => {
  const bass5 = presetById('bass5-beadg')!.profile;
  const S5: DrillSettings = { type: 'root-fifth-octave', strings: [1, 2, 3, 4, 5], fromFret: 0, toFret: 12, count: 100, octaveMode: 'any', qualities: ['major'] };
  const q5 = () => {
    const q = findQ(bass5, S5, (x) => x.itemKey === 'rfo|0');
    expect(q, 'no C question on 5-string BEADG').toBeDefined();
    return q!;
  };

  it('brute force: C2 3/3 is the root of {3/3, 2/5, 1/5} and the octave of {5/1, 4/3, 3/3}, so both roles remain', () => {
    const all = shapes(bass5, [1, 2, 3, 4, 5], 0, 12, 0).map(({ r, f, o }) => [k(r), k(f), k(o)]);
    expect(all.filter((x) => x.includes('3/3'))).toEqual([['3/3', '2/5', '1/5'], ['5/1', '4/3', '3/3']]);
    expect(['3/3', '2/5', '1/5', '5/1', '4/3', '2/10'].map((x) => posMidi(bass5, P(Number(x.split('/')[0]), Number(x.split('/')[1]))))).toEqual([36, 43, 48, 24, 31, 48]);
    // C3 2/10 is in no valid shape with C2 3/3 (as the octave it is 7 frets away; as a root C2 is not its octave).
    expect(shapes(bass5, [1, 2, 3, 4, 5], 0, 12, 0).some(({ r, f, o }) => [r, f, o].some((x) => k(x) === '3/3') && [r, f, o].some((x) => k(x) === '2/10'))).toBe(false);
  });

  it.each([
    // (a) G2 2/5 is C2 + 7: C2 becomes the root.
    ['(a) C2 3/3, G2 2/5, C3 1/5: C2 is the root', [P(3, 3), P(2, 5), P(1, 5)], [true, true, true]],
    // (b) G1 4/3 is C1 + 7: C2 becomes the octave; C1 5/1 then completes the shape.
    ['(b) C2 3/3, G1 4/3, C1 5/1: C2 is the octave', [P(3, 3), P(4, 3), P(5, 1)], [true, true, true]],
    // (c) C3 2/10 is wrong; the placed C2 is resolved first as the root (root-preferred), so the wrong
    // root-pitch-class tap goes to the lowest pending of Steps 1 and 3 = Step 3, revealed at 1/5.
    // G2 2/5 then completes Step 2.
    ['(c) C2 3/3, C3 2/10 (wrong), G2 2/5: Step 1 ✓, Step 3 missed', [P(3, 3), P(2, 10), P(2, 5)], [true, true, false]],
  ] as const)('%s', (_n, taps, steps) => {
    const r = play(q5(), taps);
    expect(r.tapsUsed).toBe(3);
    expect(r.steps).toEqual(steps);
    expect(r.correct).toBe(steps.every(Boolean));
  });

  it('(c) continued: after the resolution the shape is fixed, so G1 4/3 (the 5th of the octave-role shape) no longer fits', () => {
    // C2 resolved as root of {3/3, 2/5, 1/5}; octave revealed at 1/5. G1 4/3 = 31 ≠ 36 + 7 → wrong,
    // 5th pitch class, Step 2 pending → Step 2 missed. All three judged.
    const r = play(q5(), [P(3, 3), P(2, 10), P(4, 3)]);
    expect(r).toEqual({ tapsUsed: 3, correct: false, steps: [true, false, false], stepCount: 3 });
  });
});

// ---------------------------------------------------------------------------------------------
/** Standard chord formulas in semitones above the root (FR-005), symbol suffixes and FR-036 names. */
const CHORDS: Record<string, { semis: number[]; suffix: string; name: string }> = {
  major: { semis: [0, 4, 7], suffix: '', name: 'major' },
  minor: { semis: [0, 3, 7], suffix: 'm', name: 'minor' },
  dim: { semis: [0, 3, 6], suffix: 'dim', name: 'diminished' },
  aug: { semis: [0, 4, 8], suffix: 'aug', name: 'augmented' },
  sus2: { semis: [0, 2, 7], suffix: 'sus2', name: 'suspended 2nd' },
  sus4: { semis: [0, 5, 7], suffix: 'sus4', name: 'suspended 4th' },
  dom7: { semis: [0, 4, 7, 10], suffix: '7', name: 'dominant 7th' },
  maj7: { semis: [0, 4, 7, 11], suffix: 'maj7', name: 'major 7th' },
  min7: { semis: [0, 3, 7, 10], suffix: 'm7', name: 'minor 7th' },
  m7b5: { semis: [0, 3, 6, 10], suffix: 'm7b5', name: 'half-diminished 7th' },
  dim7: { semis: [0, 3, 6, 9], suffix: 'dim7', name: 'diminished 7th' },
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Brute force FR-057: every (root pc, s) whose arpeggio fits the window from its lowest root. */
function fits(p: InstrumentProfile, strings: readonly number[], from: number, to: number, semis: readonly number[]) {
  const w = Math.min(5, to - from + 1);
  const out: { pc: number; s: number; rm: number }[] = [];
  for (let s = from; s + w - 1 <= to; s++) {
    const A = area(p, strings, s, s + w - 1);
    for (let pc = 0; pc < 12; pc++) {
      const roots = A.filter((x) => pcOf(x.midi) === pc);
      if (!roots.length) continue;
      const rm = Math.min(...roots.map((x) => x.midi));
      if (semis.every((d) => A.some((x) => x.midi === rm + d))) out.push({ pc, s, rm });
    }
  }
  return { w, out };
}

/** FR-057 window fit and steps, read from q.window and q.steps (independent of the prompt wording). */
function checkWindowFit(p: InstrumentProfile, strings: readonly number[], from: number, to: number, ql: string, seeds: readonly number[]) {
  const c = CHORDS[ql]!;
  const s: DrillSettings = { type: 'arpeggio', strings, fromFret: from, toFret: to, count: 20, octaveMode: 'any', qualities: [ql] };
  const { w, out } = fits(p, strings, from, to, c.semis);
  expect(validateSettings(p, s).ok, `${ql}: rejected exactly when no window fits`).toBe(out.length > 0);
  if (!out.length) return;
  for (const seed of seeds) {
    for (const q of gen(p, s, seed)) {
      const win = q.window;
      expect(win, 'FR-057 states a window').toBeDefined();
      expect(win!.to - win!.from + 1, 'window width').toBe(w);
      const first = q.steps[0]?.valid[0];
      expect(first).toBeDefined();
      const pc = pcOf(posMidi(p, first!));
      const fit = out.find((x) => x.pc === pc && x.s === win!.from);
      expect(fit, `${ql} root pc ${pc}, frets ${win!.from}–${win!.to}: the whole arpeggio must fit from the lowest root`).toBeDefined();
      const A = area(p, strings, win!.from, win!.to);
      expect(q.steps.length).toBe(c.semis.length);
      c.semis.forEach((d, i) => {
        const want = A.filter((x) => x.midi === fit!.rm + d).map(k).sort();
        expect(q.steps[i]!.valid.map(k).sort(), `${ql} step ${i + 1}`).toEqual(want);
      });
    }
  }
}

/** FR-057 prompt: "Play the <root> <quality name> arpeggio (<symbol>) up from its lowest <root>, frets s to e". */
function checkPrompt(p: InstrumentProfile, ql: string) {
  const c = CHORDS[ql]!;
  const top = Math.min(12, p.fretCount);
  const s: DrillSettings = { type: 'arpeggio', strings: allStrings(p), fromFret: 0, toFret: top, count: 10, octaveMode: 'any', qualities: [ql] };
  for (const q of gen(p, s, 1)) {
    const m = new RegExp(`^Play the ([A-G](?:##|#|bb|b)?) ${esc(c.name)} arpeggio \\(([A-G](?:##|#|bb|b)?)${esc(c.suffix)}\\) up from its lowest ([A-G](?:##|#|bb|b)?), frets (\\d+) to (\\d+)$`).exec(ascii(q.text));
    expect(m, `${ql} prompt "${q.text}"`).not.toBeNull();
    const [, r1, r2, r3, a, b] = m!;
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
    expect(q.window).toEqual({ from: Number(a), to: Number(b) });
    expect(pcOfName(r1!)).toBe(pcOf(posMidi(p, q.steps[0]!.valid[0]!)));
  }
}

describe('FR-057 arpeggio window fits the whole arpeggio from the lowest root; prompt "Play the <root> <quality> arpeggio (<symbol>) up from its lowest <root>, frets s to e"', () => {
  it('US6-2 example on 4-string EADG, frets 5 to 9: "Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9"', () => {
    const q = findQ(bass4, { type: 'arpeggio', strings: [1, 2, 3, 4], fromFret: 5, toFret: 9, count: 50, octaveMode: 'any', qualities: ['min7'] }, (x) => /lowest A,/.test(ascii(x.text)));
    expect(q, 'no Am7 question').toBeDefined();
    expect(ascii(q!.text)).toBe('Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9');
    // Brute force: lowest A in frets 5–9 is A1 (33) at string 4 fret 5; C2 4/8, E2 3/7, G2 2/5.
    expect(q!.steps.map((st) => st.valid.map(k))).toEqual([['4/5'], ['4/8'], ['3/7'], ['2/5']]);
  });

  describe.each(presets().map((p) => [p.presetId, p.profile] as const))('%s', (_id, p) => {
    it.each(Object.keys(CHORDS))('%s: prompt names the chord in words with its symbol, "up from its lowest <root>", and the window', (ql) => {
      checkPrompt(p, ql);
    });
    it.each(Object.keys(CHORDS))('%s: window fit and steps, frets 0–12, all strings', (ql) => {
      checkWindowFit(p, allStrings(p), 0, Math.min(12, p.fretCount), ql, [1, 2]);
    });
    it.each(Object.keys(CHORDS))('%s: window fit and steps, frets 3–9, the lowest three strings', (ql) => {
      checkWindowFit(p, [p.stringCount - 2, p.stringCount - 1, p.stringCount], 3, 9, ql, [1]);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// PENDING THE OWNER (spec.md FR-057: "except add9, whose last step is the 9th at root + 14 semitones,
// label "9", spoken "9th"; *pending the owner's add9 answer*"). Self-contained so it can be dropped.
describe('FR-057 add9 arpeggio (pending owner): steps R, 3, 5, 9 with the 9 at root + 14', () => {
  const ADD9 = [0, 4, 7, 14];
  describe.each(presets().map((p) => [p.presetId, p.profile] as const))('%s', (_id, p) => {
    it('frets 0–12, all strings: 4 steps labelled R, 3, 5, 9; pitches root + 0, 4, 7, 14 inside a window that fits', () => {
      const strings = allStrings(p);
      const top = Math.min(12, p.fretCount);
      const s: DrillSettings = { type: 'arpeggio', strings, fromFret: 0, toFret: top, count: 20, octaveMode: 'any', qualities: ['add9'] };
      const { out } = fits(p, strings, 0, top, ADD9);
      expect(out.length, 'brute force: some window fits add9').toBeGreaterThan(0);
      for (const q of gen(p, s, 1)) {
        expect(q.steps.map((st) => st.label)).toEqual(['R', '3', '5', '9']);
        const w = q.window!;
        const A = area(p, strings, w.from, w.to);
        const rm = Math.min(...A.filter((x) => pcOf(x.midi) === pcOf(posMidi(p, q.steps[0]!.valid[0]!))).map((x) => x.midi));
        ADD9.forEach((d, i) => {
          expect(q.steps[i]!.valid.map(k).sort(), `step ${i + 1}`).toEqual(A.filter((x) => x.midi === rm + d).map(k).sort());
        });
        const m = /^Play the ([A-G](?:##|#|bb|b)?) add 9 arpeggio \(([A-G](?:##|#|bb|b)?)add9\) up from its lowest ([A-G](?:##|#|bb|b)?), frets (\d+) to (\d+)$/.exec(ascii(q.text));
        expect(m, q.text).not.toBeNull();
      }
    });
  });
});
