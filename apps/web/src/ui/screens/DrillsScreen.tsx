import { useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CHORDS, PC_FLAT, pretty } from '../common';
import { DRILL_TYPES, type DrillType } from '../../domain/records';
import { DRILL_LABELS, type DrillSettings } from '../../domain/drills/types';
import { validateSettings, type SetupField, intervalName, stringChipName, CHORD_TONE_WINDOW_DEFAULT } from '../../domain/drills/generate';
import { InstrumentGate } from '../InstrumentGate';
import { useAppState } from '../hooks';
import { DrillRunner } from './DrillRunner';
import { WalkingBassRunner } from './WalkingBassRunner';
import { MAJOR_KEYS, builtInProgression } from '../../domain/drills/walkingBass';
import { chordSymbol, parsePitchClassNote } from '@fretsense/theory';
import { InstrumentSwitcher } from './GearScreen';
import type { InstrumentProfile } from '@fretsense/theory';
import { NotFound } from './NotFound';
import { prettyText } from '../markers';

const BLURB: Record<DrillType, string> = {
  'note-finding': 'A note name appears. Find it on the string shown.',
  interval: 'Start from a marked note and find the interval above or below it.',
  'chord-tone': 'Find the 3rd, 5th or 7th of a named chord anywhere in the window.',
  'root-fifth-octave': 'From a root, tap the 5th and then the octave: the core bass shape.',
  arpeggio: 'Play a chord’s tones in order, up one octave from the root.',
  'walking-bass': 'Build a walking line, one bar per chord: root, chord tones, then a note that leads into the next chord.',
  'chord-tone-lock': 'Play one chord tone per chord of a progression.',
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
            {BASS_PATTERNS.has(t) && <span className="tag">Bass pattern</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** T098 (owner 2026-11-25, FN-7 "Build it now"): every drill type ships, walking bass included. */
const SHIPPED = DRILL_TYPES;
const BASS_PATTERNS = new Set<DrillType>(['root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock']);
const TYPE_SET = new Set<string>(SHIPPED);

export function DrillScreen() {
  const { type } = useParams();
  if (!type || !TYPE_SET.has(type)) return <NotFound />;
  return <InstrumentGate title={DRILL_LABELS[type as DrillType]}>{(inst) => <DrillSetup key={inst.id + type} type={type as DrillType} profile={inst.profile} instrumentId={inst.id} instrumentName={inst.name} />}</InstrumentGate>;
}

/** FR-031 note sets, labelled for learners with the technical term as secondary text. */
const NOTE_SETS = [
  { id: 'naturals', label: 'Letters only (A–G)', detail: 'naturals' },
  { id: 'sharps', label: 'Letters and sharps', detail: 'naturals + C♯ D♯ F♯ G♯ A♯' },
  { id: 'flats', label: 'Letters and flats', detail: 'naturals + D♭ E♭ G♭ A♭ B♭' },
  { id: 'all', label: 'All spellings', detail: '17 spellings' },
] as const;

export function defaultSettings(type: DrillType, p: InstrumentProfile, octaveMode: 'any' | 'exact'): DrillSettings {
  const all = Array.from({ length: p.stringCount }, (_, i) => i + 1);
  return {
    type,
    strings: all,
    fromFret: 0,
    toFret: Math.min(12, p.fretCount),
    count: 20,
    octaveMode,
    ...(type === 'note-finding' ? { noteSet: 'naturals' as const } : {}),
    intervals: ['M2', 'm3', 'M3', 'P4', 'P5', 'P8'], // FR-035 defaults
    direction: 'up',
    roots: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], // FR-036 defaults
    qualities: type === 'chord-tone' ? ['major', 'minor', 'dom7'] : ['major', 'minor'],
    // FR-058: outside a lesson, the built-in | I | vi | ii | V | triads in a chosen major key (default C).
    key: { tonic: 'C', mode: 'major' },
  };
}

function DrillSetup({ type, profile, instrumentId, instrumentName }: { type: DrillType; profile: InstrumentProfile; instrumentId: string; instrumentName: string }) {
  const st = useAppState();
  const switcher = useRef<HTMLSelectElement>(null);
  const [search] = useSearchParams();
  // CR-B3-5: "Try Chord-tone lock first" carries the key as ?key=<tonic>; only the 15 major keys are accepted.
  const keyParam = search.get('key');
  const [s, setS] = useState<DrillSettings>(() => {
    const d = defaultSettings(type, profile, st.settings!.octaveMode);
    return keyParam && (MAJOR_KEYS as readonly string[]).includes(keyParam) ? { ...d, key: { tonic: keyParam, mode: 'major' } } : d;
  });
  const [running, setRunning] = useState(false);
  const v = validateSettings(profile, s);
  // FR-048 (T109): the setup error is linked to the field it is about and announced.
  const errId = useId();
  const errField = v.ok ? undefined : v.field;
  const err = (f: SetupField) => (errField === f ? { 'aria-invalid': true as const, 'aria-describedby': errId } : {});
  const set = (p: Partial<DrillSettings>) => setS((x) => ({ ...x, ...p }));
  const toggle = <T,>(list: readonly T[] | undefined, x: T) => (list ?? []).includes(x) ? (list ?? []).filter((y) => y !== x) : [...(list ?? []), x];

  if (running && type === 'walking-bass') return <div className="page"><WalkingBassRunner profile={profile} instrumentId={instrumentId} settings={s} title={DRILL_LABELS[type]} onExit={() => setRunning(false)} /></div>;
  if (running) return <div className="page"><DrillRunner profile={profile} instrumentId={instrumentId} settings={s} title={DRILL_LABELS[type]} onExit={() => setRunning(false)} /></div>;

  return (
    <div className="page">
      <div className="explore-head"><h1>{DRILL_LABELS[type]}</h1><InstrumentSwitcher selectRef={switcher} /></div>
      <p className="lede">{BLURB[type]}</p>
      <form className="card form setup" onSubmit={(e) => { e.preventDefault(); if (v.ok) setRunning(true); }}>
        {/* FR-031: the active instrument, above the string chips; Change opens the switcher (FR-016). */}
        <p className="setup-inst">
          <span>Instrument: <strong>{instrumentName}</strong></span>{' '}
          <button type="button" className="link" onClick={() => switcher.current?.focus()}>Change</button>
        </p>
        <fieldset className="inline" aria-describedby={errField === 'strings' ? errId : undefined}><legend>Strings</legend>
          {Array.from({ length: profile.stringCount }, (_, i) => i + 1).map((n) => (
            <label key={n} className="chip"><input type="checkbox" checked={s.strings.includes(n)} onChange={() => set({ strings: toggle(s.strings, n).sort() })} /> {prettyText(stringChipName(profile, n))}</label>
          ))}
        </fieldset>
        <div className="inline">
          <label>From fret <input type="number" {...err('frets')} min={0} max={profile.fretCount} value={s.fromFret} onChange={(e) => set({ fromFret: Math.max(0, Math.min(profile.fretCount, +e.target.value)) })} /></label>
          <label>to fret <input type="number" {...err('frets')} min={0} max={profile.fretCount} value={s.toFret} onChange={(e) => set({ toFret: Math.max(0, Math.min(profile.fretCount, +e.target.value)) })} /></label>
          {type !== 'walking-bass' && <label>Questions <input type="number" {...err('count')} min={5} max={100} value={s.count} onChange={(e) => set({ count: +e.target.value })} /></label>}
        </div>
        {type === 'note-finding' && (
          <>
            <fieldset><legend>Notes</legend>
              {NOTE_SETS.map((ns) => (
                <label key={ns.id} className="radio-row">
                  <input type="radio" name="note-set" checked={(s.noteSet ?? 'naturals') === ns.id} onChange={() => set({ noteSet: ns.id, notes: undefined })} />
                  <span className="radio-text">{ns.label} <span className="muted">{ns.detail}</span></span>
                </label>
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
              {['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'].map((i) => (
                <label key={i} className="chip"><input type="checkbox" checked={s.intervals?.includes(i) ?? false} onChange={() => set({ intervals: toggle(s.intervals, i) })} /> {intervalName(i)}</label>
              ))}
            </fieldset>
            <fieldset className="inline"><legend>Direction</legend>
              {(['up', 'down', 'both'] as const).map((d) => <label key={d}><input type="radio" checked={s.direction === d} onChange={() => set({ direction: d })} /> {d === 'up' ? 'Above' : d === 'down' ? 'Below' : 'Both'}</label>)}
            </fieldset>
          </>
        )}
        {(type === 'chord-tone' || type === 'arpeggio' || type === 'root-fifth-octave') && (
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
        {type === 'chord-tone' && (
          <label>Window width <input type="number" min={1} max={Math.max(1, s.toFret - s.fromFret + 1)} value={Math.max(1, Math.min(s.windowWidth ?? CHORD_TONE_WINDOW_DEFAULT, s.toFret - s.fromFret + 1))} onChange={(e) => set({ windowWidth: Math.max(1, Math.min(s.toFret - s.fromFret + 1, Math.trunc(+e.target.value) || 1)) })} /> frets</label>
        )}
        {(type === 'walking-bass' || type === 'chord-tone-lock') && (
          <>
            <label>Key <select value={s.key?.tonic ?? 'C'} onChange={(e) => set({ key: { tonic: e.target.value, mode: 'major' }, chords: undefined })}>
              {MAJOR_KEYS.map((k) => <option key={k} value={k}>{pretty(k)} major</option>)}
            </select></label>
            <p className="muted">Progression: {prettyText(progressionText(s))}. {type === 'walking-bass' ? 'Each chord is one bar of four beats, and the line loops back to bar 1.' : 'One note per chord, in bar order.'}</p>
          </>
        )}
        {!v.ok && <p className="field-error" id={errId} role="alert">{v.reason}</p>}
        <button className="primary big" type="submit" disabled={!v.ok}>Start drill</button>
      </form>
    </div>
  );
}

/** FR-058 progression text, e.g. "C | Am | Dm | G in C major". */
function progressionText(s: DrillSettings): string {
  const chords = s.chords?.length ? s.chords : builtInProgression(s.key?.tonic ?? 'C');
  const sym = (c: { root: string; quality: string }) => {
    const r = parsePitchClassNote(c.root);
    return r.ok ? chordSymbol(r.value, c.quality) : c.root;
  };
  return `${chords.map(sym).join(' | ')} in ${s.key?.tonic ?? 'C'} ${s.key?.mode ?? 'major'}`;
}
