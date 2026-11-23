/**
 * code-reviewer T091–T093 r3 MINOR #6 (red, test-first) [FR-042; Edge Cases "Empty progress";
 * T093a]: "A legacy-only profile shows a blank Progress page." Coordinator ruling (2026-11-22): such a
 * profile shows the Progress empty state.
 *
 * spec.md Edge Cases "Empty progress": "the progress view shows an empty state with one action,
 * "Start a note-finding drill", instead of empty charts or 0% figures." T093a clarification: legacy
 * attempts (v0.1 drills with no spec successor) are kept "for history and totals only, never a drill
 * or a weighting input", so they produce no drill-type group.
 *
 * Rig: a real FretSenseApp over memoryRepository(); one current-format legacy attempt (drillType
 * "legacy", itemKey lg|bass-octave-shapes|…) is written straight into the repository, then a second
 * app bootstraps from it, as after a migration on load.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import { payloadOf } from '../../domain/canonicalJson';
import { AppContext } from '../hooks';
import { ProgressScreen } from './ProgressScreen';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};

async function legacyOnlyApp() {
  const repo = memoryRepository();
  let t = Date.UTC(2026, 10, 22, 12);
  const clock = { now: () => (t += 1000) };
  const first = new FretSenseApp(repo, clock, idsWith('e6000001'), sha256);
  await first.bootstrap();
  const pid = first.getState().profile!.id;
  const h = first.exportProfile(false).exportedAt;
  const base = {
    id: 'e6000001-0000-4000-8000-0000000000ff', localProfileId: pid, created: h, updated: h, schemaVersion: 1 as const, deleted: false,
    drillType: 'legacy', instrumentId: null, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap',
    prompt: { drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root: { string: 4, fret: 3 }, qualityId: null },
    answer: [{ string: 4, fret: 3 }, { string: 2, fret: 5 }], outcome: 'correct', responseMs: 1500,
    timestamp: new Date(Date.UTC(2026, 10, 22, 11)).toISOString(), lessonId: null, drillId: null, itemKey: 'lg|bass-octave-shapes|none',
  };
  await repo.write([{ store: 'attempts', record: { ...base, payloadHash: sha(payloadOf(base)) } }] as never, (await repo.loadMeta())!);
  const app = new FretSenseApp(repo, clock, idsWith('e6000002'), sha256);
  await app.bootstrap();
  return app;
}

afterEach(() => cleanup());

describe('r3 #6: a profile whose only attempts are legacy shows the Progress empty state', () => {
  it('precondition: the profile has exactly one live attempt and it is legacy', async () => {
    const app = await legacyOnlyApp();
    expect(app.getState().attempts.filter((a) => !a.deleted).map((a) => a.drillType)).toEqual(['legacy']);
  });

  it('the empty state shows, with its one action "Start a note-finding drill"; no drill-type card', async () => {
    const app = await legacyOnlyApp();
    const { container } = render(<AppContext.Provider value={app}><MemoryRouter><ProgressScreen /></MemoryRouter></AppContext.Provider>);
    expect(screen.getByRole('link', { name: 'Start a note-finding drill' })).toBeTruthy();
    expect(container.querySelectorAll('.stat-card').length).toBe(0);
    expect(container.textContent ?? '').not.toMatch(/\b0%/);
  });
});
