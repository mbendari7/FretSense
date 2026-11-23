/**
 * T100 (red, test-first) [FR-048, FR-049]: Tab order from the fretboard (user-tester Mode B2 #12,
 * product-owner triage "Bug: Tab from the board goes to the page body (FR-048)").
 *
 * spec.md FR-049: "Every control and fretboard position MUST be keyboard-operable"; "The fretboard is
 * one tab stop"; "While feedback is shown, Enter or Space on the fretboard activates Continue".
 * FR-048: the drill screen meets WCAG 2.2 AA (2.4.3 Focus Order: focus order preserves meaning and
 * operability). B2 #12 observed: "Continue is before the board. A keyboard user on the board who
 * presses Tab leaves the page (focus goes to the body)."
 *
 * Expected (test-writer reading of the bug, flagged in the report):
 *  - Tab from the board never lands on <body>; it reaches another control of the drill screen.
 *  - While feedback is shown, Continue is reachable by Tab from the board (it follows the board in
 *    tab order), before focus leaves the drill.
 * Frets 0–4 on string 6 keep the neck narrower than the 390 px area, so no jump controls are drawn
 * after the board (the B2 case: nothing focusable after it).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installLayoutMock } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const active = () => document.activeElement as HTMLElement | null;
const isPosition = (el: Element | null) => !!el?.getAttribute('aria-label')?.startsWith('String ');

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

async function start() {
  const r = await renderDrill('guitar6-standard', { strings: [6], notes: [7], fromFret: 0, toFret: 4 });
  await waitFor(() => expect(isPosition(active()), `focused: ${active()?.outerHTML.slice(0, 80)}`).toBe(true));
  return r;
}

describe('FR-048 / FR-049 Tab from the fretboard stays in the drill screen', () => {
  it('while a question is open, Tab from the board moves to a control of the drill, not <body>', async () => {
    const { container } = await start();
    const user = userEvent.setup();
    await user.tab();
    expect(active(), 'Tab from the board went to <body>').not.toBe(document.body);
    expect(container.contains(active())).toBe(true);
    expect(isPosition(active()), 'the board is one tab stop').toBe(false);
  });

  it('after an incorrect answer, Continue is reached by Tab from the board before focus leaves the drill', async () => {
    const { container } = await start();
    await act(async () => { fireEvent.keyDown(active()!, { key: 'Enter' }); }); // open E: not G
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(isPosition(active())).toBe(true);
    const user = userEvent.setup();
    const seen: (Element | null)[] = [];
    for (let i = 0; i < 6; i++) {
      await user.tab();
      seen.push(active());
      if (active() === cont || active() === document.body || !container.contains(active())) break;
    }
    expect(active(), `Tab order from the board: ${seen.map((e) => e?.tagName + ':' + (e?.textContent ?? '').slice(0, 20)).join(' > ')}`).toBe(cont);
  });
});
