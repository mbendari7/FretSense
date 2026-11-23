/**
 * T100 / CR-B2-2 and T100a (red, test-first) [FR-057, FR-032, FR-049]: arpeggio step indicators and
 * the missed-step summary, with the root played by the user as Step 1.
 *
 * spec.md FR-057 (CR-B2-2 and T100a, provisional, product-owner 2026-11-22): "Each step is shown as a
 * step indicator in one of three states, each marked by icon + text + colour: pending (no mark),
 * correct (✓, "correct") or missed (✗, "missed"). A missed step never shows ✓. Steps are numbered
 * from 1 in ascending order, one per chord tone in FR-005 order; the root is Step 1 and is played by
 * the user, not given. Each indicator shows the function label (FR-005; the root as "R"), and its
 * accessible name is "Step N, <function>, <state>", with the root spoken as "root" (e.g. "Step 1,
 * root, correct"; "Step 2, ♭3, missed"). When the last step is judged, the feedback text and
 * announcement list every missed step with its target, in the question's spelling and with octave
 * (FR-032, FR-049)". US6 scenario 2: an Am7 arpeggio is A, C, E, G (4 steps).
 *
 * T100a authorised change: this file previously assumed the root was a given reference (indicators
 * ending b3, 5, octave). It now follows the sentences above: no octave step, the root is Step 1.
 *
 * Scenario, brute-forced below from the open strings: 6-string Standard, strings 2–4, frets 11–13,
 * minor arpeggio. Of every pitch in that area, only D#4 (MIDI 63, string 4 fret 13) has a minor 3rd
 * (F#4, 66, only at string 3 fret 11) and a perfect 5th (A#4, 70, only at string 2 fret 11) above
 * it, and D#4 is also the lowest D# in the area, so every reading of "from the lowest root inside the
 * window" gives the same question. Spelling follows the prompt's root (D#m: F# A#; Ebm: Gb Bb).
 *
 * Function labels per quality are standard chord-tone functions (FR-005 formulas, FR-006 labels),
 * typed out here. add9 is left out: its 9th lies above the octave, which FR-057's "one octave
 * ascending" does not settle. The missed icon is matched as ✗ or the equivalent ✕ / ×. Date.now is
 * fixed because DrillRunner seeds its generator from it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { allPositions, installLayoutMock, liveRegions, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const std6 = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
const STRINGS = [2, 3, 4];
const FRETS = [11, 12, 13];

/** Brute force: positions sounding MIDI m on strings 2–4 inside frets 11–13. */
const at = (m: number) => STRINGS.flatMap((s) => FRETS.filter((f) => openMidi(std6, s) + f === m).map((f) => ({ string: s, fret: f })));
const AREA = STRINGS.flatMap((s) => FRETS.map((f) => openMidi(std6, s) + f));
const ROOT = 63, B3 = 66, FIFTH = 70;

/** Chord-tone functions in FR-005 order (standard theory), visible form; the root is "R". */
const FUNCTIONS: Record<string, string[]> = {
  major: ['R', '3', '5'], minor: ['R', 'b3', '5'], dim: ['R', 'b3', 'b5'], aug: ['R', '3', '#5'],
  sus2: ['R', '2', '5'], sus4: ['R', '4', '5'], dom7: ['R', '3', '5', 'b7'], maj7: ['R', '3', '5', '7'],
  min7: ['R', 'b3', '5', 'b7'], m7b5: ['R', 'b3', 'b5', 'b7'], dim7: ['R', 'b3', 'b5', 'bb7'],
};
/** The spoken form: the root is "root"; every other function is spoken as written. */
const spoken = (fn: string) => (fn === 'R' ? 'root' : fn);

/** Step indicators, in order: accessible name (aria-label, else text) and visible text. */
function indicators(c: HTMLElement): { el: HTMLElement; name: string; text: string }[] {
  const list = c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps');
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('li')].map((el) => ({ el, name: ascii(el.getAttribute('aria-label') ?? el.textContent), text: ascii(el.textContent) }));
}
const names = (c: HTMLElement) => indicators(c).map((x) => x.name);

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FR-057 brute-force preconditions', () => {
  it('strings 2–4, frets 11–13: D#4 at 4/13 is the only minor root; b3 F#4 only at 3/11, 5 A#4 only at 2/11', () => {
    const roots = [...new Set(AREA)].filter((m) => AREA.includes(m + 3) && AREA.includes(m + 7));
    expect(roots).toEqual([ROOT]);
    expect(Math.min(...AREA.filter((m) => m % 12 === ROOT % 12))).toBe(ROOT); // the lowest D# in the area
    expect(at(ROOT)).toEqual([{ string: 4, fret: 13 }]);
    expect(at(B3)).toEqual([{ string: 3, fret: 11 }]);
    expect(at(FIFTH)).toEqual([{ string: 2, fret: 11 }]);
  });
});

describe('FR-057 (CR-B2-2, T100a) D#-minor arpeggio: the root is Step 1, played by the user', () => {
  async function start() {
    const r = await renderDrill('guitar6-standard', { type: 'arpeggio', strings: STRINGS, fromFret: 11, toFret: 13, qualities: ['minor'] });
    const prompt = ascii(r.container.querySelector('#prompt')?.textContent);
    const sharp = /D#m/.test(prompt);
    expect(sharp || /Ebm/.test(prompt), prompt).toBe(true);
    return { ...r, sp: sharp ? { root: 'D#', b3: 'F#', fifth: 'A#' } : { root: 'Eb', b3: 'Gb', fifth: 'Bb' } };
  }
  const tap = async (c: HTMLElement, s: number, f: number) => { await act(async () => { fireEvent.click(positionEl(c, s, f)!); }); };

  it('before any tap: exactly "Step 1, root, pending", "Step 2, b3, pending", "Step 3, 5, pending"; visible R, b3, 5; no ✓ or ✗', async () => {
    const { container } = await start();
    expect(names(container)).toEqual(['Step 1, root, pending', 'Step 2, b3, pending', 'Step 3, 5, pending']);
    const ind = indicators(container);
    expect(ind.map((x) => x.text)).toEqual(['R', 'b3', '5']);
    for (const x of ind) expect(x.el.textContent).not.toMatch(/[✓✗✕×]/);
  });

  it('the root is not given: no position is marked or named as a reference', async () => {
    const { container } = await start();
    const refs = allPositions(container).map((el) => ascii(el.getAttribute('aria-label'))).filter((n) => /\breference\b/.test(n));
    expect(refs).toEqual([]);
  });

  it('tapping the root first judges Step 1: "Step 1, root, correct" with ✓; Steps 2 and 3 still pending', async () => {
    const { container } = await start();
    await tap(container, 4, 13);
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, b3, pending', 'Step 3, 5, pending']);
    const first = indicators(container)[0]!;
    expect(first.el.textContent).toMatch(/✓/);
    expect(first.text).toMatch(/^.*R.*correct/);
  });

  it('right root, wrong b3, right 5: "Step 2, b3, missed" with ✗ and never ✓; the feedback lists only that step, "b3 <F#|Gb>4 at string 3 fret 11"', async () => {
    const { container, sp } = await start();
    await tap(container, 4, 13); // D#4, the root
    await tap(container, 3, 12); // G4: not the b3
    await tap(container, 2, 11); // A#4, the 5th
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, b3, missed', 'Step 3, 5, correct']);
    const ind = indicators(container);
    expect(ind[1]!.el.textContent).toMatch(/[✗✕×]/);
    expect(ind[1]!.el.textContent).not.toMatch(/✓/);
    expect(ind[1]!.text).toMatch(/missed/);
    for (const i of [0, 2]) { expect(ind[i]!.el.textContent).toMatch(/✓/); expect(ind[i]!.text).toMatch(/correct/); }

    const fb = ascii(container.querySelector('.feedback')?.textContent);
    expect(/Missed: (.*?)\.?$/.exec(fb)?.[1], `feedback "${fb}"`).toBe(`b3 ${sp.b3}4 at string 3 fret 11`);
    // FR-049: the same text is announced in the polite region.
    const polite = liveRegions(container).filter((r) => r.politeness === 'polite').map((r) => ascii(r.el.textContent));
    expect(polite.some((t) => t.includes(`Missed: b3 ${sp.b3}4 at string 3 fret 11`))).toBe(true);
  });

  it('a wrong root is "Step 1, root, missed"; the drill continues to Step 2, and the missed list names the root\'s target <D#|Eb>4 at string 4 fret 13', async () => {
    const { container, sp } = await start();
    await tap(container, 4, 12); // D4: not the root
    expect(names(container)).toEqual(['Step 1, root, missed', 'Step 2, b3, pending', 'Step 3, 5, pending']);
    await tap(container, 3, 11); // F#4
    await tap(container, 2, 11); // A#4
    expect(names(container)).toEqual(['Step 1, root, missed', 'Step 2, b3, correct', 'Step 3, 5, correct']);
    const fb = ascii(container.querySelector('.feedback')?.textContent);
    // T100b: spec.md FR-057 now says "The root is written and spoken "root" in the missed list".
    expect(/Missed: (.*?)\.?$/.exec(fb)?.[1], `feedback "${fb}"`).toBe(`root ${sp.root}4 at string 4 fret 13`);
  });

  it('after Continue the next question\'s indicators are all pending again', async () => {
    const { container } = await start();
    for (let i = 0; i < 3; i++) await tap(container, 4, 12);
    const cont = screen.queryByRole('button', { name: 'Continue' });
    expect(cont).toBeTruthy();
    await act(async () => { fireEvent.click(cont!); });
    expect(names(container)).toEqual(['Step 1, root, pending', 'Step 2, b3, pending', 'Step 3, 5, pending']);
  });
});

describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-057 / US6-2 indicators follow FR-005 chord-tone order, %s', (id, profile) => {
  it.each(Object.keys(FUNCTIONS))('%s: one indicator per chord tone, Step 1 the root ("R", spoken "root"), all pending', async (ql) => {
    const strings = Array.from({ length: profile.stringCount }, (_, i) => i + 1);
    const { container } = await renderDrill(id, { type: 'arpeggio', strings, fromFret: 0, toFret: Math.min(12, profile.fretCount), qualities: [ql] });
    const fns = FUNCTIONS[ql]!;
    expect(names(container)).toEqual(fns.map((f, i) => `Step ${i + 1}, ${spoken(f)}, pending`));
    expect(indicators(container).map((x) => x.text)).toEqual(fns);
  });
});
