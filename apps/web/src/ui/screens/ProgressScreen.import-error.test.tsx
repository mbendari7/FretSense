/**
 * security-reviewer T093 r2 N3 (red, test-first), UI side [FR-043]
 * (specs/001-theory-fretboard-lessons/reviews/2026-11-22-security-reviewer-T093-r2.md): "parseExport
 * throws, and loadPreview has no try/catch, so the UI is stuck in pending."
 *
 * Expected: choosing a file whose v0.1 attempt has payloadHash {"toString":1,"valueOf":1} shows an
 * error message (role="status"), opens no preview dialog, and leaves the import usable: the next
 * valid file opens its preview with Import enabled (not stuck pending). The same holds if
 * previewImport itself rejects (defence in depth in loadPreview).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const renderWith = (app: FretSenseApp) => render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
async function chooseFile(container: HTMLElement, exp: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(exp)], 'backup.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}
const statusText = () => screen.queryAllByRole('status').map((s) => s.textContent ?? '').join(' ').trim();

function badFile(app: FretSenseApp) {
  const exp = app.exportProfile(false);
  const pid = exp.localProfile.id;
  const h = exp.exportedAt;
  const v01 = {
    id: '22222222-0000-4000-8000-000000000001', localProfileId: pid, created: h, updated: h, schemaVersion: 1, deleted: false,
    drillType: 'bass-arpeggio', instrumentId: null, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap',
    prompt: { drillType: 'bass-arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' },
    answer: [{ string: 3, fret: 5 }], outcome: 'correct', responseMs: 1500, timestamp: '2026-11-22T11:00:00.000Z',
    lessonId: null, drillId: null, itemKey: 'bs|bass-arpeggio|minor', payloadHash: { toString: 1, valueOf: 1 },
  };
  return { ...exp, attempts: [v01] };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('security r2 N3: the import preview never sticks in pending', () => {
  it('an object payloadHash: an error message is shown and no preview dialog opens', async () => {
    const app = await makeApp('c3000001');
    const { container } = renderWith(app);
    await chooseFile(container, badFile(app));
    await waitFor(() => expect(statusText().length, 'an error message is shown').toBeGreaterThan(0));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('after that error, a valid file opens its preview with Import enabled', async () => {
    const src = await makeApp('c3000002');
    await src.addPreset('guitar6-standard');
    const app = await makeApp('c3000003');
    const { container } = renderWith(app);
    await chooseFile(container, badFile(app));
    await waitFor(() => expect(statusText().length).toBeGreaterThan(0));
    await chooseFile(container, src.exportProfile(false));
    await screen.findByRole('heading', { name: 'Copy from file' });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('defence in depth: if previewImport rejects, an error is shown and the next file still previews', async () => {
    const src = await makeApp('c3000004');
    await src.addPreset('guitar6-standard');
    const app = await makeApp('c3000005');
    const real = app.previewImport.bind(app);
    vi.spyOn(app, 'previewImport').mockImplementationOnce(async () => { throw new TypeError('Cannot convert object to primitive value'); }).mockImplementation(real);
    const { container } = renderWith(app);
    await chooseFile(container, src.exportProfile(false));
    await waitFor(() => expect(statusText().length, 'an error message is shown').toBeGreaterThan(0));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await chooseFile(container, src.exportProfile(false));
    await screen.findByRole('heading', { name: 'Copy from file' });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(false));
  });
});
