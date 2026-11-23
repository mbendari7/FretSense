/**
 * T100 / CR-B2-5, CR-B2-8 (red, test-first) [FR-031, FR-030, FR-016].
 *
 * spec.md FR-031 (provisional, product-owner 2026-11-22): "Each string chip uses FR-030's string
 * naming (e.g. "6, low E", "1, high E"; 5-string bass "5, low B"). Drill setup names the active
 * instrument above the string chips, with a "Change" control that opens the instrument switcher
 * (FR-016)." FR-030: strings are named by number and open note "spelled as the instrument's
 * open-string notes (FR-051) ..., adding "low" or "high" for the lowest- and highest-pitched strings".
 *
 * Expected chip names are brute-forced from each preset's tuning: the lowest- and highest-pitched
 * strings by MIDI, the open note as letter + accidental (ASCII after normalising ♭/♯).
 * "Opens the instrument switcher" is checked as: after activating Change, focus is on the switcher
 * (a select / combobox / listbox) or inside a dialog holding it (test-writer reading).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
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
function renderSetup(app: FretSenseApp, type = 'note-finding') {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={[`/drills/${type}`]}>
        <Routes><Route path="/drills/:type" element={<DrillScreen />} /></Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}
afterEach(cleanup);

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const norm = (s: string | null | undefined) => (s ?? '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, ' ').trim();
const openOf = (p: InstrumentProfile, s: number) => p.tuning[p.stringCount - s]!;
const openName = (n: Note) => n.letter + (n.accidental === -1 ? 'b' : n.accidental === 1 ? '#' : '');

function expectedChips(p: InstrumentProfile): string[] {
  const strings = Array.from({ length: p.stringCount }, (_, i) => i + 1);
  const midis = strings.map((s) => noteMidi(openOf(p, s)));
  const lo = strings[midis.indexOf(Math.min(...midis))]!;
  const hi = strings[midis.indexOf(Math.max(...midis))]!;
  return strings.map((s) => `${s}, ${s === lo ? 'low ' : s === hi ? 'high ' : ''}${openName(openOf(p, s))}`);
}

describe('FR-031 brute-force expectations', () => {
  it('6-string Standard: "1, high E" … "6, low E"; 5-string bass: "5, low B"; Drop D string 4 is "4, D"', () => {
    const p = (id: string) => presets().find((x) => x.presetId === id)!.profile;
    expect(expectedChips(p('guitar6-standard'))).toEqual(['1, high E', '2, B', '3, G', '4, D', '5, A', '6, low E']);
    expect(expectedChips(p('bass5-beadg'))[4]).toBe('5, low B');
    expect(expectedChips(p('guitar6-drop-d'))[3]).toBe('4, D');
  });
});

describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-031 drill setup, %s', (id, profile) => {
  it('each string chip is named "<n>, low|high <open>" by FR-030', async () => {
    const app = await makeApp(id);
    renderSetup(app);
    const group = screen.getByRole('group', { name: 'Strings' });
    const names = within(group).getAllByRole('checkbox').map((c) => {
      const label = c.closest('label');
      return norm(label ? label.textContent : c.getAttribute('aria-label'));
    });
    expect(names).toEqual(expectedChips(profile));
  });

  it('names the active instrument above the string chips, with a "Change" control that opens the instrument switcher', async () => {
    const app = await makeApp(id);
    const { container } = renderSetup(app);
    const instName = norm(app.activeInstrument()!.name);
    const group = screen.getByRole('group', { name: 'Strings' });
    const before = (el: Node) => !!(el.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING);
    const naming = [...container.querySelectorAll<HTMLElement>('p, span, strong, h2, h3, div, dd, output')]
      .filter((el) => !el.closest('select, option') && el.children.length === 0 && norm(el.textContent).includes(instName));
    expect(naming.filter(before), `no text naming "${instName}" above the Strings chips`).not.toHaveLength(0);
    const change = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')].find((b) => /^Change\b/.test(norm(b.textContent)));
    expect(change, 'no "Change" control').toBeTruthy();
    expect(before(change!), '"Change" is above the string chips').toBe(true);
    await act(async () => { fireEvent.click(change!); });
    const a = document.activeElement as HTMLElement | null;
    expect(a?.matches('select, [role="combobox"], [role="listbox"]') || !!a?.closest('[role="dialog"]'), `focus after Change: ${a?.outerHTML.slice(0, 80)}`).toBe(true);
  });
});
