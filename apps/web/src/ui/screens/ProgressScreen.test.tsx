/**
 * T092 (red, test-first), UI side of the import preview [FR-043, FR-066a].
 * Expected wording is quoted from spec.md:
 *  - FR-066a: the preview is "headed with its mode ("Restore from file" or "Copy from file")";
 *    when added, restored, updated and hidden are all 0 it says "This file has nothing new to import".
 *  - FR-043: in Copy mode the preview states, next to the confirm button: "Copy import adds this
 *    file's answers and instruments as new records every time. Importing the same file again adds
 *    them again."
 * Runs the real FretSenseApp over memoryRepository() (infrastructure/idb.ts).
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(prefix: string) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}
function renderWith(app: FretSenseApp) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter><ProgressScreen /></MemoryRouter>
    </AppContext.Provider>,
  );
}
async function chooseFile(container: HTMLElement, exp: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(exp)], 'backup.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const COPY_WARNING = "Copy import adds this file's answers and instruments as new records every time. Importing the same file again adds them again.";

describe('FR-066a import preview is headed with its mode', () => {
  it('same local profile: "Restore from file"', async () => {
    const app = await makeApp('a1a1a1a1');
    await app.addPreset('guitar6-standard');
    const { container } = renderWith(app);
    await chooseFile(container, app.exportProfile(false));
    expect(await screen.findByRole('heading', { name: 'Restore from file' })).toBeTruthy();
  });

  it('different local profile: "Copy from file", with the FR-043 warning next to the confirm button', async () => {
    const src = await makeApp('b1b1b1b1');
    await src.addPreset('guitar6-standard');
    const dst = await makeApp('c1c1c1c1');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    const heading = await screen.findByRole('heading', { name: 'Copy from file' });
    const dialog = heading.closest('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(norm(dialog.textContent)).toContain(COPY_WARNING);
  });
});

describe('FR-066a "nothing new to import"', () => {
  it('re-importing a file with no changes says "This file has nothing new to import"', async () => {
    const app = await makeApp('d1d1d1d1');
    await app.addPreset('guitar6-standard');
    const { container } = renderWith(app);
    await chooseFile(container, app.exportProfile(false));
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeTruthy());
    expect(norm(container.querySelector('[role="dialog"]')!.textContent)).toContain('This file has nothing new to import');
  });

  it('a file with something new does not say it', async () => {
    const src = await makeApp('e1e1e1e1');
    await src.addPreset('guitar6-standard');
    const dst = await makeApp('f1f1f1f1');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeTruthy());
    expect(norm(container.querySelector('[role="dialog"]')!.textContent)).not.toContain('nothing new');
  });
});

// =============================================================================================
// T093 (red): privacy-auditor r1 MAJOR #3. FR-043: "Apply settings from this file" defaults off, and
// the import must apply exactly what the checkbox shows. A re-preview made by toggling the checkbox
// may resolve out of order; a stale preview must never be the one Import applies.
type Deferred = { opts: { applySettings?: boolean } | undefined; fileName: string; resolve: () => void; applied: () => boolean };
function stubApp() {
  const calls: Deferred[] = [];
  const applies: boolean[] = []; // applySettings of each preview whose apply() ran
  const state = { status: 'ready', durable: true, instruments: [], attempts: [], completion: [] };
  const app = {
    subscribe: () => () => undefined,
    getState: () => state,
    exportProfile: () => ({}),
    resetProgress: async () => undefined,
    previewImport: (file: File, opts?: { applySettings?: boolean }) => {
      let resolve!: () => void;
      let applied = false;
      const on = !!opts?.applySettings;
      const p = new Promise<unknown>((res) => {
        resolve = () => res({
          ok: true,
          preview: {
            mode: 'copy',
            counts: { added: 1, restored: 0, updated: on ? 1 : 0, hidden: 0, unchanged: 0 },
            hasSettings: true,
            apply: async () => { applied = true; applies.push(on); },
          },
        });
      });
      calls.push({ opts, fileName: file.name, resolve, applied: () => applied });
      return p;
    },
  };
  return { app: app as unknown as FretSenseApp, calls, applies };
}
async function chooseNamed(container: HTMLElement, name: string) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['{}'], name, { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}
const settingsBox = () => screen.getByRole('checkbox', { name: /Apply settings from this file/ }) as HTMLInputElement;
const importButton = () => screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement;
async function resolveCall(d: Deferred) { await act(async () => { d.resolve(); await Promise.resolve(); }); }

describe('FR-043 "Apply settings from this file": out-of-order re-previews never apply settings the checkbox no longer shows', () => {
  beforeEach(() => cleanup()); // earlier blocks leave their renders mounted
  afterEach(() => cleanup());
  it('toggle on then off; "off" resolves first, then "on"; Import applies the applySettings=false preview', async () => {
    const { app, calls, applies } = stubApp();
    const { container } = renderWith(app);
    await chooseNamed(container, 'a.json');
    expect(calls).toHaveLength(1);
    expect(!!calls[0]!.opts?.applySettings).toBe(false);
    await resolveCall(calls[0]!);
    expect(settingsBox().checked).toBe(false);

    await act(async () => { fireEvent.click(settingsBox()); }); // on  -> calls[1], pending
    await act(async () => { fireEvent.click(settingsBox()); }); // off -> calls[2], pending
    expect(settingsBox().checked).toBe(false);
    const onCall = calls.find((c, i) => i > 0 && c.opts?.applySettings === true);
    const offCall = [...calls].reverse().find((c, i) => i < calls.length - 1 && !c.opts?.applySettings);
    expect(onCall).toBeDefined();
    expect(offCall).toBeDefined();

    await resolveCall(offCall!); // the newer request lands first
    await resolveCall(onCall!);  // the stale "on" preview lands last
    expect(settingsBox().checked).toBe(false);

    await waitFor(() => expect(importButton().disabled).toBe(false));
    await act(async () => { fireEvent.click(importButton()); });
    expect(applies).toEqual([false]);
    expect(onCall!.applied()).toBe(false);
  });

  it('while a re-preview is pending, Import is disabled or applies only a preview matching the checkbox', async () => {
    const { app, calls, applies } = stubApp();
    const { container } = renderWith(app);
    await chooseNamed(container, 'a.json');
    await resolveCall(calls[0]!);
    await act(async () => { fireEvent.click(settingsBox()); }); // on, pending
    const shown = settingsBox().checked;
    expect(shown).toBe(true);
    if (!importButton().disabled) {
      await act(async () => { fireEvent.click(importButton()); });
      for (const a of applies) expect(a).toBe(shown);
    }
    // the "on" preview arrives; now Import applies it
    await resolveCall(calls[calls.length - 1]!);
    if (applies.length === 0) {
      await waitFor(() => expect(importButton().disabled).toBe(false));
      await act(async () => { fireEvent.click(importButton()); });
      expect(applies).toEqual([true]);
    }
  });

  it('the checkbox starts unchecked for each newly chosen file, and the new file is previewed with applySettings off', async () => {
    const { app, calls } = stubApp();
    const { container } = renderWith(app);
    await chooseNamed(container, 'a.json');
    await resolveCall(calls[0]!);
    await act(async () => { fireEvent.click(settingsBox()); });
    await resolveCall(calls[calls.length - 1]!);
    expect(settingsBox().checked).toBe(true);

    await chooseNamed(container, 'b.json');
    const bCalls = calls.filter((c) => c.fileName === 'b.json');
    expect(bCalls).toHaveLength(1);
    expect(!!bCalls[0]!.opts?.applySettings).toBe(false);
    await resolveCall(bCalls[0]!);
    expect(settingsBox().checked).toBe(false);
  });
});
