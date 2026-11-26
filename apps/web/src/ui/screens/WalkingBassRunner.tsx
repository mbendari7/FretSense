import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { formatPitchClass, type FretPosition, type InstrumentProfile } from '@fretsense/theory';
import { buildLine, judgeLine, lineAttempts, revealsFor, slotAnnouncement, slotNoteName, type SlotJudgement } from '../../domain/drills/walkingBass';
import type { DrillSettings, Question } from '../../domain/drills/types';
import { Fretboard, type FretboardHandle, type Marker } from '../fretboard/Fretboard';
import { useApp } from '../hooks';
import { clampWindow, useDisplay } from '../common';
import { positionHead, prettyText } from '../markers';

const STATE_TEXT: Record<SlotJudgement['state'], string> = { empty: 'empty', pending: 'waiting for the next bar', ok: 'fits', broken: 'breaks a rule' };
const STATE_ICON: Record<SlotJudgement['state'], string> = { empty: '', pending: '…', ok: '✓', broken: '✕' };
/** CR-B3-3 failed-save message. */
const SAVE_FAILED = "Couldn't save this line. Your notes are still here; try Check line again.";

/** One Undo step (CR-B3-2): the slot and what it held before the entry. */
interface Entry { readonly slot: number; readonly prev: FretPosition | undefined; readonly prevTime: number | undefined }

/**
 * FR-058 walking-bass drill: one looping line of 4 slots per bar. Each entered note is judged by
 * R1–R4 at once (R3 once the next bar's beat 1 exists); Undo reverts entries; Check line records
 * one attempt per note in one transaction (FR-040, CR-B3-3).
 */
export function WalkingBassRunner({ profile, instrumentId, settings, title, lessonId, drillId, onExit }: {
  profile: InstrumentProfile; instrumentId: string | null; settings: DrillSettings; title?: string; lessonId?: string; drillId?: string;
  onExit: (result: { completed: boolean }) => void;
}) {
  const app = useApp();
  const [display] = useDisplay();
  const built = useMemo(() => buildLine(profile, settings), [profile, settings]);
  const board = useRef<FretboardHandle>(null);
  const [entries, setEntries] = useState<(FretPosition | undefined)[]>([]);
  const [times, setTimes] = useState<(number | undefined)[]>([]);
  /** The slot the next tap fills. */
  const [current, setCurrent] = useState(0);
  /** CR-B3-1: the slot whose reasons and reveals are shown (the one just entered or selected). */
  const [shown, setShown] = useState<number | undefined>(undefined);
  const [history, setHistory] = useState<Entry[]>([]);
  const [checked, setChecked] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  /** CR-B3-4: the roving tab stop; arrows move it, only Enter/Space/click changes `current`. */
  const [focusIdx, setFocusIdx] = useState(0);
  const endRef = useRef<HTMLButtonElement>(null);
  const endDlgRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  /** FR-040 per-note response time: time since the previous entry (or the line start). */
  const lastEntryAt = useRef(performance.now());
  const resultRef = useRef<HTMLElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusStart = useRef(false);
  const win = clampWindow([settings.fromFret, settings.toFret], profile);
  const startString = Math.max(...settings.strings.filter((n) => n >= 1 && n <= profile.stringCount), 1);
  // FR-049 / FR-059: drill start moves focus into the fretboard at the range's first fret on the lowest selected string.
  useEffect(() => {
    if (focusStart.current || !built.ok) return;
    focusStart.current = true;
    board.current?.focus({ string: startString, fret: win[0] }, win);
  }, [built.ok]); // eslint-disable-line react-hooks/exhaustive-deps -- one-shot on mount; the ref also guards StrictMode
  useEffect(() => { if (checked) resultRef.current?.focus(); }, [checked]);
  useEffect(() => { if (confirmEnd) keepRef.current?.focus(); }, [confirmEnd]);

  if (!built.ok) {
    return (
      <section className="runner">
        <p className="field-error" role="alert">{built.reason}</p>
        <button className="primary" onClick={() => onExit({ completed: false })}>Back to settings</button>
      </section>
    );
  }
  const line = built.line;
  const n = line.slotCount;
  const judgements = judgeLine(profile, line, entries);
  const filled = judgements.filter((j) => j.state !== 'empty').length;
  const complete = filled === n;
  const firstEmpty = judgements.find((j) => j.state === 'empty');
  const anyPending = judgements.some((j) => j.state === 'pending');

  const noteName = (slot: number, pos: FretPosition) => slotNoteName(profile, line, slot, pos) ?? positionHead(pos);
  const slotHead = (slot: number) => `Bar ${Math.floor(slot / 4) + 1}, beat ${(slot % 4) + 1}`;
  const now = (slot: number) => `Now: ${slotAnnouncement(line, slot)}`;
  const judgedText = (j: SlotJudgement) => (j.state === 'broken' ? j.broken.map((b) => b.message).join(' ') : `${STATE_TEXT[j.state]}.`);

  const onTap = (pos: FretPosition) => {
    if (checked) return;
    const slot = current;
    const next = [...entries];
    const t = [...times];
    setHistory((h) => [...h, { slot, prev: entries[slot], prevTime: times[slot] }]);
    next[slot] = pos;
    const at = performance.now();
    t[slot] = Math.max(0, Math.round(at - lastEntryAt.current));
    lastEntryAt.current = at;
    setEntries(next);
    setTimes(t);
    setSaveError(false);
    const j = judgeLine(profile, line, next)[slot]!;
    let to = slot;
    for (let k = 1; k <= n; k++) {
      const c = (slot + k) % n;
      if (!next[c]) { to = c; break; }
    }
    setCurrent(to);
    setShown(slot);
    // Scenario 17: the announcement ends with the now-current slot.
    setNotice(`${slotAnnouncement(line, slot)}: ${noteName(slot, pos)}. ${judgedText(j)} ${now(to)}`);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || checked) return; // CR-B3-2: nothing to undo → nothing happens, nothing is announced
    const next = [...entries];
    next[last.slot] = last.prev;
    const t = [...times];
    t[last.slot] = last.prevTime;
    setEntries(next);
    setTimes(t);
    setHistory((h) => h.slice(0, -1));
    setCurrent(last.slot);
    setShown(last.slot);
    const back = last.prev ? `back to ${noteName(last.slot, last.prev)}` : 'now empty';
    setNotice(`Undid ${slotHead(last.slot)}: ${back}. ${now(last.slot)}`);
  };

  const select = (i: number, toBoard: boolean) => {
    setCurrent(i);
    setFocusIdx(i);
    setShown(i);
    setNotice(now(i));
    if (toBoard) board.current?.focus(entries[i] ?? { string: startString, fret: win[0] }, win);
  };

  // CR-B3-4: the slot row is one tab stop; arrows move within it, Enter/Space selects and goes to the board.
  const onSlotKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const go = (k: number) => { e.preventDefault(); slotRefs.current[k]?.focus(); setFocusIdx(k); };
    if (e.key === 'ArrowRight' && i < n - 1) go(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i, true); }
  };

  const check = async () => {
    if (busy.current || checked) return; // CR-B3-3: one recording per line
    busy.current = true;
    setSaving(true);
    const atts = lineAttempts(profile, line, entries);
    const answered = atts.map((a, i) => {
      const q: Question = { drillType: 'walking-bass', itemKey: a.itemKey, prompt: a.prompt, text: slotAnnouncement(line, i), steps: [], reference: [], group: a.group };
      return { question: q, taps: a.answer, correct: a.correct, responseMs: times[i] ?? 0 };
    });
    try {
      await app.recordAttempts(answered, { instrumentId, profile, ...(lessonId ? { lessonId } : {}), ...(drillId ? { drillId } : {}) });
      setChecked(true);
      const ok = atts.filter((a) => a.correct).length;
      setNotice(`Line checked: ${ok} of ${atts.length} notes fit the rules.`);
    } catch {
      setSaveError(true);
      setNotice(''); // the alert below announces it once
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const endDrill = () => {
    if (!checked && filled > 0) setConfirmEnd(true); // CR-B3-8
    else onExit({ completed: checked });
  };

  const view = shown ?? current;
  const sel = judgements[view]!;
  const markers: Marker[] = [];
  const seen = new Set<string>();
  const add = (m: Marker) => { const k = `${m.pos.string}:${m.pos.fret}`; if (!seen.has(k)) { seen.add(k); markers.push(m); } };
  const here = entries[view];
  if (here) add({ pos: here, kind: sel.state === 'broken' ? 'incorrect' : 'correct', label: `${sel.beat}`, name: `${slotHead(view)} note, ${STATE_TEXT[sel.state]}` });
  if (sel.state === 'broken') for (const r of revealsFor(profile, line, entries, view)) add({ pos: r.pos, kind: 'revealed', label: '', name: `revealed answer, ${r.caption}` });
  for (const d of [-1, 1]) {
    const k = (view + d + n) % n;
    const e = entries[k];
    if (e) add({ pos: e, kind: 'reference', label: d < 0 ? '◂' : '▸', name: d < 0 ? 'previous note' : 'next note' });
  }

  const correctCount = judgements.filter((j) => j.state === 'ok').length;
  const reset = () => {
    setEntries([]); setTimes([]); setHistory([]); setCurrent(0); setFocusIdx(0); setShown(undefined); setChecked(false); setNotice(''); setSaveError(false);
    lastEntryAt.current = performance.now();
  };
  return (
    <section className="runner walking" aria-labelledby="wb-prompt" data-route-focus-override="">
      <div className="runner-head">{title ? <h1 className="runner-title">{title}</h1> : <span className="muted">Walking bass</span>}</div>
      <h2 id="wb-prompt" className="prompt" tabIndex={-1}>
        {prettyText(`Walk a line over ${line.chords.map((c) => c.symbol).join(' | ')} in ${line.keyName}, frets ${win[0]} to ${win[1]}`)}
      </h2>
      {/* CR-B3-5: plain-words introduction and inline definitions. */}
      <p>A walking line plays one note per beat and moves step by step through the chords.</p>
      <ul className="wb-rules muted">
        <li>Beat 1: the chord’s root (the note the chord is named after).</li>
        <li>Beats 2 and 3: chord tones (a note in the chord, e.g. C, E, G in C), notes of the key, or a semitone (one fret on the same string) step between them.</li>
        <li>Beat 4: a lead-in (the last note of a bar, leading to the next chord): 1–2 semitones from the next bar’s first note, or a perfect 5th above or below it.</li>
        <li>Moves stay within an octave. The line loops back to bar 1.</li>
      </ul>
      {profile.family !== 'bass' && <p className="muted">This drill works on any instrument.</p>}
      <p><Link to={`/drills/chord-tone-lock?key=${encodeURIComponent(formatPitchClass(line.key.tonic, "ascii"))}`}>New to this? Try Chord-tone lock first</Link></p>
      <div className="announce" aria-live="polite"><p className="feedback note">{prettyText(notice)}</p></div>
      {sel.state === 'broken' && (
        <div className="wb-reasons">
          <strong>{slotHead(view)}:</strong>
          <ul aria-label={`Rules broken at ${slotAnnouncement(line, view)}`}>
            {sel.broken.map((b) => <li key={b.rule}>{prettyText(b.message)}</li>)}
          </ul>
        </div>
      )}
      {saveError && <p className="field-error" role="alert">{SAVE_FAILED}</p>}
      <div className="wb-bars" role="group" aria-label="Bars and beats: use the arrow keys to move, Enter to choose">
        {line.chords.map((c, b) => (
          <div key={b} className="wb-bar">
            <div className="wb-chord">{prettyText(c.symbol)}</div>
            <div className="wb-slots">
              {[0, 1, 2, 3].map((k) => {
                const i = b * 4 + k;
                const j = judgements[i]!;
                const e = entries[i];
                const isCur = i === current;
                return (
                  <button
                    key={k}
                    ref={(el) => { slotRefs.current[i] = el; }}
                    type="button"
                    tabIndex={i === focusIdx ? 0 : -1}
                    className={`wb-slot ${j.state}${isCur ? ' now' : ''}`}
                    aria-label={`${slotAnnouncement(line, i)}, ${e ? noteName(i, e) : 'empty'}, ${STATE_TEXT[j.state]}${isCur ? ', selected' : ''}`}
                    onClick={() => select(i, false)}
                    onKeyDown={(ev) => onSlotKey(ev, i)}
                  >
                    <span className="wb-beat">{k + 1}</span>
                    <span className="wb-note">{e ? prettyText(noteName(i, e)) : '·'}</span>
                    {STATE_ICON[j.state] && <span className="wb-icon" aria-hidden="true">{STATE_ICON[j.state]}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Fretboard
        control={board}
        profile={profile}
        from={win[0]}
        to={win[1]}
        markers={markers}
        handedness={display.handedness}
        spacing={display.fretSpacing}
        onTap={onTap}
        strings={settings.strings}
        label={`Walking-bass fretboard: tap the note for ${slotAnnouncement(line, current)}`}
        describe={(pos) => {
          const m = markers.find((x) => x.pos.string === pos.string && x.pos.fret === pos.fret);
          return m ? `${positionHead(pos)}, ${m.name}` : positionHead(pos);
        }}
      />
      {!checked && !complete && firstEmpty && (
        <p className="muted" role="status">
          {filled} of {n} notes entered. Next empty: {slotHead(firstEmpty.slot)}.
          {anyPending && ' Beat-4 notes marked … are judged once the next bar’s first note is in.'}
        </p>
      )}
      <p className="row-actions runner-foot">
        {!checked && <button type="button" onClick={undo} disabled={!history.length}>Undo</button>}
        {!checked && <button type="button" className="primary" onClick={() => void check()} disabled={!complete || saving}>Check line</button>}
        {checked && (
          <>
            <strong ref={resultRef} tabIndex={-1}>{correctCount} of {n} notes fit the rules. Select any note to see its rules.</strong>
            <button type="button" className="primary" onClick={reset}>Walk another line</button>
            <Link to="/progress">See progress</Link>
          </>
        )}
        <button ref={endRef} type="button" className="link" onClick={endDrill}>{checked ? 'Back to drills' : 'End drill'}</button>
      </p>
      {confirmEnd && (
        <div className="dialog-backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="wb-end-h" className="dialog card" onKeyDown={(e) => {
            // FR-048 dialog rules: Escape closes; Tab stays inside; focus returns to End drill.
            if (e.key === 'Escape') { setConfirmEnd(false); endRef.current?.focus(); }
            if (e.key === 'Tab') {
              e.preventDefault();
              (document.activeElement === keepRef.current ? endDlgRef.current : keepRef.current)?.focus();
            }
          }}>
            <p id="wb-end-h">End drill? Your {filled} unchecked notes won't be saved.</p>
            <div className="row-actions">
              <button ref={keepRef} type="button" className="primary" onClick={() => { setConfirmEnd(false); endRef.current?.focus(); }}>Keep playing</button>
              <button ref={endDlgRef} type="button" onClick={() => { setConfirmEnd(false); onExit({ completed: false }); }}>End drill</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
