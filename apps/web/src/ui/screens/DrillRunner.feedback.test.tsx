/**
 * T091/T093 code-reviewer r1 (MAJOR), red tests: DrillRunner feedback and the chord-tone window
 * [FR-049, FR-036, FR-032a, FR-032].
 *
 * Spec wording used as the expected values:
 *  - FR-049: feedback in drills other than any-octave note-finding includes the octave:
 *    "Correct, G2 on string 6 fret 3"; incorrect feedback starts "Incorrect. You tapped <note> at
 *    string S fret F; " (CR-B2-15: "incorrect feedback names the tapped note and its position first").
 *  - FR-036 / acceptance scenario US5-3: "a G outside the window is incorrect, with the reason
 *    "Outside frets 5 to 8"". The window is the question's own window, stated in the prompt
 *    ("..., frets 5 to 8").
 *  - FR-036: "Positions inside it carry "inside window" in their accessible name. The window's
 *    edges are drawn with a line or pattern"; FR-032a: "for example "String 6, fret 3, inside window"".
 *  - theory-checker r1: an interval question has no `context`; reference F3 (string 4 fret 3), m3 up,
 *    tap string 3 fret 1 => "Correct, Ab3 on string 3 fret 1", never G#.
 *
 * Positions and octaves are recomputed by brute force:
 *   MIDI = 12 * (octave + 1) + letter + accidental + fret; Bb octave = (MIDI - 10) / 12 - 1.
 * Runs the real FretSenseApp over memoryRepository(); the generator's seed is random, so the
 * test reads the question's window from the prompt and brute-forces everything else.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { presetById, presets, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import type { DrillSettings } from '../../domain/drills/types';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { DrillRunner } from './DrillRunner';

// ---- render helpers (copied from ProgressScreen.test.tsx) ----
const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(prefix: string) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}
function renderRunner(app: FretSenseApp, profile: InstrumentProfile, settings: DrillSettings) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter><DrillRunner profile={profile} instrumentId={null} settings={settings} onExit={vi.fn()} /></MemoryRouter>
    </AppContext.Provider>,
  );
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const ascii = (s: string) => s.replace(/𝄫/gu, 'bb').replace(/𝄪/gu, '##').replace(/♭/g, 'b').replace(/♯/g, '#');

// ---- brute force ----
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const midiAt = (p: InstrumentProfile, pos: FretPosition) => openMidi(p, pos.string) + pos.fret;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

// ---- DOM helpers ----
const LABEL = /^String (\d+)\b[^,]*, (?:fret (\d+)|open)/;
function positionButtons(container: HTMLElement) {
  return [...container.querySelectorAll<SVGGElement>('[role="button"][aria-label]')]
    .map((el) => {
      const m = LABEL.exec(el.getAttribute('aria-label') ?? '');
      return m ? { el, pos: { string: Number(m[1]), fret: m[2] === undefined ? 0 : Number(m[2]) }, label: el.getAttribute('aria-label')! } : undefined;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
function tap(container: HTMLElement, pos: FretPosition) {
  const b = positionButtons(container).find((x) => x.pos.string === pos.string && x.pos.fret === pos.fret);
  if (!b) throw new Error(`no fretboard position for string ${pos.string} fret ${pos.fret}`);
  act(() => { fireEvent.click(b.el); });
}
/** The visible feedback text, without the decorative icon and the Continue button. */
function feedbackText(container: HTMLElement): string {
  const box = container.querySelector('.feedback');
  if (!box) return '';
  const clone = box.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"], button').forEach((n) => n.remove());
  return ascii(norm(clone.textContent));
}
function promptWindow(container: HTMLElement): [number, number] {
  const h = container.querySelector('#prompt');
  const m = /frets (\d+) to (\d+)/.exec(norm(h?.textContent));
  if (!m) throw new Error(`prompt states no window: "${norm(h?.textContent)}"`);
  return [Number(m[1]), Number(m[2])];
}

const chordTone = (p: InstrumentProfile): DrillSettings => ({
  type: 'chord-tone', strings: allStrings(p), fromFret: 1, toFret: Math.min(12, p.fretCount), count: 5, octaveMode: 'any',
  roots: ['G'], qualities: ['minor'], functions: ['b3'],
});
/** Brute force: every Bb (pitch class 10) position on the profile inside frets [from, to]. */
function bbPositions(p: InstrumentProfile, from: number, to: number): FretPosition[] {
  const out: FretPosition[] = [];
  for (const s of allStrings(p)) for (let f = from; f <= to; f++) if (midiAt(p, { string: s, fret: f }) % 12 === 10) out.push({ string: s, fret: f });
  return out;
}

const profiles = presets().map((pr) => [pr.presetId, pr.profile] as const);

// =============================================================================================
describe.each(profiles)('DrillRunner chord-tone feedback, %s (all InstrumentProfiles)', (id, p) => {
  it('FR-049: a correct tap inside the window shows "Correct, Bb<letter octave> on string S fret F"', async () => {
    const app = await makeApp('a2a2a2a2');
    const { container } = renderRunner(app, p, chordTone(p));
    const [x, y] = promptWindow(container);
    const inside = bbPositions(p, x, y);
    expect(inside.length, `${id}: window ${x}-${y} holds a Bb`).toBeGreaterThan(0);
    const pos = inside[0]!;
    const oct = (midiAt(p, pos) - 10) / 12 - 1; // Bb: letter B (11) + accidental -1 = 10
    tap(container, pos);
    const t = feedbackText(container);
    expect(t.startsWith('Correct, '), t).toBe(true);
    expect(t).toBe(`Correct, Bb${oct} on string ${pos.string} fret ${pos.fret}`);
  });

  it('FR-036: a correct tone tapped outside the question\'s window is incorrect with the reason "Outside frets X to Y"', async () => {
    const app = await makeApp('b2b2b2b2');
    const { container } = renderRunner(app, p, chordTone(p));
    const [x, y] = promptWindow(container);
    const outside = bbPositions(p, 1, Math.min(12, p.fretCount)).filter((q) => q.fret < x || q.fret > y);
    if (!outside.length) return; // no Bb outside this window on this profile (brute force)
    tap(container, outside[0]!);
    const t = feedbackText(container);
    // spec FR-049 (CR-B2-15): "incorrect feedback names the tapped note and its position first"; the tap is a Bb (chord spelling).
    expect(t.startsWith(`Incorrect. You tapped Bb`) && t.includes(` at string ${outside[0]!.string} fret ${outside[0]!.fret}; `), t).toBe(true);
    expect(t).toContain(`Outside frets ${x} to ${y}`);
  });

  it('FR-036 / FR-032a: positions inside the question\'s window (not the whole fret range) carry "inside window"', async () => {
    const app = await makeApp('c2c2c2c2');
    const { container } = renderRunner(app, p, chordTone(p));
    const [x, y] = promptWindow(container);
    const buttons = positionButtons(container);
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      const inside = b.pos.fret >= x && b.pos.fret <= y;
      if (inside) expect(b.label, `window ${x}-${y}`).toContain('inside window');
      else expect(b.label, `window ${x}-${y}`).not.toContain('inside window');
    }
  });

  it('FR-036: the drawn window spans the question\'s window (frets X to Y), not the settings range', async () => {
    const app = await makeApp('d2d2d2d2');
    const { container } = renderRunner(app, p, chordTone(p));
    const [x, y] = promptWindow(container);
    const rect = container.querySelector('.fb-window');
    expect(rect, 'window is drawn').toBeTruthy();
    const left = Number(rect!.getAttribute('x'));
    const right = left + Number(rect!.getAttribute('width'));
    // Fret wires strictly inside the drawn window: frets X..Y are Y - X + 1 cells, so Y - X wires between them.
    const wires = [...container.querySelectorAll('.fb-fret')].map((l) => Number(l.getAttribute('x1')));
    const interior = wires.filter((w) => w > left + 0.5 && w < right - 0.5).length;
    expect(interior).toBe(y - x);
  });
});

// =============================================================================================
describe('FR-049 / FR-032 interval feedback without a chord context keeps the step spelling', () => {
  it('reference F3 (string 4 fret 3), m3 up, tap string 3 fret 1: "Correct, Ab3 on string 3 fret 1", never G#', async () => {
    const std6 = presetById('guitar6-standard')!.profile;
    expect(midiAt(std6, { string: 4, fret: 3 })).toBe(53); // F3
    expect(midiAt(std6, { string: 3, fret: 1 })).toBe(56); // Ab3 = 12*4 + 9 - 1
    const app = await makeApp('e2e2e2e2');
    // Strings 4 and 3, frets 1-3: F3 is the only reference with a m3 above in range.
    const s: DrillSettings = { type: 'interval', strings: [4, 3], fromFret: 1, toFret: 3, count: 5, octaveMode: 'any', intervals: ['m3'], direction: 'up' };
    const { container } = renderRunner(app, std6, s);
    tap(container, { string: 3, fret: 1 });
    const t = feedbackText(container);
    expect(t).toBe('Correct, Ab3 on string 3 fret 1');
    expect(t).not.toContain('G#');
  });
});
