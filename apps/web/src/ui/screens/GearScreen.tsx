import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { useSearchParams } from 'react-router';
import { FAMILY_RULES, formatNote, parseNote, presets, type InstrumentFamily, type Note, suggestedTuning } from '@fretsense/theory';
import type { InstrumentRecord } from '../../domain/records';
import { useApp, useAppState } from '../hooks';
import { pretty } from '../common';
import { Dialog } from '../Dialog';

/** Quick switch between My Gear instruments (FR-016). */
export function InstrumentSwitcher({ selectRef }: { selectRef?: Ref<HTMLSelectElement> } = {}) {
  const app = useApp();
  const s = useAppState();
  const live = app.liveInstruments();
  const active = app.activeInstrument() ?? live[0];
  if (!active) return null;
  return (
    <label className="select inst-switch">
      <span>Instrument</span>
      <select ref={selectRef} value={active.id} onChange={(e) => void app.updateSettings({ activeInstrumentId: e.target.value })}>
        {live.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      
    </label>
  );
}

const tuningText = (t: readonly Note[]) => t.map((n) => pretty(formatNote(n))).join(' ');

/** My Gear instruments (FR-053). */
export function GearScreen() {
  const app = useApp();
  const s = useAppState();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<InstrumentRecord | 'new' | undefined>(params.get('new') ? 'new' : undefined);
  const [status, setStatus] = useState<{ text: string; n: number; focus: boolean }>();
  /** FR-053: a status is announced; it also takes focus unless focus is going back to a dialog's opener (FR-048). */
  const setMsg = (text: string, focus = true) => setStatus((s) => ({ text, n: (s?.n ?? 0) + 1, focus }));
  /** The control that opened the instrument editor; focus returns to it on close (FR-048, T108). */
  const opener = useRef<HTMLElement | null>(null);
  /** Fallback when the editor was opened by a link (?new=1) rather than a control on this page. */
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const msg = status?.text;
  const statusRef = useRef<HTMLParagraphElement>(null);
  // FR-053 (CR-B2-7): each new status is scrolled into view, focused and announced.
  useEffect(() => {
    const el = statusRef.current;
    if (!status || !el || !status.focus) return;
    el.scrollIntoView?.({ block: 'nearest' });
    el.focus({ preventScroll: true });
  }, [status]);
  const live = app.liveInstruments();
  const activeId = app.activeInstrument()?.id;

  /** FR-053: adding a preset says whether it became the active instrument, from the app state. */
  async function addPreset(presetId: string, name: string) {
    const before = new Set(app.liveInstruments().map((i) => i.id));
    await app.addPreset(presetId);
    const added = app.liveInstruments().find((i) => !before.has(i.id));
    const active = app.activeInstrument();
    if (!added) return setMsg(`${name} couldn’t be added.`);
    setMsg(active?.id === added.id ? `Added ${name}. It is now your active instrument.` : `Added ${name}. Your active instrument is still ${active?.name ?? 'unchanged'}.`);
  }

  return (
    <div className="page">
      <h1 ref={pageHeading} tabIndex={-1}>My Gear</h1>
      <p className="lede">The fretboard and every drill use your active instrument: its strings, tuning and frets.</p>
      {msg && <p className="notice" role="status" tabIndex={-1} ref={statusRef}>{msg}</p>}
      <ul className="gear-list">
        {live.map((i) => (
          <li key={i.id} className={i.id === activeId ? 'active' : ''}>
            <div>
              <strong>{i.name}</strong>
              <span className="muted">{i.profile.stringCount}-string {i.profile.family}, {i.profile.fretCount} frets, {i.profile.scaleLengthMm} mm</span>
              <span className="tuning">{tuningText(i.profile.tuning)}</span>
            </div>
            <div className="row-actions">
              {i.id === activeId ? <span className="badge">Active</span> : <button onClick={() => void app.updateSettings({ activeInstrumentId: i.id })}>Use this</button>}
              <button onClick={(e) => { opener.current = e.currentTarget; setEditing(i); }}>Edit</button>
              <button className="danger" onClick={async () => { const r = await app.deleteInstrument(i.id); setMsg(r.ok ? `Deleted ${i.name}.` : r.reason); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {!live.length && <p>You haven’t added an instrument yet. Pick a preset below or set one up yourself.</p>}
      <h2>Add an instrument</h2>
      <div className="preset-grid compact">
        {presets().map((p) => (
          <button key={p.presetId} className="preset" onClick={() => void addPreset(p.presetId, p.name)}>
            <strong>{p.name}</strong>
            <span className="preset-tuning">{tuningText(p.profile.tuning)}</span>
          </button>
        ))}
        <button className="preset custom" onClick={(e) => { opener.current = e.currentTarget; setEditing('new'); }}><strong>Custom instrument</strong><span className="preset-tuning">Guitar with 6–8 strings or bass with 4–6, any tuning</span></button>
      </div>
      {editing && (
        <InstrumentForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          returnFocus={opener.current?.isConnected ? opener : pageHeading}
          onDone={(m) => { setEditing(undefined); if (m) setMsg(m, false); setParams({}, { replace: true }); }}
        />
      )}
    </div>
  );
}

function defaultTuning(family: InstrumentFamily, n: number): string[] {
  return [...(suggestedTuning(family, n) ?? suggestedTuning(family, FAMILY_RULES[family].minStrings)!)];
}

function InstrumentForm({ initial, onDone, returnFocus }: { initial?: InstrumentRecord; onDone: (msg?: string) => void; returnFocus: React.RefObject<HTMLElement | null> }) {
  const app = useApp();
  const [family, setFamily] = useState<InstrumentFamily>(initial?.profile.family ?? 'guitar');
  const [name, setName] = useState(initial?.name ?? '');
  const [tuning, setTuning] = useState<string[]>(initial ? initial.profile.tuning.map((t) => formatNote(t)) : defaultTuning('guitar', 6));
  const [frets, setFrets] = useState(initial?.profile.fretCount ?? 22);
  const [scale, setScale] = useState(initial?.profile.scaleLengthMm ?? 648);
  /** FR-048 (T109): an error names its field when it has one (the tuning string index), else the form. */
  const [error, setError] = useState<{ text: string; string?: number }>();
  const errId = useId();
  /** One save at a time: a fast double click must not add the instrument twice. */
  const saving = useRef(false);
  const rules = FAMILY_RULES[family];

  const setCount = (n: number) => setTuning(defaultTuning(family, n));
  const setFam = (f: InstrumentFamily) => {
    setFamily(f);
    setTuning(defaultTuning(f, FAMILY_RULES[f].minStrings));
    setFrets(FAMILY_RULES[f].defaultFretCount);
    setScale(FAMILY_RULES[f].defaultScaleLengthMm);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    const notes: Note[] = [];
    for (const [i, t] of tuning.entries()) {
      const r = parseNote(t);
      if (!r.ok) return setError({ text: `String ${tuning.length - i}: “${t}” isn’t a note like E2 or F#1.`, string: i });
      notes.push(r.value);
    }
    const input = { family, tuning: notes, fretCount: frets, scaleLengthMm: scale };
    const label = name.trim() || `${tuning.length}-string ${family}`;
    saving.current = true;
    let r: { ok: true } | { ok: false; reason: string };
    try {
      r = initial ? await app.updateInstrument(initial.id, label, input) : await app.addInstrument(label, input);
    } finally {
      saving.current = false;
    }
    if (!r.ok) return setError({ text: r.reason });
    onDone(initial ? `Saved ${label}.` : `Added ${label}.`);
  }

  return (
    // FR-048 (T108): the editor is a dialog; FR-053's "focus to its heading on open" comes from the primitive.
    <Dialog titleId="inst-form-h" onClose={() => onDone()} returnFocus={returnFocus}>
    <form className="form" onSubmit={submit}>
      <h2 id="inst-form-h" tabIndex={-1}>{initial ? `Edit ${initial.name}` : 'Custom instrument'}</h2>
      <label>Name <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Strat" /></label>
      {!initial && (
        <fieldset className="inline"><legend>Family</legend>
          {(['guitar', 'bass'] as const).map((f) => <label key={f}><input type="radio" name="fam" checked={family === f} onChange={() => setFam(f)} /> {f === 'guitar' ? 'Guitar' : 'Bass'}</label>)}
        </fieldset>
      )}
      <fieldset className="inline"><legend>Strings</legend>
        {Array.from({ length: rules.maxStrings - rules.minStrings + 1 }, (_, i) => rules.minStrings + i).map((n) => (
          <label key={n}><input type="radio" name="strings" checked={tuning.length === n} onChange={() => setCount(n)} /> {n}</label>
        ))}
      </fieldset>
      <fieldset><legend>Tuning, lowest string first</legend>
        <div className="tuning-inputs">
          {tuning.map((t, i) => (
            <label key={i}><span>String {tuning.length - i}</span>
              <input value={t} size={4} maxLength={6} aria-label={`String ${tuning.length - i} open note`}
                aria-invalid={error?.string === i ? true : undefined} aria-describedby={error?.string === i ? errId : undefined}
                onChange={(e) => setTuning(tuning.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
        </div>
        {error?.string !== undefined && <p className="field-error" id={errId} role="alert">{error.text}</p>}
      </fieldset>
      <div className="inline">
        <label>Frets <input type="number" min={12} max={24} value={frets} onChange={(e) => setFrets(+e.target.value)} /></label>
        <label>Scale length (mm) <input type="number" min={300} max={1200} value={scale} onChange={(e) => setScale(+e.target.value)} /></label>
      </div>
      {error && error.string === undefined && <p className="field-error" id={errId} role="alert">{error.text}</p>}
      <div className="row-actions">
        <button type="submit" className="primary">{initial ? 'Save instrument' : 'Add instrument'}</button>
        <button type="button" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
    </Dialog>
  );
}
