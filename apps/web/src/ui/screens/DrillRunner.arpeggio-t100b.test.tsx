/**
 * T100b (red, test-first) [FR-057]: arpeggio prompt, wrong-step reasons, "root" in the missed list,
 * and (pending the owner) add9 steps R, 3, 5, 9.
 *
 * spec.md FR-057 (product-owner 2026-11-22, provisional): "The prompt names the chord as FR-036 does
 * and states the window: "Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9".
 * Wrong-step reasons: "Outside frets 5 to 9"; "Not the lowest A in frets 5 to 9" (Step 1, right pitch
 * class, wrong octave); "Not the ♭3 of Am7" (wrong tone or out of order)." and "The root is written
 * and spoken "root" in the missed list, e.g. "Missed: root A2 at string 6 fret 5"". Window: "[s, s + w
 * − 1] (default w = 5), where the lowest root is the lowest-pitched position of the root pitch class
 * on a selected string inside the window".
 *
 * Fixture, brute-forced below from the open strings E1 A1 D2 G2 (MIDI 28 33 38 43): 4-string EADG, all
 * strings, frets 5–9 (one window, 5 frets wide). The A positions are A1 (33) string 4 fret 5 and A2
 * (45) string 2 fret 7, so the lowest A is string 4 fret 5; Am7 = A1 33, C2 36 (string 4 fret 8), E2
 * 40 (string 3 fret 7), G2 43 (string 2 fret 5), each at exactly one position. The arpeggio drill has
 * no root setting, so Date.now (DrillRunner's seed) is tried 1, 2, 3, ... until the first question is
 * for A; the expected values do not depend on the seed.
 *
 * "Outside frets s to e" needs frets outside the window on the board, so it uses frets 3–9 (two or
 * three windows) and whatever minor-7th question comes first: root and window are read from the
 * prompt, the targets are brute-forced, and an outside-window position sounding a step's exact pitch is
 * tapped after the earlier steps are answered correctly.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const pcOfName = (n: string) => pcOf(LETTER_PC[n[0]!]! + ({ '#': 1, b: -1, '##': 2, bb: -2 }[n.slice(1)] ?? 0));
const bass4 = presets().find((p) => p.presetId === 'bass4-standard')!.profile;
type Pos = { string: number; fret: number };

function indicators(c: HTMLElement): { el: HTMLElement; name: string; text: string }[] {
  const list = c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps');
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('li')].map((el) => ({ el, name: ascii(el.getAttribute('aria-label') ?? el.textContent), text: ascii(el.textContent) }));
}
const names = (c: HTMLElement) => indicators(c).map((x) => x.name);
const feedback = (c: HTMLElement) => ascii(c.querySelector('.feedback')?.textContent);
const prompt = (c: HTMLElement) => ascii(c.querySelector('#prompt')?.textContent);
const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `position string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
const reasonShown = (c: HTMLElement, s: number, f: number, reason: string) =>
  ascii(positionEl(c, s, f)?.getAttribute('aria-label')).includes(reason) || ascii(c.textContent).includes(reason);

type S = Partial<DrillSettings> & Pick<DrillSettings, 'strings'>;
async function startWhere(presetId: string, s: S, pred: (prompt: string) => boolean, tries = 300) {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= tries; t++) {
    now.mockReturnValue(t);
    const r = await renderDrill(presetId, s);
    if (pred(prompt(r.container))) return r;
    cleanup();
  }
  throw new Error(`no matching question in ${tries} seeds`);
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const AM7: S = { type: 'arpeggio', strings: [1, 2, 3, 4], fromFret: 5, toFret: 9, qualities: ['min7'] };
const startAm7 = () => startWhere('bass4-standard', AM7, (p) => /lowest A(?![#b])/.test(p));
const at = (m: number, strings: number[], from: number, to: number) =>
  strings.flatMap((s) => Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((f) => openMidi(bass4, s) + f === m).map((f) => `${s}/${f}`));

describe('FR-057 brute-force preconditions (4-string EADG, frets 5–9)', () => {
  it('A positions: A1 4/5 and A2 2/7; Am7 from A1: C2 4/8, E2 3/7, G2 2/5', () => {
    const S = [1, 2, 3, 4];
    expect([...at(33, S, 5, 9), ...at(45, S, 5, 9)]).toEqual(['4/5', '2/7']);
    expect([36, 40, 43].map((m) => at(m, S, 5, 9))).toEqual([['4/8'], ['3/7'], ['2/5']]);
  });
});

describe('FR-057 Am7 arpeggio prompt and wrong-step reasons', () => {
  it('prompt: "Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9"', async () => {
    const { container } = await startAm7();
    expect(prompt(container)).toBe('Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9');
  });

  it('Step 1, right pitch class, wrong octave (A2 2/7): "Not the lowest A in frets 5 to 9"; Step 1 missed', async () => {
    const { container } = await startAm7();
    await tap(container, 2, 7);
    expect(reasonShown(container, 2, 7, 'Not the lowest A in frets 5 to 9'), ascii(container.textContent)).toBe(true);
    expect(names(container)).toEqual(['Step 1, root, missed', 'Step 2, b3, pending', 'Step 3, 5, pending', 'Step 4, b7, pending']);
  });

  it('out of order at Step 2 (E2 3/7, the 5th): "Not the ♭3 of Am7"; Step 2 missed', async () => {
    const { container } = await startAm7();
    await tap(container, 4, 5);
    await tap(container, 3, 7);
    expect(reasonShown(container, 3, 7, 'Not the b3 of Am7'), ascii(container.textContent)).toBe(true);
    expect(names(container)).toEqual(['Step 1, root, correct', 'Step 2, b3, missed', 'Step 3, 5, pending', 'Step 4, b7, pending']);
  });

  it('wrong tone at Step 2 (B1 4/7): "Not the ♭3 of Am7"', async () => {
    expect(openMidi(bass4, 4) + 7).toBe(35); // B1
    const { container } = await startAm7();
    await tap(container, 4, 5);
    await tap(container, 4, 7);
    expect(reasonShown(container, 4, 7, 'Not the b3 of Am7')).toBe(true);
  });

  it('the missed root is written "root": "Missed: root A1 at string 4 fret 5"', async () => {
    const { container } = await startAm7();
    await tap(container, 2, 7); // A2: wrong octave
    await tap(container, 4, 8);
    await tap(container, 3, 7);
    await tap(container, 2, 5);
    expect(names(container)).toEqual(['Step 1, root, missed', 'Step 2, b3, correct', 'Step 3, 5, correct', 'Step 4, b7, correct']);
    expect(/Missed: (.*?)\.?$/.exec(feedback(container))?.[1], feedback(container)).toBe('root A1 at string 4 fret 5');
  });
});

describe('FR-057 "Outside frets s to e": a step\'s exact pitch tapped outside the window', () => {
  it('minor 7th, 4-string EADG, frets 3–9: the reason names the window from the prompt', async () => {
    const SEMIS = [0, 3, 7, 10];
    const S = [1, 2, 3, 4];
    let plan: { inside: Pos[]; outside: Pos; from: number; to: number } | undefined;
    const r = await startWhere('bass4-standard', { type: 'arpeggio', strings: S, fromFret: 3, toFret: 9, qualities: ['min7'] }, (p) => {
      const m = /up from its lowest ([A-G](?:##|#|bb|b)?), frets (\d+) to (\d+)$/.exec(p);
      if (!m) return false;
      const pc = pcOfName(m[1]!), from = Number(m[2]), to = Number(m[3]);
      const win = S.flatMap((s) => Array.from({ length: to - from + 1 }, (_, i) => ({ string: s, fret: from + i, midi: openMidi(bass4, s) + from + i })));
      const rm = Math.min(...win.filter((x) => pcOf(x.midi) === pc).map((x) => x.midi));
      const board = S.flatMap((s) => Array.from({ length: 7 }, (_, i) => ({ string: s, fret: 3 + i, midi: openMidi(bass4, s) + 3 + i })));
      for (let i = 0; i < SEMIS.length; i++) {
        const out = board.find((x) => (x.fret < from || x.fret > to) && x.midi === rm + SEMIS[i]!);
        if (!out) continue;
        const inside = SEMIS.slice(0, i).map((d) => win.find((x) => x.midi === rm + d)!);
        plan = { inside, outside: out, from, to };
        return true;
      }
      return false;
    });
    for (const x of plan!.inside) await tap(r.container, x.string, x.fret);
    await tap(r.container, plan!.outside.string, plan!.outside.fret);
    const reason = `Outside frets ${plan!.from} to ${plan!.to}`;
    expect(reasonShown(r.container, plan!.outside.string, plan!.outside.fret, reason), ascii(r.container.textContent)).toBe(true);
    expect(names(r.container)[plan!.inside.length]).toMatch(/, missed$/);
  });
});

// PENDING THE OWNER (spec.md FR-057: "except add9, whose last step is the 9th at root + 14 semitones,
// label "9", spoken "9th"; *pending the owner's add9 answer*"). Self-contained so it can be dropped.
describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-057 add9 arpeggio indicators (pending owner), %s', (id, profile) => {
  it('four steps R, 3, 5, 9; the 9 is spoken "9th"', async () => {
    const strings = Array.from({ length: profile.stringCount }, (_, i) => i + 1);
    vi.spyOn(Date, 'now').mockReturnValue(1);
    const { container } = await renderDrill(id, { type: 'arpeggio', strings, fromFret: 0, toFret: Math.min(12, profile.fretCount), qualities: ['add9'] });
    expect(names(container)).toEqual(['Step 1, root, pending', 'Step 2, 3, pending', 'Step 3, 5, pending', 'Step 4, 9th, pending']);
    expect(indicators(container).map((x) => x.text)).toEqual(['R', '3', '5', '9']);
  });
});
