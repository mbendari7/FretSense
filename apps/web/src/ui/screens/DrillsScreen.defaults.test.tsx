/**
 * T091a (red, test-first) [FR-031, FR-035, FR-036], from theory-checker T091 r1 findings #3 and #9.
 * Expected values are quoted from spec.md:
 *  - FR-035: intervals offered "m2 M2 m3 M3 P4 A4 d5 P5 m6 M6 m7 M7 P8"; defaults
 *    "intervals {M2, m3, M3, P4, P5, P8}, direction up, 20 questions", frets 0–12 (clamped).
 *  - FR-036: chord-tone defaults "the 7 natural roots, qualities {maj, min, 7}" (ids major, minor, dom7).
 *  - FR-031: note set default naturals; UI labels "Letters only (A–G)", "Letters and sharps",
 *    "Letters and flats" and "All spellings", with the technical term as secondary text.
 * Interval chip names use the spec's interval words (major 2nd, diminished 5th, octave, ...).
 * Render helpers copied from ProgressScreen.test.tsx; runs the real FretSenseApp over memoryRepository().
 * Parameterised over every shipped InstrumentProfile preset.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { presets } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { DrillScreen, defaultSettings } from './DrillsScreen';

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

const PRESETS = presets();
const IDS = PRESETS.map((p) => p.presetId);

const OFFERED = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const DEFAULT_INTERVALS = ['M2', 'm3', 'M3', 'P4', 'P5', 'P8'];
const WORDS: Record<string, string> = {
  m2: 'minor 2nd', M2: 'major 2nd', m3: 'minor 3rd', M3: 'major 3rd', P4: 'perfect 4th', A4: 'augmented 4th',
  d5: 'diminished 5th', P5: 'perfect 5th', m6: 'minor 6th', M6: 'major 6th', m7: 'minor 7th', M7: 'major 7th', P8: 'octave',
};
const NATURAL_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const sorted = (xs: readonly string[] | undefined) => [...(xs ?? [])].sort();

// ---------- pure defaults ----------
describe('FR-035 / FR-036 / FR-031 defaultSettings', () => {
  it.each(PRESETS.map((p) => [p.presetId, p.profile] as const))('%s: interval defaults {M2, m3, M3, P4, P5, P8}, up, 20, frets 0–12 clamped, all strings', (_id, p) => {
    const s = defaultSettings('interval', p, 'any');
    expect(sorted(s.intervals)).toEqual(sorted(DEFAULT_INTERVALS));
    expect(s.direction).toBe('up');
    expect(s.count).toBe(20);
    expect([s.fromFret, s.toFret]).toEqual([0, Math.min(12, p.fretCount)]);
    expect(s.strings).toEqual(Array.from({ length: p.stringCount }, (_, i) => i + 1));
  });

  it.each(PRESETS.map((p) => [p.presetId, p.profile] as const))('%s: chord-tone defaults are the 7 natural roots and {major, minor, dom7}', (_id, p) => {
    const s = defaultSettings('chord-tone', p, 'any');
    expect(sorted(s.roots)).toEqual(sorted(NATURAL_ROOTS));
    expect(sorted(s.qualities)).toEqual(['dom7', 'major', 'minor']);
  });

  it.each(PRESETS.map((p) => [p.presetId, p.profile] as const))('%s: note-finding default note set is naturals', (_id, p) => {
    const s = defaultSettings('note-finding', p, 'any') as ReturnType<typeof defaultSettings> & { noteSet?: string };
    expect(s.noteSet).toBe('naturals');
  });
});

// ---------- rendered setup screen ----------
describe('FR-035 interval drill setup screen', () => {
  it.each(IDS)('%s: offers all 13 intervals, including a d5 chip', async (id) => {
    renderDrill(await makeApp(id), 'interval');
    const group = await screen.findByRole('group', { name: 'Intervals' });
    for (const iv of OFFERED) expect(within(group).getByRole('checkbox', { name: WORDS[iv] }), `${iv} chip`).toBeTruthy();
    expect(within(group).getAllByRole('checkbox')).toHaveLength(13);
  });

  it.each(IDS)('%s: exactly M2, m3, M3, P4, P5 and P8 are checked by default', async (id) => {
    renderDrill(await makeApp(id), 'interval');
    const group = await screen.findByRole('group', { name: 'Intervals' });
    const checked = within(group).getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked).map((c) => c.closest('label')!.textContent!.trim());
    expect(checked.sort()).toEqual(DEFAULT_INTERVALS.map((i) => WORDS[i]!).sort());
  });
});

describe('FR-036 chord-tone drill setup screen', () => {
  it.each(IDS)('%s: the 7 natural roots C D E F G A B are checked by default, no others', async (id) => {
    renderDrill(await makeApp(id), 'chord-tone');
    const group = await screen.findByRole('group', { name: 'Chord roots' });
    const checked = within(group).getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked).map((c) => c.closest('label')!.textContent!.trim());
    expect(checked.sort()).toEqual([...NATURAL_ROOTS].sort());
  });
});

describe('FR-031 note-finding setup screen offers the four note sets', () => {
  it.each(IDS)('%s: four note-set choices, "Letters only (A–G)" selected by default', async (id) => {
    renderDrill(await makeApp(id), 'note-finding');
    const only = await screen.findByRole('radio', { name: /^Letters only \(A–G\)/ });
    expect(screen.getByRole('radio', { name: /^Letters and sharps/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Letters and flats/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^All spellings/ })).toBeTruthy();
    expect((only as HTMLInputElement).checked).toBe(true);
  });
});
