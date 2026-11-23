/**
 * T100 / CR-B2-9 interim (red, test-first) [FR-022].
 *
 * spec.md FR-022 (provisional, product-owner 2026-11-22): "While no lesson is available, the Lessons
 * tab stays visible and opens the library, which says "The first lessons are being written" and links
 * to Drills, the explorer and the key helper. No placeholder lesson or "coming soon" control is shown."
 *
 * The compiled content module is mocked to hold no lessons, so the test does not depend on what
 * content/lessons/ holds today. The Lessons tab is checked in the real Layout.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { Layout } from '../Layout';
import { LibraryScreen } from './LessonScreens';

vi.mock('virtual:fretsense-content', () => ({ default: { lessons: [], packs: [] } }));

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const ids = (): IdGenerator => { let n = 0; return { uuid: () => `abcdef01-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` }; };
const norm = (s: string | null | undefined) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
afterEach(cleanup);

async function renderLibrary() {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={['/library']}>
        <Routes><Route element={<Layout />}><Route path="/library" element={<LibraryScreen />} /></Route></Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

describe('FR-022 (CR-B2-9) the library with no lessons', () => {
  it('says "The first lessons are being written"', async () => {
    const { container } = await renderLibrary();
    const main = container.querySelector('main')!;
    expect(norm(main.textContent)).toContain('The first lessons are being written');
  });

  it('links to Drills, the explorer and the key helper, and shows no placeholder lesson or "coming soon"', async () => {
    const { container } = await renderLibrary();
    const main = container.querySelector('main') as HTMLElement;
    const hrefs = within(main).queryAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => /^\/drills(\/|$)/.test(h)), `links: ${hrefs.join(', ')}`).toBe(true);
    expect(hrefs).toContain('/explore');
    expect(hrefs).toContain('/keys');
    expect(hrefs.filter((h) => h.startsWith('/lessons/'))).toEqual([]);
    expect(norm(main.textContent)).not.toMatch(/coming soon/i);
  });

  it('the Lessons tab stays visible in the main navigation and points to the library', async () => {
    await renderLibrary();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Lessons' }).getAttribute('href')).toBe('/library');
  });
});
