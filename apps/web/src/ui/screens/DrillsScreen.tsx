import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CHORDS, PC_FLAT, PC_SHARP, pretty } from '../common';
import { DRILL_TYPES, type DrillType } from '../../domain/records';
import { DRILL_LABELS, type DrillSettings } from '../../domain/drills/types';
import { validateSettings, intervalName } from '../../domain/drills/generate';
import { InstrumentGate } from '../InstrumentGate';
import { useAppState } from '../hooks';
import { DrillRunner, stringName } from './DrillRunner';
import { InstrumentSwitcher } from './GearScreen';
import type { InstrumentProfile } from '@fretsense/theory';
import { NotFound } from './NotFound';

const BLURB: Record<DrillType, string> = {
  'note-finding': 'A note name appears. Find it on the string shown.',
  interval: 'Start from a marked note and find the interval above or below it.',
  'chord-tone': 'Find the 3rd, 5th or 7th of a named chord anywhere in the window.',
  'bass-root-fifth-octave': 'From a root, tap the 5th and then the octave: the core bass shape.',
  'bass-arpeggio': 'Play a chord’s tones in order, up one octave from the root.',
  'bass-walking': 'Build a walking line, one bar per chord: root, chord tones, then a note that leads into the next chord.',
  'bass-octave-shapes': 'From a root, find the octave above it across the strings.',
};

export function DrillsHome() {
  const s = useAppState();
  return (
    <div className="page">
      <h1>Drills</h1>
      <p className="lede">Short sessions of 5 to 100 questions. Tap the fretboard to answer. Every drill works on any instrument in My Gear.</p>
      <div className="drill-grid">
        {SHIPPED.map((t) => (
          <Link key={t} to={`/drills/${t}`} className="drill-card">
            <strong>{DRILL_LABELS[t]}</strong>
            <span>{BLURB[t]}</span>
            {t.startsWith('bass') && <span className="tag">Bass pattern</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** FN-7 (provisional): the simplified walking-bass drill is hidden until full FR-058 ships. */
const SHIPPED = DRILL_TYPES.filter((t) => t !== 'bass-walking');
const TYPE_SET = new Set<string>(SHIPPED);

export function DrillScreen() {
  const { type } = useParams();
  if (!type || !TYPE_SET.has(type)) return <NotFound />;
  return <InstrumentGate>{(inst) => <DrillSetup key={inst.id + type} type={type as DrillType} profile={inst.profile} instrumentId={inst.id} />}</InstrumentGate>;
}

export function defaultSettings(type: DrillType, p: InstrumentProfile, octaveMode: 'any' | 'exact'): DrillSettings {
  const all = Array.from({ length: p.stringCount }, (_, i) => i + 1);
  return {
    type,
    strings: all,
    fromFret: 0,
    toFret: Math.min(12, p.fretCount),
    count: 20,
    octaveMode,
    intervals: ['m3', 'M3', 'P4', 'P5'],
    direction: 'up',
    roots: ['C', 'G', 'D', 'A', 'E', 'F'],
    qualities: type === 'chord-tone' ? ['major', 'minor', 'dom7'] : ['major', 'minor'],
    key: { tonic: 'C', mode: 'major' },
    chords: [{ root: 'C', quality: 'maj7' }, { root: 'A', quality: 'min7' }, { root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }],
  };
}

function DrillSetup({ type, profile, instrumentId }: { type: DrillType; profile: InstrumentProfile; instrumentId: string }) {
  const st = useAppState();
  const [s, setS] = useState<DrillSettings>(() => defaultSettings(type, profile, st.settings!.octaveMode));
  const [running, setRunning] = useState(false);
  const v = validateSettings(profile, s);
  const set = (p: Partial<DrillSettings>) => setS((x) => ({ ...x, ...p }));
  const toggle = <T,>(list: readonly T[] | undefined, x: T) => (list ?? []).includes(x) ? (list ?? []).filter((y) => y !== x) : [...(list ?? []), x];

  if (running) return <div className="page"><DrillRunner profile={profile} instrumentId={instrumentId} settings={s} onExit={() => setRunning(false)} /></div>;

  return (
    <div className="page">
      <div className="explore-head"><h1>{DRILL_LABELS[type]}</h1><InstrumentSwitcher /></div>
      <p className="lede">{BLURB[type]}</p>
      <form className="card form setup" onSubmit={(e) => { e.preventDefault(); if (v.ok) setRunning(true); }}>
        <fieldset className="inline"><legend>Strings</legend>
          {Array.from({ length: profile.stringCount }, (_, i) => i + 1).map((n) => (
            <label key={n} className="chip"><input type="checkbox" checked={s.strings.includes(n)} onChange={() => set({ strings: toggle(s.strings, n).sort() })} /> {stringName(profile, n)}</label>
          ))}
        </fieldset>
        <div className="inline">
          <label>From fret <input type="number" min={0} max={profile.fretCount} value={s.fromFret} onChange={(e) => set({ fromFret: Math.max(0, Math.min(profile.fretCount, +e.target.value)) })} /></label>
          <label>to fret <input type="number" min={0} max={profile.fretCount} value={s.toFret} onChange={(e) => set({ toFret: Math.max(0, Math.min(profile.fretCount, +e.target.value)) })} /></label>
          <label>Questions <input type="number" min={5} max={100} value={s.count} onChange={(e) => set({ count: +e.target.value })} /></label>
        </div>
        {type === 'note-finding' && (
          <>
            <fieldset className="inline"><legend>Notes</legend>
              {PC_SHARP.map((n, pc) => (
                <label key={pc} className="chip"><input type="checkbox" checked={!s.notes?.length || s.notes.includes(pc)} onChange={() => set({ notes: toggle(s.notes?.length ? s.notes : PC_SHARP.map((_, i) => i), pc) })} /> {pretty(n === PC_FLAT[pc] ? n : `${n}/${PC_FLAT[pc]}`)}</label>
              ))}
            </fieldset>
            <fieldset className="inline"><legend>Octave</legend>
              <label><input type="radio" checked={s.octaveMode === 'any'} onChange={() => set({ octaveMode: 'any' })} /> Any octave on the string</label>
              <label><input type="radio" checked={s.octaveMode === 'exact'} onChange={() => set({ octaveMode: 'exact' })} /> Exact octave (e.g. C4)</label>
            </fieldset>
          </>
        )}
        {type === 'interval' && (
          <>
            <fieldset className="inline"><legend>Intervals</legend>
              {['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'].map((i) => (
                <label key={i} className="chip"><input type="checkbox" checked={s.intervals?.includes(i) ?? false} onChange={() => set({ intervals: toggle(s.intervals, i) })} /> {intervalName(i)}</label>
              ))}
            </fieldset>
            <fieldset className="inline"><legend>Direction</legend>
              {(['up', 'down', 'both'] as const).map((d) => <label key={d}><input type="radio" checked={s.direction === d} onChange={() => set({ direction: d })} /> {d === 'up' ? 'Above' : d === 'down' ? 'Below' : 'Both'}</label>)}
            </fieldset>
          </>
        )}
        {(type === 'chord-tone' || type === 'bass-arpeggio' || type === 'bass-root-fifth-octave') && (
          <fieldset className="inline"><legend>Chord types</legend>
            {CHORDS.filter((c) => c.id !== 'add9').map((c) => (
              <label key={c.id} className="chip"><input type="checkbox" checked={s.qualities?.includes(c.id) ?? false} onChange={() => set({ qualities: toggle(s.qualities, c.id) })} /> {c.name}</label>
            ))}
          </fieldset>
        )}
        {type === 'chord-tone' && (
          <fieldset className="inline"><legend>Chord roots</legend>
            {PC_FLAT.map((n) => <label key={n} className="chip"><input type="checkbox" checked={s.roots?.includes(n) ?? false} onChange={() => set({ roots: toggle(s.roots, n) })} /> {pretty(n)}</label>)}
          </fieldset>
        )}
        {type === 'bass-walking' && (
          <p className="muted">Progression: {s.chords?.map((c) => `${pretty(c.root)}${CHORDS.find((q) => q.id === c.quality)?.symbolSuffix ?? ''}`).join(' → ')} in {s.key?.tonic} {s.key?.mode}. Each chord is one bar of four beats.</p>
        )}
        {!v.ok && <p className="field-error" role="alert">{v.reason}</p>}
        <button className="primary big" type="submit" disabled={!v.ok}>Start drill</button>
      </form>
    </div>
  );
}
