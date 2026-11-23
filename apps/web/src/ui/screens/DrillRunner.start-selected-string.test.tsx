/**
 * code-reviewer T091–T093 r3 MINOR #10 (red, test-first) [FR-049]: "`startOf` can land on an
 * unselected string." Coordinator ruling (2026-11-22): the drill start focus is the highest-numbered
 * SELECTED string that exists on the instrument (≤ stringCount).
 *
 * spec.md FR-049: the starting position is "the first fret of the window (chord-tone, arpeggio) or of
 * the range (other drills) on the lowest selected string", and (code-reviewer r2 clarification)
 * "start on the highest-numbered selected string". A selected string number above stringCount (a
 * stale setting carried across instruments) is not on the instrument and must be ignored, not
 * clamped to the instrument's lowest string, which may be unselected.
 *
 * Every preset (Constitution IV: parameterise over all InstrumentProfiles): chord-tone drill,
 * strings {1, 2, 3, stringCount + 1}, frets 0–12. Expected focus: string 3 at the first fret of the
 * window the prompt states ("…, frets s to e").
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, waitFor } from '@testing-library/react';
import { presets } from '@fretsense/theory';
import { installLayoutMock, norm } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const ALL = presets().map((p) => [p.presetId, p.profile] as const);
const nameOf = (el: Element | null | undefined) => el?.getAttribute('aria-label') ?? '';
const startsAt = (el: Element | null | undefined, s: number, f: number) => {
  const head = f === 0 ? `String ${s}, open` : `String ${s}, fret ${f}`;
  const n = nameOf(el);
  return n === head || n.startsWith(`${head},`);
};

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe('FR-049 start focus: the highest selected string that exists on the instrument', () => {
  it.each(ALL)('%s: chord-tone, strings {1, 2, 3, stringCount + 1} → focus on string 3 at the window start', async (_id, p) => {
    const { container } = await renderDrill(_id, { type: 'chord-tone', strings: [1, 2, 3, p.stringCount + 1], fromFret: 0, toFret: 12 });
    const m = /frets (\d+) to (\d+)/.exec(norm(container.querySelector('#prompt')?.textContent));
    expect(m, norm(container.textContent)).toBeTruthy();
    const from = Number(m![1]);
    await waitFor(() => expect(startsAt(document.activeElement, 3, from), `focused: "${nameOf(document.activeElement)}"`).toBe(true));
  });
});
