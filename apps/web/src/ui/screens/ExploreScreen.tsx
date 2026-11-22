import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { buildChord, buildScale, chordSymbol, degreeLabels, formatPitchClass, functionLabels, type FretPosition } from '@fretsense/theory';
import { Fretboard } from '../fretboard/Fretboard';
import { InstrumentGate } from '../InstrumentGate';
import { useApp, useAppState } from '../hooks';
import { contextMarkers, describePosition, positionInfo, prettyNote, type Ctx } from '../markers';
import { CHORDS, SCALES, RootPicker, Segmented, WindowControl, clampWindow, parsePc, pretty, useDisplay } from '../common';
import { InstrumentSwitcher } from './GearScreen';

/** US1 fretboard explorer (FR-011–FR-021). Query params make views shareable. */
export function ExploreScreen() {
  return <InstrumentGate>{(inst) => <Explorer key={inst.id} profile={inst.profile} />}</InstrumentGate>;
}

const SCALE_IDS = new Set(SCALES.map((s) => s.id));
const CHORD_IDS = new Set(CHORDS.map((c) => c.id));

function Explorer({ profile }: { profile: import('@fretsense/theory').InstrumentProfile }) {
  const app = useApp();
  const s = useAppState().settings!;
  const [display, setDisplay] = useDisplay();
  const [params, setParams] = useSearchParams();

  // URL wins over saved state; unknown values fall back to saved state.
  const qScale = params.get('scale');
  const qChord = params.get('chord');
  const kind: 'scale' | 'chord' = qChord && CHORD_IDS.has(qChord) ? 'chord' : qScale && SCALE_IDS.has(qScale) ? 'scale' : s.explorer.kind;
  const typeId = kind === 'chord' ? (qChord && CHORD_IDS.has(qChord) ? qChord : CHORD_IDS.has(s.explorer.typeId) ? s.explorer.typeId : 'major')
    : qScale && SCALE_IDS.has(qScale) ? qScale : SCALE_IDS.has(s.explorer.typeId) ? s.explorer.typeId : 'major';
  const root = parsePc(params.get('root')) ?? parsePc(s.explorer.root) ?? { letter: 'C', accidental: 0 };
  const labelParam = params.get('labels');
  const labels = labelParam === 'notes' || labelParam === 'degrees' || labelParam === 'none' ? labelParam : display.labelMode;
  const qFrom = Number(params.get('from'));
  const qTo = Number(params.get('to'));
  const win = params.has('from') && params.has('to') && Number.isInteger(qFrom) && Number.isInteger(qTo) && qFrom <= qTo
    ? clampWindow([qFrom, qTo], profile) : clampWindow(display.window, profile);

  const [tapped, setTapped] = useState<FretPosition | undefined>();

  const save = (next: { root?: string; kind?: 'scale' | 'chord'; typeId?: string }) => {
    const e = { root: formatPitchClass(root), kind, typeId, ...next };
    void app.updateSettings({ explorer: e });
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('root', e.root);
      n.delete('scale'); n.delete('chord');
      n.set(e.kind, e.typeId);
      return n;
    }, { replace: true });
  };

  const ctx: Ctx = kind === 'scale' ? { root, typeId } : { root, qualityId: typeId };
  const markers = useMemo(() => contextMarkers(profile, ctx, win[0], win[1], labels), [profile, root.letter, root.accidental, typeId, kind, win[0], win[1], labels]);
  const tones = kind === 'scale' ? buildScale(root, typeId) : buildChord(root, typeId);
  const degs = kind === 'scale' ? degreeLabels(root, typeId) : functionLabels(root, typeId);
  const title = kind === 'scale' ? `${prettyNote(root)} ${SCALES.find((x) => x.id === typeId)?.name.toLowerCase()}` : pretty(chordSymbol(root, typeId));
  const info = tapped ? positionInfo(profile, tapped, ctx) : undefined;

  return (
    <div className="explore">
      <div className="explore-head">
        <h1 className="display-title">{title}</h1>
        <InstrumentSwitcher />
      </div>
      {tones.ok ? (
        <ol className="tone-strip" aria-label="Notes">
          {tones.value.map((t, i) => (
            <li key={i} className={i === 0 ? 'is-root' : ''}><span className="tone-name">{prettyNote(t)}</span><span className="tone-deg">{pretty(degs[i] ?? '')}</span></li>
          ))}
        </ol>
      ) : (
        <p className="notice error" role="alert">This root needs a triple accidental for this {kind}. Try the other spelling.</p>
      )}
      <Fretboard
        profile={profile}
        from={win[0]}
        to={win[1]}
        markers={tones.ok ? markers : []}
        handedness={display.handedness}
        spacing={display.fretSpacing}
        onTap={setTapped}
        label={`${title} on the fretboard`}
        describe={(pos) => describePosition(profile, pos, ctx)}
      />
      <p className="tap-info" aria-live="polite">
        {info ? <>String {tapped!.string}, fret {tapped!.fret}: <strong>{info.note}</strong>{info.degree && <> is the <strong>{info.degree}</strong>{info.inContext ? '' : ' (not in this ' + kind + ')'}</>}</> : 'Tap any position to see its note and degree.'}
      </p>
      <div className="controls">
        <RootPicker value={root} context={kind === 'scale' ? { typeId } : { qualityId: typeId }} onChange={(r) => save({ root: formatPitchClass(r) })} />
        <div className="control-row">
          <Segmented label="Show" value={kind} options={[{ value: 'scale', label: 'Scale' }, { value: 'chord', label: 'Chord' }]}
            onChange={(k) => save({ kind: k, typeId: k === 'scale' ? 'major' : 'major' })} />
          <label className="select">
            <span>{kind === 'scale' ? 'Scale' : 'Chord'}</span>
            <select value={typeId} onChange={(e) => save({ typeId: e.target.value })}>
              {(kind === 'scale' ? SCALES : CHORDS).map((t) => (
                <option key={t.id} value={t.id}>{'symbolSuffix' in t ? `${pretty(chordSymbol(root, t.id))}  (${t.name})` : t.name}</option>
              ))}
            </select>
          </label>
          <Segmented label="Labels" value={labels} options={[{ value: 'notes', label: 'Notes' }, { value: 'degrees', label: kind === 'chord' ? 'Functions' : 'Degrees' }, { value: 'none', label: 'None' }]}
            onChange={(l) => { setDisplay({ labelMode: l }); setParams((p) => { const n = new URLSearchParams(p); n.delete('labels'); return n; }, { replace: true }); }} />
        </div>
        <div className="control-row">
          <WindowControl profile={profile} value={win} onChange={(w) => { setDisplay({ window: w }); setParams((p) => { const n = new URLSearchParams(p); n.delete('from'); n.delete('to'); return n; }, { replace: true }); }} />
          <Segmented label="Fret spacing" value={display.fretSpacing} options={[{ value: 'uniform', label: 'Even frets' }, { value: 'proportional', label: 'Real spacing' }]} onChange={(v) => setDisplay({ fretSpacing: v })} />
          <Segmented label="Hand" value={display.handedness} options={[{ value: 'right', label: 'Right-handed' }, { value: 'left', label: 'Left-handed' }]} onChange={(v) => setDisplay({ handedness: v })} />
        </div>
      </div>
    </div>
  );
}
