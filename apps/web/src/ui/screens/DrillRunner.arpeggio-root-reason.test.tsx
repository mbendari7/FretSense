/**
 * code-reviewer T091–T093 r3 MINOR #3 (red, test-first) [FR-057]: "A wrong-tone Step-1 arpeggio tap
 * gets "Not the lowest A…" instead of a root reason." Coordinator ruling (2026-11-22): a Step-1 tap
 * of the WRONG pitch class gets "Not the root of Am7"; "Not the lowest A in frets 5 to 9" stays for
 * the right pitch class in the wrong octave (FR-057: "(Step 1, right pitch class, wrong octave)").
 * The reason wording follows FR-057's own pattern for later steps ("Not the ♭3 of Am7").
 *
 * Fixture (brute-forced in DrillRunner.arpeggio-t100b.test.tsx from E1 A1 D2 G2 = 28 33 38 43):
 * 4-string EADG, all strings, frets 5–9, Am7 from A1 4/5. B1 4/7 (35) is no chord tone; C2 4/8 (36) is
 * the ♭3, a chord tone out of order at Step 1. Date.now is tried 1, 2, ... until question 1 is for A.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { presetById, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const B4 = presetById('bass4-standard')!.profile;
const at = (s: number, f: number) => noteMidi(B4.tuning[B4.stringCount - s]!) + f;
const prompt = (c: HTMLElement) => norm(c.querySelector('#prompt')?.textContent);
const shown = (c: HTMLElement, s: number, f: number) => `${norm(positionEl(c, s, f)?.getAttribute('aria-label'))} | ${norm(c.textContent)}`;
const steps = (c: HTMLElement) => [...(c.querySelector('ol.steps')?.querySelectorAll('li') ?? [])].map((li) => norm(li.getAttribute('aria-label')));

type S = Partial<DrillSettings> & Pick<DrillSettings, 'strings'>;
const AM7: S = { type: 'arpeggio', strings: [1, 2, 3, 4], fromFret: 5, toFret: 9, qualities: ['min7'] };
async function startAm7() {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= 300; t++) {
    now.mockReturnValue(t);
    const r = await renderDrill('bass4-standard', AM7);
    if (/lowest A(?![#b])/.test(prompt(r.container))) return r;
    cleanup();
  }
  throw new Error('no Am7 question in 300 seeds');
}
const tap = async (c: HTMLElement, s: number, f: number) => { await act(async () => { fireEvent.click(positionEl(c, s, f)!); }); };

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FR-057 Step-1 reason for a wrong pitch class', () => {
  it('precondition: 4/7 is B1 (35), 4/8 is C2 (36)', () => {
    expect([at(4, 7), at(4, 8)]).toEqual([35, 36]);
  });

  it('B1 4/7 (not a chord tone) at Step 1: "Not the root of Am7", never "Not the lowest A"; Step 1 missed', async () => {
    const { container } = await startAm7();
    await tap(container, 4, 7);
    expect(shown(container, 4, 7)).toContain('Not the root of Am7');
    expect(shown(container, 4, 7)).not.toContain('Not the lowest A');
    expect(steps(container)[0]).toBe('Step 1, root, missed');
  });

  it('C2 4/8 (the b3, out of order) at Step 1: "Not the root of Am7"', async () => {
    const { container } = await startAm7();
    await tap(container, 4, 8);
    expect(shown(container, 4, 8)).toContain('Not the root of Am7');
    expect(shown(container, 4, 8)).not.toContain('Not the lowest A');
  });

  it('control: A2 2/7 (right pitch class, wrong octave) keeps "Not the lowest A in frets 5 to 9"', async () => {
    const { container } = await startAm7();
    await tap(container, 2, 7);
    expect(shown(container, 2, 7)).toContain('Not the lowest A in frets 5 to 9');
  });
});
