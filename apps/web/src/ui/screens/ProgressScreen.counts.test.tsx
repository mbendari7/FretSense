/**
 * T092/T093 code-reviewer r1 (MAJOR) and privacy-auditor r2, red tests: import preview count
 * sentences, the status after confirming, and Import disabled while it is written
 * [FR-066a, FR-043, FR-048].
 *
 * FR-066a: the preview "lists the added, restored, updated, hidden and unchanged counts ... Each
 * count has a plain sentence such as "12 answers you reset earlier will come back". Nothing is
 * written until the user confirms." If added, restored, updated and hidden are all 0, "confirming
 * writes nothing".
 *
 * CR-B2-14 (provisional, product-owner 2026-11-22), spec FR-066a: "Count sentences name record
 * kinds in plain words (e.g. "5 answers and 1 instrument will be added"). When the preview says "This
 * file has nothing new to import", its only action is "Close"." This replaces the earlier generic
 * "N records ..." sentences (spec quote above; the old expectations contradicted it).
 * Kind words: attempts are "answer(s)", instruments "instrument(s)"; lesson progress must mention
 * "lesson" (its exact noun is left to the implementer). No count sentence says "record".
 * Sentence tails (unchanged from the earlier pass, one element each, a zero count has none):
 *   added:     "<kinds> will be added"
 *   restored:  "<kinds> you reset or deleted earlier will come back"
 *   updated:   "<kinds> will be updated with newer changes from the file"
 *   hidden:    "<kinds> you reset or deleted elsewhere will be hidden"
 *   unchanged: "<kinds> is|are already up to date"
 * (A trailing full stop is allowed.)
 *
 * Expected counts are brute-forced from the scenario (what the file holds versus the target), not
 * read from the implementation. Render helpers copied from ProgressScreen.test.tsx.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { presetById } from '@fretsense/theory';
import { FretSenseApp, type ImportPreview } from '../../application/app';
import { generateQuestions } from '../../domain/drills/generate';
import type { AnsweredQuestion } from '../../domain/drills/session';
import { mulberry32 } from '../../domain/prng';
import type { Hasher, IdGenerator, Repository } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

// ---- helpers copied from ProgressScreen.test.tsx ----
const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(prefix: string, repo: Repository = memoryRepository()) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(repo, { now: () => (t += 1000) }, idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}
function renderWith(app: FretSenseApp) {
  return render(
    <AppContext.Provider value={app}>
      <MemoryRouter><ProgressScreen /></MemoryRouter>
    </AppContext.Provider>,
  );
}
async function chooseFile(container: HTMLElement, exp: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(exp)], 'backup.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// ---- sentences (CR-B2-14: plain record kinds) ----
type Kind = 'added' | 'restored' | 'updated' | 'hidden' | 'unchanged';
/** A phrase that identifies each kind's sentence whatever the number. */
const MARK: Record<Kind, RegExp> = {
  added: /will be added/,
  restored: /will come back/,
  updated: /will be updated/,
  hidden: /will be hidden/,
  unchanged: /already up to date/,
};
/** Expected sentence per kind: an exact string, or a predicate for lesson-progress wording. */
type Expect = string | ((t: string) => boolean);
const lessonSentence = (n: number, mark: RegExp): Expect => (t) => mark.test(t) && new RegExp(`\\b${n}\\b`).test(t) && /lesson/i.test(t) && !/\brecords?\b/i.test(t);
async function dialog(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeTruthy());
  return container.querySelector('[role="dialog"]') as HTMLElement;
}
/** Leaf-ish text elements of the dialog, normalised, without a trailing full stop. */
function sentences(d: HTMLElement): string[] {
  return [...d.querySelectorAll('p, li, span, div')]
    .filter((el) => el.children.length === 0)
    .map((el) => norm(el.textContent).replace(/\.$/, ''));
}
function expectCounts(d: HTMLElement, expected: Partial<Record<Kind, Expect>>) {
  const own = sentences(d);
  for (const k of Object.keys(MARK) as Kind[]) {
    const e = expected[k];
    const mine = own.filter((t) => MARK[k].test(t));
    if (e === undefined) { expect(norm(d.textContent), `no sentence for a zero ${k} count`).not.toMatch(MARK[k]); continue; }
    if (typeof e === 'string') expect(own, `own element for ${k} in: ${norm(d.textContent)}`).toContain(e);
    else expect(mine.some(e), `${k} sentence in: ${mine.join(' | ') || norm(d.textContent)}`).toBe(true);
    // spec FR-066a (CR-B2-14): "Count sentences name record kinds in plain words"
    for (const t of mine) expect(t, 'a count sentence names the kind, not "record"').not.toMatch(/\brecords?\b/i);
  }
  // The old one-line summary ("0 added, 1 restored, ...") never shows a zero count.
  expect(norm(d.textContent)).not.toMatch(/\b0 (added|restored|updated|hidden|unchanged)\b/);
}

// Attempts for the mixed-kind case (same construction as application/app.test.ts).
const std6 = presetById('guitar6-standard')!.profile;
const QS = (() => {
  const r = generateQuestions({ profile: std6, settings: { type: 'note-finding', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12, count: 20, octaveMode: 'any' }, rng: mulberry32(42), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
})();
const answered = (i: number): AnsweredQuestion => ({ question: QS[i]!, taps: [QS[i]!.steps[0]!.valid[0]!], correct: true, responseMs: 900 + i });

// =============================================================================================
describe('FR-066a (CR-B2-14) each non-zero count has its own plain sentence naming the record kinds; zero counts have none', () => {
  it('copy import of 5 answers and 1 instrument: "5 answers and 1 instrument will be added" (the spec example)', async () => {
    const src = await makeApp('a5a5a5a5');
    await src.addPreset('guitar6-standard');
    for (let i = 0; i < 5; i++) await src.recordAttempt(answered(i), { instrumentId: src.activeInstrument()!.id, profile: std6 });
    const dst = await makeApp('b5b5b5b5');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    expectCounts(await dialog(container), { added: '5 answers and 1 instrument will be added' });
  });

  it('copy import of a file with 2 instruments: "2 instruments will be added" only', async () => {
    const src = await makeApp('a3a3a3a3');
    await src.addPreset('guitar6-standard');
    await src.addPreset('bass4-standard');
    const dst = await makeApp('b3b3b3b3');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false)); // 2 live instruments, nothing else
    expectCounts(await dialog(container), { added: '2 instruments will be added' });
  });

  it('copy import of a file with 1 instrument: singular "1 instrument will be added"', async () => {
    const src = await makeApp('c3c3c3c3');
    await src.addPreset('guitar6-standard');
    const dst = await makeApp('d3d3d3d3');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false));
    expectCounts(await dialog(container), { added: '1 instrument will be added' });
  });

  it('export, reset, restore: lesson progress for 2 lessons "will come back"; "1 instrument is already up to date"', async () => {
    const app = await makeApp('e3e3e3e3');
    await app.addPreset('guitar6-standard');
    await app.markStage('lesson-a', 'read');
    await app.markStage('lesson-b', 'read');
    const exp = app.exportProfile(false); // 1 instrument + 2 live completions
    await app.resetProgress(); // the 2 completions are tombstoned; the instrument stays
    const { container } = renderWith(app);
    await chooseFile(container, exp);
    expectCounts(await dialog(container), { restored: lessonSentence(2, MARK.restored), unchanged: '1 instrument is already up to date' });
  });

  it('copy import adding a stage to a lesson the target already has: 1 lesson\'s progress "will be updated"', async () => {
    const src = await makeApp('f3f3f3f3');
    await src.markStage('lesson-a', 'read');
    await src.markStage('lesson-a', 'see');
    const dst = await makeApp('a4a4a4a4');
    await dst.markStage('lesson-a', 'read');
    const { container } = renderWith(dst);
    await chooseFile(container, src.exportProfile(false)); // per-stage union adds "see" (FR-066a)
    expectCounts(await dialog(container), { updated: lessonSentence(1, MARK.updated) });
  });

  it('restore of a newer reset made on another copy of this profile: 1 lesson\'s progress "will be hidden"', async () => {
    // Two app instances on one repository share the profile; B loads the live completion, then A resets it.
    const repo = memoryRepository();
    const a = await makeApp('b4b4b4b4', repo);
    await a.markStage('lesson-a', 'read');
    const b = await makeApp('b4b4b4b4', repo);
    expect(b.getState().profile!.id).toBe(a.getState().profile!.id);
    expect(b.getState().completion.filter((c) => !c.deleted)).toHaveLength(1);
    await a.resetProgress(); // incoming tombstone, newer than B's live copy
    const { container } = renderWith(b);
    await chooseFile(container, a.exportProfile(false));
    expectCounts(await dialog(container), { hidden: lessonSentence(1, MARK.hidden) });
  });
});

// =============================================================================================
describe('FR-066a (CR-B2-14) a nothing-new preview offers only "Close"', () => {
  // spec FR-066a (CR-B2-14): "When the preview says "This file has nothing new to import", its only action is "Close"."
  it('re-importing an unchanged export: the only button is "Close"; closing writes nothing and does not say "Import finished."', async () => {
    const app = await makeApp('c4c4c4c4');
    await app.addPreset('guitar6-standard');
    const before = { inst: app.getState().instruments.length, att: app.getState().attempts.length };
    const { container } = renderWith(app);
    await chooseFile(container, app.exportProfile(false));
    const d = await dialog(container);
    expect(norm(d.textContent)).toContain('This file has nothing new to import');
    expect([...d.querySelectorAll('button')].map((b) => norm(b.textContent))).toEqual(['Close']);
    await act(async () => { fireEvent.click([...d.querySelectorAll('button')][0]!); });
    await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
    expect(norm(screen.queryByRole('status')?.textContent)).not.toBe('Import finished.');
    expect({ inst: app.getState().instruments.length, att: app.getState().attempts.length }).toEqual(before);
  });
});

// =============================================================================================
describe('FR-043 / privacy-auditor r2: Import and "Apply settings" are disabled while the import is written', () => {
  it('a double click on Import calls apply() once; both controls are disabled until it settles', async () => {
    const app = await makeApp('d4d4d4d4');
    let release!: () => void;
    const apply = vi.fn(() => new Promise<void>((res) => { release = res; }));
    const stub: ImportPreview = { mode: 'copy', counts: { added: 3, restored: 0, updated: 0, hidden: 0, unchanged: 0 }, hasSettings: true, apply };
    vi.spyOn(app, 'previewImport').mockResolvedValue({ ok: true, preview: stub });
    const { container } = renderWith(app);
    await chooseFile(container, { any: 'file' });
    const d = await dialog(container);
    const importBtn = [...d.querySelectorAll('button')].find((b) => norm(b.textContent) === 'Import') as HTMLButtonElement;
    const settingsBox = d.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(importBtn.disabled).toBe(false);
    expect(settingsBox).toBeTruthy();

    await act(async () => { fireEvent.click(importBtn); });
    await act(async () => { fireEvent.click(importBtn); });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(importBtn.disabled, 'Import disabled while writing').toBe(true);
    expect(settingsBox.disabled, 'Apply settings disabled while writing').toBe(true);

    await act(async () => { release(); });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
