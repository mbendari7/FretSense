/** Test-only harness for T094: a real FretSenseApp over memoryRepository(), as in ProgressScreen.test.tsx. */
import { createHash } from 'node:crypto';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FretSenseApp } from '../../application/app';
import type { Hasher, IdGenerator } from '../../application/ports';
import { memoryRepository } from '../../infrastructure/idb';
import type { DrillSettings } from '../../domain/drills/types';
import { AppContext } from '../hooks';
import { DrillRunner } from '../screens/DrillRunner';

const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
let seq = 0;
const ids = (): IdGenerator => {
  const prefix = (++seq).toString(16).padStart(8, '0');
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};

export async function makeApp(presetId: string, autoAdvanceMs: 0 | 600 | 1500 = 0) {
  let t = Date.UTC(2026, 10, 22, 12);
  const app = new FretSenseApp(memoryRepository(), { now: () => (t += 1000) }, ids(), sha256);
  await app.bootstrap();
  await app.addPreset(presetId);
  await app.updateSettings({ autoAdvanceMs });
  return app;
}

export function drillSettings(s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'>): DrillSettings {
  return { type: 'note-finding', fromFret: 0, toFret: 12, count: 5, octaveMode: 'any', ...s };
}

export async function renderDrill(presetId: string, s: Partial<DrillSettings> & Pick<DrillSettings, 'strings'>, autoAdvanceMs: 0 | 600 | 1500 = 0) {
  const app = await makeApp(presetId, autoAdvanceMs);
  const inst = app.activeInstrument()!;
  const utils = render(
    <AppContext.Provider value={app}>
      <MemoryRouter>
        <DrillRunner profile={inst.profile} instrumentId={inst.id} settings={drillSettings(s)} onExit={() => undefined} />
      </MemoryRouter>
    </AppContext.Provider>,
  );
  return { app, ...utils };
}
