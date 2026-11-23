/**
 * code-reviewer T091-T093 r2 MAJOR #2 (red, test-first) [FR-047, FR-049, FR-036]: on drill start a
 * chord-tone question's stated window is in view, not just its first fret.
 *
 * Spec wording used as the expected values (FR-047): "The first question starts scrolled so that its
 * starting focus position (FR-049), the nut column and the stated window, when there is one, are
 * visible. Later questions keep the focused position and the nut column in view; the stated window
 * starts in view when it fits alongside them". The visible range is read from FR-047's plain-text
 * indicator ("Open and frets a–b of 12" / "Frets a–b of 12" / "Fret a of 12"), which counts a fret
 * only when its whole target is visible. FR-049: the starting position of a chord-tone question is
 * the first fret of its window on the lowest string.
 *
 * Deterministic setup, brute force per profile: frets 0–12, the lowest string only, chord-tone
 * root of a major chord, root pitch class = (open MIDI of the lowest string + 11) mod 12. On that
 * string that pitch class sits only at fret 11 within 0–12 (frets 11 and 11 - 12 < 0, 11 + 12 > 12),
 * so with FR-036's 4-fret window every question's window is 8–11 or 9–12 (window starts 0..9),
 * well right of the scroll-0 view at 390 px (layout-mock). Every question's answer is fret 11.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const DASH = '–';
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PC_NAME = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const lowestOpenMidi = (p: InstrumentProfile) => noteMidi(p.tuning[0]!);
const ALL = presets().map((p) => [p.presetId, p.profile] as const);

const nameOf = (el: Element | null | undefined) => el?.getAttribute('aria-label') ?? '';
const active = () => document.activeElement as HTMLElement | null;

function settingsFor(p: InstrumentProfile) {
  const rootPc = (lowestOpenMidi(p) + 11) % 12;
  return { type: 'chord-tone' as const, strings: [p.stringCount], fromFret: 0, toFret: 12, roots: [PC_NAME[rootPc]!], qualities: ['major'], functions: ['R'] };
}
function promptWindow(container: HTMLElement): [number, number] {
  const t = norm(container.querySelector('#prompt')?.textContent);
  const m = /frets (\d+) to (\d+)/.exec(t);
  if (!m) throw new Error(`prompt states no window: "${t}"`);
  return [Number(m[1]), Number(m[2])];
}
/** The fretted frets in view, from the FR-047 indicator. */
function visibleFrets(): [number, number] {
  const text = norm(screen.getByText(/ of 12$/).textContent);
  const m = new RegExp(`^(?:Open and )?[Ff]rets? (\\d+)(?:${DASH}(\\d+))? of 12$`).exec(text);
  if (!m) throw new Error(`indicator names no fretted fret in view: "${text}"`);
  return [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])];
}
const focusedFret = () => {
  const m = /^String (\d+), (?:open|fret (\d+))/.exec(nameOf(active()));
  if (!m) throw new Error(`focus is not on a fretboard position: "${nameOf(active())}"`);
  return { string: Number(m[1]), fret: m[2] ? Number(m[2]) : 0 };
};

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe.each(ALL)('FR-047 chord-tone window in view on drill start, %s (all InstrumentProfiles)', (_id, p) => {
  it('precondition (brute force): the root sits at fret 11 on the lowest string, so the window is 8–11 or 9–12', async () => {
    const { container } = await renderDrill(_id, settingsFor(p));
    const [x, y] = promptWindow(container);
    expect([[8, 11], [9, 12]]).toContainEqual([x, y]);
  });

  it('question 1: the visible range includes the whole stated window [X, Y], and focus is inside it', async () => {
    const { container } = await renderDrill(_id, settingsFor(p));
    const [x, y] = promptWindow(container);
    await waitFor(() => expect(nameOf(active())).toMatch(/^String /));
    const f = focusedFret();
    expect(f.string).toBe(p.stringCount);
    expect(f.fret >= x && f.fret <= y, `focus fret ${f.fret} outside window ${x}-${y}`).toBe(true);
    const [a, b] = visibleFrets();
    expect(a <= x && y <= b, `window ${x}${DASH}${y} not fully in view: frets ${a}${DASH}${b}`).toBe(true);
  });

  it('question 2 (after a correct answer at fret 11 and Continue): its window is in view, since it fits alongside the focused fret 11', async () => {
    const { container } = await renderDrill(_id, settingsFor(p));
    await waitFor(() => expect(nameOf(active())).toMatch(/^String /));
    const answer = positionEl(container, p.stringCount, 11)!;
    act(() => { fireEvent.click(answer); });
    const cont = await screen.findByRole('button', { name: 'Continue' });
    act(() => { fireEvent.click(cont); });
    await waitFor(() => expect(norm(container.textContent)).toContain('Question 2 of 5.'));
    const [x, y] = promptWindow(container);
    const [a, b] = visibleFrets();
    expect(a <= x && y <= b, `Q2 window ${x}${DASH}${y} not fully in view: frets ${a}${DASH}${b}`).toBe(true);
    const f = focusedFret();
    expect(f).toEqual({ string: p.stringCount, fret: 11 });
  });
});
