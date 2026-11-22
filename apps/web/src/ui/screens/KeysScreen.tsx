import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { diatonicChords, formatPitchClass, keys, keySignature, type Key } from '@fretsense/theory';
import { Fretboard } from '../fretboard/Fretboard';
import { InstrumentGate } from '../InstrumentGate';
import { useAppState } from '../hooks';
import { contextMarkers, describePosition, prettyNote } from '../markers';
import { clampWindow, pretty, useDisplay } from '../common';
import { InstrumentSwitcher } from './GearScreen';

const ALL = keys();
const name = (k: Key) => `${prettyNote(k.tonic)} ${k.mode}`;
const sig = (k: Key) => { const n = keySignature(k); return n === 0 ? 'no sharps or flats' : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}`; };

/** US5 key helper (FR-007, FR-038, FR-039). */
export function KeysScreen() {
  useAppState();
  const [display] = useDisplay();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'minor' ? 'minor' : 'major';
  const tonicText = params.get('tonic') ?? (mode === 'major' ? 'C' : 'A');
  const key = ALL.find((k) => k.mode === mode && formatPitchClass(k.tonic) === tonicText) ?? ALL.find((k) => k.mode === mode && (formatPitchClass(k.tonic) === 'C' || formatPitchClass(k.tonic) === 'A'))!;
  const sevenths = params.get('sevenths') === '1';
  const hm = params.get('hm') === '1';
  const set = (k: Record<string, string>) => setParams((p) => { const n = new URLSearchParams(p); for (const [a, b] of Object.entries(k)) n.set(a, b); return n; }, { replace: true });
  const chords = diatonicChords(key, { sevenths, harmonicMinor: hm });
  const [sel, setSel] = useState(0);
  const chord = chords.ok ? chords.value[Math.min(sel, 6)] : undefined;

  return (
    <div className="page keys">
      <div className="explore-head"><h1 className="display-title">{name(key)}</h1><InstrumentSwitcher /></div>
      <p className="lede">{sig(key)}</p>
      <div className="control-row">
        <div className="segmented" role="radiogroup" aria-label="Mode">
          {(['major', 'minor'] as const).map((m) => <button key={m} role="radio" aria-checked={mode === m} onClick={() => set({ mode: m, tonic: m === 'major' ? 'C' : 'A' })}>{m === 'major' ? 'Major keys' : 'Minor keys'}</button>)}
        </div>
        <label className="switch"><input type="checkbox" checked={sevenths} onChange={(e) => set({ sevenths: e.target.checked ? '1' : '0' })} /> Seventh chords</label>
        {mode === 'minor' && <label className="switch"><input type="checkbox" checked={hm} onChange={(e) => set({ hm: e.target.checked ? '1' : '0' })} /> Harmonic-minor V and vii°</label>}
      </div>
      <div className="key-ring" role="radiogroup" aria-label="Key, in circle-of-fifths order from 7 flats to 7 sharps">
        {ALL.filter((k) => k.mode === mode).map((k) => (
          <button key={formatPitchClass(k.tonic)} role="radio" aria-checked={k === key} title={sig(k)} onClick={() => set({ tonic: formatPitchClass(k.tonic) })}>{prettyNote(k.tonic)}</button>
        ))}
      </div>
      {chords.ok && (
        <ol className="chord-row" aria-label="Diatonic chords">
          {chords.value.map((c, i) => (
            <li key={i}>
              <button aria-pressed={i === sel} onClick={() => setSel(i)}>
                <span className="numeral">{c.numeral}</span>
                <span className="sym">{pretty(c.symbol)}</span>
                <span className="tones">{c.tones.map(prettyNote).join(' ')}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {chord && (
        <InstrumentGate>{(inst) => {
          const win = clampWindow(display.window, inst.profile);
          const ctx = { root: chord.root, qualityId: chord.qualityId };
          return (
            <>
              <h2>{pretty(chord.symbol)} on your {inst.profile.family}</h2>
              <Fretboard profile={inst.profile} from={win[0]} to={win[1]} handedness={display.handedness} spacing={display.fretSpacing}
                markers={contextMarkers(inst.profile, ctx, win[0], win[1], 'degrees')} label={`${chord.symbol} chord tones`}
                describe={(pos) => describePosition(inst.profile, pos, ctx)} />
              <p className="muted">Labels show each tone’s function: R is the root.</p>
            </>
          );
        }}</InstrumentGate>
      )}
    </div>
  );
}
