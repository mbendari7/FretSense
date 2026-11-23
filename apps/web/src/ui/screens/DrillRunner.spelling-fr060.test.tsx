/**
 * code-reviewer T091–T093 r3 MAJOR #1 (red, test-first) [FR-032, FR-060, FR-049]
 * (reviews/2026-11-22-code-reviewer-T091-T093-r3.md: "In an interval question (F + m3 = A♭, tap 6/2)
 * the feedback says "G♭2" but the position name says "F♯2", and other revealed positions are sharp").
 *
 * spec.md FR-032: "Within one question, the prompt, every label revealed in feedback and the feedback
 *   text and announcement MUST use the question's spelling: ... the reference transposed by the
 *   interval (interval, FR-002) ...; other revealed positions use FR-060 relative to that note".
 * FR-060: "a fixed 12-pitch-class map relative to the context root: 1 b2 2 b3 3 4 #4 5 b6 6 b7 7 ...
 *   The note is spelled as the root transposed by that interval. Double accidentals are allowed."
 *
 * Question (forced by the settings; see DrillRunner.spelling.test.tsx): 6-string Standard, string 6,
 * frets 1–4, m3 up → reference F2 6/1 (MIDI 41), answer Ab2 6/4 (44). The tap 6/2 is MIDI 42.
 * FR-060 relative to Ab, brute-forced below by letter arithmetic (Ab moved up by each map interval):
 *   +0 Ab, +1 Bbb, +2 Bb, +3 Cb, +4 C, +5 Db, +6 D, +7 Eb, +8 Fb, +9 F, +10 Gb, +11 G.
 * So MIDI 42 (+10 from Ab) is Gb2, and D#/Eb (+7) is Eb. The +1, +3 and +8 cells (A as Bbb, B as Cb,
 * E as Fb) are what FR-060 literally gives; they are reported as a gap for theory-checker / the owner
 * and only checked here for "no sharp", not for their exact spelling.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { presetById, type InstrumentProfile, type Note } from '@fretsense/theory';
import { allPositions, installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const STD = presetById('guitar6-standard')!.profile;
const midiAt = (p: InstrumentProfile, s: number, f: number) => noteMidi(p.tuning[p.stringCount - s]!) + f;
const mod12 = (x: number) => ((x % 12) + 12) % 12;
const ACC = (a: number) => (a === 0 ? '' : a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));

/** FR-060 map: semitones above the root → letter steps (1 b2 2 b3 3 4 #4 5 b6 6 b7 7). */
const MAP_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
function fr060(root: { letter: string; accidental: number }, pc: number): string {
  const rootPc = mod12(LETTER_PC[root.letter]! + root.accidental);
  const d = mod12(pc - rootPc);
  const letter = LETTERS[(LETTERS.indexOf(root.letter as (typeof LETTERS)[number]) + MAP_STEPS[d]!) % 7]!;
  let acc = mod12(pc - LETTER_PC[letter]!);
  if (acc > 6) acc -= 12;
  return `${letter}${ACC(acc)}`;
}
const AB = { letter: 'A', accidental: -1 };

const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const nameOf = (el: Element | null | undefined) => ascii(el?.getAttribute('aria-label'));
const promptText = (c: HTMLElement) => norm(c.querySelector('#prompt')?.textContent);
const feedback = (c: HTMLElement) => ascii(c.querySelector('.feedback')?.textContent);
/** The note with octave in a position name: "String N, fret F, <Note><octave>, ...". */
const noteIn = (name: string) => /^String \d+, (?:open|fret \d+), ([A-G](?:bb|b|##|#)?)(-?\d)\b/.exec(name);

const F_M3 = { type: 'interval' as const, strings: [6], fromFret: 1, toFret: 4, intervals: ['m3'], direction: 'up' as const };

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

async function answeredWrongAt62() {
  const r = await renderDrill('guitar6-standard', F_M3);
  await waitFor(() => expect(promptText(r.container)).toMatch(/\bF\b/));
  act(() => { fireEvent.click(positionEl(r.container, 6, 2)!); });
  await waitFor(() => expect(nameOf(positionEl(r.container, 6, 4))).toMatch(/\banswer\b/));
  return r;
}

describe('brute-force preconditions', () => {
  it('MIDI: F2 6/1 = 41, 6/2 = 42, Ab2 6/4 = 44; Eb3 4/1 = 51', () => {
    expect([midiAt(STD, 6, 1), midiAt(STD, 6, 2), midiAt(STD, 6, 4), midiAt(STD, 4, 1)]).toEqual([41, 42, 44, 51]);
  });
  it('FR-060 relative to Ab, all 12 pitch classes', () => {
    expect(Array.from({ length: 12 }, (_, d) => fr060(AB, mod12(8 + d)))).toEqual(['Ab', 'Bbb', 'Bb', 'Cb', 'C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G']);
  });
  it('control: FR-060 relative to C is the spec\'s example row (C Db D Eb E F F# G Ab A Bb B)', () => {
    expect(Array.from({ length: 12 }, (_, pc) => fr060({ letter: 'C', accidental: 0 }, pc))).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  });
});

describe('FR-032 / FR-060: F + m3 = Ab, tap 6/2 → "Gb2" everywhere, never F#2', () => {
  it('the tapped position\'s accessible name says Gb2', async () => {
    const { container } = await answeredWrongAt62();
    const n = nameOf(positionEl(container, 6, 2));
    expect(n).toContain('Gb2');
    expect(n).not.toContain('F#');
  });

  it('the feedback says Gb2', async () => {
    const { container } = await answeredWrongAt62();
    expect(feedback(container)).toContain('Gb2');
    expect(feedback(container)).not.toContain('F#');
  });

  it('D#/Eb at string 4 fret 1 is named Eb3, never D#3', async () => {
    const { container } = await answeredWrongAt62();
    const n = nameOf(positionEl(container, 4, 1));
    expect(n).toContain('Eb3');
    expect(n).not.toContain('D#');
  });

  it('every position named after answering: no sharp; each pitch class FR-060 spells with ≤ 1 accidental matches FR-060 relative to Ab', async () => {
    const { container } = await answeredWrongAt62();
    let checked = 0;
    for (const el of allPositions(container)) {
      const name = nameOf(el);
      const m = noteIn(name);
      if (!m) continue;
      const [s, f] = /^String (\d+), (?:open|fret (\d+))/.exec(name)!.slice(1).map((x) => Number(x ?? 0));
      const pc = mod12(midiAt(STD, s!, f!));
      expect(m[1], name).not.toMatch(/#/);
      const want = fr060(AB, pc);
      if (!/bb/.test(want) && !['Cb', 'Fb'].includes(want)) { expect(m[1], name).toBe(want); checked++; }
    }
    expect(checked, 'positions named with notes after answering').toBeGreaterThan(0);
  });
});
