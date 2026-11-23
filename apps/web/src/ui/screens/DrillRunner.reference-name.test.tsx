/**
 * code-reviewer r2 #7 (red, test-first) [FR-032a, FR-049]: the interval reference's accessible name.
 *
 * spec.md FR-032a (r2 #7, owner-approved 2026-11-22): "each position's accessible name is "String N,
 * fret F" plus only those markers' suffixes (FR-013), except the interval reference, whose name also
 * includes its note with octave in the question's spelling (FR-032), because that note is shown
 * visibly and is part of the prompt (WCAG 2.5.3)". FR-049: "Whenever a position's accessible name
 * includes its note, the note includes the octave; while a question is open the name has no note,
 * except the interval reference (FR-032a)". Name order (FR-049): "String N, fret F" ("String N,
 * open"), then the spelled note with octave, then marker suffixes, e.g. "String 5, fret 1, B♭2, …reference".
 *
 * Expected values: the note's spelling is the one the prompt uses ("Find the <interval> above|below
 * this <note>", FR-035), and its octave is the letter (scientific pitch) octave of the pitch the
 * position sounds, recomputed by brute force from the profile's open strings. Accidentals may be
 * ASCII or Unicode. Parameterised over every InstrumentProfile preset.
 *
 * Determinism (T100a): DrillRunner seeds its generator from Date.now(), so Date.now is fixed per test
 * and each preset runs over several fixed seeds. The prompt's note is matched with a negative
 * lookahead `(?![#b])`, not a word boundary `\b`, because no word boundary follows "#" (it captured "F" for "F#").
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { allPositions, installLayoutMock, norm } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const ALL = presets().map((p) => [p.presetId, p.profile] as const);

/** "String N, fret F, <note><octave>, ... reference ..." (or "String N, open, ..."). */
const REF_NAME = /^String (\d+), (?:open|fret (\d+)), ([A-G])(bb|b|##|#)?(-?\d+)(?:, [a-z][a-z ]*)*$/;
/** Open-question name of every other position: no note (FR-032a). */
const NO_NOTE = /^String \d+, (open|fret \d+)(, [a-z][a-z ]*)*$/;

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const SEEDS = [1, 2, 3, 0x5eed];

describe.each(ALL)('FR-032a / FR-049 interval reference name includes its note with octave, %s', (id, profile) => {
  it.each(SEEDS)('seed %i, first 3 questions: "String N, fret F, <prompt note><letter octave>, …reference"; other positions name no note', async (seed) => {
    vi.spyOn(Date, 'now').mockReturnValue(seed);
    const { container } = await renderDrill(id, {
      type: 'interval', strings: allStrings(profile), fromFret: 0, toFret: Math.min(12, profile.fretCount),
      intervals: ['M2', 'm3', 'P4', 'P5'], direction: 'both',
    });
    for (let q = 0; q < 3; q++) {
      const prompt = ascii(container.querySelector('#prompt')?.textContent);
      const pm = /\b(?:above|below) this ([A-G](?:bb|b|##|#)?)(?![#b])/.exec(prompt);
      expect(pm, `prompt "${prompt}" names no reference note`).toBeTruthy();

      const names = allPositions(container).map((el) => ascii(el.getAttribute('aria-label')));
      const refs = names.filter((n) => /\breference\b/.test(n));
      expect(refs, `question ${q + 1}: exactly one reference position`).toHaveLength(1);
      const m = REF_NAME.exec(refs[0]!);
      expect(m, `reference name "${refs[0]}" lacks "<note><octave>" after the position`).toBeTruthy();
      const [, s, f, letter, acc, oct] = m!;
      expect(`${letter}${acc ?? ''}`, `reference spelled as in the prompt "${prompt}"`).toBe(pm![1]);
      const sounding = openMidi(profile, Number(s)) + (f ? Number(f) : 0);
      expect(12 * (Number(oct) + 1) + LETTER_PC[letter!]! + ACC[acc ?? '']!, `"${refs[0]}": letter octave of MIDI ${sounding}`).toBe(sounding);

      for (const n of names.filter((x) => !/\breference\b/.test(x))) expect(n).toMatch(NO_NOTE);

      // Answer anything, then continue to the next question.
      await act(async () => { fireEvent.click(allPositions(container)[0]!); });
      const cont = screen.queryByRole('button', { name: 'Continue' });
      if (!cont) break;
      await act(async () => { fireEvent.click(cont); });
      if (!container.querySelector('#prompt')) break;
    }
  });
});

it('FR-032a example shape, 6-string Standard: a Bb reference on string 5 fret 1 is named "String 5, fret 1, Bb2, …reference"', async () => {
  // String 5 alone, frets 1–2, m2 up: Bb2 (5/1) -> B2 (5/2) is the only reference with its target in range.
  const std6 = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
  expect(openMidi(std6, 5) + 1).toBe(46); // Bb2 = 12 * 3 + 11 - 1 = 46
  vi.spyOn(Date, 'now').mockReturnValue(1);
  const { container } = await renderDrill('guitar6-standard', { type: 'interval', strings: [5], fromFret: 1, toFret: 2, intervals: ['m2'], direction: 'up' });
  const ref = allPositions(container).map((el) => ascii(el.getAttribute('aria-label'))).find((n) => /\breference\b/.test(n));
  const prompt = ascii(container.querySelector('#prompt')?.textContent);
  const spelled = /this ([A-G][b#]?)(?![#b])/.exec(prompt)![1]!; // Bb or A#, the prompt's own spelling
  expect(ref?.startsWith(`String 5, fret 1, ${spelled}2, `), `"${ref}"`).toBe(true);
});
