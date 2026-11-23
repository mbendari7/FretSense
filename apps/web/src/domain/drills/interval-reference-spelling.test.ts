/**
 * Owner decision 2026-11-22 (3) (red, test-first) [FR-035, FR-032; property test].
 * spec.md Clarifications "Owner decisions 2026-11-22": "Interval drill (FR-035, FR-032): each
 * black-key reference is spelled so that the answer needs no E♯, B♯, C♭, F♭ or double accidental;
 * when one spelling of the reference would give such an answer and the other would not, the other is
 * used; if both would, the question is not asked ("Avoid F♭-style references")."
 *
 * Independent oracle: interval spelling by letter arithmetic (FR-002), written here. An interval of
 * number n moves the letter n − 1 steps (up or down) and the accidental makes the semitone size
 * exact (m2 1, M2 2, m3 3, M3 4, P4 5, A4 6, d5 6, P5 7, m6 8, M6 9, m7 10, M7 11, P8 12).
 * A black-key pitch class (1, 3, 6, 8, 10) has exactly two single-accidental spellings: the sharp of
 * the letter below and the flat of the letter above. "Bad" answer = E#, B#, Cb, Fb or any double.
 *
 * Over every preset, every FR-035 interval and both directions (all strings, every fret), generated
 * questions must satisfy:
 *  (a) a black-key reference is spelled with one of its two spellings;
 *  (b) the answer the question carries is the oracle's transposition of that reference spelling;
 *  (c) when that reference's two spellings are not both bad, the answer is not bad;
 *  (d) no question is asked for a (reference pitch class, interval, direction) whose two spellings
 *      are both bad.
 * Each (preset, interval, direction) is generated with several seeds (fast-check picks extra ones).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { Question } from './types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Letter = (typeof LETTERS)[number];
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mod12 = (x: number) => ((x % 12) + 12) % 12;
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter as Letter] + n.accidental;
const midiAt = (p: InstrumentProfile, s: number, f: number) => noteMidi(p.tuning[p.stringCount - s]!) + f;

const INTERVALS: Record<string, [number, number]> = {
  m2: [2, 1], M2: [2, 2], m3: [3, 3], M3: [3, 4], P4: [4, 5], A4: [4, 6], d5: [5, 6], P5: [5, 7],
  m6: [6, 8], M6: [6, 9], m7: [7, 10], M7: [7, 11], P8: [8, 12],
};
const BLACK = new Set([1, 3, 6, 8, 10]);
type Sp = { letter: Letter; accidental: number };
const show = (s: Sp) => `${s.letter}${s.accidental > 0 ? '#'.repeat(s.accidental) : 'b'.repeat(-s.accidental)}`;

function transpose(ref: Sp, iv: string, dir: 'up' | 'down'): Sp {
  const [n, semis] = INTERVALS[iv]!;
  const li = LETTERS.indexOf(ref.letter);
  const letter = LETTERS[(((li + (dir === 'up' ? n - 1 : -(n - 1))) % 7) + 7) % 7]!;
  const target = mod12(LETTER_PC[ref.letter] + ref.accidental + (dir === 'up' ? semis : -semis));
  let acc = mod12(target - LETTER_PC[letter]);
  if (acc > 6) acc -= 12;
  return { letter, accidental: acc };
}
const bad = (s: Sp) => Math.abs(s.accidental) >= 2 || ['E#', 'B#', 'Cb', 'Fb'].includes(show(s));
function blackSpellings(pc: number): [Sp, Sp] {
  const below = LETTERS.find((l) => LETTER_PC[l] === mod12(pc - 1))!;
  const above = LETTERS.find((l) => LETTER_PC[l] === mod12(pc + 1))!;
  return [{ letter: below, accidental: 1 }, { letter: above, accidental: -1 }];
}
const bothBad = (pc: number, iv: string, dir: 'up' | 'down') => blackSpellings(pc).every((s) => bad(transpose(s, iv, dir)));

describe('oracle self-checks (published interval spellings)', () => {
  it('F + m3 = Ab; Bb + m3 = Db; F# + A4 = B#; Gb + A4 = C; Gb + d5 = Dbb; F# + d5 = C; C# down m2 = B#', () => {
    const t = (l: Letter, a: number, iv: string, d: 'up' | 'down') => show(transpose({ letter: l, accidental: a }, iv, d));
    expect([t('F', 0, 'm3', 'up'), t('B', -1, 'm3', 'up'), t('F', 1, 'A4', 'up'), t('G', -1, 'A4', 'up'), t('G', -1, 'd5', 'up'), t('F', 1, 'd5', 'up'), t('C', 1, 'm2', 'down')])
      .toEqual(['Ab', 'Db', 'B#', 'C', 'Dbb', 'C', 'B#']);
  });
  it('black keys have two spellings: 1 → C#/Db, 6 → F#/Gb, 10 → A#/Bb', () => {
    expect([1, 6, 10].map((pc) => blackSpellings(pc).map(show))).toEqual([['C#', 'Db'], ['F#', 'Gb'], ['A#', 'Bb']]);
  });
});

const CASES = presets().flatMap((pr) => Object.keys(INTERVALS).flatMap((iv) => (['up', 'down'] as const).map((dir) => ({ id: pr.presetId, p: pr.profile, iv, dir }))));

function questionsFor(p: InstrumentProfile, iv: string, dir: 'up' | 'down', seed: number): Question[] {
  const strings = Array.from({ length: p.stringCount }, (_, i) => i + 1);
  const r = generateQuestions({
    profile: p,
    settings: { type: 'interval', strings, fromFret: 0, toFret: p.fretCount, count: 100, octaveMode: 'any', intervals: [iv], direction: dir },
    rng: mulberry32(seed), histories: new Map(), adaptive: false,
  });
  return r.ok ? r.questions : [];
}

function check(p: InstrumentProfile, iv: string, dir: 'up' | 'down', q: Question): string | undefined {
  const ref = q.reference[0]!;
  const pc = mod12(midiAt(p, ref.string, ref.fret));
  if (!BLACK.has(pc)) return undefined;
  if (bothBad(pc, iv, dir)) return `(d) asked a question whose reference pc ${pc} has two bad spellings for ${iv} ${dir}`;
  const refSp = q.spellings?.[0] as Sp | undefined;
  if (!refSp || !blackSpellings(pc).some((s) => s.letter === refSp.letter && s.accidental === refSp.accidental)) return `(a) reference pc ${pc} spelled ${refSp ? show(refSp) : 'nothing'}`;
  const ans = q.steps[0]?.spelled as Sp | undefined;
  const want = transpose(refSp, iv, dir);
  if (!ans || ans.letter !== want.letter || ans.accidental !== want.accidental) return `(b) ${show(refSp)} ${iv} ${dir}: answer ${ans ? show(ans) : 'nothing'}, expected ${show(want)}`;
  if (bad(ans)) return `(c) ${show(refSp)} ${iv} ${dir} gives ${show(ans)}; the other spelling avoids it`;
  return undefined;
}

describe('owner decision (3): interval references avoid E♯, B♯, C♭, F♭ and double-accidental answers', () => {
  it.each(CASES.map((c) => [`${c.id} ${c.iv} ${c.dir}`, c] as const))('%s (seeds 1–3)', (_n, c) => {
    const problems = new Set<string>();
    for (const seed of [1, 2, 3]) for (const q of questionsFor(c.p, c.iv, c.dir, seed)) { const e = check(c.p, c.iv, c.dir, q); if (e) problems.add(e); }
    expect([...problems]).toEqual([]);
  });

  it('property: any preset, interval, direction and seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CASES.length - 1 }), fc.integer({ min: 0, max: 2 ** 31 - 1 }), (i, seed) => {
        const c = CASES[i]!;
        for (const q of questionsFor(c.p, c.iv, c.dir, seed)) {
          const e = check(c.p, c.iv, c.dir, q);
          if (e) throw new Error(`${c.id}: ${e}`);
        }
      }),
      { numRuns: 150 },
    );
  });
});
