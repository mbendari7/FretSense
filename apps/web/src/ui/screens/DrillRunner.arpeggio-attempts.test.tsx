/**
 * Spec change (red, test-first) [FR-040, FR-041, FR-057]: the arpeggio drill records ONE attempt per
 * question, like root–fifth–octave. Replaces the earlier per-step version of this file.
 *
 * spec.md (Clarifications, "Arpeggio per-step attempts", provisional, product-owner 2026-11-22):
 *   "arpeggio records one attempt per question, like root–fifth–octave (FR-040, FR-057); weighting
 *   counts FR-040 attempts (FR-041, R9) ... The per-step wording was a pending proposal, never
 *   owner-signed."
 * FR-040: "one attempt per question for note-finding, interval, chord-tone, root–fifth–octave and
 *   arpeggio, however many taps or steps it took (FR-056a, FR-057)".
 * FR-056a (the rule FR-040 points to): "The question is recorded as one attempt (FR-040) when its last
 *   step is judged: outcome correct only if no step was missed; answer positions are every judged tap
 *   in tap order ... Step results are shown (FR-057 indicator) but not recorded separately."
 * FR-041: the arpeggio item is "(drill type, quality of the chord the note is played over)";
 *   "Attempts are counted as FR-040 records them: a multi-step question is one attempt, and it is a
 *   miss if any step was missed." R9 (research.md / weighting.ts doc): w = 1 + 3·(m + 1)/(n + 2).
 * Item key grammar (data-model §3.1): bs|arpeggio|<qualityId>; the setting's quality id here is
 *   "minor", so the key is bs|arpeggio|minor.
 *
 * Fixture, brute-forced below from the preset's open strings (MIDI = 12·(octave + 1) + letter +
 * accidental, plus the fret): 6-string Standard, strings 2–4, frets 11–13, quality minor. The area's
 * pitches are s4: 61 62 63, s3: 66 67 68, s2: 70 71 72, so D# minor (63, 66, 70) is the only minor
 * chord whose lowest root has its 3rd and 5th inside: D#4 4/13, F#4 3/11, A#4 2/11. G4 3/12 is a
 * wrong ♭3. Date.now is fixed because DrillRunner seeds its generator from it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { presetById, type InstrumentProfile, type Note } from '@fretsense/theory';
import { installLayoutMock, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import { historiesFrom } from '../../domain/weighting';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const STD = presetById('guitar6-standard')!.profile;
const STRINGS = [2, 3, 4];

const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `position string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
const k = (x: { string: number; fret: number }) => `${x.string}/${x.fret}`;
type App = Awaited<ReturnType<typeof renderDrill>>['app'];
const live = (app: App) => app.getState().attempts.filter((a) => !a.deleted);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
/** R9, written from the formula: w = 1 + 3·(m + 1)/(n + 2). */
const r9 = (n: number, m: number) => 1 + (3 * (m + 1)) / (n + 2);

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const arp = () => renderDrill('guitar6-standard', { type: 'arpeggio', strings: STRINGS, fromFret: 11, toFret: 13, qualities: ['minor'] });

describe('fixture (brute force): D# minor is the only minor arpeggio in strings 2–4, frets 11–13', () => {
  it('area pitches, and the only fitting chord', () => {
    const area = STRINGS.flatMap((s) => [11, 12, 13].map((f) => ({ string: s, fret: f, midi: openMidi(STD, s) + f })));
    const fits: number[] = [];
    for (const r of area) {
      const lowest = Math.min(...area.filter((x) => pcOf(x.midi) === pcOf(r.midi)).map((x) => x.midi));
      if (lowest !== r.midi) continue;
      if ([3, 7].every((o) => area.some((x) => x.midi === r.midi + o))) fits.push(r.midi);
    }
    expect(fits).toEqual([63]); // D#4
    const at = (s: number, f: number) => openMidi(STD, s) + f;
    expect([at(4, 13), at(3, 11), at(2, 11), at(3, 12), at(2, 12)]).toEqual([63, 66, 70, 67, 71]);
  });
  it('the drill asks for D# minor', async () => {
    const { container } = await arp();
    expect(norm(container.querySelector('#prompt')?.textContent)).toMatch(/D[#♯] minor/);
  });
});

describe('FR-040 arpeggio: exactly one attempt per question, written when the last step is judged', () => {
  it('D#4, G4 (wrong ♭3), A#4: one attempt, outcome incorrect, every judged tap in tap order, item bs|arpeggio|minor', async () => {
    const { app, container } = await arp();
    await tap(container, 4, 13);
    expect(live(app).length, 'nothing recorded after Step 1').toBe(0);
    await tap(container, 3, 12);
    expect(live(app).length, 'nothing recorded after Step 2').toBe(0);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    const list = live(app);
    expect(list.length, 'one attempt per arpeggio question, never one per step').toBe(1);
    const a = list[0]!;
    expect(a.drillType).toBe('arpeggio');
    expect(a.outcome, 'a missed step makes the question incorrect').toBe('incorrect');
    expect(a.answer.map(k), 'every judged tap, in tap order').toEqual(['4/13', '3/12', '2/11']);
    expect(a.itemKey).toBe('bs|arpeggio|minor');
  });

  it('all three steps correct: one attempt, outcome correct, answer 4/13, 3/11, 2/11', async () => {
    const { app, container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 11);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    expect(live(app).map((a) => [a.outcome, a.answer.map(k).join(' '), a.itemKey])).toEqual([['correct', '4/13 3/11 2/11', 'bs|arpeggio|minor']]);
  });

  it('Step 1 missed (B4 2/12), then F#4 and A#4: one attempt, incorrect, answer 2/12, 3/11, 2/11', async () => {
    const { app, container } = await arp();
    await tap(container, 2, 12);
    await tap(container, 3, 11);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    expect(live(app).map((a) => [a.outcome, a.answer.map(k).join(' ')])).toEqual([['incorrect', '2/12 3/11 2/11']]);
  });

  it('two questions answered: exactly two attempts, one per question', async () => {
    const { app, container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await tap(container, 2, 11);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); });
    await tap(container, 4, 13);
    await tap(container, 3, 11);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThanOrEqual(2));
    await settle();
    expect(live(app).map((a) => a.outcome)).toEqual(['incorrect', 'correct']);
  });
});

describe('FR-041 weighting counts one attempt per multi-step question; a miss if any step was missed', () => {
  it('one question with Step 2 missed: history {attempts 1, misses 1}, R9 weight 3 (not {3, 1}, weight 2.2)', async () => {
    const { app, container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThan(0));
    await settle();
    const h = historiesFrom(live(app)).get('bs|arpeggio|minor');
    expect(h).toEqual({ attempts: 1, misses: 1 });
    expect(r9(h!.attempts, h!.misses)).toBeCloseTo(3, 12);
  });

  it('a missed question then a clean one: history {2, 1}, R9 weight 2.5 (per step would be {6, 1})', async () => {
    const { app, container } = await arp();
    await tap(container, 4, 13);
    await tap(container, 3, 12);
    await tap(container, 2, 11);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Continue' })); });
    await tap(container, 4, 13);
    await tap(container, 3, 11);
    await tap(container, 2, 11);
    await waitFor(() => expect(live(app).length).toBeGreaterThanOrEqual(2));
    await settle();
    const h = historiesFrom(live(app)).get('bs|arpeggio|minor');
    expect(h).toEqual({ attempts: 2, misses: 1 });
    expect(r9(h!.attempts, h!.misses)).toBeCloseTo(2.5, 12);
  });
});
