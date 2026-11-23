/**
 * T100b (red) [FR-056, FR-057, FR-032]: the final feedback line of a multi-step bass drill.
 *
 * spec.md FR-057 (product-owner 2026-11-22, provisional; Clarifications "test-writer T100b gaps"):
 * "When the last step is judged, the feedback starts "Correct, <chord> arpeggio" (FR-056: "Correct,
 * <chord> root–fifth–octave shape") when no step was missed, otherwise it uses the incorrect style and
 * reads "Incorrect. N of M steps correct. Missed: …"". US6 scenario 5: "the feedback is "Correct, C
 * root–fifth–octave shape""; US6 scenario 7: "the feedback reads "Incorrect. 2 of 3 steps correct.
 * Missed: octave C3 at string 1 fret 5."". (Replaces this file's earlier "Done: N of M" proposal.)
 *
 * The spec's two examples differ on a final full stop (FR-057's "Missed: ♭3 F♯4 at string 2 fret 7"
 * has none; US6-7 has one), so a single trailing "." is allowed. "<chord>" for the arpeggio is not
 * pinned to symbol or words; both "D#m" and "D# minor" are accepted (reported as a MINOR gap).
 *
 * Fixtures (brute-forced in DrillRunner.rfo-steps.test.tsx and DrillRunner.steps.test.tsx):
 *  - 4-string EADG, strings 1–3, frets 3–5: the only C root–fifth–octave shape is C2 string 3 fret 3,
 *    G2 string 2 fret 5, C3 string 1 fret 5; C#2 is string 3 fret 4 (neither C nor G).
 *  - 6-string Standard, strings 2–4, frets 11–13, minor: D#4 string 4 fret 13, F#4 string 3 fret 11,
 *    A#4 string 2 fret 11; G4 is string 3 fret 12.
 * Date.now is fixed because DrillRunner seeds its generator from it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const tap = async (c: HTMLElement, s: number, f: number) => { await act(async () => { fireEvent.click(positionEl(c, s, f)!); }); };
/** The feedback text without its leading icon. */
const line = (c: HTMLElement) => ascii(c.querySelector('.feedback')?.textContent).replace(/^[✓✕✗×]\s*/u, '');
const isBad = (c: HTMLElement) => !!c.querySelector('.feedback.bad');
const isOk = (c: HTMLElement) => !!c.querySelector('.feedback.ok');

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FR-056 / FR-057 final feedback: "Correct, …" when nothing was missed, else "Incorrect. N of M steps correct. Missed: …"', () => {
  const rfo = () => renderDrill('bass4-standard', { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 3, toFret: 5, qualities: ['major'] });
  const arp = () => renderDrill('guitar6-standard', { type: 'arpeggio', strings: [2, 3, 4], fromFret: 11, toFret: 13, qualities: ['minor'] });

  it('root–fifth–octave, nothing missed (C2, G2, C3): "Correct, C root–fifth–octave shape" in the correct style', async () => {
    const { container } = await rfo();
    await tap(container, 3, 3);
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    expect(isOk(container)).toBe(true);
    expect(line(container)).toMatch(/^Correct, C root–fifth–octave shape\.?$/);
  });

  it('root–fifth–octave, last tap wrong (G2, C2, then C#2): "Incorrect. 2 of 3 steps correct. Missed: octave C3 at string 1 fret 5"', async () => {
    const { container } = await rfo();
    await tap(container, 2, 5);
    await tap(container, 3, 3);
    await tap(container, 3, 4);
    expect(isBad(container)).toBe(true);
    expect(line(container)).toMatch(/^Incorrect\. 2 of 3 steps correct\. Missed: octave C3 at string 1 fret 5\.?$/);
  });

  it('root–fifth–octave, last tap correct after an earlier miss (C#2, G2, C3): incorrect style; "Incorrect. 2 of 3 steps correct. Missed: root C2 at string 3 fret 3"', async () => {
    const { container } = await rfo();
    await tap(container, 3, 4); // C#2: neither C nor G → Step 1 missed, C2 3/3 revealed
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    expect(isBad(container)).toBe(true);
    expect(line(container)).not.toMatch(/^Correct/);
    expect(line(container)).toMatch(/^Incorrect\. 2 of 3 steps correct\. Missed: root C2 at string 3 fret 3\.?$/);
  });

  it('root–fifth–octave, all three missed (three C#/D taps): "Incorrect. 0 of 3 steps correct. Missed: …" lists all three', async () => {
    const { container } = await rfo();
    await tap(container, 3, 4); // C#2 (37)
    await tap(container, 3, 5); // D2 (38)
    await tap(container, 2, 3); // F2 (41)
    expect(isBad(container)).toBe(true);
    const m = /^Incorrect\. 0 of 3 steps correct\. Missed: (.*?)\.?$/.exec(line(container));
    expect(m, line(container)).not.toBeNull();
    expect(m![1]!.split(/;\s*/).sort()).toEqual(['5th G2 at string 2 fret 5', 'octave C3 at string 1 fret 5', 'root C2 at string 3 fret 3']);
  });

  it('arpeggio, nothing missed (D#4, F#4, A#4): "Correct, <D#m | D# minor> arpeggio" in the correct style', async () => {
    const { container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 11);
    await tap(container, 2, 11);
    expect(isOk(container)).toBe(true);
    expect(line(container)).toMatch(/^Correct, (D#|Eb)(m| minor) arpeggio\.?$/);
  });

  it('arpeggio, last tap correct after a missed ♭3 (D#4, G4, A#4): "Incorrect. 2 of 3 steps correct. Missed: b3 <F#|Gb>4 at string 3 fret 11"', async () => {
    const { container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await tap(container, 2, 11);
    expect(isBad(container)).toBe(true);
    expect(line(container)).not.toMatch(/^Correct/);
    expect(line(container)).toMatch(/^Incorrect\. 2 of 3 steps correct\. Missed: b3 (F#|Gb)4 at string 3 fret 11\.?$/);
  });
});
