/**
 * T099a (red, test-first) [FR-036]: the chord-tone setup shows a "Window width" number input,
 * default 4 (FR-036), min 1, max = the fret-range size (toFret - fromFret + 1, by the clamp rule).
 * Render helpers follow DrillsScreen.defaults.test.tsx. Parameterised over every shipped preset.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { presets } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { DrillScreen } from './DrillsScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(presetId: string) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  await app.addPreset(presetId);
  return app;
}
function renderDrill(app: FretSenseApp, type: string) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={[`/drills/${type}`]}>
        <Routes><Route path="/drills/:type" element={<DrillScreen />} /></Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}
afterEach(cleanup);

describe('FR-036 chord-tone setup: Window width input', () => {
  it.each(presets().map((p) => [p.presetId, p.profile] as const))('%s: number input, default 4, min 1, max = fret-range size', async (id, profile) => {
    renderDrill(await makeApp(id), 'chord-tone');
    const input = (await screen.findByLabelText(/^Window width/)) as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('4');
    expect(input.min).toBe('1');
    // Default range is frets 0 to min(12, fretCount): size = that + 1.
    expect(input.max).toBe(String(Math.min(12, profile.fretCount) + 1));
  });

  it('after the fret range is changed to 3-5, the Window width input shows no more than 3', async () => {
    renderDrill(await makeApp('guitar6-standard'), 'chord-tone');
    const input = (await screen.findByLabelText(/^Window width/)) as HTMLInputElement;
    act(() => { fireEvent.change(screen.getByLabelText(/^From fret/), { target: { value: '3' } }); });
    act(() => { fireEvent.change(screen.getByLabelText(/^to fret/), { target: { value: '5' } }); });
    expect(Number(input.value)).toBeLessThanOrEqual(3);
    expect(Number(input.max)).toBeLessThanOrEqual(3);
  });

  it('other drill types do not show the chord-tone Window width input', async () => {
    renderDrill(await makeApp('guitar6-standard'), 'interval');
    await screen.findByRole('group', { name: 'Intervals' });
    expect(screen.queryByLabelText(/^Window width/)).toBeNull();
  });
});
