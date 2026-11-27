/**
 * T109 (red, test-first) [FR-048]: My Gear editor errors are named in text next to their field,
 * linked with aria-invalid / aria-describedby, and announced. A bad tuning note ("H2") is attributed
 * to that string's input; the message names the note. Other inputs stay valid.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { GearScreen } from './GearScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (0x9000 + ++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function openCustom() {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  const user = userEvent.setup();
  render(<AppContext.Provider value={app}><MemoryRouter initialEntries={['/gear/instruments']}><GearScreen /></MemoryRouter></AppContext.Provider>);
  await user.click(screen.getAllByRole('button').find((b) => (b.textContent ?? '').startsWith('Custom instrument'))!);
  const form = screen.getByRole('heading', { name: 'Custom instrument' }).closest('form') as HTMLElement;
  return { user, app, form };
}
afterEach(cleanup);

describe.each([6, 2, 1])('[T109][FR-048] bad tuning note on string %i', (n) => {
  it('marks only that string aria-invalid and links a message that names the problem, announced', async () => {
    const { user, form } = await openCustom();
    const input = within(form).getByLabelText(`String ${n} open note`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'H2' } });
    await user.click(within(form).getByRole('button', { name: 'Add instrument' }));

    expect(input.getAttribute('aria-invalid')).toBe('true');
    const id = input.getAttribute('aria-describedby');
    expect(id, 'aria-describedby').toBeTruthy();
    const msg = document.getElementById(id!.split(/\s+/)[0]!)!;
    expect(msg, 'the described element exists').toBeTruthy();
    expect(msg.textContent).toContain('H2');
    expect(msg.textContent).toMatch(new RegExp(`String ${n}`));
    expect(msg.closest('[role="alert"]'), 'announced as an alert').toBeTruthy();
    expect(msg.closest('fieldset'), 'rendered next to the field, in its fieldset').toBe(input.closest('fieldset'));

    for (const other of within(form).getAllByRole('textbox')) {
      if (other !== input) expect(other.getAttribute('aria-invalid'), `${other.getAttribute('aria-label') ?? 'name'}`).not.toBe('true');
    }
    for (const num of within(form).getAllByRole('spinbutton')) expect(num.getAttribute('aria-invalid')).not.toBe('true');
  });
});
