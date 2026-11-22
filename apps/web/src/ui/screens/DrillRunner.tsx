import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { formatPitchClass, openString, type FretPosition, type InstrumentProfile } from '@fretsense/theory';
import { generateQuestions } from '../../domain/drills/generate';
import { DrillSession } from '../../domain/drills/session';
import { fromAnswered, summarize } from '../../domain/drills/summary';
import { DRILL_LABELS, type DrillSettings, type Question } from '../../domain/drills/types';
import { mulberry32 } from '../../domain/prng';
import { historiesFrom } from '../../domain/weighting';
import { Fretboard, type Marker } from '../fretboard/Fretboard';
import { useApp, useAppState } from '../hooks';
import { describePosition, positionInfo, prettyText } from '../markers';
import { clampWindow, useDisplay } from '../common';

type Feedback = { correct: boolean; text: string } | undefined;

/** Runs one drill session: prompt → tap → feedback → next; then a summary (FR-030–FR-034). */
export function DrillRunner({ profile, instrumentId, settings, lessonId, drillId, onExit, onComplete }: {
  profile: InstrumentProfile; instrumentId: string | null; settings: DrillSettings; lessonId?: string; drillId?: string; onExit: (result: { completed: boolean }) => void; onComplete?: () => void;
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
  const promptRef = useRef<HTMLHeadingElement>(null);
  const reported = useRef(false);
  const timer = useRef<number>(undefined);

  // Pause when the page is hidden; resume re-shows the current question (Edge Cases).
  useEffect(() => {
    const onVis = () => {
      if (!session) return;
      if (document.hidden) session.pause();
      else if (session.snapshot().state === 'paused') { session.resume(performance.now()); setFeedback(undefined); setRevealed(false); }
      force((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearTimeout(timer.current); };
  }, [session]);

  const qIndex = session?.snapshot().index;
  useEffect(() => { promptRef.current?.focus({ preventScroll: true }); }, [qIndex]);

  if (!gen.ok || !session) {
    return <div className="card"><p role="alert" className="field-error">{gen.ok ? '' : gen.reason}</p><button onClick={() => onExit({ completed: false })}>Change settings</button></div>;
  }
  const snap = session.snapshot();
  const q = session.current;
  const steps = (q?.steps.length ?? 0) > 1;

  const next = () => {
    window.clearTimeout(timer.current);
    session.advance(performance.now());
    setFeedback(undefined);
    setRevealed(false);
    force((n) => n + 1);
  };

  function onTap(pos: FretPosition) {
    if (!q || feedback || session!.awaitingAdvance) return;
    // FR-030: a tap on another string isn't judged; it gets a hint instead.
    if (q.promptedString && pos.string !== q.promptedString) {
      setHint(`That’s string ${pos.string}. This question is on string ${q.promptedString}.`);
      return;
    }
    setHint(undefined);
    const r = session!.tap(pos, performance.now());
    if (!r) return;
    const info = positionInfo(profile, pos, q.context);
    if (r.finished) {
      void app.recordAttempt(r.finished, { instrumentId, profile, lessonId, drillId });
      const step = q.steps[Math.min(session!.snapshot().stepIndex, q.steps.length - 1)]!;
      setFeedback({
        correct: r.finished.correct,
        text: r.correct && r.finished.correct
          ? `Correct: ${info?.note ?? ''}`
          : `Not quite: that’s ${info?.note ?? 'a different note'}. ${step.hint ? prettyText(step.hint) + ' ' : ''}The right ${steps ? 'notes are' : 'note is'} marked.`,
      });
      if (!r.finished.correct) setRevealed(true);
      if (r.finished.correct && autoMs > 0) timer.current = window.setTimeout(next, autoMs);
    }
    force((n) => n + 1);
  }

  if (snap.state === 'completed' && !session.endedEarly && !reported.current) {
    reported.current = true;
    onComplete?.();
  }
  if (snap.state === 'completed' || snap.state === 'abandoned' || !q) {
    return <DrillSummary settings={settings} answered={snap.answered} endedEarly={session.endedEarly} onAgain={() => onExit({ completed: snap.state === 'completed' && !session.endedEarly })} />;
  }

  const win = clampWindow([settings.fromFret, settings.toFret], profile);
  const markers = buildMarkers(q, snap.stepIndex, snap.taps, revealed, profile);

  return (
    <section className="runner" aria-labelledby="prompt">
      <div className="runner-head">
        <span className="count">Question {snap.index + 1} of {snap.questions.length}</span>
        <span className="muted">{DRILL_LABELS[settings.type]}</span>
        <button className="link" onClick={() => { session.end(); force((n) => n + 1); }}>End drill</button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h2 id="prompt" className="prompt" tabIndex={-1} ref={promptRef}>{prettyText(q.text)}</h2>
      </div>
      {hint && <p className="hint" role="status">{hint}</p>}
      {steps && (
        <ol className="steps" aria-label="Steps">
          {q.steps.map((s, i) => <li key={i} className={i < snap.stepIndex ? 'done' : i === snap.stepIndex ? 'now' : ''}>{prettyText(s.label)}</li>)}
        </ol>
      )}
      <Fretboard
        profile={profile}
        from={win[0]}
        to={win[1]}
        markers={markers}
        handedness={display.handedness}
        spacing={display.fretSpacing}
        onTap={onTap}
        promptedString={q.promptedString}
        strings={settings.strings}
        windowRange={[win[0], win[1]]}
        label="Drill fretboard: tap your answer"
        describe={(pos) => {
          const base = `String ${pos.string}${pos.string === q.promptedString ? ' (prompted string)' : ''}, fret ${pos.fret}`;
          return snap.taps.some((t) => t.pos.string === pos.string && t.pos.fret === pos.fret) || revealed ? describePosition(profile, pos, q.context) : base;
        }}
      />
      <div className={`feedback${feedback ? (feedback.correct ? ' ok' : ' bad') : ''}`} aria-live="assertive" role="status">
        {feedback && (
          <>
            <span className="fb-icon" aria-hidden="true">{feedback.correct ? '✓' : '✕'}</span>
            <span>{feedback.text}</span>
            {(!feedback.correct || autoMs === 0) && <button className="primary" onClick={next} autoFocus>Next question</button>}
          </>
        )}
      </div>
    </section>
  );
}

function buildMarkers(q: Question, stepIndex: number, taps: readonly { pos: FretPosition; correct: boolean }[], revealed: boolean, profile: InstrumentProfile): Marker[] {
  const out: Marker[] = [];
  const seen = new Set<string>();
  const add = (m: Marker) => { const k = `${m.pos.string}:${m.pos.fret}`; if (!seen.has(k)) { seen.add(k); out.push(m); } };
  for (const t of [...taps].reverse()) {
    add({ pos: t.pos, kind: t.correct ? 'correct' : 'incorrect', label: t.correct ? '✓' : '✕', name: `your tap, ${t.correct ? 'correct' : 'incorrect'}` });
  }
  for (const r of q.reference) {
    const info = positionInfo(profile, r, q.context);
    add({ pos: r, kind: 'reference', label: info?.note.replace(/-?\d+$/, '') ?? '', name: 'reference' });
  }
  if (revealed) {
    const step = q.steps[Math.min(stepIndex, q.steps.length - 1)]!;
    for (const v of step.valid) add({ pos: v, kind: 'revealed', label: positionInfo(profile, v, q.context)?.note.replace(/-?\d+$/, '') ?? '', name: 'answer' });
  }
  return out;
}

function DrillSummary({ settings, answered, endedEarly, onAgain }: { settings: DrillSettings; answered: readonly import('../../domain/drills/session').AnsweredQuestion[]; endedEarly: boolean; onAgain: () => void }) {
  const missed = answered.filter((a) => !a.correct);
  const sum = summarize(fromAnswered(answered));
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
        </>
      ) : <p>No questions answered.</p>}
      {endedEarly && answered.length > 0 && <p className="muted">Ended early: the questions you answered are saved.</p>}
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

export const stringName = (p: InstrumentProfile, n: number) => `${n} (${formatPitchClass(openString(p, n)!)})`;
