/**
 * Spec change (red, test-first) [FR-042, FR-040]. spec.md FR-042 (product-owner 2026-11-22,
 * provisional): "Counts are of recorded attempts (FR-040). Each item group names its unit:
 * "questions" for every drill except walking-bass ("notes") and chord-tone lock ("chords"), e.g. "18
 * of 24 questions correct". A total across groups, if shown, uses "answers" (one answer = one recorded
 * attempt). Typical time is shown per item group only and is never pooled across drill types."
 *
 * Reading used here: the per-drill-type card is the item group (its unit depends on the drill type,
 * which only the card has). Attempts are recorded through the real app (recordAttempt) from
 * hand-built questions; expected counts and medians are worked out by hand below.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import type { AnsweredQuestion } from '../../domain/drills/session';
import { DRILL_LABELS, type Question } from '../../domain/drills/types';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
const norm = (s: string | null | undefined) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const STD = presetById('guitar6-standard')!.profile;
const R = { string: 5, fret: 3 };

const Q: Record<string, Question> = {
  'note-finding': { drillType: 'note-finding', itemKey: `nf|${STD.geometryId}|5|0`, prompt: { drillType: 'note-finding', pitchClass: 0, string: 5, midi: null }, text: 'Find C on string 5', steps: [], reference: [], group: 'String 5' } as unknown as Question,
  arpeggio: { drillType: 'arpeggio', itemKey: 'bs|arpeggio|min7', prompt: { drillType: 'arpeggio', root: R, qualityId: 'min7' }, text: 'Am7', steps: [], reference: [], group: 'Minor 7th' } as unknown as Question,
  'walking-bass': { drillType: 'walking-bass', itemKey: 'bs|walking-bass|maj7', prompt: { drillType: 'walking-bass', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'maj7' }] }, text: 'Walk', steps: [], reference: [], group: 'Cmaj7' } as unknown as Question,
  'chord-tone-lock': { drillType: 'chord-tone-lock', itemKey: 'bs|chord-tone-lock|maj7', prompt: { drillType: 'chord-tone-lock', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'maj7' }] }, text: 'Lock', steps: [], reference: [], group: 'Cmaj7' } as unknown as Question,
};
const ans = (type: string, correct: boolean, responseMs: number): AnsweredQuestion => ({ question: Q[type]!, taps: [{ string: 5, fret: 3 }], correct, responseMs });

async function appWith(list: [string, boolean, number][]) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, idsWith('f4200001'), sha256);
  await app.bootstrap();
  await app.addPreset('guitar6-standard');
  const instrumentId = app.activeInstrument()!.id;
  for (const [type, ok, ms] of list) await app.recordAttempt(ans(type, ok, ms), { instrumentId, profile: STD });
  return app;
}
async function show(app: FretSenseApp) {
  const r = render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
  const all = screen.queryByRole('radio', { name: 'All time' });
  if (all) await act(async () => { fireEvent.click(all); });
  return r;
}
/** The card (item group) for a drill type: the section that holds its heading. */
function card(type: keyof typeof DRILL_LABELS): HTMLElement {
  const h = screen.getByRole('heading', { name: DRILL_LABELS[type] });
  return (h.closest('section') ?? h.parentElement)!;
}

afterEach(() => cleanup());

describe('FR-042 each item group names its unit', () => {
  // note-finding 2 of 3, arpeggio 2 of 2, walking-bass 3 of 4 notes, chord-tone lock 1 of 2 chords.
  const LIST: [string, boolean, number][] = [
    ['note-finding', true, 900], ['note-finding', true, 900], ['note-finding', false, 900],
    ['arpeggio', true, 900], ['arpeggio', true, 900],
    ['walking-bass', true, 900], ['walking-bass', true, 900], ['walking-bass', true, 900], ['walking-bass', false, 900],
    ['chord-tone-lock', true, 900], ['chord-tone-lock', false, 900],
  ];

  it.each([
    ['note-finding', '2 of 3 questions correct'],
    ['arpeggio', '2 of 2 questions correct'],
    ['walking-bass', '3 of 4 notes correct'],
    ['chord-tone-lock', '1 of 2 chords correct'],
  ] as const)('%s: "%s"', async (type, sentence) => {
    await show(await appWith(LIST));
    const t = norm(card(type).textContent);
    expect(t).toContain(sentence);
    expect(t, 'a group never counts "answers"').not.toMatch(/\bof \d+ answers correct\b/);
  });

  it('a total across groups, if shown, uses "answers" and counts every recorded attempt (8 of 11 answers correct)', async () => {
    const { container } = await show(await appWith(LIST));
    const cards = new Set((['note-finding', 'arpeggio', 'walking-bass', 'chord-tone-lock'] as const).map(card));
    const outside = [...container.querySelectorAll<HTMLElement>('p, span, div, li, h2, h3')]
      .filter((el) => el.children.length === 0 && ![...cards].some((c) => c.contains(el)))
      .map((el) => norm(el.textContent))
      .filter((t) => /\b\d+ of \d+ \w+ correct\b/.test(t));
    for (const t of outside) expect(t).toMatch(/\b8 of 11 answers correct\b/);
  });
});

describe('FR-042 typical time is per item group only, never pooled across drill types', () => {
  // note-finding 1000, 2000 ms → median 1.5 s; arpeggio 6000, 8000 ms → 7.0 s;
  // pooled 1000, 2000, 6000, 8000 → (2000 + 6000) / 2 = 4.0 s, which must appear nowhere.
  const LIST: [string, boolean, number][] = [['note-finding', true, 1000], ['note-finding', true, 2000], ['arpeggio', true, 6000], ['arpeggio', true, 8000]];

  it('each card shows its own median', async () => {
    await show(await appWith(LIST));
    // textContent joins elements without spaces ("1.5 sWeakest"), so no trailing \b.
    expect(norm(card('note-finding').textContent)).toMatch(/(?<![\d.])1\.5 s/);
    expect(norm(card('arpeggio').textContent)).toMatch(/(?<![\d.])7\.0 s/);
  });

  it('the pooled median (4.0 s) is shown nowhere', async () => {
    const { container } = await show(await appWith(LIST));
    expect(norm(container.textContent)).not.toMatch(/(?<![\d.])4\.0 s/);
  });
});
