/**
 * code-reviewer T091-T093 r2 MAJOR #1 (red, test-first) [FR-032, FR-032a, FR-049]: in an interval
 * drill the fretboard uses the question's spelling everywhere, not the instrument's sharp default.
 *
 * Spec wording used as the expected values:
 *  - FR-032: the answer is spelled as the question spells it ("F + m3 = Ab, never G#"), and after an
 *    incorrect answer the correct positions stay shown until Continue.
 *  - FR-032a: once a question is answered, labels follow the question's spelling.
 *  - FR-049: a position's name is "String N, fret F", then the spelled note with octave.
 *
 * The questions are forced by the settings, and every position is recomputed by brute force from
 * the published standard tuning E2 A2 D3 G3 B3 E4 (MIDI 40 45 50 55 59 64) with
 * MIDI = 12 * (octave + 1) + letter + accidental + fret:
 *  - Case Bb: strings {5}, frets 1–4, m3 up. String 5 fret 1 = 45 + 1 = 46 (Bb2 / A#2). Its m3
 *    (+3) = 49 at fret 4 (Db3 / C#3). Fret 2 (47) needs 50 at fret 5, fret 3 (48) needs 51 at
 *    fret 6, fret 4 needs fret 7: all outside the range, so the reference is always string 5 fret 1.
 *    Bb + m3 = Db (letter B → D, three letters up; B♭→D♭ is 3 semitones), never C#.
 *  - Case F: strings {6}, frets 1–4, m3 up. String 6 fret 1 = 41 (F2); +3 = 44 at fret 4. The
 *    only reference again (frets 2–4 need frets 5–7). F + m3 = Ab (F → A, three letters up;
 *    F→A♭ is 3 semitones), so the answer is Ab2: octave = (44 - 8) / 12 - 1 = 2. Never G#.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { presetById, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const PRESET = 'guitar6-standard';
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const midiAt = (p: InstrumentProfile, pos: FretPosition) => noteMidi(p.tuning[p.stringCount - pos.string]!) + pos.fret;

const nameOf = (el: Element | null | undefined) => norm(el?.getAttribute('aria-label'));
/** The visible marker label drawn inside a position (the SVG <text> child), normalised. */
const labelOf = (el: Element | null | undefined) => norm(el?.querySelector('text')?.textContent);
const promptText = (c: HTMLElement) => norm(c.querySelector('#prompt')?.textContent);

function tap(container: HTMLElement, s: number, f: number) {
  const el = positionEl(container, s, f);
  if (!el) throw new Error(`no fretboard position for string ${s} fret ${f}`);
  act(() => { fireEvent.click(el); });
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

const BB = { type: 'interval' as const, strings: [5], fromFret: 1, toFret: 4, intervals: ['m3'], direction: 'up' as const };
const F = { type: 'interval' as const, strings: [6], fromFret: 1, toFret: 4, intervals: ['m3'], direction: 'up' as const };

describe('brute-force preconditions (standard tuning, published MIDI numbers)', () => {
  it('string 5 fret 1 is MIDI 46 (pitch class 10), its m3 is fret 4 (MIDI 49); string 6 fret 1 is MIDI 41, its m3 is fret 4 (MIDI 44)', () => {
    const p = presetById(PRESET)!.profile;
    expect(midiAt(p, { string: 5, fret: 1 })).toBe(46);
    expect(midiAt(p, { string: 5, fret: 4 })).toBe(49);
    expect(midiAt(p, { string: 6, fret: 1 })).toBe(41);
    expect(midiAt(p, { string: 6, fret: 4 })).toBe(44);
  });
});

describe('FR-032 / FR-032a / FR-049 interval reference spelled as prompted (Bb, never A#)', () => {
  it('the prompt names Bb and the reference marker at string 5 fret 1 is labelled "B♭"', async () => {
    const { container } = await renderDrill(PRESET, BB);
    await waitFor(() => expect(promptText(container)).toMatch(/\bBb\b/));
    expect(promptText(container)).not.toMatch(/A#/);
    const ref = positionEl(container, 5, 1)!;
    expect(nameOf(ref)).toMatch(/\breference\b/);
    expect(labelOf(ref)).toBe('Bb');
  });

  it('after an incorrect answer the revealed Db (string 5 fret 4) is labelled "D♭" and named "Db3", never C#', async () => {
    const { container } = await renderDrill(PRESET, BB);
    await waitFor(() => expect(promptText(container)).toMatch(/\bBb\b/));
    tap(container, 5, 2); // B2 (MIDI 47): not the m3 of Bb2
    const ans = positionEl(container, 5, 4)!;
    await waitFor(() => expect(nameOf(ans)).toMatch(/\banswer\b/));
    expect(labelOf(ans)).toBe('Db');
    expect(nameOf(ans)).toContain('Db3');
    expect(nameOf(ans)).not.toContain('C#');
    // The reference keeps its spelling once answered, in its label and its full name.
    const ref = positionEl(container, 5, 1)!;
    expect(labelOf(ref)).toBe('Bb');
    expect(nameOf(ref)).toContain('Bb2');
    expect(nameOf(ref)).not.toContain('A#');
  });
});

describe('FR-032 / FR-032a / FR-049 flat target: F + m3 = Ab, never G#', () => {
  it('after an incorrect answer the revealed answer (string 6 fret 4) is labelled "A♭" and named "Ab2"', async () => {
    const { container } = await renderDrill(PRESET, F);
    await waitFor(() => expect(promptText(container)).toMatch(/\bF\b/));
    tap(container, 6, 2); // F#2 (MIDI 42): not the m3 of F2
    const ans = positionEl(container, 6, 4)!;
    await waitFor(() => expect(nameOf(ans)).toMatch(/\banswer\b/));
    expect(labelOf(ans)).toBe('Ab');
    expect(nameOf(ans)).toContain('String 6, fret 4, Ab2');
    expect(nameOf(ans)).not.toContain('G#');
  });

  it('a correct answer at string 6 fret 4 is named "String 6, fret 4, Ab2", never G#2', async () => {
    const { container } = await renderDrill(PRESET, F);
    await waitFor(() => expect(promptText(container)).toMatch(/\bF\b/));
    tap(container, 6, 4);
    const ans = positionEl(container, 6, 4)!;
    await waitFor(() => expect(nameOf(ans)).toMatch(/\bcorrect\b/));
    expect(nameOf(ans)).toContain('String 6, fret 4, Ab2');
    expect(nameOf(ans)).not.toContain('G#');
  });

  it('every answered position named on the board uses the question spelling: no G# anywhere after answering', async () => {
    const { container } = await renderDrill(PRESET, F);
    await waitFor(() => expect(promptText(container)).toMatch(/\bF\b/));
    tap(container, 6, 2);
    await waitFor(() => expect(nameOf(positionEl(container, 6, 4))).toMatch(/\banswer\b/));
    const sharpAnswer = [...container.querySelectorAll('[role="button"][aria-label^="String 6, fret 4"]')].map((e) => nameOf(e));
    expect(sharpAnswer.length).toBe(1);
    expect(sharpAnswer[0]).not.toMatch(/G#/);
    const labels = [...container.querySelectorAll('[role="button"] text')].map((t) => norm(t.textContent));
    expect(labels).not.toContain('G#');
  });
});
