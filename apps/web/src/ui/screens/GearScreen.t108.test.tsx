/**
 * T108 (red, test-first) [FR-048]: the My Gear instrument editor opens inside the shared Dialog
 * primitive (modal, heading focused, Escape and Cancel close and return focus to the opener). After a
 * successful save the status is announced and focus returns to the opener (provisional decision:
 * FR-048 return-focus wins for the editor; FR-053 "status receives focus" stays for preset adds).
 * Export has no dialog (the "verified" half of the task).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { GearScreen } from './GearScreen';
import { ProgressScreen } from './ProgressScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (0x8000 + ++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp() {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  await app.addPreset('guitar6-standard');
  return app;
}
const renderGear = (app: FretSenseApp) => render(<AppContext.Provider value={app}><MemoryRouter initialEntries={['/gear/instruments']}><GearScreen /></MemoryRouter></AppContext.Provider>);
const customTile = () => screen.getAllByRole('button').find((b) => (b.textContent ?? '').startsWith('Custom instrument'))!;
afterEach(cleanup);

describe.each([
  { name: 'Edit', open: () => screen.getByRole('button', { name: 'Edit' }), heading: /^Edit / },
  { name: 'Custom instrument', open: customTile, heading: 'Custom instrument' },
])('[T108][FR-048] editor opened with $name', ({ open, heading }) => {
  it('is a modal dialog and its heading is focused', async () => {
    const user = userEvent.setup();
    renderGear(await makeApp());
    await user.click(open());
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    const h = screen.getByRole('heading', { name: heading });
    expect(d.contains(h)).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(h));
  });

  it('Escape closes it and focus returns to the opener', async () => {
    const user = userEvent.setup();
    renderGear(await makeApp());
    const opener = open();
    await user.click(opener);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('Cancel closes it and focus returns to the opener', async () => {
    const user = userEvent.setup();
    renderGear(await makeApp());
    const opener = open();
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('focus stays inside while tabbing', async () => {
    const user = userEvent.setup();
    renderGear(await makeApp());
    await user.click(open());
    const d = screen.getByRole('dialog');
    for (let i = 0; i < 25; i++) { await user.tab(); expect(d.contains(document.activeElement), `Tab ${i + 1}`).toBe(true); }
  });

  it('after a successful save the message is announced (role=status) and focus is back on the opener', async () => {
    const user = userEvent.setup();
    renderGear(await makeApp());
    const opener = open();
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: /^(Save|Add) instrument$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/^(Saved|Added) /);
    await waitFor(() => expect(document.activeElement).toBe(opener));
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(document.activeElement, 'focus must not move on to the status message afterwards').toBe(opener);
  });
});

describe('[T108][FR-048] export has no dialog', () => {
  it('clicking "Export progress" announces a status and renders no role=dialog', async () => {
    const user = userEvent.setup();
    const app = await makeApp();
    const urlCtor = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
    const saved = [urlCtor.createObjectURL, urlCtor.revokeObjectURL];
    urlCtor.createObjectURL = () => 'blob:test';
    urlCtor.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
      await user.click(screen.getByRole('button', { name: 'Export progress' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('status').textContent).toMatch(/^Exported\./);
    } finally {
      [urlCtor.createObjectURL, urlCtor.revokeObjectURL] = saved;
      click.mockRestore();
    }
  });
});

describe('[T108][FR-048] editor opened with no opener (?new=1)', () => {
  const openNew = async (withPreset = false) => {
    let t = Date.UTC(2026, 10, 22, 12);
    const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
    await app.bootstrap();
    if (withPreset) await app.addPreset('guitar6-standard');
    const user = userEvent.setup();
    render(<AppContext.Provider value={app}><MemoryRouter initialEntries={['/gear/instruments?new=1']}><GearScreen /></MemoryRouter></AppContext.Provider>);
    return { app, user };
  };

  it('Escape closes it and focus lands on the page heading "My Gear", not body', async () => {
    const { user } = await openNew();
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'My Gear' }));
  });

  it('the form has no aria-labelledby (the dialog carries the name)', async () => {
    await openNew();
    const d = await screen.findByRole('dialog');
    const form = d.querySelector('form') ?? d.closest('form');
    expect(form, 'the editor form').toBeTruthy();
    expect(form!.hasAttribute('aria-labelledby')).toBe(false);
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('double-clicking "Add instrument" quickly adds only one instrument', async () => {
    const { app } = await openNew();
    const d = await screen.findByRole('dialog');
    const btn = within(d).getByRole('button', { name: 'Add instrument' });
    await act(async () => { fireEvent.click(btn); fireEvent.click(btn); });
    await waitFor(() => expect(app.liveInstruments().length).toBeGreaterThanOrEqual(1));
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(app.liveInstruments()).toHaveLength(1);
  });

  it('every tuning input has maxLength 6', async () => {
    await openNew();
    const d = await screen.findByRole('dialog');
    const inputs = [...d.querySelectorAll<HTMLInputElement>('input[aria-label$="open note"]')];
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    for (const i of inputs) expect(i.getAttribute('maxlength'), i.getAttribute('aria-label') ?? '').toBe('6');
  });
});
