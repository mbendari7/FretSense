/**
 * Spec change (red, test-first) [FR-034, FR-040, FR-042; US6 scenario 14]: what the drill summary and
 * Progress count for multi-step questions (arpeggio, root–fifth–octave).
 *
 * spec.md (product-owner 2026-11-22, provisional):
 *  - US6-14: "Given an arpeggio drill for Am7 on 6-string Standard, When the user plays Steps 1, 3 and 4
 *    correctly and misses Step 2, Then exactly one attempt with outcome incorrect is recorded for item
 *    (arpeggio, m7), holding every judged tap in tap order, and the drill summary and Progress each
 *    count 1 question."
 *  - FR-034: ""Number asked" counts the same unit FR-040 records for the drill type (questions; notes
 *    for walking-bass; chords for chord-tone lock), so the summary and Progress always agree. For
 *    per-string figures, a multi-step question counts toward the string of its Step 1 (root)
 *    position: the user's tap, or the revealed root if Step 1 was missed."
 *  - FR-042: "Each item group names its unit: "questions" for every drill except walking-bass
 *    ("notes") and chord-tone lock ("chords"), e.g. "18 of 24 questions correct"."
 * The m7 quality's id in settings and item keys is "min7" (data-model §3.1 grammar bs|arpeggio|<id>).
 *
 * Am7 positions are brute-forced from the preset's open strings for whatever window the prompt states
 * (the drill has no root setting, so Date.now is tried until question 1 is Am7): the lowest A in the
 * window on the selected strings, then the exact pitches + 3, + 7, + 10. The wrong Step-2 tap is a
 * position in the window whose pitch class is not A, C, E or G.
 * Other fixtures as in DrillRunner.multistep-interrupt.test.tsx (D# minor; root–fifth–octave on C).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { presetById, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
type Pos = { string: number; fret: number };
const k = (x: Pos) => `${x.string}/${x.fret}`;

type S = Partial<DrillSettings> & Pick<DrillSettings, 'strings'>;
const promptText = (c: HTMLElement) => norm(c.querySelector('#prompt')?.textContent);
async function startWhere(presetId: string, s: S, pred: (p: string) => boolean) {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= 300; t++) {
    now.mockReturnValue(t);
    const r = await renderDrill(presetId, s);
    if (pred(promptText(r.container))) return r;
    cleanup();
  }
  throw new Error('no matching first question in 300 seeds');
}
const tap = async (c: HTMLElement, p: Pos) => {
  const el = positionEl(c, p.string, p.fret);
  expect(el, `position ${k(p)}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
type App = Awaited<ReturnType<typeof renderDrill>>['app'];
const live = (app: App) => app.getState().attempts.filter((a) => !a.deleted);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
const endDrill = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'End drill' })); }); };
const cont = async () => { await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); }); };
const summary = (c: HTMLElement) => c.querySelector('.summary') as HTMLElement | null;
/** Summary table rows as [row header, cells...], normalised. */
const rows = (el: HTMLElement | null) => [...(el?.querySelectorAll('tr') ?? [])].map((tr) => [...tr.querySelectorAll('th, td')].map((x) => norm(x.textContent)));
const stringRows = (el: HTMLElement | null) => rows(el).filter((r) => /^String \d+$/.test(r[0] ?? ''));

// ---- Am7 on 6-string Standard (US6-14) ------------------------------------------------------
const STD = presetById('guitar6-standard')!.profile;
const ALL6 = [1, 2, 3, 4, 5, 6];
const AM7: S = { type: 'arpeggio', strings: ALL6, fromFret: 0, toFret: 12, qualities: ['min7'] };
function am7Plan(prompt: string) {
  const m = /frets (\d+) to (\d+)/.exec(prompt)!;
  const [from, to] = [Number(m[1]), Number(m[2])];
  const area = ALL6.flatMap((s) => Array.from({ length: to - from + 1 }, (_, i) => ({ string: s, fret: from + i, midi: openMidi(STD, s) + from + i })));
  const rm = Math.min(...area.filter((x) => pcOf(x.midi) === 9).map((x) => x.midi));
  const step = (o: number) => area.find((x) => x.midi === rm + o)!;
  const wrong = area.find((x) => ![9, 0, 4, 7].includes(pcOf(x.midi)))!;
  return { s1: step(0), s3: step(7), s4: step(10), wrong };
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('US6-14: Am7 on 6-string Standard, Steps 1, 3, 4 correct and Step 2 missed', () => {
  async function play() {
    const r = await startWhere('guitar6-standard', AM7, (p) => /\(Am7\)/.test(p));
    const plan = am7Plan(promptText(r.container));
    for (const p of [plan.s1, plan.wrong, plan.s3, plan.s4]) await tap(r.container, p);
    await waitFor(() => expect(live(r.app).length).toBeGreaterThan(0));
    await settle();
    return { ...r, plan };
  }

  it('brute-force plan: every step has a position in the stated window and the wrong tap is no chord tone', async () => {
    const r = await startWhere('guitar6-standard', AM7, (p) => /\(Am7\)/.test(p));
    const plan = am7Plan(promptText(r.container));
    expect([plan.s1, plan.s3, plan.s4, plan.wrong].every(Boolean)).toBe(true);
    expect(pcOf(plan.s1.midi)).toBe(9);
    expect([pcOf(plan.s3.midi), pcOf(plan.s4.midi)]).toEqual([4, 7]);
  });

  it('exactly one attempt: incorrect, item bs|arpeggio|min7, every judged tap in tap order', async () => {
    const { app, plan } = await play();
    const list = live(app);
    expect(list.length).toBe(1);
    expect(list[0]!.outcome).toBe('incorrect');
    expect(list[0]!.itemKey).toBe('bs|arpeggio|min7');
    expect(list[0]!.answer.map(k)).toEqual([plan.s1, plan.wrong, plan.s3, plan.s4].map(k));
  });

  it('the summary counts 1 question (0 of 1), never the 4 steps', async () => {
    const { container } = await play();
    await endDrill();
    const t = norm(summary(container)?.textContent);
    expect(t).toMatch(/\b0 of 1\b/);
    expect(t).not.toMatch(/\bof [2-9]\b/);
  });

  it('FR-034 per string: the question counts under its Step 1 root\'s string (the user\'s tap), and only there', async () => {
    const { container, plan } = await play();
    await endDrill();
    expect(stringRows(summary(container))).toEqual([[`String ${plan.s1.string}`, '0 of 1', expect.any(String)]]);
  });

  it('Progress counts the same unit: the arpeggio group reads "0 of 1 questions correct"', async () => {
    const { app } = await play();
    cleanup();
    const { container } = render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
    const all = screen.queryByRole('radio', { name: 'All time' });
    if (all) await act(async () => { fireEvent.click(all); });
    expect(norm(container.textContent)).toMatch(/\b0 of 1 questions correct\b/);
  });
});

// ---- FR-034 per-string figures for multi-step questions -------------------------------------
const ARP: S = { type: 'arpeggio', strings: [2, 3, 4], fromFret: 11, toFret: 13, qualities: ['minor'] };
const RFO: S = { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 17, qualities: ['major'], adaptive: false } as S;
const P = (string: number, fret: number): Pos => ({ string, fret });

describe('FR-034 per-string figures: the string of the Step 1 root (tap, or revealed root if Step 1 was missed)', () => {
  it('arpeggio D# minor, Step 1 missed (B4 2/12), then F#4 3/11, A#4 2/11: counts under string 4 (the revealed D#4 4/13), not string 2', async () => {
    const r = await startWhere('guitar6-standard', ARP, (p) => /D# minor/.test(p));
    for (const p of [P(2, 12), P(3, 11), P(2, 11)]) await tap(r.container, p);
    await waitFor(() => expect(live(r.app).length).toBeGreaterThan(0));
    await endDrill();
    expect(stringRows(summary(r.container))).toEqual([['String 4', '0 of 1', expect.any(String)]]);
  });

  it('arpeggio D# minor, two questions (one missed step, one clean): string 4 has 1 of 2; no other string rows', async () => {
    const r = await startWhere('guitar6-standard', ARP, (p) => /D# minor/.test(p));
    for (const p of [P(4, 13), P(3, 12), P(2, 11)]) await tap(r.container, p);
    await cont();
    for (const p of [P(4, 13), P(3, 11), P(2, 11)]) await tap(r.container, p);
    await waitFor(() => expect(live(r.app).length).toBeGreaterThanOrEqual(2));
    await endDrill();
    expect(norm(summary(r.container)?.textContent)).toMatch(/\b1 of 2\b/);
    expect(stringRows(summary(r.container))).toEqual([['String 4', '1 of 2', expect.any(String)]]);
  });

  it('root–fifth–octave C, Step 1 tapped at C2 3/3 (US6-7 order): counts under string 3', async () => {
    const r = await startWhere('bass4-standard', RFO, (p) => /shape for C(?![#b])/.test(p));
    for (const p of [P(3, 3), P(1, 17), P(2, 5)]) await tap(r.container, p);
    await waitFor(() => expect(live(r.app).length).toBeGreaterThan(0));
    await endDrill();
    expect(stringRows(summary(r.container))).toEqual([['String 3', '0 of 1', expect.any(String)]]);
  });

  it('root–fifth–octave C, Step 1 missed (C3 2/10, US6-10) and C2 3/3 revealed: counts under string 3, not string 2', async () => {
    const r = await startWhere('bass4-standard', RFO, (p) => /shape for C(?![#b])/.test(p));
    for (const p of [P(2, 10), P(2, 5), P(1, 5)]) await tap(r.container, p);
    await waitFor(() => expect(live(r.app).length).toBeGreaterThan(0));
    await endDrill();
    expect(stringRows(summary(r.container))).toEqual([['String 3', '0 of 1', expect.any(String)]]);
  });
});
