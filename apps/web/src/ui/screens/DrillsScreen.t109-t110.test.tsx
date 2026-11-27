/**
 * T109 + T110 (red, test-first), drill setup [FR-048, FR-047].
 * T109: a validation failure is named in text next to its field, linked (aria-invalid /
 * aria-describedby) and announced (role=alert). Attribution assumed from the validator's reasons
 * (apps/web/src/domain/drills/generate.ts validateSettings):
 *   'Choose at least one string.'            -> the Strings fieldset (aria-describedby; a group has no aria-invalid)
 *   'Choose between 5 and 100 questions.'    -> the Questions input
 *   'None of the chosen notes is on the chosen strings and frets. Widen the fret range ...'
 *                                            -> both fret inputs (From fret, to fret)
 * (from fret > to fret is NOT a validation failure: rangeOf() swaps them, so it is not tested as one.)
 * T110: each note-set option is its own label.radio-row with exactly one radio; CSS gives .radio-row
 * display:flex, align-items:center and min-height >= 44px (jsdom cannot lay out, so read from the CSS).
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { DrillScreen } from './DrillsScreen';
import { lastDecl, rulesFor, specificity, winningDecl } from '../__tests__/css-parse';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (0xa000 + ++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function setup(type = 'note-finding') {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  await app.addPreset('guitar6-standard');
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={[`/drills/${type}`]}><Routes><Route path="/drills/:type" element={<DrillScreen />} /></Routes></MemoryRouter>
    </AppContext.Provider>,
  );
}
afterEach(cleanup);

const setNumber = (label: string, v: number) => fireEvent.change(screen.getByLabelText(label) as HTMLInputElement, { target: { value: String(v) } });
const alertFor = (el: Element) => {
  const id = el.getAttribute('aria-describedby');
  expect(id, 'aria-describedby').toBeTruthy();
  const msg = document.getElementById(id!.split(/\s+/)[0]!)!;
  expect(msg, 'described element exists').toBeTruthy();
  expect(msg.getAttribute('role') === 'alert' || !!msg.closest('[role="alert"]'), 'announced as an alert').toBe(true);
  return msg;
};

describe('[T109][FR-048] drill setup validation is linked to its field', () => {
  it('valid settings: nothing is aria-invalid and there is no alert', async () => {
    const { container } = await setup();
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('question count out of range: the Questions input is invalid and described by the message', async () => {
    const { container } = await setup();
    setNumber('Questions', 3);
    const q = screen.getByLabelText('Questions');
    expect(q.getAttribute('aria-invalid')).toBe('true');
    expect(alertFor(q).textContent).toBe('Choose between 5 and 100 questions.');
    for (const other of container.querySelectorAll('input')) if (other !== q) expect(other.getAttribute('aria-invalid')).not.toBe('true');
    setNumber('Questions', 20);
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('no string selected: the Strings fieldset is described by the announced message', async () => {
    await setup();
    const strings = screen.getByRole('group', { name: 'Strings' });
    for (const box of within(strings).getAllByRole('checkbox')) fireEvent.click(box);
    expect(alertFor(strings).textContent).toBe('Choose at least one string.');
  });

  it('no note on the chosen frets: both fret inputs are invalid and described by the message', async () => {
    const { container } = await setup();
    // guitar6-standard string 5 is A; fret 1 is A#/Bb, which the default "Letters only" set excludes.
    const strings = screen.getByRole('group', { name: 'Strings' });
    const boxes = within(strings).getAllByRole('checkbox');
    boxes.forEach((b, i) => { if (i !== 4) fireEvent.click(b); });
    setNumber('From fret', 1);
    setNumber('to fret', 1);
    const from = screen.getByLabelText('From fret');
    const to = screen.getByLabelText('to fret');
    expect(from.getAttribute('aria-invalid')).toBe('true');
    expect(to.getAttribute('aria-invalid')).toBe('true');
    const msg = alertFor(from);
    expect(msg.textContent).toMatch(/fret range/);
    expect(alertFor(to)).toBe(msg);
    expect(screen.getByLabelText('Questions').getAttribute('aria-invalid')).not.toBe('true');
    void container;
  });
});

describe('[T110][FR-047] note-set radios are one 44 px row per option', () => {
  it('each note-set option is its own label.radio-row with exactly one radio', async () => {
    await setup();
    const notes = screen.getByRole('group', { name: 'Notes' });
    const rows = [...notes.querySelectorAll('label.radio-row')];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    expect(notes.querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });

  it('.radio-row is display:flex, align-items:center and at least 44px tall', () => {
    expect(lastDecl('.radio-row', 'display')).toBe('flex');
    expect(lastDecl('.radio-row', 'align-items')).toBe('center');
    const min = lastDecl('.radio-row', 'min-height');
    expect(min, '.radio-row min-height').toBeDefined();
    expect(parseFloat(min!)).toBeGreaterThanOrEqual(44);
    expect(min).toMatch(/px$/);
  });
});

describe('[T110][FR-047] .radio-row is not overridden by .form label', () => {
  it('a ".form .radio-row" rule declares flex-direction row, display flex and align-items center', () => {
    expect(lastDecl('.form .radio-row', 'flex-direction'), 'rule ".form .radio-row { flex-direction }" missing').toBe('row');
    expect(lastDecl('.form .radio-row', 'display')).toBe('flex');
    expect(lastDecl('.form .radio-row', 'align-items')).toBe('center');
  });

  it('specificity sanity: .form label (0,1,1) beats .radio-row (0,1,0); .form .radio-row (0,2,0) beats both', () => {
    expect(specificity('.form label')).toBeGreaterThan(specificity('.radio-row'));
    expect(specificity('.form .radio-row')).toBeGreaterThan(specificity('.form label'));
  });

  it('the winning flex-direction for label.radio-row inside .form is row (by specificity, then order)', () => {
    expect(rulesFor('.form label', 'flex-direction').length).toBeGreaterThan(0);
    expect(winningDecl(['.form label', '.radio-row', '.form .radio-row'], 'flex-direction')).toBe('row');
    expect(winningDecl(['.form label', '.radio-row', '.form .radio-row'], 'align-items')).toBe('center');
  });
});
