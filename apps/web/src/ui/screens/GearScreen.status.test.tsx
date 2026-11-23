/**
 * T100 / CR-B2-7 (red, test-first) [FR-053, FR-048].
 *
 * spec.md FR-053 (provisional, product-owner 2026-11-22): "After adding a preset, a status message
 * names it and states whether it became the active instrument ("Added 4-string bass, Standard. It is
 * now your active instrument."). The message is scrolled into view, receives focus and is announced.
 * Opening the custom-instrument form scrolls its heading into view and moves focus to it."
 *
 * The preset's name is the preset's own `name` (presets()); whether it became active is read from
 * the app state after the add, not assumed. "Announced" = the message is in a polite live region
 * (role="status" or aria-live="polite").
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { presets } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { GearScreen } from './GearScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp() {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  return app;
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
function renderGear(app: FretSenseApp, path = '/gear/instruments') {
  return render(<AppContext.Provider value={app}><MemoryRouter initialEntries={[path]}><GearScreen /></MemoryRouter></AppContext.Provider>);
}
const bass = presets().find((p) => p.presetId === 'bass4-standard')!;
const presetButton = (name: string) => screen.getAllByRole('button').find((b) => norm(b.textContent).startsWith(norm(name)))!;
const inPoliteRegion = (el: Element) => !!el.closest('[role="status"], [aria-live="polite"]');

let scrolled: Element[] = [];
let saved: PropertyDescriptor | undefined;
afterEach(() => {
  cleanup();
  if (saved) Object.defineProperty(Element.prototype, 'scrollIntoView', saved);
  else delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
  saved = undefined;
  scrolled = [];
});
/** jsdom has no scrollIntoView: record calls (this element was asked to scroll into view). */
function spyScroll() {
  saved = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: function (this: Element) { scrolled.push(this); } });
}

describe('FR-053 (CR-B2-7) the status after adding a preset is in view, focused and announced', () => {
  it('first instrument: "Added <preset>. It is now your active instrument." receives focus and is scrolled into view', async () => {
    spyScroll();
    const app = await makeApp();
    renderGear(app);
    await act(async () => { fireEvent.click(presetButton(bass.name)); });
    await waitFor(() => expect(app.liveInstruments()).toHaveLength(1));
    expect(app.activeInstrument()?.name).toBe(bass.name); // brute fact: the only instrument is the active one
    const msg = await screen.findByText((_, el) => !!el && el.children.length === 0 && norm(el.textContent) === norm(`Added ${bass.name}. It is now your active instrument.`));
    expect(inPoliteRegion(msg), 'announced').toBe(true);
    await waitFor(() => expect(msg.contains(document.activeElement) || document.activeElement?.contains(msg), `focus is on ${document.activeElement?.outerHTML.slice(0, 80)}`).toBe(true));
    expect(scrolled.some((el) => el.contains(msg) || msg.contains(el)), 'the message was scrolled into view').toBe(true);
  });

  it('a second instrument: the status says whether it became active, matching the app state', async () => {
    spyScroll();
    const app = await makeApp();
    await app.addPreset('guitar6-standard');
    const before = app.activeInstrument()!.name;
    renderGear(app);
    await act(async () => { fireEvent.click(presetButton(bass.name)); });
    await waitFor(() => expect(app.liveInstruments()).toHaveLength(2));
    const nowActive = app.activeInstrument()!.name === bass.name;
    const status = await waitFor(() => {
      const el = [...document.querySelectorAll('[role="status"], [aria-live="polite"]')].find((e) => norm(e.textContent).startsWith(norm(`Added ${bass.name}.`)));
      expect(el).toBeTruthy();
      return el!;
    });
    const t = norm(status.textContent);
    if (nowActive) expect(t).toContain('It is now your active instrument.');
    else {
      expect(t).not.toContain('It is now your active instrument.');
      expect(t, `"${t}" does not say which instrument is active`).toMatch(/active/i);
      expect(t).toContain(norm(before));
    }
    await waitFor(() => expect(status.contains(document.activeElement) || document.activeElement === status).toBe(true));
  });

  it('opening the custom-instrument form scrolls its heading into view and moves focus to it', async () => {
    spyScroll();
    const app = await makeApp();
    renderGear(app);
    await act(async () => { fireEvent.click(presetButton('Custom instrument')); });
    const h = await screen.findByRole('heading', { name: 'Custom instrument' });
    await waitFor(() => expect(document.activeElement).toBe(h));
    expect(scrolled).toContain(h);
  });
});
