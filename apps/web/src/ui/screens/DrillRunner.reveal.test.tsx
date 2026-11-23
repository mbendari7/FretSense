/**
 * code-reviewer T091-T093 r2 MAJOR #3, spec change (provisional) (red, test-first) [FR-032, FR-047,
 * FR-049]: after an incorrect answer the board scrolls the revealed answer into view.
 *
 * FR-032 (spec.md, new text): "When feedback for an incorrect answer appears, the fretboard scrolls
 * ... so that the revealed correct position nearest the tapped position (fewest frets apart, then
 * fewest strings, then lower fret) and the nut column are fully in view, together with the tapped
 * position when both fit; when they do not both fit, the revealed position wins and the clipped-edge
 * cue (FR-047) points toward the tapped position. Keyboard focus stays on the tapped position (FR-049)
 * and is not moved by this scroll." US3 acceptance: at 390 px, tapping fret 2 when the only correct
 * fret is 15 leaves fret 15 and the nut visible and focus on fret 2, with a cue toward fret 2.
 *
 * Deterministic adaptation, brute force over every preset (presets have 20 or 22 frets, not 24):
 * note-finding on the lowest string, any octave, with notes {pc} where
 * pc = (open MIDI of the lowest string + K) mod 12.
 *  - "far" case: range 2–fretCount, K = 13. The pitch class occurs on that string at frets 1, 13
 *    and 25; only 13 is in [2, fretCount ≤ 24], so the only correct position is fret 13. Tap fret 2
 *    (11 frets away): at 390 px (layout-mock) fewer than 12 frets fit, so the revealed fret 13 wins
 *    and the left cue (data-scroll-cue="left", right-handed) points toward fret 2.
 *  - "near" case: same question, tap fret 12: 1 fret apart, both fit, both in view.
 *  - "nearest" case: range 0–fretCount, K = 3: correct frets 3 and 15. Tap fret 14 (after
 *    focusing it, which scrolls it into view): the nearest revealed is 15 (1 fret, not 11), in view
 *    together with fret 14.
 *  - "tie" case: range 0–fretCount, K = 3, tap fret 9: frets 3 and 15 are both 6 frets away on the
 *    same string, so the lower fret, 3, must be in view.
 * Visible frets come from FR-047's indicator ("Frets a–b of N" / "Open and frets a–b of N").
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const DASH = '–';
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const lowOpen = (p: InstrumentProfile) => noteMidi(p.tuning[0]!);
const ALL = presets().map((p) => [p.presetId, p.profile] as const);

const nameOf = (el: Element | null | undefined) => el?.getAttribute('aria-label') ?? '';
const active = () => document.activeElement as HTMLElement | null;

function settings(p: InstrumentProfile, k: number, fromFret: number) {
  return { strings: [p.stringCount], notes: [(lowOpen(p) + k) % 12], fromFret, toFret: p.fretCount };
}
/** Brute force: every fret in [from, to] on the lowest string with that pitch class. */
function correctFrets(p: InstrumentProfile, k: number, from: number, to: number): number[] {
  const pc = (lowOpen(p) + k) % 12;
  const out: number[] = [];
  for (let f = from; f <= to; f++) if ((lowOpen(p) + f) % 12 === pc) out.push(f);
  return out;
}
function visibleFrets(of: number): [number, number] {
  const text = norm(screen.getByText(new RegExp(` of ${of}$`)).textContent);
  const m = new RegExp(`^(?:Open and )?[Ff]rets? (\\d+)(?:${DASH}(\\d+))? of ${of}$`).exec(text);
  if (!m) throw new Error(`indicator names no fretted fret in view: "${text}"`);
  return [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])];
}
const inView = (f: number, [a, b]: [number, number]) => f >= a && f <= b;

/** Focus a position (as a pointer press or arrow keys would) and then tap it. */
async function focusAndTap(container: HTMLElement, s: number, f: number) {
  const el = positionEl(container, s, f);
  if (!el) throw new Error(`no position string ${s} fret ${f}`);
  await act(async () => { el.focus(); });
  await act(async () => { fireEvent.click(el); });
  return el;
}
async function waitIncorrect(container: HTMLElement) {
  await waitFor(() => expect(norm(container.querySelector('.feedback')?.textContent)).toMatch(/Incorrect/));
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe.each(ALL)('FR-032 reveal scroll after an incorrect answer, %s (all InstrumentProfiles)', (id, p) => {
  const S = p.stringCount;

  it('precondition (brute force): range 2–N has exactly one correct fret, 13; range 0–N has 3 and 15', () => {
    expect(correctFrets(p, 13, 2, p.fretCount)).toEqual([13]);
    expect(correctFrets(p, 3, 0, p.fretCount)).toEqual([3, 15]);
  });

  it('far: tap fret 2, only correct fret 13: fret 13 is in view, focus stays on fret 2, the left cue points toward the tap', async () => {
    const { container } = await renderDrill(id, settings(p, 13, 2));
    await waitFor(() => expect(nameOf(active())).toMatch(new RegExp(`^String ${S}, fret 2\\b`)));
    const tapped = await focusAndTap(container, S, 2);
    await waitIncorrect(container);
    await waitFor(() => expect(inView(13, visibleFrets(p.fretCount)), `view ${visibleFrets(p.fretCount).join(DASH)}`).toBe(true));
    expect(inView(2, visibleFrets(p.fretCount)), 'both cannot fit at 390 px (precondition)').toBe(false);
    expect(active()).toBe(tapped);
    expect(nameOf(active())).toMatch(new RegExp(`^String ${S}, fret 2\\b`));
    expect(container.querySelector('[data-scroll-cue="left"]')).toBeTruthy();
    // The nut column (open-string names) is still drawn.
    expect(container.querySelector(`[data-nut-string="${S}"]`)).toBeTruthy();
    // The revealed answer is marked as the answer.
    expect(nameOf(positionEl(container, S, 13))).toMatch(/\banswer\b/);
  });

  it('near: tap fret 12 next to the only correct fret 13: both are in view and focus stays on fret 12', async () => {
    const { container } = await renderDrill(id, settings(p, 13, 2));
    await waitFor(() => expect(nameOf(active())).toMatch(/^String /));
    const tapped = await focusAndTap(container, S, 12);
    await waitIncorrect(container);
    const v = visibleFrets(p.fretCount);
    expect(inView(13, v) && inView(12, v), `view ${v.join(DASH)}`).toBe(true);
    expect(active()).toBe(tapped);
  });

  it('nearest: correct frets 3 and 15, tap fret 14: fret 15 (1 fret away, not 3 at 11) and fret 14 are in view', async () => {
    const { container } = await renderDrill(id, settings(p, 3, 0));
    await waitFor(() => expect(nameOf(active())).toMatch(/^String /));
    const tapped = await focusAndTap(container, S, 14);
    await waitIncorrect(container);
    const v = visibleFrets(p.fretCount);
    expect(inView(15, v) && inView(14, v), `view ${v.join(DASH)}`).toBe(true);
    expect(active()).toBe(tapped);
  });

  it('tie: correct frets 3 and 15, tap fret 9 (6 frets from each): the lower fret, 3, is in view; the tap too if it fits, else the right cue points to it', async () => {
    const { container } = await renderDrill(id, settings(p, 3, 0));
    await waitFor(() => expect(nameOf(active())).toMatch(/^String /));
    const tapped = await focusAndTap(container, S, 9);
    await waitIncorrect(container);
    const v = visibleFrets(p.fretCount);
    expect(inView(3, v), `view ${v.join(DASH)}`).toBe(true);
    if (!inView(9, v)) expect(container.querySelector('[data-scroll-cue="right"]')).toBeTruthy();
    expect(active()).toBe(tapped);
  });
});
