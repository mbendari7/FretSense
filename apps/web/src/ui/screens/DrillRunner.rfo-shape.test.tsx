/**
 * T100b (red, test-first) [FR-056, FR-056a, FR-057]: root–fifth–octave valid-shape judging and
 * wrong-tap charging, as the user sees it in the drill.
 *
 * spec.md FR-056 (product-owner 2026-11-22, provisional): "A **valid shape** is a root position R on
 * a selected string within the fret range, plus a position sounding exactly R + 7 semitones (the 5th)
 * and one sounding exactly R + 12 (the octave), all on selected strings within the fret range, whose
 * frets span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret 0). Any octave of
 * the root pitch class may be the root. A tap is **accepted** if at least one valid shape contains it
 * together with every earlier accepted or revealed position in the question; otherwise it is a wrong
 * tap (FR-056a). A step is marked correct as soon as the accepted positions fix its role [...] A tap's
 * role is fixed when every valid shape containing it and every accepted or revealed position gives it
 * the same role; it is fixed at once when only one role is possible. Until then it is **placed** [...]
 * The prompt states the fret range in play, as FR-035 does: "Play a root–fifth–octave shape for C,
 * frets 0 to 12". [...] Only positions inside the fret range are drawn as targets, so no
 * out-of-range reason exists."
 * spec.md FR-056a: "a wrong tap MUST be flagged at the tapped position with a reason and charged to
 * one pending step: to Step 2 (5th) if the tap has the 5th's pitch class and Step 2 is pending; to the
 * lowest-numbered pending of Step 1 (root) and Step 3 (octave) if it has the root's pitch class;
 * otherwise to the lowest-numbered pending step. That step is marked missed (FR-057 indicator) and its
 * correct position revealed, from a valid shape containing every accepted and revealed position (if
 * several fit, the first in this order: lowest-pitched root; then root at the lower fret, then on the
 * higher string number; then the same two tests for the 5th's position, then for the octave's).
 * Revealed positions count as fixed for the rest of the question. [...] the question ends when all
 * three steps are judged. Reasons: "Not C or G" (neither pitch class); "Doesn't fit the shape (more
 * than 3 frets apart or wrong octave)"."
 * spec.md FR-057: "Step 2 5th (visible "5", spoken and written "5th")"; "its missed list uses the same
 * words, e.g. "Missed: octave C3 at string 1 fret 5" (4-string bass)"; "The root is written and spoken
 * "root" in the missed list".
 *
 * Fixture area, brute-forced in the first test from the open strings E1 A1 D2 G2 (MIDI 28 33 38 43):
 * 4-string EADG, strings 1–3, frets 0–20, root C. Exactly two valid shapes, with different root
 * pitches (so the FR-056a reveal is unique):
 *   S1: C2 string 3 fret 3, G2 string 2 fret 5, C3 string 1 fret 5
 *   S4: C3 string 3 fret 15, G3 string 2 fret 17, C4 string 1 fret 17
 * The 5th-octave case uses all 4 strings, frets 0–12 (the spec's own prompt example).
 *
 * The root–fifth–octave drill has no root setting, so each test fixes Date.now (DrillRunner seeds its
 * generator from it) and tries seeds until the first question is for C; the expected values do not
 * depend on which seed that is.
 *
 * The earlier spec gaps (placed taps, reveal tie-breaks, repeat taps, one attempt per question, no
 * out-of-range reason) were settled on 2026-11-22 (Clarifications "test-writer T100b gaps") and are
 * tested in DrillRunner.rfo-scenarios.test.tsx (US6 scenarios 5–13).
 *
 * In this fixture (strings 1–3 of 4-string EADG) every root-pitch-class position has at most one possible
 * role (brute-forced below), so none is ever "placed": C3 1/5 can only be S1's octave and C3 3/15 only
 * S4's root (C2 is at 3/3, more than 3 frets from 15; C4 at 1/17 has no 5th within reach).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, liveRegions, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const bass4 = presets().find((p) => p.presetId === 'bass4-standard')!.profile;

type Pos = { string: number; fret: number };
type MPos = Pos & { midi: number };
function shapes(strings: number[], from: number, to: number, pc: number) {
  const A: MPos[] = strings.flatMap((s) => Array.from({ length: to - from + 1 }, (_, i) => ({ string: s, fret: from + i, midi: openMidi(bass4, s) + from + i })));
  const out: string[][] = [];
  for (const r of A) if (r.midi % 12 === pc) for (const f of A) if (f.midi === r.midi + 7) for (const o of A) if (o.midi === r.midi + 12) {
    const fr = [r.fret, f.fret, o.fret];
    if (Math.max(...fr) - Math.min(...fr) <= 3) out.push([r, f, o].map((x) => `${x.string}/${x.fret}=${x.midi}`));
  }
  return out;
}

function indicators(c: HTMLElement): { el: HTMLElement; name: string; text: string }[] {
  const list = c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps');
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('li')].map((el) => ({ el, name: ascii(el.getAttribute('aria-label') ?? el.textContent), text: ascii(el.textContent) }));
}
const names = (c: HTMLElement) => indicators(c).map((x) => x.name);
const st = (a: string, b: string, c: string) => [`Step 1, root, ${a}`, `Step 2, 5th, ${b}`, `Step 3, octave, ${c}`];
const feedback = (c: HTMLElement) => ascii(c.querySelector('.feedback')?.textContent);
const missedParts = (c: HTMLElement) => (/Missed: (.*?)\.?$/.exec(feedback(c))?.[1] ?? '').split(/;\s*/).filter(Boolean).sort();
const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `position string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
/** FR-056a: the reason is flagged at the tapped position: in its accessible name or shown with it. */
const reasonShown = (c: HTMLElement, s: number, f: number, reason: string) =>
  ascii(positionEl(c, s, f)?.getAttribute('aria-label')).includes(reason) || ascii(c.textContent).includes(reason);
const continueButton = () => screen.queryByRole('button', { name: 'Continue' });

const FIT = "Doesn't fit the shape (more than 3 frets apart or wrong octave)";
const S13_0_20: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 20, qualities: ['major'] };
const ALL_0_12: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'root-fifth-octave', strings: [1, 2, 3, 4], fromFret: 0, toFret: 12, qualities: ['major'] };

/** Renders until the first question is for root C (any octave), trying Date.now = 1, 2, 3, ... */
async function startC(s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'>) {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= 300; t++) {
    now.mockReturnValue(t);
    const r = await renderDrill('bass4-standard', s);
    if (/shape for C(?![#b])/.test(ascii(r.container.querySelector('#prompt')?.textContent))) return r;
    cleanup();
  }
  throw new Error('no root-fifth-octave question for C in 300 seeds');
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FR-056 brute-force preconditions', () => {
  it('4-string EADG, strings 1–3, frets 0–20: the only C shapes are S1 (C2 3/3, G2 2/5, C3 1/5) and S4 (C3 3/15, G3 2/17, C4 1/17)', () => {
    expect(shapes([1, 2, 3], 0, 20, 0)).toEqual([['3/3=36', '2/5=43', '1/5=48'], ['3/15=48', '2/17=55', '1/17=60']]);
    expect(openMidi(bass4, 1) + 9).toBe(52); // E3 at string 1 fret 9: neither C nor G
    expect(openMidi(bass4, 1) + 12).toBe(55); // G3 at string 1 fret 12
    expect(openMidi(bass4, 4) + 3).toBe(31); // G1 at string 4 fret 3 (C2 − 5)
  });
});

describe('FR-056 prompt', () => {
  it('states the root pitch class (no octave) and the fret range: "Play a root–fifth–octave shape for C, frets 0 to 12"', async () => {
    const { container } = await startC(ALL_0_12);
    expect(ascii(container.querySelector('#prompt')?.textContent)).toBe('Play a root–fifth–octave shape for C, frets 0 to 12');
  });
  it('frets 0 to 20: "Play a root–fifth–octave shape for C, frets 0 to 20"', async () => {
    const { container } = await startC(S13_0_20);
    expect(ascii(container.querySelector('#prompt')?.textContent)).toBe('Play a root–fifth–octave shape for C, frets 0 to 20');
  });
});

describe('FR-056 valid shapes: any octave of C may be the root; roles are fixed as positions are accepted', () => {
  it('S4 (root C3) in the order octave, root, 5th: all three correct, nothing missed', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 1, 17); // C4
    await tap(container, 3, 15); // C3
    await tap(container, 2, 17); // G3
    expect(names(container)).toEqual(st('correct', 'correct', 'correct'));
    expect(feedback(container)).not.toMatch(/Missed:/);
  });

  it('S1 (root C2) in the order 5th, octave, root: all three correct', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('correct', 'correct', 'correct'));
  });

  it('the 5th is marked correct at once', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 2, 17); // G3
    expect(names(container)).toEqual(st('pending', 'correct', 'pending'));
  });

  // FR-056 (2026-11-22): "it is fixed at once when only one role is possible". (The earlier version
  // of these two tests expected "placed" here; that case now needs both roles possible, see
  // DrillRunner.rfo-scenarios.test.tsx, US6 scenario 13.)
  it('a root-pitch-class tap with only one possible role is fixed at once: C3 3/15 can only be S4\'s root → Step 1 ✓, not "placed"', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 3, 15); // C3
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    const name = ascii(positionEl(container, 3, 15)?.getAttribute('aria-label'));
    expect(name, name).not.toMatch(/\bplaced\b/);
    await tap(container, 2, 17); // G3 = C3 + 7
    expect(names(container)).toEqual(st('correct', 'correct', 'pending'));
  });

  it('C3 1/5 can only be S1\'s octave → Step 3 ✓ at once; C2 3/3 then makes Step 1 ✓', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 1, 5); // C3
    expect(names(container)).toEqual(st('pending', 'pending', 'correct'));
    expect(ascii(positionEl(container, 1, 5)?.getAttribute('aria-label'))).not.toMatch(/\bplaced\b/);
    await tap(container, 3, 3); // C2
    expect(names(container)).toEqual(st('correct', 'pending', 'correct'));
  });
});

describe('FR-056a wrong taps: reason, charged step, reveal from the shape, fixed positions', () => {
  it('exact octave pitch 12 frets away (C2 3/3, G2 2/5, C3 3/15): "Doesn\'t fit the shape …"; Step 3 missed; "Missed: octave C3 at string 1 fret 5"', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 3, 3);
    await tap(container, 2, 5);
    expect(continueButton()).toBeNull();
    await tap(container, 3, 15);
    expect(reasonShown(container, 3, 15, FIT), ascii(container.textContent)).toBe(true);
    expect(names(container)).toEqual(st('correct', 'correct', 'missed'));
    expect(missedParts(container)).toEqual(['octave C3 at string 1 fret 5']);
    expect(continueButton(), 'all three steps judged: the question ends').toBeTruthy();
  });

  it('a 5th-pitch-class wrong tap goes to Step 2 while it is pending (C2 3/3, G3 1/12): Step 2 missed at once; then C3 1/5 completes the shape', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 3, 3);
    // FR-056 (2026-11-22): "it is fixed at once when only one role is possible" — 3/3 is only in S1,
    // as its root (brute-forced shapes above), so Step 1 is correct before the wrong tap arrives.
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    await tap(container, 1, 12); // G3: no shape holds it with C2 3/3
    expect(reasonShown(container, 1, 12, FIT)).toBe(true);
    expect(names(container)).toEqual(st('correct', 'missed', 'pending'));
    expect(continueButton()).toBeNull();
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('correct', 'missed', 'correct'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5']);
  });

  it('a 5th-pitch-class wrong tap once Step 2 is done goes to the lowest pending step (C2 3/3, G2 2/5, G3 1/12): Step 3 missed', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 3, 3);
    await tap(container, 2, 5);
    await tap(container, 1, 12);
    expect(names(container)).toEqual(st('correct', 'correct', 'missed'));
    expect(missedParts(container)).toEqual(['octave C3 at string 1 fret 5']);
  });

  it('a root-pitch-class wrong tap goes to the lowest pending of Steps 1 and 3 (G2 2/5, C3 3/15): Step 1 missed; "Missed: root C2 at string 3 fret 3"', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 2, 5);
    await tap(container, 3, 15);
    expect(reasonShown(container, 3, 15, FIT)).toBe(true);
    expect(names(container)).toEqual(st('missed', 'correct', 'pending'));
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('missed', 'correct', 'correct'));
    expect(missedParts(container)).toEqual(['root C2 at string 3 fret 3']);
  });

  it('neither pitch class (E3 1/9): "Not C or G", charged to Step 1; the reveal (lowest-pitched root, C2 3/3) is fixed, so S4 taps no longer fit', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 1, 9);
    expect(reasonShown(container, 1, 9, 'Not C or G')).toBe(true);
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 1, 17); // C4 fits S4 but not with the revealed C2 3/3
    expect(names(container)).toEqual(st('missed', 'pending', 'missed'));
    expect(reasonShown(container, 1, 17, FIT)).toBe(true);
    expect(continueButton()).toBeNull();
    await tap(container, 2, 17); // G3 fits S4 but not with the fixed S1 positions
    expect(names(container)).toEqual(st('missed', 'missed', 'missed'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5', 'octave C3 at string 1 fret 5', 'root C2 at string 3 fret 3']);
    const polite = liveRegions(container).filter((r) => r.politeness === 'polite').map((r) => ascii(r.el.textContent));
    expect(polite.some((t) => t.includes('root C2 at string 3 fret 3'))).toBe(true);
    expect(continueButton()).toBeTruthy();
  });

  it('after "Not C or G" reveals the root C2 3/3, S1\'s 5th and octave are accepted', async () => {
    const { container } = await startC(S13_0_20);
    await tap(container, 1, 9);
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('missed', 'correct', 'correct'));
    expect(missedParts(container)).toEqual(['root C2 at string 3 fret 3']);
  });

  it('exact pitch: G1 4/3 is the right pitch class but C2 − 5, not C2 + 7 (all strings, frets 0–12: C2 3/3, C3 1/5, G1 4/3): "Doesn\'t fit …"; "Missed: 5th G2 at string 2 fret 5"', async () => {
    const { container } = await startC(ALL_0_12);
    await tap(container, 3, 3);
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('correct', 'pending', 'correct'));
    await tap(container, 4, 3);
    expect(reasonShown(container, 4, 3, FIT)).toBe(true);
    expect(names(container)).toEqual(st('correct', 'missed', 'correct'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5']);
  });
});
