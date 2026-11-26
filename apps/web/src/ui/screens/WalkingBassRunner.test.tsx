/**
 * T098 UI: FR-058 walking-bass entry, judging and recording; US6 scenario 3. Expected notes are hand
 * derived on bass4-standard (E1 A1 D2 G2; string 1 = G): C2 = string 3 fret 3, E2 = string 2 fret 2,
 * G2 = string 1 fret 0, B1 = string 3 fret 2, A1 = string 3 fret 0, D2 = string 2 fret 0, F2 = string 2
 * fret 3, A2 = string 1 fret 2, G#2 = string 1 fret 1, B2 = string 1 fret 4, D3 = string 1 fret 7.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AppContext } from '../hooks';
import { makeApp, drillSettings, renderDrill } from '../__tests__/drill-harness';
import { installLayoutMock, positionEl } from '../__tests__/layout-mock';
import { WalkingBassRunner } from './WalkingBassRunner';

let restore: (() => void) | undefined;
beforeEach(() => { const r = installLayoutMock() as unknown; restore = typeof r === 'function' ? (r as () => void) : undefined; });
afterEach(() => { cleanup(); restore?.(); });

async function renderLine() {
  const app = await makeApp('bass4-standard');
  const inst = app.activeInstrument()!;
  const s = drillSettings({ type: 'walking-bass', strings: [1, 2, 3, 4], key: { tonic: 'C', mode: 'major' } });
  const utils = render(
    <AppContext.Provider value={app}>
      <MemoryRouter><WalkingBassRunner profile={inst.profile} instrumentId={inst.id} settings={s} onExit={() => undefined} /></MemoryRouter>
    </AppContext.Provider>,
  );
  return { app, ...utils };
}
const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
const slot = (name: RegExp) => screen.getByRole('button', { name });

/** A fully valid line over | C | Am | Dm | G | (bar n's beat 4 leads into bar n + 1's root). */
const GOOD: [number, number][] = [
  [3, 3], [2, 2], [1, 0], [3, 2], //  C2 E2 G2 B1 → A1 (2 semitones)
  [3, 0], [3, 3], [2, 2], [2, 1], //  A1 C2 E2 D#2 → D2 (1); beat 4 is judged by R3/R4 only
  [2, 0], [2, 3], [1, 2], [1, 1], //  D2 F2 A2 G#2 → G2 (1)
  [1, 0], [1, 4], [1, 7], [1, 0], //  G2 B2 D3 G2 → C2 across the loop (7, P5)
];

describe('FR-058 walking-bass screen', () => {
  it('shows 4 bars with chord names and 16 slots named "Bar N, beat B, <chord>"', async () => {
    await renderLine();
    expect(screen.getAllByRole('button', { name: /^Bar \d, beat \d, / })).toHaveLength(16);
    expect(slot(/^Bar 1, beat 1, C, empty/)).toBeTruthy();
    expect(slot(/^Bar 2, beat 3, Am, empty/)).toBeTruthy();
    expect(slot(/^Bar 4, beat 4, G, empty/)).toBeTruthy();
  });

  it('a wrong beat 1 names R1 in FR-058 wording', async () => {
    const { container } = await renderLine();
    await tap(container, 2, 0); // D2 on bar 1 beat 1 (C)
    expect(container.textContent).toContain("Beat 1 is the chord's root (C); you played D.");
    expect(slot(/^Bar 1, beat 1, C, D2, breaks a rule/)).toBeTruthy();
  });

  it('beat 4 waits for the next bar’s beat 1, then is judged (R3)', async () => {
    const { container } = await renderLine();
    for (const [s, f] of GOOD.slice(0, 4)) await tap(container, s, f);
    expect(slot(/^Bar 1, beat 4, C, B1, waiting for the next bar/)).toBeTruthy();
    await tap(container, 3, 0); // A1
    expect(slot(/^Bar 1, beat 4, C, B1, fits/)).toBeTruthy();
  });

  it('Undo removes the last note; selecting a slot and re-entering re-judges it', async () => {
    const { container } = await renderLine();
    await tap(container, 2, 0); // wrong D2
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(slot(/^Bar 1, beat 1, C, empty/)).toBeTruthy();
    await tap(container, 2, 0);
    await act(async () => { fireEvent.click(slot(/^Bar 1, beat 1, C, D2/)); });
    await tap(container, 3, 3); // C2
    expect(slot(/^Bar 1, beat 1, C, C2, fits/)).toBeTruthy();
  });

  it('Check line is disabled until all 16 slots are filled, then records 16 walking-bass attempts', async () => {
    const { container, app } = await renderLine();
    const check = () => screen.getByRole('button', { name: 'Check line' }) as HTMLButtonElement;
    for (const [s, f] of GOOD.slice(0, 15)) await tap(container, s, f);
    expect(check().disabled).toBe(true);
    await tap(container, ...GOOD[15]!);
    expect(check().disabled).toBe(false);
    await act(async () => { fireEvent.click(check()); });
    const atts = app.getState().attempts.filter((a) => !a.deleted);
    expect(atts).toHaveLength(16);
    expect(atts.every((a) => a.drillType === 'walking-bass')).toBe(true);
    expect(atts.map((a) => a.itemKey)).toEqual([
      ...Array(4).fill('bs|walking-bass|major'), ...Array(8).fill('bs|walking-bass|minor'), ...Array(4).fill('bs|walking-bass|major'),
    ]);
    expect(atts.every((a) => a.outcome === 'correct')).toBe(true);
    expect(container.textContent).toContain('16 of 16 notes fit the rules.');
  });

  it('after Check line every note stays selectable, so the rule a broken note breaks can be read (code-reviewer T098 #3)', async () => {
    const { container } = await renderLine();
    await tap(container, 2, 0); // D2 on bar 1 beat 1: R1
    for (const [s, f] of GOOD.slice(1)) await tap(container, s, f);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check line' })); });
    const broken = slot(/^Bar 1, beat 1, C, D2, breaks a rule/) as HTMLButtonElement;
    expect(broken.disabled).toBe(false);
    await act(async () => { fireEvent.click(broken); });
    expect(container.textContent).toContain("Beat 1 is the chord's root (C); you played D.");
  });

  it('a broken slot reveals its fixes with FR-058 captions on the fretboard', async () => {
    const { container } = await renderLine();
    await tap(container, 2, 0); // D2 over C
    await act(async () => { fireEvent.click(slot(/^Bar 1, beat 1, C, D2/)); });
    const c2 = positionEl(container, 3, 3)!.getAttribute('aria-label') ?? '';
    expect(c2).toContain('root of C');
  });
});

const announceText = (c: HTMLElement) => (c.querySelector('.announce')?.textContent ?? '').trim();
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
const slots = () => screen.getAllByRole('button', { name: /^Bar \d, beat \d, / }) as HTMLButtonElement[];
const fill = async (c: HTMLElement, n: number) => { for (const [s, f] of GOOD.slice(0, n)) await tap(c, s, f); };

describe('T098a Mode B3 triage (CR-B3-1..9)', () => {
  it('US6 scenario 17: after C2 the live region ends with "Now: Bar 1, beat 2, C"', async () => {
    const { container } = await renderLine();
    await tap(container, 3, 3);
    expect(announceText(container)).toMatch(/Now: Bar 1, beat 2, C$/);
  });

  it('CR-B3-1: a wrong beat-1 message stays visible while the current slot is bar 1 beat 2, and the fix position says "root of C"', async () => {
    const { container } = await renderLine();
    await tap(container, 2, 0); // D2 over C
    expect(container.textContent).toContain('Bar 1, beat 1:');
    expect(container.textContent).toContain("Beat 1 is the chord's root (C); you played D.");
    expect(announceText(container)).toMatch(/Now: Bar 1, beat 2, C$/);
    expect(positionEl(container, 3, 3)!.getAttribute('aria-label') ?? '').toContain('root of C');
  });

  it('CR-B3-2: Undo reverts a re-entry (restores E2); after undoing everything Undo is disabled and announces nothing new', async () => {
    const { container } = await renderLine();
    await tap(container, 3, 3); // C2
    await tap(container, 2, 2); // E2 at slot 1
    await click(slot(/^Bar 1, beat 2, C, E2/));
    await tap(container, 1, 0); // G2 replaces E2
    expect(slot(/^Bar 1, beat 2, C, G2/)).toBeTruthy();
    const undo = () => screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    await click(undo());
    expect(slot(/^Bar 1, beat 2, C, E2/)).toBeTruthy();
    for (let i = 0; i < 2 && !undo().disabled; i++) await click(undo());
    expect(slot(/^Bar 1, beat 1, C, empty/)).toBeTruthy();
    expect(undo().disabled).toBe(true);
    const before = announceText(container);
    await click(undo());
    expect(announceText(container)).toBe(before);
  });

  it('CR-B3-3: a double-clicked Check line records exactly 16 attempts', async () => {
    const { container, app } = await renderLine();
    await fill(container, 16);
    const check = screen.getByRole('button', { name: 'Check line' });
    await act(async () => { fireEvent.click(check); fireEvent.click(check); });
    expect(app.getState().attempts.filter((a) => !a.deleted)).toHaveLength(16);
  });

  it('CR-B3-3: a failed save records 0 attempts and says the notes are still here', async () => {
    const { container, app } = await renderLine();
    const spy = vi.spyOn(app as unknown as { recordAttempts: (...a: unknown[]) => Promise<void> }, 'recordAttempts').mockRejectedValue(new Error('disk full'));
    await fill(container, 16);
    await click(screen.getByRole('button', { name: 'Check line' }));
    expect(spy).toHaveBeenCalled();
    expect(app.getState().attempts.filter((a) => !a.deleted)).toHaveLength(0);
    expect(container.textContent).toContain("Couldn't save this line. Your notes are still here; try Check line again.");
  });

  it('CR-B3-4: roving tabindex over the 16 slots, ArrowRight / End / Enter', async () => {
    const { container } = await renderLine();
    const stops = slots().filter((b) => b.tabIndex === 0);
    expect(slots()).toHaveLength(16);
    expect(stops).toHaveLength(1);
    const first = stops[0]!;
    act(() => first.focus());
    const idx = slots().indexOf(first);
    await act(async () => { fireEvent.keyDown(first, { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(slots()[idx + 1]);
    await act(async () => { fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' }); });
    expect(document.activeElement).toBe(slots()[15]);
    await act(async () => { fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' }); });
    expect(slots()[15]!.getAttribute('aria-label') ?? slots()[15]!.textContent).toContain(', selected');
    expect(container.querySelectorAll('button[tabindex="0"]').length).toBeGreaterThan(0);
  });

  it('CR-B3-5: intro sentence, definitions and the Chord-tone lock link', async () => {
    const { container } = await renderLine();
    const t = container.textContent ?? '';
    expect(t).toContain('A walking line plays one note per beat and moves step by step through the chords.');
    expect(t).toContain('the note the chord is named after');
    expect(t).toContain('one fret');
    expect(screen.getByRole('link', { name: 'New to this? Try Chord-tone lock first' })).toBeTruthy();
  });

  it('CR-B3-8: End drill with notes asks first; Keep playing is focused, closes the dialog and keeps notes', async () => {
    const { container } = await renderLine();
    await tap(container, 3, 3);
    await click(screen.getByRole('button', { name: /End drill/ }));
    const dlg = screen.getByRole('dialog');
    expect(dlg.textContent).toContain("End drill? Your 1 unchecked notes won't be saved.");
    const keep = screen.getByRole('button', { name: 'Keep playing' });
    expect(document.activeElement).toBe(keep);
    await click(keep);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(slot(/^Bar 1, beat 1, C, C2/)).toBeTruthy();
  });

  it('CR-B3-9: status text after one entry', async () => {
    const { container } = await renderLine();
    await tap(container, 3, 3);
    expect(container.textContent).toContain('1 of 16 notes entered. Next empty: Bar 1, beat 2.');
  });
});

describe('T098a CR-B3-6 chord-tone lock feedback lists the chord tones', () => {
  it('a correct E2 on question 1 (C) shows "(C, E, G)"', async () => {
    const { container } = await renderDrill('bass4-standard', { type: 'chord-tone-lock', strings: [1, 2, 3, 4], key: { tonic: 'C', mode: 'major' } });
    await tap(container, 2, 2);
    expect(container.textContent).toContain('(C, E, G)');
  });
});

describe('T098a review fixes (code-reviewer r1 #1, #3, #4)', () => {
  it('the Chord-tone lock link carries the key as ?key=', async () => {
    await renderLine();
    const link = screen.getByRole('link', { name: 'New to this? Try Chord-tone lock first' });
    expect(link.getAttribute('href')).toBe('/drills/chord-tone-lock?key=C');
  });

  it('arrow keys move the tab stop without changing which slot the next tap fills', async () => {
    const { container } = await renderLine();
    const first = slots().find((b) => b.tabIndex === 0)!;
    act(() => first.focus());
    await act(async () => { fireEvent.keyDown(first, { key: 'ArrowRight' }); });
    expect(slots()[1]!.tabIndex).toBe(0);
    await tap(container, 3, 3);
    expect(slot(/^Bar 1, beat 1, C, C2/)).toBeTruthy();
  });

  it('the End drill dialog keeps Tab inside and returns focus to End drill on Escape', async () => {
    const { container } = await renderLine();
    await tap(container, 3, 3);
    const end = screen.getByRole('button', { name: /End drill/ });
    await click(end);
    const keep = screen.getByRole('button', { name: 'Keep playing' });
    await act(async () => { fireEvent.keyDown(keep, { key: 'Tab' }); });
    expect(document.activeElement?.textContent).toBe('End drill');
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await act(async () => { fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /End drill/ }));
  });
});
