/**
 * CR-B2-3 (red, test-first) [FR-032a]: nut-column names once a drill question is answered.
 *
 * spec.md FR-032a (CR-B2-3, owner-approved 2026-11-22): "While a question is unanswered it is spelled
 * exactly as the instrument's open-string notes (FR-051); once the question is answered, an open
 * string keeps the instrument's spelling unless its pitch is one of the question's own notes (the
 * prompted note, the interval reference or target, or a tone of the question's chord), in which case
 * it takes that note's spelling, except where that spelling has a double accidental. FR-060 never
 * applies to the nut column."
 *
 * Expected values come from music theory, recomputed by brute force here:
 *  - D#-minor arpeggio on 6-string Standard, strings 2–4, frets 11–13. FR-057 (T100a): the steps are
 *    the chord tones in FR-005 order with the root played as Step 1 (R, b3, 5; no octave step). In
 *    that area the only pitch with a b3 and a 5 above it is D#4 (MIDI 63, string 4 fret 13), which is
 *    also the lowest D# there: the brute force below checks that. (T100a authorised change: this
 *    scenario used all strings and an octave step; with R, b3, 5 all strings would also allow G#4.)
 *    D#m = D# F# A# (pitch classes 3, 6, 10); no open string of
 *    E A D G B E (4, 9, 2, 7, 11, 4) is one of them, so the nut reads E A D G B E (owner acceptance).
 *  - Db-minor chord-tone: Dbm = Db Fb Ab (1, 4, 8). The open E strings (pc 4) are the chord's Fb, so
 *    strings 1 and 6 read Fb; A D G B keep their names (owner acceptance).
 *  - Eb tuning, note-finding F#: only string 3 (Gb, pc 6) sounds the prompted note, so it reads F#
 *    (kept in DrillRunner.test.tsx); every other string keeps Eb Ab Db Bb Eb.
 *  - Db dim7 = Db Fb Abb Cbb: in Eb tuning string 2 (Bb, pc 10) sounds the chord's Cbb, a double
 *    accidental, so it keeps "Bb". G# aug = G# B# D##: the open E strings sound D##, so they keep "E".
 *  - Property: on every preset, no nut name ever has a double accidental, and every nut name has the
 *    open string's pitch class. Determinism (T100a): DrillRunner seeds its generator from Date.now(),
 *    so Date.now is fixed and the property runs over several fixed seeds.
 * Test hook (shared with Fretboard.test.tsx and DrillRunner.test.tsx): nut labels carry `data-nut-string="N"`.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { allPositions, installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';

// ---- independent brute force ----
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const mod12 = (x: number) => ((x % 12) + 12) % 12;
const accStr = (a: number) => (a === -1 ? 'b' : a === 1 ? '#' : a === -2 ? 'bb' : a === 2 ? '##' : '');
const instrumentName = (p: InstrumentProfile, s: number) => { const n = p.tuning[p.stringCount - s]!; return n.letter + accStr(n.accidental); };
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
/** ASCII nut text, including the Unicode double accidentals. */
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
const pcOfName = (name: string) => {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(name);
  return m ? mod12(LETTER_PC[m[1]!]! + ACC[m[2] ?? '']!) : undefined;
};

const ALL = presets().map((p) => [p.presetId, p.profile] as const);
const std6 = presets().find((p) => p.presetId === 'guitar6-standard')!.profile;
const eb6 = presets().find((p) => p.presetId === 'guitar6-eb')!.profile;

const nut = (c: HTMLElement, s: number) => ascii(c.querySelector(`[data-nut-string="${s}"]`)?.textContent);
const nuts = (c: HTMLElement, p: InstrumentProfile) => allStrings(p).map((s) => nut(c, s));
const continueBtn = () => screen.queryByRole('button', { name: 'Continue' });
async function click(el: Element) { await act(async () => { fireEvent.click(el); }); }
/** Taps positions in document order until the question is judged (Continue shows; auto-advance is off). */
async function answerQuestion(c: HTMLElement) {
  for (const el of allPositions(c)) {
    if (continueBtn()) return;
    await click(el);
  }
  if (!continueBtn()) throw new Error('could not finish the question');
}

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const SEEDS = [1, 2, 3];

describe('FR-032a (CR-B2-3) brute-force preconditions', () => {
  it('6-string Standard, strings 2–4, frets 11–13: the only minor-arpeggio root (R, b3, 5) is D#4 (MIDI 63) at string 4 fret 13, the lowest D# there', () => {
    const at = new Map<number, { string: number; fret: number }[]>();
    for (const s of [2, 3, 4]) for (let f = 11; f <= 13; f++) {
      const m = openMidi(std6, s) + f;
      at.set(m, [...(at.get(m) ?? []), { string: s, fret: f }]);
    }
    const roots = [...at.keys()].filter((m) => at.has(m + 3) && at.has(m + 7));
    expect(roots).toEqual([63]);
    expect(Math.min(...[...at.keys()].filter((m) => m % 12 === 3))).toBe(63);
    expect(at.get(63)).toEqual([{ string: 4, fret: 13 }]);
  });
});

describe('FR-032a (CR-B2-3) owner acceptance: the nut keeps the instrument spelling unless the open string is a question note', () => {
  it('D#-minor arpeggio on 6-string Standard: the nut reads E A D G B E before and after the answer', async () => {
    const s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'arpeggio', strings: [2, 3, 4], fromFret: 11, toFret: 13, qualities: ['minor'] };
    const { container } = await renderDrill('guitar6-standard', s);
    // T100b authorised change (spec.md FR-057, provisional 2026-11-22): "The prompt names the chord as
    // FR-036 does and states the window: "Play the A minor 7th arpeggio (Am7) up from its lowest A,
    // frets 5 to 9"." The old pattern /(D#|Eb)m arpeggio/ assumed "Play the D#m arpeggio".
    expect(norm(container.textContent)).toMatch(/Play the (D#|Eb) minor arpeggio \((D#|Eb)m\) up from its lowest (D#|Eb), frets 11 to 13/);
    // strings 1..6
    expect(nuts(container, std6)).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
    await answerQuestion(container);
    expect(nuts(container, std6), 'answered: no open string is D#, F# or A#').toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
  });

  it('Db-minor chord-tone on 6-string Standard: once answered, strings 1 and 6 read Fb; A D G B keep their names', async () => {
    const s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'chord-tone', strings: allStrings(std6), fromFret: 0, toFret: 12, roots: ['Db'], qualities: ['minor'], functions: ['R'] };
    const { container } = await renderDrill('guitar6-standard', s);
    expect(norm(container.textContent)).toMatch(/Dbm/);
    expect(nuts(container, std6), 'unanswered: the instrument spelling').toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
    await answerQuestion(container);
    expect(nuts(container, std6)).toEqual(['Fb', 'B', 'G', 'D', 'A', 'Fb']);
  });

  it('Eb tuning, note-finding F# on string 3: once answered only string 3 reads F#; Eb Ab Db Bb Eb keep their names', async () => {
    const { container } = await renderDrill('guitar6-eb', { strings: [3], notes: [6] });
    expect(nuts(container, eb6)).toEqual(['Eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb']);
    await click(positionEl(container, 3, 0)!);
    expect(continueBtn()).toBeTruthy();
    expect(nuts(container, eb6)).toEqual(['Eb', 'Bb', 'F#', 'Db', 'Ab', 'Eb']);
  });

  it('Db dim7 in Eb tuning: string 2 (Bb) sounds the chord\'s Cbb, a double accidental, so it keeps "Bb"', async () => {
    const s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'chord-tone', strings: allStrings(eb6), fromFret: 0, toFret: 12, roots: ['Db'], qualities: ['dim7'], functions: ['R'] };
    const { container } = await renderDrill('guitar6-eb', s);
    await answerQuestion(container);
    const n = nuts(container, eb6);
    expect(n[1]).toBe('Bb');
    // Db (string 4, pc 1) is the chord root: its own spelling is Db, the same as the instrument's.
    expect(n[3]).toBe('Db');
    // Eb Ab Gb are not tones of Db dim7 (Db Fb Abb Cbb = pc 1 4 7 10): they keep their names.
    expect([n[0], n[2], n[4], n[5]]).toEqual(['Eb', 'Gb', 'Ab', 'Eb']);
  });

  it('G# aug on 6-string Standard: the open E strings sound the chord\'s D## (double sharp), so they keep "E"', async () => {
    const s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'> = { type: 'chord-tone', strings: allStrings(std6), fromFret: 0, toFret: 12, roots: ['G#'], qualities: ['aug'], functions: ['R'] };
    const { container } = await renderDrill('guitar6-standard', s);
    await answerQuestion(container);
    expect(nuts(container, std6)).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
  });
});

describe.each(ALL)('FR-032a (CR-B2-3) property, %s: no double accidental ever appears in the nut', (id, profile) => {
  const top = Math.min(12, profile.fretCount);
  const drills: (Partial<DrillSettings> & Pick<DrillSettings, 'strings'>)[] = [
    { type: 'chord-tone', strings: allStrings(profile), fromFret: 0, toFret: top, count: 5, roots: ['Db', 'Ab', 'G#', 'C#', 'D#', 'Gb'], qualities: ['dim7', 'aug', 'minor'], functions: ['R', 'b3', '3', '5', '#5', 'bb7'] },
    { type: 'interval', strings: allStrings(profile), fromFret: 0, toFret: top, count: 5, intervals: ['d5', 'm2', 'A4', 'm6'], direction: 'both' },
    { type: 'arpeggio', strings: allStrings(profile), fromFret: 0, toFret: top, count: 5, qualities: ['dim', 'aug', 'minor'] },
  ];
  it.each(drills.flatMap((d) => SEEDS.map((seed) => [d.type, seed, d] as const)))('%s, seed %i: before and after every answer, each nut name is a single spelling of the open string\'s pitch class', async (_t, seed, d) => {
    vi.spyOn(Date, 'now').mockReturnValue(seed);
    const { container } = await renderDrill(id, d);
    for (let q = 0; q < 5; q++) {
      if (!container.querySelector('[data-nut-string]')) break; // the summary has no fretboard
      await answerQuestion(container);
      for (const s of allStrings(profile)) {
        const name = nut(container, s);
        expect(name, `string ${s} nut "${name}" has a double accidental`).not.toMatch(/bb|##/);
        expect(pcOfName(name), `string ${s} nut "${name}" is not a spelling of its open string ${instrumentName(profile, s)}`).toBe(mod12(openMidi(profile, s)));
      }
      await click(continueBtn()!);
    }
  });
});
