/**
 * T100b follow-up (red, test-first) [FR-056, FR-056a, FR-057, FR-040]: root–fifth–octave US6
 * scenarios 5–13, as the user sees them in the drill, and the one attempt each question records.
 *
 * Spec text used for the expected values (spec.md, product-owner 2026-11-22, provisional;
 * Clarifications "test-writer T100b gaps"):
 *  - FR-056: "A tap's role is fixed when every valid shape containing it and every accepted or
 *    revealed position gives it the same role; it is fixed at once when only one role is possible.
 *    Until then it is **placed**: the position shows a "placed" marker (visible "R/8", accessible-name
 *    suffix ", placed, root or octave"), the announcement is "<note> placed on string N fret F: root
 *    or octave, set by your next note", and Steps 1 and 3 stay pending." ... "Only positions inside
 *    the fret range are drawn as targets, so no out-of-range reason exists."
 *  - FR-056a: "If a placed tap exists when a wrong tap arrives, it is resolved first: the reveal shape
 *    is chosen (preferring shapes in which the placed tap is the root, then the reveal order below),
 *    the placed tap takes its role in that shape and is marked correct, and the wrong tap is then
 *    charged by the rules here to the steps still pending. A revealed position is never a position the
 *    user has already tapped." ... "(if several fit, the first in this order: lowest-pitched root;
 *    then root at the lower fret, then on the higher string number; then the same two tests for the
 *    5th's position, then for the octave's)" ... "The question is recorded as one attempt (FR-040) when
 *    its last step is judged: outcome correct only if no step was missed; answer positions are every
 *    judged tap in tap order" ... "A tap on a position already tapped or revealed in this question is
 *    ignored (not judged, charged or recorded); it is announced "String N, fret F is already in this
 *    answer" (or "… was already marked wrong")."
 *  - FR-057: "Step 2 5th (visible "5", spoken and written "5th"), Step 3 octave (visible "8", spoken
 *    and written "octave")"; final feedback "Correct, <chord> root–fifth–octave shape" or "Incorrect.
 *    N of M steps correct. Missed: …".
 *  - FR-040: "root–fifth–octave (one attempt per question, however many taps or steps it took,
 *    FR-056a)".
 *  - US6 scenarios 5–13 (quoted on each test).
 *
 * Independent sources only. MIDI = 12·(octave + 1) + letter + accidental from each preset's open
 * strings, plus the fret. Valid shapes are brute-forced over every position triple; roles are
 * brute-forced from those shapes; the FR-056a reveal order is a separate sort over the brute-forced
 * shapes, written from the spec sentence above (not from the implementation).
 *
 * Brute-forced facts (checked in the first describe):
 *  - Shared fixture (US6-5..12): 4-string EADG (E1 A1 D2 G2 = 28 33 38 43), strings 1–3, frets 0–17,
 *    root C: exactly two shapes, S1 = C2 3/3, G2 2/5, C3 1/5 and S4 = C3 3/15, G3 2/17, C4 1/17. No
 *    root-pitch-class position here has two possible roles, so nothing is ever "placed".
 *  - US6-13: 5-string BEADG (B0 E1 A1 D2 G2 = 23 28 33 38 43), all strings, frets 0–12: C2 3/3 is the
 *    root of {3/3, 2/5, 1/5} and the octave of {5/1, 4/3, 3/3}.
 *  - Reveal order: 6-string Standard, all strings, frets 5–17: the lowest-pitched root C3 6/8 is at a
 *    higher fret than C4 3/5 (pitch beats fret), and from 6/8 the 5th 4/5 beats 5/10 (lower fret).
 *    4-string EADG, all strings, frets 0–12: roots C2 3/3 and C2 4/8 tie on pitch (lower fret wins:
 *    3/3); from root 4/8 the 5th 2/5 beats 3/10. DADGAD, all strings, frets 0–12: root C3 5/3 and 5th
 *    G3 4/5 leave two octaves, 2/3 and 3/5 (lower fret wins: 2/3). The "higher string number"
 *    tie-break needs one pitch at one fret on two strings (unison open strings), which no preset has.
 *
 * The drill has no root setting, so each test tries Date.now = 1, 2, 3, ... (DrillRunner's seed) until
 * the first question is for C; the expected values do not depend on the seed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { presetById, presets, type InstrumentProfile, type Note } from '@fretsense/theory';
import { allPositions, installLayoutMock, liveRegions, norm, positionEl } from '../__tests__/layout-mock';
import { renderDrill } from '../__tests__/drill-harness';
import type { DrillSettings } from '../../domain/drills/types';

// ---- independent pitch arithmetic and brute force -------------------------------------------
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const octaveOf = (m: number) => Math.floor(m / 12) - 1;
type Pos = { string: number; fret: number };
type MPos = Pos & { midi: number };
const k = (x: Pos) => `${x.string}/${x.fret}`;
const P = (string: number, fret: number): Pos => ({ string, fret });
const prof = (id: string) => presetById(id)!.profile;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

function area(p: InstrumentProfile, strings: readonly number[], from: number, to: number): MPos[] {
  return strings.flatMap((s) => Array.from({ length: to - from + 1 }, (_, i) => ({ string: s, fret: from + i, midi: openMidi(p, s) + from + i })));
}
type Shape = { r: MPos; f: MPos; o: MPos };
/** FR-056 valid shapes for root pitch class 0 (C), brute-forced over every position triple. */
function shapes(p: InstrumentProfile, strings: readonly number[], from: number, to: number): Shape[] {
  const A = area(p, strings, from, to);
  const out: Shape[] = [];
  for (const r of A) if (pcOf(r.midi) === 0) for (const f of A) if (f.midi === r.midi + 7) for (const o of A) if (o.midi === r.midi + 12) {
    const fr = [r.fret, f.fret, o.fret];
    if (Math.max(...fr) - Math.min(...fr) <= 3) out.push({ r, f, o });
  }
  return out;
}
const has = (s: Shape, x: Pos) => [s.r, s.f, s.o].some((y) => y.string === x.string && y.fret === x.fret);
/** Every role pos can take in a shape that also holds every fixed position. */
function roles(all: Shape[], pos: Pos, fixed: Pos[] = []): string[] {
  const out = new Set<string>();
  for (const s of all) {
    if (!has(s, pos) || !fixed.every((x) => has(s, x))) continue;
    if (k(s.r) === k(pos)) out.add('root');
    if (k(s.f) === k(pos)) out.add('5th');
    if (k(s.o) === k(pos)) out.add('octave');
  }
  return [...out].sort();
}
/** FR-056a reveal order, written from the spec sentence: the first shape after this sort. */
function revealOrder(all: Shape[]): Shape[] {
  const cmp = (a: MPos, b: MPos) => a.fret - b.fret || b.string - a.string; // lower fret, then higher string number
  return [...all].sort((a, b) => a.r.midi - b.r.midi || cmp(a.r, b.r) || cmp(a.f, b.f) || cmp(a.o, b.o));
}
const name = (m: number) => `${['C', '', '', '', '', '', '', 'G'][pcOf(m)]}${octaveOf(m)}`;
const missedText = (word: string, x: MPos) => `${word} ${name(x.midi)} at string ${x.string} fret ${x.fret}`;

// ---- DOM helpers -----------------------------------------------------------------------------
const ascii = (s: string | null | undefined) => norm((s ?? '').replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##'));
function indicators(c: HTMLElement): { el: HTMLElement; name: string; text: string }[] {
  const list = c.querySelector('[aria-label="Steps"]') ?? c.querySelector('ol.steps');
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('li')].map((el) => ({ el, name: ascii(el.getAttribute('aria-label') ?? el.textContent), text: ascii(el.textContent) }));
}
const names = (c: HTMLElement) => indicators(c).map((x) => x.name);
const st = (a: string, b: string, c: string) => [`Step 1, root, ${a}`, `Step 2, 5th, ${b}`, `Step 3, octave, ${c}`];
const line = (c: HTMLElement) => ascii(c.querySelector('.feedback')?.textContent).replace(/^[✓✕✗×]\s*/u, '');
const missedParts = (c: HTMLElement) => (/Missed: (.*?)\.?$/.exec(line(c))?.[1] ?? '').split(/;\s*/).filter(Boolean).sort();
const label = (c: HTMLElement, s: number, f: number) => ascii(positionEl(c, s, f)?.getAttribute('aria-label'));
const tap = async (c: HTMLElement, s: number, f: number) => {
  const el = positionEl(c, s, f);
  expect(el, `position string ${s} fret ${f}`).toBeTruthy();
  await act(async () => { fireEvent.click(el!); });
};
const reasonShown = (c: HTMLElement, s: number, f: number, reason: string) =>
  label(c, s, f).includes(reason) || ascii(c.textContent).includes(reason);
/** Text of every live region that is not aria-live="off". */
const announced = (c: HTMLElement) => liveRegions(c).filter((r) => r.politeness !== 'off').map((r) => ascii(r.el.textContent)).join(' | ');
const continueButton = () => screen.queryByRole('button', { name: 'Continue' });
const FIT = "Doesn't fit the shape (more than 3 frets apart or wrong octave)";

type S = Partial<DrillSettings> & Pick<DrillSettings, 'strings'>;
async function startC(presetId: string, s: S) {
  const now = vi.spyOn(Date, 'now');
  for (let t = 1; t <= 300; t++) {
    now.mockReturnValue(t);
    const r = await renderDrill(presetId, s);
    if (/shape for C(?![#b])/.test(ascii(r.container.querySelector('#prompt')?.textContent))) return r;
    cleanup();
  }
  throw new Error(`no root-fifth-octave question for C on ${presetId} in 300 seeds`);
}
type App = Awaited<ReturnType<typeof renderDrill>>['app'];
const attempts = (app: App) => app.getState().attempts.filter((a) => !a.deleted);
async function oneAttempt(app: App) {
  await waitFor(() => expect(attempts(app).length).toBeGreaterThan(0));
  const list = attempts(app);
  expect(list.length, 'FR-040: exactly one attempt per root–fifth–octave question').toBe(1);
  return list[0]!;
}

const BASS4 = 'bass4-standard';
const BASS5 = 'bass5-beadg';
const FIX: S = { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 17, qualities: ['major'], adaptive: false } as S;
const B5: S = { type: 'root-fifth-octave', strings: [1, 2, 3, 4, 5], fromFret: 0, toFret: 12, qualities: ['major'] };

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// =============================================================================================
describe('FR-056 brute-force preconditions for US6 scenarios 5–13', () => {
  const b4 = prof(BASS4);
  const b5 = prof(BASS5);
  const fix = shapes(b4, [1, 2, 3], 0, 17);

  it('shared fixture: exactly S1 (C2 3/3, G2 2/5, C3 1/5) and S4 (C3 3/15, G3 2/17, C4 1/17)', () => {
    expect(fix.map(({ r, f, o }) => [k(r), r.midi, k(f), f.midi, k(o), o.midi])).toEqual([
      ['3/3', 36, '2/5', 43, '1/5', 48],
      ['3/15', 48, '2/17', 55, '1/17', 60],
    ]);
  });
  it('shared fixture: the tapped positions of scenarios 5–12 and their roles', () => {
    const m = (x: Pos) => openMidi(b4, x.string) + x.fret;
    expect([P(2, 7), P(1, 0), P(2, 10), P(1, 17), P(3, 15)].map(m)).toEqual([45, 43, 48, 60, 48]); // A2, G2, C3, C4, C3
    expect(roles(fix, P(1, 5))).toEqual(['octave']); // US6-5: octave at once, never placed
    expect(roles(fix, P(3, 3))).toEqual(['root']);
    expect(roles(fix, P(3, 15))).toEqual(['root']); // US6-6
    expect(roles(fix, P(1, 17), [P(3, 3)])).toEqual([]); // US6-7: no shape with C2 3/3
    expect(roles(fix, P(1, 0))).toEqual([]); // US6-9: G2 open is in no shape
    expect(roles(fix, P(2, 10))).toEqual([]); // US6-10: C3 2/10 is in no shape
    expect(roles(fix, P(3, 15), [P(3, 3)])).toEqual([]); // US6-8 follow-up: S4 is out once 3/3 is fixed
    expect(revealOrder(fix)[0]!.r).toMatchObject({ string: 3, fret: 3 }); // US6-8: lowest-pitched root
  });
  it('US6-13: on 5-string BEADG, frets 0–12, C2 3/3 can be the root or the octave; G2 2/5 fixes root, G1 4/3 fixes octave; a revealed C1 5/1 fixes octave', () => {
    const all = shapes(b5, [1, 2, 3, 4, 5], 0, 12);
    expect(roles(all, P(3, 3))).toEqual(['octave', 'root']);
    expect(roles(all, P(3, 3), [P(2, 5)])).toEqual(['root']);
    expect(roles(all, P(3, 3), [P(4, 3)])).toEqual(['octave']);
    expect(roles(all, P(3, 3), [P(5, 1)])).toEqual(['octave']);
    expect(roles(all, P(2, 10), [P(3, 3)])).toEqual([]); // the wrong tap of (c)
    // Root-preferred resolution of a placed 3/3: the only shape with 3/3 as root is {3/3, 2/5, 1/5}.
    expect(all.filter((s) => k(s.r) === '3/3').map((s) => [k(s.f), k(s.o)])).toEqual([['2/5', '1/5']]);
    // With nothing fixed, the reveal order starts at the lowest-pitched root C1 5/1.
    expect(k(revealOrder(all)[0]!.r)).toBe('5/1');
    expect(openMidi(b5, 1) + 1).toBe(44); // G#2 at string 1 fret 1: neither C nor G
  });
  it('reveal order fixtures: pitch beats fret; lower fret for root, 5th and octave', () => {
    const g6 = shapes(prof('guitar6-standard'), [1, 2, 3, 4, 5, 6], 5, 17);
    const g6first = revealOrder(g6)[0]!;
    expect([k(g6first.r), g6first.r.midi, k(g6first.f), k(g6first.o)]).toEqual(['6/8', 48, '4/5', '3/5']);
    expect(g6.some((s) => s.r.fret < g6first.r.fret), 'a higher root sits at a lower fret').toBe(true);
    expect(g6.filter((s) => k(s.r) === '6/8').map((s) => k(s.f)).sort()).toEqual(['4/5', '5/10']);

    const b4all = shapes(b4, [1, 2, 3, 4], 0, 12);
    expect(b4all.filter((s) => s.r.midi === 36).map((s) => k(s.r)).sort()).toEqual(['3/3', '4/8', '4/8']);
    expect(k(revealOrder(b4all)[0]!.r)).toBe('3/3');
    expect(roles(b4all, P(4, 8))).toEqual(['root']);
    expect(b4all.filter((s) => k(s.r) === '4/8').map((s) => [k(s.f), k(s.o)]).sort()).toEqual([['2/5', '1/5'], ['3/10', '2/10']]);
    expect(openMidi(b4, 3) + 5).toBe(38); // D2 at string 3 fret 5: neither C nor G

    const dd = shapes(prof('guitar6-dadgad'), [1, 2, 3, 4, 5, 6], 0, 12);
    expect(roles(dd, P(5, 3))).toEqual(['root']);
    expect(dd.filter((s) => k(s.r) === '5/3' && k(s.f) === '4/5').map((s) => k(s.o)).sort()).toEqual(['2/3', '3/5']);
  });
});

// =============================================================================================
describe('US6 scenarios 5–12 (4-string EADG, strings 1–3, frets 0–17)', () => {
  it('US6-5: C3 1/5, G2 2/5, C2 3/3 → Step 3 ✓ at once (no "placed"), then Step 2, then Step 1; "Correct, C root–fifth–octave shape"; one correct attempt for (root-fifth-octave, C)', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('pending', 'pending', 'correct'));
    expect(label(container, 1, 5)).not.toMatch(/\bplaced\b/);
    expect(positionEl(container, 1, 5)?.textContent ?? '').not.toContain('R/8');
    await tap(container, 2, 5);
    expect(names(container)).toEqual(st('pending', 'correct', 'correct'));
    expect(attempts(app).length, 'no attempt before the last step').toBe(0);
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('correct', 'correct', 'correct'));
    expect(container.querySelector('.feedback.ok')).toBeTruthy();
    expect(line(container)).toMatch(/^Correct, C root–fifth–octave shape\.?$/);
    const a = await oneAttempt(app);
    expect(a.drillType).toBe('root-fifth-octave');
    expect(a.itemKey).toBe('rfo|0');
    expect(a.outcome).toBe('correct');
    expect(a.answer.map(k)).toEqual(['1/5', '2/5', '3/3']);
  });

  it('US6-6: C3 3/15, C4 1/17, G3 2/17 → Steps 1, 3 and 2 ✓ in that order; correct', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 3, 15);
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    await tap(container, 1, 17);
    expect(names(container)).toEqual(st('correct', 'pending', 'correct'));
    await tap(container, 2, 17);
    expect(names(container)).toEqual(st('correct', 'correct', 'correct'));
    expect(line(container)).toMatch(/^Correct, C root–fifth–octave shape\.?$/);
    expect((await oneAttempt(app)).outcome).toBe('correct');
  });

  it('US6-7: C2 3/3, C4 1/17 (wrong), G2 2/5 → "Doesn\'t fit …" at 1/17; Step 3 missed; "Incorrect. 2 of 3 steps correct. Missed: octave C3 at string 1 fret 5."; one incorrect attempt', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    await tap(container, 1, 17);
    expect(reasonShown(container, 1, 17, FIT), ascii(container.textContent)).toBe(true);
    expect(names(container)).toEqual(st('correct', 'pending', 'missed'));
    expect(continueButton()).toBeNull();
    expect(attempts(app).length).toBe(0);
    await tap(container, 2, 5);
    expect(names(container)).toEqual(st('correct', 'correct', 'missed'));
    expect(container.querySelector('.feedback.bad')).toBeTruthy();
    expect(line(container)).toMatch(/^Incorrect\. 2 of 3 steps correct\. Missed: octave C3 at string 1 fret 5\.?$/);
    expect(announced(container)).toContain('Missed: octave C3 at string 1 fret 5');
    const a = await oneAttempt(app);
    expect(a.outcome).toBe('incorrect');
    expect(a.answer.map(k), 'every judged tap in tap order').toEqual(['3/3', '1/17', '2/5']);
  });

  it('US6-8: A2 2/7 first → "Not C or G", Step 1 missed, C2 3/3 revealed and fixed: C3 3/15 (S4\'s root) then no longer fits', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 2, 7);
    expect(reasonShown(container, 2, 7, 'Not C or G')).toBe(true);
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 3, 15); // root pitch class, no shape with the revealed 3/3 → lowest pending of 1 and 3 = Step 3
    expect(reasonShown(container, 3, 15, FIT)).toBe(true);
    expect(names(container)).toEqual(st('missed', 'pending', 'missed'));
    await tap(container, 2, 5);
    expect(names(container)).toEqual(st('missed', 'correct', 'missed'));
    expect(missedParts(container)).toEqual(['octave C3 at string 1 fret 5', 'root C2 at string 3 fret 3']);
    expect(line(container)).toMatch(/^Incorrect\. 1 of 3 steps correct\. Missed: /);
    expect((await oneAttempt(app)).outcome).toBe('incorrect');
  });

  it('US6-9: G2 1/0 first → "Doesn\'t fit …", Step 2 missed, G2 2/5 revealed; missed list says "5th"', async () => {
    const { container } = await startC(BASS4, FIX);
    await tap(container, 1, 0);
    expect(reasonShown(container, 1, 0, FIT)).toBe(true);
    expect(names(container)).toEqual(st('pending', 'missed', 'pending'));
    await tap(container, 3, 3);
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('correct', 'missed', 'correct'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5']);
    expect(announced(container)).toContain('Missed: 5th G2 at string 2 fret 5');
  });

  it('US6-10: C3 2/10 first → "Doesn\'t fit …" charged to Step 1; Step 1 missed, C2 3/3 revealed', async () => {
    const { container } = await startC(BASS4, FIX);
    await tap(container, 2, 10);
    expect(reasonShown(container, 2, 10, FIT)).toBe(true);
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('missed', 'correct', 'correct'));
    expect(missedParts(container)).toEqual(['root C2 at string 3 fret 3']);
  });

  it('US6-11: C2 3/3 twice → the second tap is not judged, charged or recorded; announced "String 3, fret 3 is already in this answer"', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 3, 3);
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    expect(announced(container)).toContain('String 3, fret 3 is already in this answer');
    expect(label(container, 3, 3)).not.toMatch(/\b(wrong|incorrect|missed)\b/i);
    expect(continueButton()).toBeNull();
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    const a = await oneAttempt(app);
    expect(a.outcome, 'the ignored repeat is not charged').toBe('correct');
    expect(a.answer.map(k), 'the ignored repeat is not recorded').toEqual(['3/3', '2/5', '1/5']);
  });

  it('FR-056a repeats: a wrong position again → "String 2, fret 7 was already marked wrong"; a revealed position → "String 3, fret 3 is already in this answer"; neither is judged or recorded', async () => {
    const { app, container } = await startC(BASS4, FIX);
    await tap(container, 2, 7); // Not C or G → Step 1 missed, 3/3 revealed
    await tap(container, 2, 7);
    expect(announced(container)).toContain('String 2, fret 7 was already marked wrong');
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 3, 3); // revealed
    expect(announced(container)).toContain('String 3, fret 3 is already in this answer');
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 2, 5);
    await tap(container, 1, 5);
    const a = await oneAttempt(app);
    expect(a.answer.map(k)).toEqual(['2/7', '2/5', '1/5']);
    expect(a.outcome).toBe('incorrect');
  });

  it.each([
    ['US6-5 order', [P(1, 5), P(2, 5), P(3, 3)], 'correct'],
    ['US6-6 order', [P(3, 15), P(1, 17), P(2, 17)], 'correct'],
    ['US6-7 order', [P(3, 3), P(1, 17), P(2, 5)], 'incorrect'],
    ['US6-8, three wrong taps (A2 2/7, C3 3/15, G3 2/17)', [P(2, 7), P(3, 15), P(2, 17)], 'incorrect'],
    ['US6-9 order', [P(1, 0), P(3, 3), P(1, 5)], 'incorrect'],
  ] as const)('US6-12 / FR-040: %s → exactly one attempt for the question, never one per step', async (_n, taps, outcome) => {
    const { app, container } = await startC(BASS4, FIX);
    for (const [i, t] of taps.entries()) {
      await tap(container, t.string, t.fret);
      if (i < taps.length - 1) expect(attempts(app).length, `after tap ${i + 1}`).toBe(0);
    }
    const a = await oneAttempt(app);
    expect(a.outcome).toBe(outcome);
    expect(a.answer.map(k)).toEqual(taps.map(k));
    // Settle any late writes, then check again: still one.
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(attempts(app).length).toBe(1);
  });
});

// =============================================================================================
describe('US6 scenario 13: "placed" on 5-string BEADG, all strings, frets 0–12', () => {
  const placedName = /, placed, root or octave$/;

  it('C2 3/3 shows as placed: visible "R/8", accessible suffix ", placed, root or octave", announced; Steps 1 and 3 stay pending with no ✓', async () => {
    const { container } = await startC(BASS5, B5);
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('pending', 'pending', 'pending'));
    for (const x of indicators(container)) expect(x.el.textContent).not.toMatch(/✓/);
    expect(label(container, 3, 3), label(container, 3, 3)).toMatch(placedName);
    expect(positionEl(container, 3, 3)?.textContent ?? '').toContain('R/8');
    expect(announced(container)).toContain('C2 placed on string 3 fret 3: root or octave, set by your next note');
  });

  it('(a) then G2 2/5 → C2 is the root: Step 1 ✓ and Step 2 ✓; the placed marker is gone', async () => {
    const { container } = await startC(BASS5, B5);
    await tap(container, 3, 3);
    await tap(container, 2, 5);
    expect(names(container)).toEqual(st('correct', 'correct', 'pending'));
    expect(label(container, 3, 3)).not.toMatch(/\bplaced\b/);
  });

  it('(b) then G1 4/3 → C2 is the octave: Step 3 ✓ and Step 2 ✓; C1 5/1 then completes the shape', async () => {
    const { app, container } = await startC(BASS5, B5);
    await tap(container, 3, 3);
    await tap(container, 4, 3);
    expect(names(container)).toEqual(st('pending', 'correct', 'correct'));
    expect(label(container, 3, 3)).not.toMatch(/\bplaced\b/);
    await tap(container, 5, 1);
    expect(names(container)).toEqual(st('correct', 'correct', 'correct'));
    expect((await oneAttempt(app)).outcome).toBe('correct');
  });

  it('(c) then the wrong C3 2/10 → the placed tap is resolved first as the root (Step 1 ✓); 2/10 is flagged "Doesn\'t fit …"; Step 3 missed and C3 1/5 revealed (never 3/3)', async () => {
    const { app, container } = await startC(BASS5, B5);
    await tap(container, 3, 3);
    await tap(container, 2, 10);
    expect(names(container)).toEqual(st('correct', 'pending', 'missed'));
    expect(reasonShown(container, 2, 10, FIT)).toBe(true);
    expect(label(container, 3, 3)).not.toMatch(/\bplaced\b/);
    await tap(container, 2, 5);
    expect(names(container)).toEqual(st('correct', 'correct', 'missed'));
    expect(missedParts(container)).toEqual(['octave C3 at string 1 fret 5']);
    const a = await oneAttempt(app);
    expect(a.outcome).toBe('incorrect');
    expect(a.answer.map(k)).toEqual(['3/3', '2/10', '2/5']);
  });

  it('FR-056a: a "Not C or G" tap while 3/3 is placed also resolves it as the root first; the wrong tap then goes to Step 2 (lowest pending), revealed at G2 2/5', async () => {
    const { container } = await startC(BASS5, B5);
    await tap(container, 3, 3);
    await tap(container, 1, 1); // G#2: neither
    expect(reasonShown(container, 1, 1, 'Not C or G')).toBe(true);
    expect(names(container)).toEqual(st('correct', 'missed', 'pending'));
    await tap(container, 1, 5);
    expect(names(container)).toEqual(st('correct', 'missed', 'correct'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5']);
  });

  it('FR-056: a revealed position fixes the role: "Not C or G" reveals C1 5/1 (lowest-pitched root), so C2 3/3 is the octave at once, never placed', async () => {
    const { container } = await startC(BASS5, B5);
    await tap(container, 1, 1); // G#2 → Step 1 missed, C1 5/1 revealed
    expect(names(container)).toEqual(st('missed', 'pending', 'pending'));
    await tap(container, 3, 3);
    expect(names(container)).toEqual(st('missed', 'pending', 'correct'));
    expect(label(container, 3, 3)).not.toMatch(/\bplaced\b/);
    expect(positionEl(container, 3, 3)?.textContent ?? '').not.toContain('R/8');
    expect(announced(container)).not.toContain('placed on string 3 fret 3');
    await tap(container, 4, 3);
    expect(names(container)).toEqual(st('missed', 'correct', 'correct'));
    expect(missedParts(container)).toEqual(['root C1 at string 5 fret 1']);
  });
});

// =============================================================================================
describe('FR-056a reveal tie-break order (independent sort over brute-forced shapes)', () => {
  /** Taps three "Not C or G" positions so that every step is revealed, then reads the missed list. */
  async function revealAll(presetId: string, s: S) {
    const p = prof(presetId);
    const wrong = area(p, s.strings, Math.max(1, s.fromFret ?? 0), s.toFret ?? 12).filter((x) => pcOf(x.midi) !== 0 && pcOf(x.midi) !== 7).slice(0, 3);
    const { container } = await startC(presetId, s);
    for (const w of wrong) {
      await tap(container, w.string, w.fret);
      expect(reasonShown(container, w.string, w.fret, 'Not C or G')).toBe(true);
    }
    expect(names(container)).toEqual(st('missed', 'missed', 'missed'));
    return missedParts(container);
  }
  const expectedAll = (sh: Shape) => [missedText('root', sh.r), missedText('5th', sh.f), missedText('octave', sh.o)].sort();

  it('pitch beats fret, then the 5th at the lower fret (6-string Standard, all strings, frets 5–17): root C3 6/8, 5th G3 4/5, octave C4 3/5', async () => {
    const s: S = { type: 'root-fifth-octave', strings: [1, 2, 3, 4, 5, 6], fromFret: 5, toFret: 17, qualities: ['major'] };
    expect(await revealAll('guitar6-standard', s)).toEqual(['5th G3 at string 4 fret 5', 'octave C4 at string 3 fret 5', 'root C3 at string 6 fret 8']);
  });

  it('equal-pitch roots: the lower fret (4-string EADG, all strings, frets 0–12): root C2 3/3, not 4/8', async () => {
    const s: S = { type: 'root-fifth-octave', strings: [1, 2, 3, 4], fromFret: 0, toFret: 12, qualities: ['major'] };
    expect(await revealAll(BASS4, s)).toEqual(['5th G2 at string 2 fret 5', 'octave C3 at string 1 fret 5', 'root C2 at string 3 fret 3']);
  });

  it('5th tie from a tapped root (4-string EADG, all strings, frets 0–12): C2 4/8, then D2 3/5 reveals the 5th at 2/5 (not 3/10); C3 2/10 then no longer fits and 1/5 is revealed', async () => {
    const { container } = await startC(BASS4, { type: 'root-fifth-octave', strings: [1, 2, 3, 4], fromFret: 0, toFret: 12, qualities: ['major'] });
    await tap(container, 4, 8);
    expect(names(container)).toEqual(st('correct', 'pending', 'pending'));
    await tap(container, 3, 5);
    expect(names(container)).toEqual(st('correct', 'missed', 'pending'));
    await tap(container, 2, 10);
    expect(reasonShown(container, 2, 10, FIT)).toBe(true);
    expect(names(container)).toEqual(st('correct', 'missed', 'missed'));
    expect(missedParts(container)).toEqual(['5th G2 at string 2 fret 5', 'octave C3 at string 1 fret 5']);
  });

  it('octave tie (DADGAD, all strings, frets 0–12): C3 5/3 and G3 4/5, then a "Not C or G" tap reveals the octave at 2/3 (not 3/5)', async () => {
    const p = prof('guitar6-dadgad');
    const wrong = area(p, [1], 1, 12).find((x) => pcOf(x.midi) !== 0 && pcOf(x.midi) !== 7)!;
    const { container } = await startC('guitar6-dadgad', { type: 'root-fifth-octave', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12, qualities: ['major'] });
    await tap(container, 5, 3);
    await tap(container, 4, 5);
    expect(names(container)).toEqual(st('correct', 'correct', 'pending'));
    await tap(container, wrong.string, wrong.fret);
    expect(names(container)).toEqual(st('correct', 'correct', 'missed'));
    expect(missedParts(container)).toEqual(['octave C4 at string 2 fret 3']);
  });

  describe.each(presets().map((p) => [p.presetId, p.profile] as const))('%s, all strings, frets 0–12', (id, p) => {
    it('three "Not C or G" taps reveal the first shape of the FR-056a order', async () => {
      const strings = allStrings(p);
      const top = Math.min(12, p.fretCount);
      const all = shapes(p, strings, 0, top);
      expect(all.length, 'brute force: some C shape exists').toBeGreaterThan(0);
      const first = revealOrder(all)[0]!;
      expect(await revealAll(id, { type: 'root-fifth-octave', strings, fromFret: 0, toFret: top, qualities: ['major'] })).toEqual(expectedAll(first));
    });
  });
});

// =============================================================================================
describe('FR-056 no out-of-range reason: only positions inside the fret range are drawn as targets', () => {
  it('4-string EADG, strings 1–3, frets 0–12: no target past fret 12, so C3 3/15 cannot be tapped; a wrong tap never says "Outside frets"', async () => {
    const { container } = await startC(BASS4, { type: 'root-fifth-octave', strings: [1, 2, 3], fromFret: 0, toFret: 12, qualities: ['major'] });
    expect(positionEl(container, 3, 15)).toBeUndefined();
    const frets = allPositions(container).map((el) => /^String \d+, (?:open|fret (\d+))/.exec(el.getAttribute('aria-label') ?? '')).map((m) => (m?.[1] ? Number(m[1]) : 0));
    expect(frets.length).toBeGreaterThan(0);
    expect(Math.max(...frets)).toBeLessThanOrEqual(12);
    await tap(container, 2, 10); // C3: wrong (no shape), charged to Step 1
    await tap(container, 1, 9); // E3: neither
    await tap(container, 1, 12); // G3: wrong
    expect(ascii(container.textContent)).not.toMatch(/Outside frets/);
    expect(names(container)).toEqual(st('missed', 'missed', 'missed'));
  });
});

// =============================================================================================
describe('FR-057 the 5th is spoken and written "5th" (visible "5")', () => {
  it.each(presets().map((p) => [p.presetId, p.profile] as const))('%s: indicators read "Step 2, 5th, pending" and show R, 5, 8', async (id, p) => {
    const { container } = await renderDrill(id, { type: 'root-fifth-octave', strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), qualities: ['major'] });
    expect(names(container)).toEqual(st('pending', 'pending', 'pending'));
    expect(indicators(container).map((x) => x.text)).toEqual(['R', '5', '8']);
  });
});
