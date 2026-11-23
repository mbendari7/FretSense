/**
 * T100 / CR-B2-11 (red, test-first) [FR-048, FR-049].
 *
 * spec.md FR-048 (provisional, product-owner 2026-11-22): "Every route has exactly one h1, its main
 * heading (FR-049); onboarding pickers use h2."
 *
 * The route table mirrors ui/App.tsx (contracts/ui-routes.md); App's router is a browser router and
 * isn't exported, so the same screens are mounted here under a MemoryRouter inside the real Layout.
 * Every route is checked twice: on a fresh profile (no instrument, so gated screens show the
 * instrument picker) and with an instrument. A running drill (after "Start drill") is a view of its
 * route too, so it must also have exactly one h1.
 */
import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FretSenseApp } from '../application/app';
import type { Hasher, IdGenerator } from '../application/ports';
import { memoryRepository } from '../infrastructure/idb';
import { AppContext } from './hooks';
import { Layout } from './Layout';
import { HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { KeysScreen } from './screens/KeysScreen';
import { LibraryScreen, LessonScreen } from './screens/LessonScreens';
import { DrillsHome, DrillScreen } from './screens/DrillsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GearScreen } from './screens/GearScreen';
import { NotFound } from './screens/NotFound';
import { installLayoutMock } from './__tests__/layout-mock';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(withInstrument: boolean) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  if (withInstrument) await app.addPreset('guitar6-standard');
  return app;
}
function renderAt(app: FretSenseApp, path: string) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/explore" element={<ExploreScreen />} />
            <Route path="/keys" element={<KeysScreen />} />
            <Route path="/library" element={<LibraryScreen />} />
            <Route path="/lessons/:lessonId" element={<LessonScreen />} />
            <Route path="/lessons/:lessonId/drill/:drillId" element={<LessonScreen />} />
            <Route path="/lessons/:lessonId/:stage" element={<LessonScreen />} />
            <Route path="/drills" element={<DrillsHome />} />
            <Route path="/drills/:type" element={<DrillScreen />} />
            <Route path="/progress" element={<ProgressScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/gear/instruments" element={<GearScreen />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}
const h1s = () => [...document.querySelectorAll('h1')];
const describeH1s = () => h1s().map((h) => `"${(h.textContent ?? '').trim()}"`).join(', ') || 'none';

const PATHS = ['/', '/explore', '/keys', '/library', '/drills', '/drills/note-finding', '/drills/interval', '/progress', '/settings', '/gear/instruments', '/no-such-page', '/lessons/no-such-lesson'];

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(cleanup);

describe.each([[false], [true]])('FR-048 (CR-B2-11) exactly one h1 per route, instrument added: %s', (withInstrument) => {
  it.each(PATHS)('%s', async (path) => {
    const app = await makeApp(withInstrument);
    renderAt(app, path);
    await act(async () => { await Promise.resolve(); });
    expect(h1s().length, `${path}: h1s ${describeH1s()}`).toBe(1);
  });
});

describe('FR-048 (CR-B2-11) onboarding pickers use h2', () => {
  it.each(['/', '/explore', '/keys', '/drills/note-finding'])('%s on a fresh profile: "What do you play?" is an h2', async (path) => {
    const app = await makeApp(false);
    renderAt(app, path);
    const h = await screen.findByRole('heading', { name: 'What do you play?' });
    expect(h.tagName).toBe('H2');
  });
});

describe('FR-048 (CR-B2-11) a running drill keeps exactly one h1', () => {
  it.each(['/drills/note-finding', '/drills/interval', '/drills/chord-tone', '/drills/arpeggio'])('%s after "Start drill"', async (path) => {
    const app = await makeApp(true);
    renderAt(app, path);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start drill' })); });
    await waitFor(() => expect(document.querySelector('[aria-label^="String "]')).toBeTruthy());
    expect(h1s().length, `${path} running: h1s ${describeH1s()}`).toBe(1);
  });
});
