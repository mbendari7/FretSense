import type { ReactNode } from 'react';
import { presets } from '@fretsense/theory';
import { Link } from 'react-router';
import type { InstrumentRecord } from '../domain/records';
import { useApp, useAppState } from './hooks';

/** FR-053: screens that need an instrument show the picker first; nothing is assumed. */
export function InstrumentGate({ children }: { children: (inst: InstrumentRecord) => ReactNode }) {
  const app = useApp();
  useAppState();
  const inst = app.activeInstrument() ?? app.liveInstruments()[0];
  if (inst) return <>{children(inst)}</>;
  return <InstrumentPicker />;
}

export function InstrumentPicker() {
  const app = useApp();
  const s = useAppState();
  const left = s.settings?.display.handedness === 'left';
  return (
    <section className="picker" aria-labelledby="picker-h">
      <h1 id="picker-h">What do you play?</h1>
      <p className="lede">Pick your instrument and tuning. You can change it, or add more, in My Gear.</p>
      <div className="preset-grid">
        {presets().map((p) => (
          <button key={p.presetId} className="preset" onClick={() => void app.addPreset(p.presetId)}>
            <span className="preset-fam">{p.profile.stringCount}-string {p.profile.family}</span>
            <strong>{p.name.split(', ')[1]}</strong>
            <span className="preset-tuning">{p.profile.tuning.map((t) => t.letter + (t.accidental === -1 ? '♭' : t.accidental === 1 ? '♯' : '')).join(' ')}</span>
          </button>
        ))}
      </div>
      <label className="switch">
        <input type="checkbox" checked={left} onChange={(e) => void app.updateSettings({ display: { ...s.settings!.display, handedness: e.target.checked ? 'left' : 'right' } })} />
        Left-handed
      </label>
      <p><Link to="/gear/instruments?new=1">Set up a custom instrument instead</Link> (7- or 8-string, 6-string bass, other tunings)</p>
    </section>
  );
}
