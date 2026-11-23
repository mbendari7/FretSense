/**
 * T100a (red, test-first) [FR-056, FR-057, FR-049]: root–fifth–octave step indicators.
 *
 * spec.md FR-057 (T100a/T100b, provisional, product-owner 2026-11-22; "the 5th is spoken and written
 * "5th"", Clarifications "test-writer T100b gaps"): "FR-056 uses the same indicator with
 * three fixed steps, numbered by tone and not by tap order: Step 1 root ("R"), Step 2 5th (visible "5",
 * spoken and written "5th"), Step 3 octave (visible "8", spoken and written "octave"), e.g. "Step 3,
 * octave, pending"; its
 * missed list uses the same words, e.g. "Missed: octave C3 at string 1 fret 5" (4-string bass)."
 * spec.md FR-056: "ask, for a given root, for the root, the perfect 5th above it, and the octave
 * above the root, in any order. Positions sounding those exact pitches are accepted if their frets
 * span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret 0)."
 * US6 scenario 1: C, G and the C an octave above on 4-string EADG.
 *
 * Scenario, brute-forced below from the open strings: 4-string EADG, strings 1–3, frets 3–5. Of every
 * pitch in that area, only C2 (MIDI 36, string 3 fret 3) has a 5th (G2, 43) and an octave (C3, 48)
 * that complete a shape spanning ≤ 3 frets, and that shape is unique: C2 3/3, G2 2/5, C3 1/5. So the
 * question is the same whatever root the generator draws and whichever octave of the root it means.
 * (spec.md now reads "string 1 fret 5", matching EADG: C3 is string 1 fret 5.)
 *
 * Wrong-tap charging is now FR-056a (T100b; see DrillRunner.rfo-shape.test.tsx); the missed case here
 * taps the root and the 5th first, so the only open step is the octave. Date.now is fixed because
 * DrillRunner seeds its generator from it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, liveRegions, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const bass4 = presets().find((p) => p.presetId === 'bass4-standard')!.profile;
const STRINGS = [1, 2, 3];
const FRETS = [3, 4, 5];

type Pos = { string: number; fret: number };
const AREA: (Pos & { midi: number })[] = STRINGS.flatMap((s) => FRETS.map((f) => ({ string: s, fret: f, midi: openMidi(bass4, s) + f })));
/** Every (root, 5th, octave) triple of positions in the area with exact pitches and span ≤ 3. */
function shapes() {
  const out: [Pos & { midi: number }, Pos & { midi: number }, Pos & { midi: number }][] = [];
  for (const r of AREA) for (const f of AREA) for (const o of AREA) {
    if (f.midi !== r.midi + 7 || o.midi !== r.midi + 12) continue;
    const fr = [r.fret, f.fret, o.fret];
    if (Math.max(...fr) - Math.min(...fr) <= 3) out.push([r, f, o]);
  }
  return out;
}

function indicators(c: HTMLElement): { el: HTMLElement; name: string; text: string }[] {
  const list = c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps');
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('li')].map((el) => ({ el, name: ascii(el.getAttribute('aria-label') ?? el.textContent), text: ascii(el.textContent) }));
}
const names = (c: HTMLElement) => indicators(c).map((x) => x.name);
const PENDING = ['Step 1, root, pending', 'Step 2, 5th, pending', 'Step 3, octave, pending'];

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FR-056 brute-force preconditions', () => {
  it('4-string EADG, strings 1–3, frets 3–5: the only shape is C2 3/3, G2 2/5, C3 1/5', () => {
    expect(shapes().map(([r, f, o]) => [[r.string, r.fret, r.midi], [f.string, f.fret, f.midi], [o.string, o.fret, o.midi]]))
      .toEqual([[[3, 3, 36], [2, 5, 43], [1, 5, 48]]]);
  });
});

describe('FR-056 / FR-057 (T100a) C root–fifth–octave on 4-string EADG: three fixed steps, numbered by tone', () => {
  const start = () => renderDrill('bass4-standard', { type: 'root-fifth-octave', strings: STRINGS, fromFret: 3, toFret: 5, qualities: ['major'] });
  const tap = async (c: HTMLElement, s: number, f: number) => { await act(async () => { fireEvent.click(positionEl(c, s, f)!); }); };

  it('the prompt names the root C', async () => {
    const { container } = await start();
    expect(ascii(container.querySelector('#prompt')?.textContent)).toMatch(/\bC(?![#b])/);
  });

  it('before any tap: "Step 1, root, pending", "Step 2, 5th, pending", "Step 3, octave, pending"; visible R, 5, 8', async () => {
    const { container } = await start();
    expect(names(container)).toEqual(PENDING);
    expect(indicators(container).map((x) => x.text)).toEqual(['R', '5', '8']);
    for (const x of indicators(container)) expect(x.el.textContent).not.toMatch(/[✓✗✕×]/);
  });

  it('the root is played, not given: no position is named as a reference', async () => {
    const { container } = await start();
    const refs = [...container.querySelectorAll('[role="button"][aria-label^="String "]')].map((el) => ascii(el.getAttribute('aria-label'))).filter((n) => /\breference\b/.test(n));
    expect(refs).toEqual([]);
  });

  it('taps in any order: octave, then root, then 5th; each tap marks its own tone\'s step, and all three end correct', async () => {
    const { container } = await start();
    await tap(container, 1, 5); // C3, the octave
    expect(names(container)).toEqual(['Step 1, root, pending', 'Step 2, 5th, pending', 'Step 3, octave, correct']);
    expect(indicators(container)[2]!.el.textContent).toMatch(/✓/);
    await tap(container, 3, 3); // C2, the root
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, 5th, pending', 'Step 3, octave, correct']);
    await tap(container, 2, 5); // G2, the 5th
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, 5th, correct', 'Step 3, octave, correct']);
    expect(ascii(container.querySelector('.feedback')?.textContent)).not.toMatch(/Missed:/);
  });

  it('5th, root, then a wrong note: "Step 3, octave, missed" with ✗; the feedback and announcement read "Missed: octave C3 at string 1 fret 5"', async () => {
    const { container } = await start();
    await tap(container, 2, 5); // G2
    await tap(container, 3, 3); // C2
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, 5th, correct', 'Step 3, octave, pending']);
    await tap(container, 3, 4); // C#2: not the octave
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, 5th, correct', 'Step 3, octave, missed']);
    const oct = indicators(container)[2]!;
    expect(oct.el.textContent).toMatch(/[✗✕×]/);
    expect(oct.el.textContent).not.toMatch(/✓/);
    const fb = ascii(container.querySelector('.feedback')?.textContent);
    expect(/Missed: (.*?)\.?$/.exec(fb)?.[1], `feedback "${fb}"`).toBe('octave C3 at string 1 fret 5');
    const polite = liveRegions(container).filter((r) => r.politeness === 'polite').map((r) => ascii(r.el.textContent));
    expect(polite.some((t) => t.includes('Missed: octave C3 at string 1 fret 5'))).toBe(true);
  });
});

describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-057 (T100a) root–fifth–octave indicators, %s', (id, profile) => {
  it('three fixed steps named root, 5th, octave and shown R, 5, 8', async () => {
    const strings = Array.from({ length: profile.stringCount }, (_, i) => i + 1);
    const { container } = await renderDrill(id, { type: 'root-fifth-octave', strings, fromFret: 0, toFret: Math.min(12, profile.fretCount), qualities: ['major'] });
    expect(names(container)).toEqual(PENDING);
    expect(indicators(container).map((x) => x.text)).toEqual(['R', '5', '8']);
  });
});
