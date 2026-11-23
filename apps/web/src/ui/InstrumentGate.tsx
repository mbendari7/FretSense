import type { ReactNode } from 'react';
import { presets } from '@fretsense/theory';
import { Link } from 'react-router';
import type { InstrumentRecord } from '../domain/records';
import { useApp, useAppState } from './hooks';

/**
 * FR-053: screens that need an instrument show the picker first; nothing is assumed.
 * FR-048: the picker's heading is an h2; a gate that is the whole route passes `title`, the
 * route's one h1, so the route keeps exactly one h1 while the picker shows.
 */
export function InstrumentGate({ children, title }: { children: (inst: InstrumentRecord) => ReactNode; title?: string }) {
  const app = useApp();
  useAppState();
  const inst = app.activeInstrument() ?? app.liveInstruments()[0];
  if (inst) return <>{children(inst)}</>;
  if (title) return <div className="page"><h1>{title}</h1><InstrumentPicker /></div>;
  return <InstrumentPicker />;
}

export function InstrumentPicker() {
  const app = useApp();
  const s = useAppState();
  const left = s.settings?.display.handedness === 'left';
  return (
    <section className="picker" aria-labelledby="picker-h">
      <h2 id="picker-h">What do you play?</h2>
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
