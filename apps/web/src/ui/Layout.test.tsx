/**
 * T094 (red, test-first) [FR-049]: route-change focus in the app shell.
 * spec.md FR-049: "On every route change, focus moves to the new view's main heading." ...
 * "Drill start overrides the route-change focus rule." On drill start, focus moves into the
 * fretboard at the starting position (note-finding: the first fret of the range on the prompted
 * string). A route that opens straight into a running drill (e.g. a lesson's Drill stage) is both a
 * route change and a drill start, so focus must end on the fretboard, not the heading.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import type { FretSenseApp } from '../application/app';
import { AppContext } from './hooks';
import { Layout } from './Layout';
import { DrillRunner } from './screens/DrillRunner';
import { drillSettings, makeApp } from './__tests__/drill-harness';
import { installLayoutMock } from './__tests__/layout-mock';

function Running({ app }: { app: FretSenseApp }) {
  const inst = app.activeInstrument()!;
  return (
    <div className="page">
      <h1>Note finding</h1>
      <DrillRunner profile={inst.profile} instrumentId={inst.id} settings={drillSettings({ strings: [6], notes: [4] })} onExit={() => undefined} />
    </div>
  );
}

function shell(app: FretSenseApp) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/a" element={<div><h1>Page A</h1><Link to="/b">to B</Link> <Link to="/drill">to drill</Link></div>} />
            <Route path="/b" element={<div><h1>Page B</h1><button>Something</button></div>} />
            <Route path="/drill" element={<Running app={app} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe('FR-049 route change moves focus to the new view\'s main heading', () => {
  it('navigating /a → /b focuses the "Page B" heading', async () => {
    const app = await makeApp('guitar6-standard');
    shell(app);
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'to B' })); });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Page B' })));
  });
});

describe('FR-049 drill start overrides the route-change focus rule', () => {
  it('a route that opens a running drill leaves focus on the fretboard start position, not the heading', async () => {
    const app = await makeApp('guitar6-standard');
    shell(app);
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'to drill' })); });
    await screen.findByRole('heading', { level: 1, name: 'Note finding' });
    // Let every mount effect (child and Layout) run before judging.
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const name = document.activeElement?.getAttribute('aria-label') ?? '';
    expect(name === 'String 6, open' || name.startsWith('String 6, open,'), `focused: <${document.activeElement?.tagName}> "${name || document.activeElement?.textContent}"`).toBe(true);
  });
});
