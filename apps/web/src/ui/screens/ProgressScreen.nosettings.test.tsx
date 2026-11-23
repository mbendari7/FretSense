/**
 * code-reviewer T091-T093 r1 #7 residual / r2 #13 [FR-043]: "Apply settings from this file" is
 * offered only when the file carries settings. A file exported without settings
 * (exportProfile(false), the export dialog's "Include my settings" off) has no such checkbox.
 * Rig copied from ProgressScreen.test.tsx (real FretSenseApp over memoryRepository()).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  await app.addPreset('guitar6-standard');
  return app;
}
async function openPreview(app: FretSenseApp, exp: unknown) {
  const { container } = render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(exp)], 'backup.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  return await screen.findByRole('dialog');
}
afterEach(() => cleanup());

describe('FR-043 "Apply settings from this file" only when the file has settings', () => {
  it('restore: a file exported without settings has no "Apply settings from this file" checkbox', async () => {
    const app = await makeApp('f1f1f1f1');
    const exp = app.exportProfile(false);
    expect('profileSettings' in exp).toBe(false); // precondition
    const dialog = await openPreview(app, exp);
    expect(dialog.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.queryByRole('checkbox', { name: /Apply settings from this file/ })).toBeNull();
    expect(dialog.textContent ?? '').not.toContain('Apply settings from this file');
  });

  it('copy: a file from another profile exported without settings has no such checkbox either', async () => {
    const src = await makeApp('f2f2f2f2');
    const dst = await makeApp('f3f3f3f3');
    const dialog = await openPreview(dst, src.exportProfile(false));
    expect(screen.queryByRole('checkbox', { name: /Apply settings from this file/ })).toBeNull();
    expect(dialog.textContent ?? '').not.toContain('Apply settings from this file');
  });

  it('control: a file exported with settings shows it, unchecked by default', async () => {
    const app = await makeApp('f4f4f4f4');
    await openPreview(app, app.exportProfile(true));
    const box = screen.getByRole('checkbox', { name: /Apply settings from this file/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });
});
