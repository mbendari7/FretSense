/**
 * T094 (red, test-first) [FR-032a, FR-047, FR-049]: drill-runner fretboard behaviour.
 * Real FretSenseApp over memoryRepository(); questions come from the real generator, constrained by
 * settings so the answer is known from music theory, not from the implementation:
 *  - Eb tuning (string 3 open = Gb3), notes {F#} (pc 6), strings {3}: every question is "Find F# on
 *    string 3, Gb" (FR-030 prompt form "string N, <open>", middle string so no low/high; F# major has
 *    6 sharps and Gb major 6 flats, the tie goes to sharps per Edge Cases), answered at fret 0 or 12.
 *  - Standard tuning, notes {G}: G is fret 3 on string 6 (E) and fret 10 on string 5 (A).
 * Expected behaviour is quoted from spec.md:
 *  - FR-049: "On drill start, focus moves into the fretboard at the starting position: the first fret
 *    of the question's range on the prompted string (note-finding), the reference position
 *    (interval)"; "On each later question, focus stays on the fretboard at the last answered
 *    position"; "Feedback and the 'Question N of M. <prompt>' announcement use one polite live
 *    region"; "The Home key moves focus to the current question's starting position ... without
 *    answering"; hint "Arrow keys: move. Enter or Space: answer, then continue. Home: go to the start
 *    of the question." (CR-B2-12) whenever the fretboard has focus
 *    and the last input was a key press; "While feedback is shown, Enter or Space on the fretboard
 *    activates Continue; activating Continue by any means returns focus to the fretboard at the
 *    last answered position"; names "String N, fret F" ("String N, open"), then the spelled note
 *    with octave ...; reduced while a question is open (FR-032a).
 *  - FR-032: after an incorrect answer the correct positions stay until the user taps "Continue".
 *  - FR-032a: nut labels spelled as the instrument while unanswered, in the question's spelling once
 *    answered; open-question names are "String N, fret F" plus marker suffixes only.
 *  - FR-047: the first question starts scrolled so its starting focus position is visible.
 * Test hook (shared with Fretboard.test.tsx): nut labels carry `data-nut-string="N"`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { presets } from '@fretsense/theory';
import { allPositions, installLayoutMock, liveRegions, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

// spec FR-049 (CR-B2-12, owner-approved 2026-11-22): "the drill screen shows the visible hint "Arrow keys: move.
// Enter or Space: answer, then continue. Home: go to the start of the question.""
const HINT = 'Arrow keys: move. Enter or Space: answer, then continue. Home: go to the start of the question.';
const OPEN_QUESTION_NAME = /^String \d+, (open|fret \d+)(, [a-z][a-z ]*)*$/;
const ALL = presets().map((p) => [p.presetId, p.profile] as const);
const DASH = '–';

const active = () => document.activeElement as HTMLElement | null;
const nameOf = (el: Element | null | undefined) => el?.getAttribute('aria-label') ?? '';
const startsAt = (el: Element | null | undefined, s: number, f: number) => {
  const head = f === 0 ? `String ${s}, open` : `String ${s}, fret ${f}`;
  const n = nameOf(el);
  return n === head || n.startsWith(`${head},`);
};
async function key(k: string, el: Element | null = active()) {
  if (!el) throw new Error('nothing focused');
  await act(async () => { fireEvent.keyDown(el, { key: k }); });
}
const ebF = () => renderDrill('guitar6-eb', { strings: [3], notes: [6] });
const PROMPT_F = 'Find F# on string 3, Gb';

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe('FR-049 drill start: focus moves into the fretboard at the starting position', () => {
  describe.each(ALL)('%s', (_id, profile) => {
    it('note-finding on the lowest string, frets 0–12: focus on "String N, open"', async () => {
      await renderDrill(_id, { strings: [profile.stringCount] });
      await waitFor(() => expect(startsAt(active(), profile.stringCount, 0), `focused: "${nameOf(active())}"`).toBe(true));
    });
  });

  it('note-finding, frets 2–12: focus on the first fret of the range on the prompted string', async () => {
    const { container } = await renderDrill('guitar6-standard', { strings: [5, 6], notes: [7], fromFret: 2 });
    const prompted = Number(/Find G on string (\d)/.exec(norm(container.textContent))![1]);
    await waitFor(() => expect(startsAt(active(), prompted, 2), `focused: "${nameOf(active())}"`).toBe(true));
  });

  it('interval: focus on the reference position, and the first question is scrolled so it is visible (FR-047)', async () => {
    await renderDrill('guitar6-standard', { type: 'interval', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 20, intervals: ['P5'], direction: 'up' });
    await waitFor(() => expect(nameOf(active())).toMatch(/\breference\b/));
    const ref = /^String \d+, (?:open|fret (\d+))/.exec(nameOf(active()));
    expect(ref).toBeTruthy();
    const fret = ref![1] ? Number(ref![1]) : 0;
    const text = norm(screen.getByText(/ of 20$/).textContent);
    const m = new RegExp(`^(Open)?(?: and )?(?:[Ff]rets? (\\d+)(?:${DASH}(\\d+))?)? of 20$`).exec(text);
    expect(m, text).toBeTruthy();
    if (fret === 0) expect(m![1]).toBe('Open');
    else {
      const a = Number(m![2]);
      const b = m![3] ? Number(m![3]) : a;
      expect(fret >= a && fret <= b, `reference fret ${fret} not in view: "${text}"`).toBe(true);
    }
  });
});

describe('FR-049 "Question N of M. <prompt>" in one polite live region', () => {
  it('on drill start the polite region announces "Question 1 of 5. Find F♯ on string 3, G♭"', async () => {
    const { container } = await ebF();
    await waitFor(() => {
      const hit = liveRegions(container).filter((r) => r.politeness === 'polite' && norm(r.el.textContent) === `Question 1 of 5. ${PROMPT_F}`);
      expect(hit.length).toBe(1);
    });
  });

  it('feedback goes into the same polite region; no assertive region is used', async () => {
    const { container } = await ebF();
    let region: Element | undefined;
    await waitFor(() => {
      region = liveRegions(container).find((r) => r.politeness === 'polite' && norm(r.el.textContent).startsWith('Question 1 of 5.'))?.el;
      expect(region).toBeTruthy();
    });
    await key('Enter');
    expect(norm(region!.textContent)).toMatch(/Correct/);
    expect(liveRegions(container).filter((r) => r.politeness === 'assertive')).toEqual([]);
  });

  it('after Continue the same region announces "Question 2 of 5. <prompt>"', async () => {
    const { container } = await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    const region = liveRegions(container).find((r) => r.politeness === 'polite' && norm(r.el.textContent).startsWith('Question 1 of 5.'))?.el;
    expect(region).toBeTruthy();
    await key('Enter');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
    expect(norm(region!.textContent)).toContain(`Question 2 of 5. ${PROMPT_F}`);
  });
});

describe('FR-032a nut labels and open-question names in a drill', () => {
  it('while unanswered the nut shows the instrument spelling (string 3 "G♭"); once answered, the question spelling ("F♯")', async () => {
    const { container } = await ebF();
    const nut3 = () => norm(container.querySelector('[data-nut-string="3"]')?.textContent);
    expect(nut3()).toBe('Gb');
    expect(norm(container.querySelector('[data-nut-string="6"]')?.textContent)).toBe('Eb');
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('Enter');
    expect(nut3()).toBe('F#');
  });

  describe.each(ALL)('%s', (id) => {
    it('every position name is "String N, fret F" / "String N, open" plus lowercase marker suffixes only', async () => {
      const { container } = await renderDrill(id, { strings: [1, 2] });
      const names = allPositions(container).map((el) => nameOf(el));
      expect(names.length).toBeGreaterThan(0);
      for (const n of names) expect(n).toMatch(OPEN_QUESTION_NAME);
    });
  });

  it('once answered, the answered fret-0 position names its note with octave in the question spelling', async () => {
    const { container } = await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('Enter');
    expect(norm(nameOf(positionEl(container, 3, 0))).startsWith('String 3, open, F#3')).toBe(true);
  });

  it('a fret-0 position is a full answer target: answering "String 3, open" is judged correct', async () => {
    const { app, container } = await ebF();
    expect(positionEl(container, 3, 0), 'no target named "String 3, open"').toBeTruthy();
    await act(async () => { fireEvent.click(positionEl(container, 3, 0)!); });
    await waitFor(() => expect(app.getState().attempts.length).toBe(1));
    expect(app.getState().attempts[0]!.outcome).toBe('correct');
  });
});

describe('FR-049 later questions: focus stays at the last answered position', () => {
  it('with auto-advance 600 ms, focus is still on "String 3, open" when question 2 appears', async () => {
    await renderDrill('guitar6-eb', { strings: [3], notes: [6] }, 600);
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('Enter');
    await waitFor(() => expect(screen.getByText(/Question 2 of 5/)).toBeTruthy(), { timeout: 3000 });
    expect(startsAt(active(), 3, 0), `focused: "${nameOf(active())}"`).toBe(true);
  });

  it('answering does not move focus off the fretboard (feedback is not interrupted)', async () => {
    await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('Enter');
    expect(startsAt(active(), 3, 0), `focused: "${nameOf(active())}"`).toBe(true);
  });
});

describe('FR-049 Enter or Space on the fretboard activates Continue while feedback shows', () => {
  it.each([['Enter'], [' ']])('%j advances to question 2 without recording another answer', async (k) => {
    const { app } = await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('Enter');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    await key(k);
    await waitFor(() => expect(screen.getByText(/Question 2 of 5/)).toBeTruthy());
    expect(app.getState().attempts.length).toBe(1);
    expect(startsAt(active(), 3, 0), `focused: "${nameOf(active())}"`).toBe(true);
  });
});

describe('FR-049 Continue returns focus to the fretboard at the last answered position', () => {
  it('after an incorrect answer at "String 3, fret 1", clicking Continue focuses that position', async () => {
    await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('ArrowRight');
    expect(startsAt(active(), 3, 1)).toBe(true);
    await key('Enter'); // G on a Gb string: not F#
    const cont = screen.getByRole('button', { name: 'Continue' });
    cont.focus();
    await act(async () => { fireEvent.click(cont); });
    await waitFor(() => expect(screen.getByText(/Question 2 of 5/)).toBeTruthy());
    expect(startsAt(active(), 3, 1), `focused: "${nameOf(active())}"`).toBe(true);
  });
});

describe('FR-049 Home key goes to the start of the question without answering', () => {
  it('from another string and fret, Home returns to the prompted string at the range start; nothing is recorded', async () => {
    const { app, container } = await renderDrill('guitar6-standard', { strings: [5, 6], notes: [7], fromFret: 2 });
    const prompted = Number(/Find G on string (\d)/.exec(norm(container.textContent))![1]);
    await waitFor(() => expect(startsAt(active(), prompted, 2)).toBe(true));
    await key('ArrowUp');
    await key('ArrowRight');
    await key('ArrowRight');
    expect(startsAt(active(), prompted, 2), 'arrows moved focus away from the start').toBe(false);
    await key('Home');
    expect(startsAt(active(), prompted, 2), `focused: "${nameOf(active())}"`).toBe(true);
    expect(app.getState().attempts.length).toBe(0);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByText(/Question 1 of 5/)).toBeTruthy();
  });
});

describe('FR-049 keyboard hint "Arrow keys: move. Enter or Space: answer, then continue. Home: go to the start of the question."', () => {
  it('shows while the fretboard has keyboard focus, hides after pointer input and when focus leaves', async () => {
    const { container } = await ebF();
    await waitFor(() => expect(startsAt(active(), 3, 0)).toBe(true));
    await key('ArrowRight');
    expect(screen.getByText(HINT)).toBeTruthy();

    const other = positionEl(container, 4, 2)!; // another string: not judged (FR-030)
    await act(async () => {
      fireEvent.pointerDown(other);
      fireEvent.mouseDown(other);
      other.focus();
    });
    expect(screen.queryByText(HINT)).toBeNull();

    await key('ArrowRight');
    expect(screen.getByText(HINT)).toBeTruthy();
    const end = screen.getByRole('button', { name: 'End drill' });
    await act(async () => { fireEvent.keyDown(active()!, { key: 'Tab' }); end.focus(); });
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
