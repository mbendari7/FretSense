/**
 * FR-027 (red, test-first): a lesson's drill launches with its own parameters.
 *
 * spec.md FR-027: "Drill MUST list and launch the lesson's drills with their parameters."
 *
 * The parameters are read from the lesson file itself (content/lessons/sharps-and-flats.md, drill
 * `in-between-notes`: `notes: [Db, Eb, F#, Ab, Bb]`), not from the app, so the expected values are
 * the content author's. The drill is launched through the real route
 * `/lessons/:lessonId/drill/:drillId` (toSettings is not exported).
 *
 * Expected values: every prompted note ("Find <note> on string N") must be one of those 5 pitch
 * classes (pc 1, 3, 6, 8, 10), computed here by brute force from letter + accidental. A second test
 * also requires the prompt to use the lesson's own spellings (Db, never C#; F#, never Gb), because
 * the lesson parameter names the note that way. Date.now is fixed so the drill's seed is fixed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppContext } from '../hooks';
import { LessonScreen } from './LessonScreens';
import { allPositions, installLayoutMock, norm } from '../__tests__/layout-mock';
import { makeApp } from '../__tests__/drill-harness';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };
const pcOf = (name: string) => {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(name)!;
  return (((LETTER_PC[m[1]!]! + ACC[m[2] ?? '']!) % 12) + 12) % 12;
};

/** The lesson file's own `notes:` list for drill `in-between-notes`. */
function lessonNotes(): string[] {
  const md = readFileSync(resolve(__dirname, '../../../../../content/lessons/sharps-and-flats.md'), 'utf8');
  const block = /- id: in-between-notes[\s\S]*?notes: \[([^\]]*)\]/.exec(md);
  if (!block) throw new Error('sharps-and-flats.md: drill in-between-notes has no notes list');
  return block[1]!.split(',').map((x) => x.trim());
}

const SEEDS = [1, 2, 3];
let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function promptsFor(seed: number, count = 10): Promise<string[]> {
  const app = await makeApp('guitar6-standard');
  vi.spyOn(Date, 'now').mockReturnValue(seed);
  const { container } = render(
    <AppContext.Provider value={app}>
      <MemoryRouter initialEntries={['/lessons/sharps-and-flats/drill/in-between-notes']}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonScreen />} />
          <Route path="/lessons/:lessonId/drill/:drillId" element={<LessonScreen />} />
          <Route path="/lessons/:lessonId/:stage" element={<LessonScreen />} />
        </Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
  const out: string[] = [];
  for (let q = 0; q < count; q++) {
    const prompt = container.querySelector('#prompt');
    if (!prompt) break;
    const m = /Find ([A-G](?:bb|b|##|#)?)(?![#b])/.exec(norm(prompt.textContent));
    expect(m, `prompt "${norm(prompt.textContent)}" names no note`).toBeTruthy();
    out.push(m![1]!);
    // Tap positions until the question is judged (Continue shows; auto-advance is off).
    for (const el of allPositions(container)) {
      if (screen.queryByRole('button', { name: 'Continue' })) break;
      await act(async () => { fireEvent.click(el); });
    }
    const cont = screen.queryByRole('button', { name: 'Continue' });
    if (!cont) throw new Error(`question ${q + 1}: no Continue after tapping`);
    await act(async () => { fireEvent.click(cont); });
  }
  return out;
}

describe('FR-027 lesson drill "in-between-notes" (sharps-and-flats) launches with its notes', () => {
  it('precondition: the lesson asks for Db, Eb, F#, Ab, Bb (pitch classes 1, 3, 6, 8, 10)', () => {
    const notes = lessonNotes();
    expect(notes).toEqual(['Db', 'Eb', 'F#', 'Ab', 'Bb']);
    expect(notes.map(pcOf)).toEqual([1, 3, 6, 8, 10]);
  });

  it.each(SEEDS)('seed %i: every prompted note is one of the lesson\'s 5 pitch classes, never a natural', async (seed) => {
    const allowed = new Set(lessonNotes().map(pcOf));
    const prompts = await promptsFor(seed);
    expect(prompts.length, 'the drill showed no prompts').toBeGreaterThanOrEqual(5);
    for (const n of prompts) expect(allowed.has(pcOf(n)), `prompted "${n}" (pc ${pcOf(n)}) is not in the lesson's notes`).toBe(true);
  }, 20_000);

  it.each(SEEDS)('seed %i: every prompt uses the lesson\'s own spelling (Db Eb F# Ab Bb)', async (seed) => {
    const spelled = new Set(lessonNotes());
    const prompts = await promptsFor(seed);
    expect(prompts.length).toBeGreaterThanOrEqual(5);
    for (const n of prompts) expect(spelled.has(n), `prompted "${n}", not spelled as in the lesson`).toBe(true);
  }, 20_000);
});
