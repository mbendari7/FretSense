import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { buildChord, formatPitchClass, midiAt, mod, openString, pitchClass, type FretPosition, type InstrumentProfile, type PitchClassNote } from '@fretsense/theory';
import { feedbackText, finalStepsText, letterOctave, stepReason, stepReasonText } from '../../domain/drills/feedback';
import { generateQuestions } from '../../domain/drills/generate';
import { DrillSession, isStepJudged, type AnsweredQuestion, type StepResult, type TapRecord } from '../../domain/drills/session';
import { byRootString, fromAnswered, summarize } from '../../domain/drills/summary';
import { DRILL_LABELS, type DrillSettings, type Question } from '../../domain/drills/types';
import { mulberry32 } from '../../domain/prng';
import { historiesFrom } from '../../domain/weighting';
import { Fretboard, type FretboardHandle, type Marker } from '../fretboard/Fretboard';
import { useApp, useAppState } from '../hooks';
import { describePosition, positionHead, positionInfo, prettyNote, prettyText } from '../markers';
import { clampWindow, useDisplay } from '../common';

type Feedback = { correct: boolean; text: string } | undefined;

/** FR-049 (CR-B2-12) visible keyboard hint. */
const KEYBOARD_HINT = 'Arrow keys: move. Enter or Space: answer, then continue. Home: go to the start of the question.';

/**
 * FR-049 starting position: the first fret of the range on the prompted string (note-finding), the
 * reference (interval), the first fret of the window (chord-tone, arpeggio) or of the range (other
 * drills) on the lowest-pitched (highest-numbered) selected string on the instrument.
 */
function startOf(q: Question, win: readonly [number, number], settings: DrillSettings, profile: InstrumentProfile): FretPosition {
  if (q.drillType === 'note-finding' && q.promptedString) return { string: q.promptedString, fret: win[0] };
  if (q.drillType === 'interval' && q.reference[0]) return q.reference[0];
  // The highest-numbered SELECTED string that exists on the instrument (code-reviewer r3 #10).
  const onInstrument = settings.strings.filter((n) => n >= 1 && n <= profile.stringCount);
  const lowest = onInstrument.length ? Math.max(...onInstrument) : profile.stringCount;
  const fret = (q.drillType === 'chord-tone' || q.drillType === 'arpeggio') && q.window ? q.window.from : win[0];
  return { string: lowest, fret };
}

/** FR-032: the position nearest the tap: fewest frets apart, then fewest strings, then lower fret. */
export function nearestTo(tap: FretPosition, candidates: readonly FretPosition[]): FretPosition | undefined {
  let best: FretPosition | undefined;
  for (const c of candidates) {
    if (!best) { best = c; continue; }
    const df = Math.abs(c.fret - tap.fret) - Math.abs(best.fret - tap.fret);
    const ds = Math.abs(c.string - tap.string) - Math.abs(best.string - tap.string);
    if (df < 0 || (df === 0 && (ds < 0 || (ds === 0 && c.fret < best.fret)))) best = c;
  }
  return best;
}

/** Runs one drill session: prompt → tap → feedback → next; then a summary (FR-030–FR-034). */
export function DrillRunner({ profile, instrumentId, settings, lessonId, drillId, title, onExit, onComplete }: {
  profile: InstrumentProfile; instrumentId: string | null; settings: DrillSettings; lessonId?: string; drillId?: string;
  /** FR-048: when the runner is the whole route, its h1 (a lesson drill keeps the lesson's h1). */
  title?: string;
  onExit: (result: { completed: boolean }) => void; onComplete?: () => void;
}) {
  const app = useApp();
  const st = useAppState();
  const [display] = useDisplay();
  const autoMs = st.settings!.autoAdvanceMs;
  const [seed] = useState(() => (Date.now() ^ 0x9e3779b9) >>> 0);
  const gen = useMemo(() => generateQuestions({
    profile,
    settings,
    rng: mulberry32(seed),
    histories: historiesFrom(app.getState().attempts.filter((a) => !a.deleted)),
    adaptive: app.getState().settings!.adaptiveWeighting,
  }), [profile, settings, seed]);
  const session = useMemo(() => (gen.ok ? new DrillSession(gen.questions, performance.now()) : undefined), [gen]);
  const [, force] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>();
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState<string>();
  /** FR-056a / FR-057: the line for a step tap made while the question is still open. */
  const [stepNote, setStepNote] = useState<string>();
  /** FR-056a / FR-057: each wrong step tap's reason, flagged at the tapped position ("s/f" → reason). */
  const [reasons, setReasons] = useState<ReadonlyMap<string, string>>(new Map());
  const [keyboard, setKeyboard] = useState(false);
  /** Set once focus is in the fretboard, so the live region then announces question 1 (FR-049). */
  const [started, setStarted] = useState(false);
  const board = useRef<FretboardHandle>(null);
  const lastAnswered = useRef<FretPosition>(undefined);
  const reported = useRef(false);
  const timer = useRef<number>(undefined);
  const win = clampWindow([settings.fromFret, settings.toFret], profile);

  // Pause when the page is hidden; resume re-shows the current question (Edge Cases). A multi-step
  // question keeps its judged steps, taps, reasons and revealed positions; paused time never counts.
  useEffect(() => {
    const onVis = () => {
      if (!session) return;
      if (document.hidden) session.pause(performance.now());
      else if (session.snapshot().state === 'paused') {
        const keep = !!session.current && isStepJudged(session.current);
        session.resume(performance.now());
        setFeedback(undefined);
        setRevealed(false);
        if (!keep) { setStepNote(undefined); setReasons(new Map()); }
      }
      force((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearTimeout(timer.current); };
  }, [session]);

  // Drill start: focus moves into the fretboard at the starting position (FR-049). Later questions
  // keep focus where it is (the last answered position).
  useEffect(() => {
    const q0 = session?.current;
    if (!q0) return;
    // FR-047: the stated window starts in view with the starting position, when it fits.
    board.current?.focus(startOf(q0, win, settings, profile), q0.window ? [q0.window.from, q0.window.to] : undefined);
    setStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!gen.ok || !session) {
    return <div className="card"><p role="alert" className="field-error">{gen.ok ? '' : gen.reason}</p><button onClick={() => onExit({ completed: false })}>Change settings</button></div>;
  }
  const snap = session.snapshot();
  const q = session.current;
  const steps = (q?.steps.length ?? 0) > 1;
  const answered = session.awaitingAdvance;

  const next = () => {
    window.clearTimeout(timer.current);
    session.advance(performance.now());
    setFeedback(undefined);
    setRevealed(false);
    setHint(undefined);
    setStepNote(undefined);
    setReasons(new Map());
    force((n) => n + 1);
  };
  /**
   * FR-047: auto-advance brings the next question's stated window into view beside the last
   * answered position, without moving keyboard focus.
   */
  const autoAdvance = () => {
    next();
    const pos = lastAnswered.current;
    const w = session.current?.window;
    if (pos && w) board.current?.show(pos, [w.from, w.to]);
  };
  /** Continue by any means returns focus to the fretboard at the last answered position (FR-049). */
  const onContinue = () => {
    next();
    const pos = lastAnswered.current;
    // FR-047: the next question's stated window starts in view when it fits beside the focused position.
    const w = session.current?.window;
    if (pos) board.current?.focus(pos, w ? [w.from, w.to] : undefined);
  };

  function onTap(pos: FretPosition) {
    if (!q || feedback || session!.awaitingAdvance) return;
    // FR-030: a tap on another string isn't judged; it gets a hint instead.
    if (q.promptedString && pos.string !== q.promptedString) {
      setHint(`That’s string ${pos.string}. This question is on string ${q.promptedString}.`);
      return;
    }
    // FR-056a: a position already in this answer (or already marked wrong) is ignored and announced.
    const repeat = session!.repeatOf(pos);
    if (repeat) {
      setHint(`String ${pos.string}, fret ${pos.fret} ${repeat === 'wrong' ? 'was already marked wrong' : 'is already in this answer'}`);
      return;
    }
    setHint(undefined);
    const r = session!.tap(pos, performance.now());
    if (!r) return;
    const ctx = { instrumentId, profile, lessonId, drillId };
    const after = session!.snapshot();
    const stepIndex = after.lastStep;
    const judged = judgedPerStep(q);
    if (judged && !r.correct) {
      const reason = prettyText(stepReason(profile, q, pos, stepIndex));
      setReasons((m) => new Map(m).set(`${pos.string}/${pos.fret}`, reason));
    }
    if (!r.finished) {
      if (judged) {
        const placed = after.taps.find((t) => t.placed && t.pos.string === pos.string && t.pos.fret === pos.fret);
        if (placed) setStepNote(prettyText(`${noteAt(profile, q, pos)} placed on string ${pos.string} fret ${pos.fret}: root or octave, set by your next note`));
        else setStepNote(r.correct ? undefined : prettyText(stepReasonText({ profile, question: q, tap: pos, stepIndex })));
      }
      force((n) => n + 1);
      return;
    }
    lastAnswered.current = pos;
    // FR-040: one attempt per question (arpeggio and root–fifth–octave included), when its last step is judged.
    void app.recordAttempt(r.finished, ctx);
    const step = q.steps[Math.min(stepIndex, q.steps.length - 1)]!;
    let text: string;
    if (judged) {
      // FR-056 / FR-057: the final line gives the overall result and lists every missed step.
      text = prettyText(finalStepsText(profile, q, after.stepResults));
    } else {
      text = prettyText(feedbackText({ profile, question: q, tap: pos, correct: r.finished.correct, stepIndex }));
      if (!r.finished.correct && !r.correct && step.hint) text = `${text}. ${prettyText(step.hint)}`;
    }
    setStepNote(undefined);
    setFeedback({ correct: r.finished.correct, text });
    if (!r.finished.correct) {
      setRevealed(true);
      // FR-032: bring the revealed answer nearest the tap into view (with the tap when both fit);
      // focus stays on the tapped position (FR-049).
      const near = nearestTo(pos, revealedPositions(q, stepIndex, after.stepResults));
      if (near) board.current?.reveal(near, pos);
    }
    if (r.finished.correct && autoMs > 0) timer.current = window.setTimeout(autoAdvance, autoMs);
    force((n) => n + 1);
  }
  /** Enter / Space on the fretboard: Continue while feedback shows, otherwise answer (FR-049). */
  function onKeyActivate(pos: FretPosition) {
    if (feedback || session!.awaitingAdvance) onContinue();
    else onTap(pos);
  }

  if (snap.state === 'completed' && !session.endedEarly && !reported.current) {
    reported.current = true;
    onComplete?.();
  }
  if (snap.state === 'completed' || snap.state === 'abandoned' || !q) {
    return <DrillSummary settings={settings} answered={snap.answered} endedEarly={session.endedEarly} discarded={session.discardedUnfinished} onAgain={() => onExit({ completed: snap.state === 'completed' && !session.endedEarly })} />;
  }

  const markers = buildMarkers(q, snap.stepIndex, snap.taps, snap.stepResults, revealed || judgedPerStep(q), profile, reasons);
  // FR-036: the drawn window and "inside window" are the question's own window, else the range.
  const drawn: readonly [number, number] = q.window ? [q.window.from, q.window.to] : win;
  const step = q.steps[Math.min(snap.stepIndex, q.steps.length - 1)];
  /**
   * FR-032a (CR-B2-3): once answered, an open string keeps the instrument's spelling unless its
   * pitch is one of the question's own notes (prompt, interval reference or target, chord tone);
   * then it takes that note's spelling, except a double accidental. FR-060 never applies here.
   */
  const questionNotes = questionNotesOf(q);
  const nutName = (n: number): string | undefined => {
    if (!answered) return undefined;
    const m = midiAt(profile, { string: n, fret: 0 });
    if (!m.ok) return undefined;
    const own = questionNotes.find((x) => pitchClass(x) === mod(m.value, 12));
    if (own && Math.abs(own.accidental) < 2) return prettyNote(own);
    return prettyNote(openString(profile, n)!);
  };

  return (
    <section className="runner" aria-labelledby="prompt" data-route-focus-override="">
      <div className="runner-head">
        {title ? <h1 className="runner-title">{title}</h1> : <span className="muted">{DRILL_LABELS[settings.type]}</span>}
      </div>
      {/* One polite live region for "Question N of M. <prompt>" and the feedback (FR-032, FR-049). */}
      <div className="announce" aria-live="polite">
        {started && <span className="count">Question {snap.index + 1} of {snap.questions.length}.</span>}
        {started && ' '}
        <h2 id="prompt" className="prompt" tabIndex={-1}>{prettyText(q.text)}</h2>
        <div className={`feedback${feedback ? (feedback.correct ? ' ok' : ' bad') : stepNote ? ' note' : ''}`}>
          {feedback && (
            <>
              <span className="fb-icon" aria-hidden="true">{feedback.correct ? '✓' : '✕'}</span>
              <span>{feedback.text}</span>
            </>
          )}
          {!feedback && stepNote && <span>{stepNote}</span>}
        </div>
      </div>
      {hint && <p className="hint" role="status">{hint}</p>}
      {keyboard && <p className="hint kb-hint">{KEYBOARD_HINT}</p>}
      {steps && (
        <ol className="steps" aria-label="Steps">
          {q.steps.map((s, i) => {
            // FR-057: pending, correct (✓) or missed (✗); a missed step never shows ✓.
            const t = snap.stepResults[i];
            const state = t ? (t.correct ? 'correct' : 'missed') : 'pending';
            const now = !t && i === snap.stepIndex && !answered;
            return (
              <li key={i} className={`${state}${now ? ' now' : ''}`} aria-label={`Step ${i + 1}, ${prettyText(stepSpoken(q, s.label))}, ${state}`}>
                {state !== 'pending' && <span className="step-icon" aria-hidden="true">{state === 'correct' ? '✓' : '✗'}</span>}
                {prettyText(stepVisible(s.label))}
                {state !== 'pending' && <span className="step-state">, {state}</span>}
              </li>
            );
          })}
        </ol>
      )}
      <Fretboard
        control={board}
        profile={profile}
        from={win[0]}
        to={win[1]}
        markers={markers}
        handedness={display.handedness}
        spacing={display.fretSpacing}
        onTap={onTap}
        onKeyActivate={onKeyActivate}
        onKeyboardFocus={setKeyboard}
        startPosition={startOf(q, win, settings, profile)}
        nutName={nutName}
        promptedString={q.promptedString}
        strings={settings.strings}
        windowRange={drawn}
        label="Drill fretboard: tap your answer"
        describe={(pos) => {
          const full = answered || revealed || snap.taps.some((t) => t.pos.string === pos.string && t.pos.fret === pos.fret);
          if (full) return describePosition(profile, pos, q.context, q.spellings);
          // FR-032a: the interval reference also names its note (with octave) in the question's spelling.
          if (q.drillType === 'interval' && q.reference.some((r) => r.string === pos.string && r.fret === pos.fret)) {
            return describePosition(profile, pos, q.context, q.spellings);
          }
          // FR-032a: string and fret plus the drill's own marker suffixes only.
          const prompted = pos.string === q.promptedString ? ', prompted string' : '';
          // Only drills that state a window (FR-036) name it; elsewhere it is noise (implementer gap #1).
          const inside = q.window && pos.fret >= drawn[0] && pos.fret <= drawn[1] ? ', inside window' : '';
          return `${positionHead(pos)}${prompted}${inside}`;
        }}
      />
      {/* FR-048 / FR-049: the drill's controls follow the board in tab order (Continue first). */}
      <p className="row-actions runner-foot">
        {feedback && (!feedback.correct || autoMs === 0) && <button className="primary" onClick={onContinue}>Continue</button>}
        <button className="link" onClick={() => { session.end(); force((n) => n + 1); }}>End drill</button>
      </p>
    </section>
  );
}

/** The question's own notes (FR-032a): each step's answer, its spelling source and its chord's tones. */
function questionNotesOf(q: Question): PitchClassNote[] {
  const out: PitchClassNote[] = [];
  for (const st of q.steps) if (st.spelled) out.push(st.spelled);
  out.push(...(q.spellings ?? []));
  if (q.context?.qualityId) {
    const tones = buildChord(q.context.root, q.context.qualityId);
    if (tones.ok) out.push(...tones.value);
  }
  return out;
}

/** FR-056 / FR-057: drills whose steps are each judged and listed as missed at the end. */
const judgedPerStep = isStepJudged;
/** FR-057 indicator text: the root shows "R", the octave "8"; other labels as written. */
const stepVisible = (label: string) => (label === 'octave' ? '8' : label);
/**
 * FR-057 indicator name: the root is spoken "root", the add9 9 "9th", the root–fifth–octave 5th
 * "5th"; other labels (including "octave") as written.
 */
const stepSpoken = (q: Question, label: string) =>
  label === 'R' ? 'root' : label === '9' ? '9th' : label === '5' && q.drillType === 'root-fifth-octave' ? '5th' : label;

/** The note sounding at a position, in the question's spelling, with octave (FR-032). */
function noteAt(profile: InstrumentProfile, q: Question, pos: FretPosition): string {
  const m = midiAt(profile, pos);
  const sp = q.steps[0]?.spelled;
  if (!m.ok || !sp) return '';
  return `${formatPitchClass(sp)}${letterOctave(sp, m.value)}`;
}

/** FR-032 / FR-057: the answer positions revealed after a wrong answer (every missed step's, when judged per step). */
function revealedPositions(q: Question, stepIndex: number, results: readonly (StepResult | undefined)[]): FretPosition[] {
  // FR-056a: a missed root–fifth–octave step reveals its one position from the reveal shape.
  if (judgedPerStep(q)) return q.steps.flatMap((st, i) => (results[i] && !results[i]!.correct ? (results[i]!.revealed ? [results[i]!.revealed!] : st.valid) : []));
  return [...(q.steps[Math.min(stepIndex, q.steps.length - 1)]?.valid ?? [])];
}

function buildMarkers(q: Question, stepIndex: number, taps: readonly TapRecord[], results: readonly (StepResult | undefined)[], revealed: boolean, profile: InstrumentProfile, reasons: ReadonlyMap<string, string>): Marker[] {
  const out: Marker[] = [];
  const seen = new Set<string>();
  const add = (m: Marker) => { const k = `${m.pos.string}:${m.pos.fret}`; if (!seen.has(k)) { seen.add(k); out.push(m); } };
  for (const t of [...taps].reverse()) {
    // FR-056: a placed tap (root or octave still open) is neither correct nor incorrect yet.
    if (t.placed) { add({ pos: t.pos, kind: 'tone', label: 'R/8', name: 'your tap, placed, root or octave' }); continue; }
    const reason = reasons.get(`${t.pos.string}/${t.pos.fret}`);
    add({ pos: t.pos, kind: t.correct ? 'correct' : 'incorrect', label: t.correct ? '✓' : '✕', name: `your tap, ${t.correct ? 'correct' : 'incorrect'}${!t.correct && reason ? `, ${reason}` : ''}` });
  }
  for (const r of q.reference) {
    const info = positionInfo(profile, r, q.context, q.spellings);
    add({ pos: r, kind: 'reference', label: info?.note.replace(/-?\d+$/, '') ?? '', name: 'reference' });
  }
  if (revealed) {
    for (const v of revealedPositions(q, stepIndex, results)) add({ pos: v, kind: 'revealed', label: positionInfo(profile, v, q.context, q.spellings)?.note.replace(/-?\d+$/, '') ?? '', name: 'answer' });
  }
  return out;
}

/** FR-034: the notice for a started question that End drill discarded. */
const UNFINISHED = 'Your unfinished question wasn’t saved.';

function DrillSummary({ settings, answered, endedEarly, discarded, onAgain }: { settings: DrillSettings; answered: readonly AnsweredQuestion[]; endedEarly: boolean; discarded: boolean; onAgain: () => void }) {
  const missed = answered.filter((a) => !a.correct);
  const sum = summarize(fromAnswered(answered));
  // FR-034: per-string figures; a multi-step question counts toward its Step 1 root's string.
  const strings = settings.type === 'note-finding' ? [] : byRootString(answered);
  const fmt = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);
  return (
    <section className="summary" aria-labelledby="sum-h">
      <h2 id="sum-h">Drill finished</h2>
      {answered.length ? (
        <>
          <p className="big-score"><strong>{Math.round(sum.overall.accuracy * 100)}%</strong> correct, {sum.overall.correct} of {sum.overall.total}. Typical answer time {fmt(sum.overall.medianMs)}.</p>
          <table className="stats">
            <thead><tr><th scope="col">{settings.type === 'note-finding' ? 'String' : 'Item'}</th><th scope="col">Correct</th><th scope="col">Typical time</th></tr></thead>
            <tbody>{sum.groups.map((g) => <tr key={g.group}><th scope="row">{prettyText(g.group)}</th><td>{g.correct} of {g.total}</td><td>{fmt(g.medianMs)}</td></tr>)}</tbody>
          </table>
          {strings.length > 0 && (
            <table className="stats">
              <caption>By string (the root’s string)</caption>
              <thead><tr><th scope="col">String</th><th scope="col">Correct</th><th scope="col">Typical time</th></tr></thead>
              <tbody>{strings.map((g) => <tr key={g.group}><th scope="row">{g.group}</th><td>{g.correct} of {g.total}</td><td>{fmt(g.medianMs)}</td></tr>)}</tbody>
            </table>
          )}
        </>
      ) : <p>{discarded ? `No questions answered. ${UNFINISHED}` : 'No questions answered.'}</p>}
      {endedEarly && answered.length > 0 && <p className="muted">Ended early: the questions you answered are saved.</p>}
      {discarded && answered.length > 0 && <p className="muted">{UNFINISHED}</p>}
      {missed.length > 0 && (
        <>
          <h3>To practise</h3>
          <ul className="missed">{missed.slice(0, 10).map((a, i) => <li key={i}>{prettyText(a.question.text)}</li>)}</ul>
        </>
      )}
      <div className="row-actions">
        <button className="primary" onClick={onAgain}>Practise again</button>
        <Link to="/progress">See progress</Link>
        <Link to="/drills">Other drills</Link>
      </div>
    </section>
  );
}

