/**
 * T107 (red, test-first) [FR-048]: the import-preview and reset confirmations follow the FR-048
 * dialog rules via the shared Dialog primitive: aria-modal true, focus to the heading on open,
 * Escape closes (but not while the import is being written), focus returns to the opener, and the
 * destructive action is never the first control. Runs the real FretSenseApp over memoryRepository().
 * The tests do not pre-focus the opener (a real file picker would), so a return to it proves the
 * screen passes an explicit returnFocus.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import type { AnsweredQuestion } from '../../domain/drills/session';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
const STD = presetById('guitar6-standard')!.profile;
async function makeApp(prefix: string) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}
const NF = { drillType: 'note-finding', itemKey: `nf|${STD.geometryId}|5|0`, prompt: { drillType: 'note-finding', pitchClass: 0, string: 5, midi: null }, text: 'Find C on string 5', steps: [], reference: [], group: 'String 5' } as unknown as AnsweredQuestion['question'];
async function appWithProgress(prefix: string) {
  const app = await makeApp(prefix);
  await app.addPreset('guitar6-standard');
  await app.recordAttempt({ question: NF, taps: [{ string: 5, fret: 3 }], correct: true, responseMs: 900 }, { instrumentId: app.activeInstrument()!.id, profile: STD });
  return app;
}
function renderWith(app: FretSenseApp) {
  return render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
}
async function chooseFile(container: HTMLElement, exp: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(exp)], 'backup.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}
/** A Copy-mode preview (a file from another profile with something new in it). */
async function openImport() {
  const src = await makeApp('b7b7b7b7');
  await src.addPreset('guitar6-standard');
  const dst = await makeApp('c7c7c7c7');
  const r = renderWith(dst);
  await chooseFile(r.container, src.exportProfile(false));
  const dialog = await screen.findByRole('dialog');
  return { ...r, dst, dialog };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('[T107][FR-048] import preview dialog', () => {
  it('is aria-modal and focuses its heading on open', async () => {
    const { dialog } = await openImport();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const h = within(dialog).getByRole('heading', { name: 'Copy from file' });
    await waitFor(() => expect(document.activeElement).toBe(h));
  });

  it('Escape closes it and focus returns to "Import a file"', async () => {
    const user = userEvent.setup();
    await openImport();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Import a file' }));
  });

  it('Cancel closes it and focus returns to "Import a file"', async () => {
    const user = userEvent.setup();
    const { dialog } = await openImport();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Import a file' }));
  });

  it('focus stays inside while tabbing', async () => {
    const user = userEvent.setup();
    const { dialog } = await openImport();
    for (let i = 0; i < 6; i++) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true); }
  });

  it('Escape does NOT close it while the import is being written (preview.apply pending)', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    const src = await makeApp('d7d7d7d7');
    await src.addPreset('guitar6-standard');
    const dst = await makeApp('e7e7e7e7');
    const real = dst.previewImport.bind(dst);
    vi.spyOn(dst, 'previewImport').mockImplementation(async (...a: Parameters<typeof real>) => {
      const r = await real(...a);
      return r.ok ? { ...r, preview: { ...r.preview, apply: () => gate } } : r;
    });
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog'), 'still open while writing').toBeTruthy();
    await act(async () => { release(); await gate; });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('[T107][FR-048] reset confirmation dialog', () => {
  const open = async () => {
    const user = userEvent.setup();
    const app = await appWithProgress('f7f7f7f7');
    renderWith(app);
    const opener = screen.getByRole('button', { name: 'Clear progress…' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog');
    return { user, app, opener, dialog };
  };

  it('opens a modal dialog and focuses its heading', async () => {
    const { dialog } = await open();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const label = dialog.getAttribute('aria-labelledby')!;
    const h = document.getElementById(label)!;
    expect(h, 'labelled by a heading').toBeTruthy();
    expect(dialog.contains(h)).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(h));
  });

  it('the first button in tab order is the non-destructive "Keep it"', async () => {
    const { dialog } = await open();
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons[0]!.textContent).toBe('Keep it');
    expect(buttons.map((b) => b.textContent)).toContain('Clear progress');
  });

  it('Escape closes it and focus returns to "Clear progress…"', async () => {
    const { user } = await open();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear progress…' }));
  });

  it('"Keep it" closes it without resetting and returns focus', async () => {
    const { user, app, dialog } = await open();
    const spy = vi.spyOn(app, 'resetProgress');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(spy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear progress…' }));
  });

  it('"Clear progress" inside still resets', async () => {
    const { user, app, dialog } = await open();
    const spy = vi.spyOn(app, 'resetProgress');
    await user.click(within(dialog).getByRole('button', { name: 'Clear progress' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('[T107][FR-048] focus while the import is being written', () => {
  it('after clicking Import (apply pending) focus is still inside the dialog, on its heading, not on body', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    const src = await makeApp('a8a8a8a8');
    await src.addPreset('guitar6-standard');
    const dst = await makeApp('a9a9a9a9');
    const real = dst.previewImport.bind(dst);
    vi.spyOn(dst, 'previewImport').mockImplementation(async (...a: Parameters<typeof real>) => {
      const r = await real(...a);
      return r.ok ? { ...r, preview: { ...r.preview, apply: () => gate } } : r;
    });
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(document.activeElement).not.toBe(document.body);
    expect(dialog.contains(document.activeElement), `focus is on ${document.activeElement?.outerHTML.slice(0, 60)}`).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'Copy from file' }));
    await act(async () => { release(); await gate; });
  });
});

describe('[T107][FR-048] after confirming the reset', () => {
  it('focus moves to the "Start fresh" heading and "Progress cleared." is announced in a status element', async () => {
    const user = userEvent.setup();
    const app = await appWithProgress('b7b7c7c7');
    renderWith(app);
    await user.click(screen.getByRole('button', { name: 'Clear progress…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear progress' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const heading = screen.getByRole('heading', { name: 'Start fresh' });
    await waitFor(() => expect(document.activeElement, `focus is on ${document.activeElement?.outerHTML.slice(0, 60)}`).toBe(heading));
    expect((screen.getByRole('button', { name: 'Clear progress…' }) as HTMLButtonElement).disabled, 'opener is disabled when nothing is left').toBe(true);
    const status = screen.getAllByRole('status').find((el) => /cleared/i.test(el.textContent ?? ''));
    expect(status, 'a role=status element whose text contains "cleared"').toBeTruthy();
    expect(status!.textContent).toBe('Progress cleared.');
  });

  it('"Keep it" still returns focus to "Clear progress…" and announces nothing', async () => {
    const user = userEvent.setup();
    renderWith(await appWithProgress('b8b8c8c8'));
    await user.click(screen.getByRole('button', { name: 'Clear progress…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keep it' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear progress…' }));
    expect(screen.queryAllByRole('status').some((el) => /cleared/i.test(el.textContent ?? ''))).toBe(false);
  });
});
