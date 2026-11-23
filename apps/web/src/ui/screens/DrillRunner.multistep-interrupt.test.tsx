/**
 * Spec change (red, test-first) [FR-034, FR-040, FR-033; Edge Cases "Interrupted drill"; US6
 * scenarios 15 and 16]: pause / resume and End drill in the middle of a multi-step question, for the
 * arpeggio and (as the caller asked) root–fifth–octave drills.
 *
 * spec.md, Edge Cases "Interrupted drill" (product-owner 2026-11-22, provisional):
 *   "A multi-step question (root–fifth–octave, arpeggio) keeps its judged steps, taps, placed and
 *   revealed positions, and continues at the next pending step; nothing is recorded for it until its
 *   last step is judged, and its response time is its active time before the pause plus the time
 *   since resume (paused time never counts)."
 * FR-034: "A question counts as answered only when its last step (or note) is judged. Ending early
 *   discards an unfinished question: its taps are not recorded and it appears in neither the summary
 *   nor Progress. When one is discarded, the summary adds "Your unfinished question wasn't saved."
 *   (with 0 answered: "No questions answered. Your unfinished question wasn't saved.")" and "Ending
 *   with 0 answered shows "No questions answered", records nothing and does not count as abandoned
 *   for FR-028."
 * US6-15: "Given an arpeggio question with Steps 1 and 2 judged, When the app is backgrounded and then
 *   resumed, Then Steps 1 and 2 keep their marks and revealed positions, the drill asks for Step 3,
 *   nothing has been recorded yet, and one attempt is recorded when the last step is judged."
 * US6-16: "Given the first arpeggio question with Steps 1 and 2 judged, When the user selects "End
 *   drill", Then the summary reads "No questions answered. Your unfinished question wasn't saved.",
 *   nothing is recorded, and the session does not count as abandoned (FR-028)."
 *
 * Fixtures (brute-forced in DrillRunner.arpeggio-attempts.test.tsx and
 * DrillRunner.rfo-scenarios.test.tsx, not from the implementation):
 *  - Arpeggio: 6-string Standard, strings 2–4, frets 11–13, minor → D# minor only. Step 1 D#4 4/13,
 *    Step 2 F#4 3/11 (its only position in the area, so a missed Step 2 reveals 3/11), Step 3 A#4
 *    2/11. G4 3/12 is a wrong ♭3.
 *  - Root–fifth–octave: 4-string EADG, strings 1–3, frets 0–17, root C (US6-5..12 fixture): C2 3/3 is
 *    Step 1; C4 1/17 is "Doesn't fit", charged to Step 3, which reveals C3 1/5; G2 2/5 is Step 2.
 *
 * Backgrounding is simulated the way a browser reports it: document.hidden / visibilityState and a
 * "visibilitychange" event. Time is performance.now (DrillRunner's clock), mocked to a test-owned
 * value; the expected response time is computed from the timeline, never read from the app.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { drillSettings, makeApp } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';
import { AppContext } from '../hooks';
import { DrillRunner } from './DrillRunner';

type S = Partial<DrillSettings> & Pick<DrillSettings, 'strings'>;
const ARP: S = { type: 'arpeggio', strings: [2, 3, 4], fromFret: 11, toFret: 13, qualities: ['minor'] };
const RFO: S = { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 17, qualities: ['major'], adaptive: false } as S;
const UNSAVED = "Your unfinished question wasn't saved.";
const NONE_UNSAVED = "No questions answered. Your unfinished question wasn't saved.";

// ---- clock and visibility --------------------------------------------------------------------
let clock = 0;
let hidden = false;
async function setHidden(h: boolean) {
  hidden = h;
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
}

// ---- rendering -------------------------------------------------------------------------------
async function mountOnce(presetId: string, s: S) {
  const app = await makeApp(presetId);
  const inst = app.activeInstrument()!;
  const onComplete = vi.fn();
  const onExit = vi.fn();
  const utils = render(
    <AppContext.Provider value={app}>
      <MemoryRouter>
        <DrillRunner profile={inst.profile} instrumentId={inst.id} settings={drillSettings(s)} onExit={onExit} onComplete={onComplete} lessonId="root-fifth-octave" />
      </MemoryRouter>
    </AppContext.Provider>,
  );
  return { app, onComplete, onExit, ...utils };
}
const promptText = (c: HTMLElement) => norm(c.querySelector('#prompt')?.textContent);
async function mountArp() {
  vi.spyOn(Date, 'now').mockReturnValue(1);
  const r = await mountOnce('guitar6-standard', ARP);
  expect(promptText(r.container)).toMatch(/D# minor/);
  return r;
}
/** The drill has no root setting: try seeds until question 1 is for C (expected values don't depend on it). */
async function mountRfoC() {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= 300; t++) {
    now.mockReturnValue(t);
    const r = await mountOnce('bass4-standard', RFO);
    if (/shape for C(?![#b])/.test(promptText(r.container))) return r;
    cleanup();
  }
  throw new Error('no root-fifth-octave question for C in 300 seeds');
}

const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `position string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
const label = (c: HTMLElement, s: number, f: number) => norm(positionEl(c, s, f)?.getAttribute('aria-label'));
/** FR-057 indicator states, in step order ("correct" | "missed" | "pending"). */
const states = (c: HTMLElement) =>
  [...(c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps'))?.querySelectorAll('li') ?? []].map((li) => /, (correct|missed|pending)$/.exec(norm(li.getAttribute('aria-label') ?? li.textContent))?.[1] ?? '?');
const currentStep = (c: HTMLElement) => [...(c.querySelector('ol.steps')?.querySelectorAll('li') ?? [])].findIndex((li) => li.classList.contains('now'));
type App = Awaited<ReturnType<typeof makeApp>>;
const live = (app: App) => app.getState().attempts.filter((a) => !a.deleted);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
const k = (x: { string: number; fret: number }) => `${x.string}/${x.fret}`;
const endDrill = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'End drill' })); }); };
const summaryText = (c: HTMLElement) => norm(c.querySelector('.summary')?.textContent ?? c.textContent);

let restore: () => void;
beforeAll(() => {
  restore = installLayoutMock();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
});
afterAll(() => {
  restore();
  delete (document as unknown as Record<string, unknown>).hidden;
  delete (document as unknown as Record<string, unknown>).visibilityState;
});
beforeEach(() => {
  hidden = false;
  clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// =============================================================================================
describe('US6-15 arpeggio: background mid-question, then resume', () => {
  /** Timeline: shown 1000; Step 1 at 2000; Step 2 at 3000; hidden 4000; visible 104000; Step 3 at 104500. */
  async function upToResume() {
    const r = await mountArp();
    clock = 2000; await tap(r.container, 4, 13); // Step 1 ✓
    clock = 3000; await tap(r.container, 3, 12); // Step 2 ✗ (G4), reveals F#4 3/11
    expect(states(r.container)).toEqual(['correct', 'missed', 'pending']);
    clock = 4000; await setHidden(true);
    clock = 104_000; await setHidden(false);
    return r;
  }

  it('Steps 1 and 2 keep their marks; the drill asks for Step 3', async () => {
    const { container } = await upToResume();
    expect(states(container)).toEqual(['correct', 'missed', 'pending']);
    expect(currentStep(container), 'Step 3 is the current step').toBe(2);
  });

  it('the taps keep their marks and the missed step keeps its revealed position', async () => {
    const { container } = await upToResume();
    expect(label(container, 4, 13)).toMatch(/\bcorrect\b/);
    expect(label(container, 3, 12)).toMatch(/\bincorrect\b/);
    expect(label(container, 3, 11), 'F#4 3/11 is still revealed').toMatch(/\banswer\b/);
  });

  it('nothing is recorded before the last step; then exactly one attempt, holding every judged tap in order', async () => {
    const { app, container } = await upToResume();
    await settle();
    expect(live(app).length, 'nothing recorded yet').toBe(0);
    clock = 104_500; await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    expect(live(app).map((a) => [a.outcome, a.answer.map(k).join(' ')])).toEqual([['incorrect', '4/13 3/12 2/11']]);
  });

  it('paused time is excluded: response time = (4000 − 1000) + (104500 − 104000) = 3500 ms', async () => {
    const { app, container } = await upToResume();
    clock = 104_500; await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    expect(live(app)[0]!.responseMs).toBe(3500);
  });

  it('without a pause, the one attempt\'s response time runs from the prompt to the last step (104500 − 1000)', async () => {
    const { app, container } = await mountArp();
    clock = 2000; await tap(container, 4, 13);
    clock = 3000; await tap(container, 3, 12);
    clock = 104_500; await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    expect(live(app)[0]!.responseMs).toBe(103_500);
  });
});

describe('Edge Cases "Interrupted drill" for root–fifth–octave: background mid-question, then resume', () => {
  /** Timeline: shown 1000; C2 3/3 at 2000; C4 1/17 (wrong) at 3000; hidden 4000; visible 104000; G2 2/5 at 104500. */
  async function upToResume() {
    const r = await mountRfoC();
    clock = 2000; await tap(r.container, 3, 3);
    clock = 3000; await tap(r.container, 1, 17);
    expect(states(r.container)).toEqual(['correct', 'pending', 'missed']);
    clock = 4000; await setHidden(true);
    clock = 104_000; await setHidden(false);
    return r;
  }

  it('the judged steps, taps and the revealed C3 1/5 are kept; Step 2 is the next pending step', async () => {
    const { container } = await upToResume();
    expect(states(container)).toEqual(['correct', 'pending', 'missed']);
    expect(label(container, 3, 3)).toMatch(/\bcorrect\b/);
    expect(label(container, 1, 17)).toMatch(/\bincorrect\b/);
    expect(label(container, 1, 5), 'C3 1/5 is still revealed').toMatch(/\banswer\b/);
  });

  it('nothing recorded until the last step; then one attempt (incorrect; 3/3, 1/17, 2/5) with paused time excluded (3500 ms)', async () => {
    const { app, container } = await upToResume();
    await settle();
    expect(live(app).length).toBe(0);
    clock = 104_500; await tap(container, 2, 5);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    const list = live(app);
    expect(list.map((a) => [a.outcome, a.answer.map(k).join(' ')])).toEqual([['incorrect', '3/3 1/17 2/5']]);
    expect(list[0]!.responseMs).toBe(3500);
  });

  it('a repeat of a kept position after resume is still ignored (FR-056a): 3/3 again is "already in this answer"', async () => {
    const { app, container } = await upToResume();
    await tap(container, 3, 3);
    expect(norm(container.textContent)).toContain('String 3, fret 3 is already in this answer');
    expect(states(container)).toEqual(['correct', 'pending', 'missed']);
    expect(live(app).length).toBe(0);
  });
});

// =============================================================================================
describe('US6-16 / FR-034: End drill in the middle of the first question', () => {
  it('arpeggio, Steps 1 and 2 judged: "No questions answered. Your unfinished question wasn\'t saved."; nothing recorded; not a completed Drill stage', async () => {
    const { app, container, onComplete } = await mountArp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await endDrill();
    expect(summaryText(container)).toContain(NONE_UNSAVED);
    await settle();
    expect(live(app).length, 'its taps are not recorded').toBe(0);
    expect(app.getState().completion.filter((c) => !c.deleted)).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('root–fifth–octave, Steps 1 and 2 judged (3/3, 2/5): the same summary line; nothing recorded', async () => {
    const { app, container, onComplete } = await mountRfoC();
    await tap(container, 3, 3);
    await tap(container, 2, 5);
    expect(states(container)).toEqual(['correct', 'correct', 'pending']);
    await endDrill();
    expect(summaryText(container)).toContain(NONE_UNSAVED);
    await settle();
    expect(live(app).length).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('control: End drill before any tap shows "No questions answered" without the unfinished-question sentence', async () => {
    const { app, container } = await mountArp();
    await endDrill();
    expect(summaryText(container)).toContain('No questions answered');
    expect(summaryText(container)).not.toContain(UNSAVED);
    await settle();
    expect(live(app).length).toBe(0);
  });

  it('End drill while paused mid-question also discards it (Edge Cases + FR-034)', async () => {
    const { app, container } = await mountArp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await setHidden(true);
    await setHidden(false);
    await endDrill();
    expect(summaryText(container)).toContain(NONE_UNSAVED);
    await settle();
    expect(live(app).length).toBe(0);
  });
});

describe('FR-034: End drill with answered > 0 and an unfinished question', () => {
  it('arpeggio: one question answered, the second started → summary adds "Your unfinished question wasn\'t saved."; one attempt recorded; the summary counts 1', async () => {
    const r = await mountArp();
    for (const [s, f] of [[4, 13], [3, 11], [2, 11]] as const) await tap(r.container, s, f);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); });
    // The next question may be any D# minor again (the only option); Step 1 is 4/13.
    await tap(r.container, 4, 13);
    await endDrill();
    const t = summaryText(r.container);
    expect(t).toContain(UNSAVED);
    expect(t).not.toContain('No questions answered');
    expect(t).toMatch(/\b1 of 1\b/);
    await settle();
    expect(live(r.app).length, 'only the finished question').toBe(1);
  });

  it('root–fifth–octave: one question answered (3/3, 2/5, 1/5), one tap into the next → the same sentence; one attempt', async () => {
    const m = await mountRfoC();
    for (const [s, f] of [[3, 3], [2, 5], [1, 5]] as const) await tap(m.container, s, f);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); });
    // The next root is seed-dependent; one tap (string 1 fret 1, always drawn in frets 0–17) can never
    // judge all three steps, so the question stays unfinished whatever the tap is judged as.
    await tap(m.container, 1, 1);
    await endDrill();
    expect(summaryText(m.container)).toContain(UNSAVED);
    await settle();
    expect(live(m.app).length).toBe(1);
  });

  it('control: one question answered and the next not touched → no unfinished-question sentence', async () => {
    const r = await mountArp();
    for (const [s, f] of [[4, 13], [3, 11], [2, 11]] as const) await tap(r.container, s, f);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); });
    await endDrill();
    expect(summaryText(r.container)).not.toContain(UNSAVED);
  });
});
