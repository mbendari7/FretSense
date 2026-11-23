import type { FretPosition } from '@fretsense/theory';
import { judgeTap } from './generate';
import type { Question, RfoShape } from './types';

/** DrillSession state machine (data-model §2): idle → running ⇄ paused → completed | abandoned. */
export type SessionState = 'running' | 'answered' | 'paused' | 'completed' | 'abandoned';

export interface AnsweredQuestion {
  readonly question: Question;
  readonly taps: FretPosition[];
  readonly correct: boolean;
  readonly responseMs: number;
  /**
   * FR-034 per-string figures for a multi-step question (arpeggio, root–fifth–octave): the string of
   * its Step 1 (root) position, the user's tap, or the revealed root if Step 1 was missed.
   */
  readonly rootString?: number;
}

/** Multi-step questions whose steps are each judged (FR-056, FR-057): one attempt per question (FR-040). */
export const isStepJudged = (q: Question) => q.drillType === 'arpeggio' || q.drillType === 'root-fifth-octave';

/**
 * A judged step: the tap it was judged on and whether it was correct. FR-056a: a missed
 * root–fifth–octave step also carries the position revealed for it (fixed for the rest of the question).
 */
export interface StepResult { readonly pos: FretPosition; readonly correct: boolean; readonly revealed?: FretPosition }

/** A tap as shown: FR-056 "placed" while a root-pitch-class tap's role (root or octave) is open. */
export interface TapRecord { readonly pos: FretPosition; readonly correct: boolean; readonly placed?: boolean }

const same = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;
const pcOf = (m: number) => ((m % 12) + 12) % 12;

export interface SessionSnapshot {
  readonly state: SessionState;
  readonly index: number;
  readonly stepIndex: number;
  /** Taps in the order they were made. */
  readonly taps: readonly TapRecord[];
  /** FR-057: each step's judged tap, by step number (undefined while the step is pending). */
  readonly stepResults: readonly (StepResult | undefined)[];
  /** The step the latest tap was judged against (FR-056 taps may come in any order). */
  readonly lastStep: number;
  readonly answered: readonly AnsweredQuestion[];
  readonly questions: readonly Question[];
}

/**
 * Valid shapes for a root–fifth–octave question built without them: every (root, 5th, octave)
 * triple of the steps' positions spanning ≤ 4 frets (max − min ≤ 3), in step order.
 */
function shapesFromSteps(q: Question): RfoShape[] {
  const [r, f, o] = [0, 1, 2].map((k) => q.steps[k]?.valid ?? []);
  const out: RfoShape[] = [];
  for (const a of r!) for (const b of f!) for (const c of o!) {
    const fr = [a.fret, b.fret, c.fret];
    if (Math.max(...fr) - Math.min(...fr) <= 3) out.push({ rm: 0, pos: [a, b, c] });
  }
  return out;
}

export class DrillSession {
  private state: SessionState = 'running';
  private index = 0;
  private stepIndex = 0;
  private taps: TapRecord[] = [];
  /** FR-056: the accepted root-pitch-class tap whose role is still open, if any. */
  private placed: FretPosition | undefined;
  private results: (StepResult | undefined)[] = [];
  private lastStep = 0;
  private answered: AnsweredQuestion[] = [];
  /** When the current question was shown, shifted forward by any paused time (Edge Cases). */
  private shownAt: number;
  /** When the latest tap was made in the current question (the pause time when pause() has none). */
  private lastTapAt: number;
  /** Active time of the current question before the pause (multi-step questions, Edge Cases). */
  private activeBeforePause = 0;
  private anyWrong = false;
  /** True when the user ended the drill before answering every question (FR-034). */
  endedEarly = false;

  constructor(readonly questions: readonly Question[], now: number) {
    this.shownAt = now;
    this.lastTapAt = now;
  }

  get current(): Question | undefined {
    return this.questions[this.index];
  }

  snapshot(): SessionSnapshot {
    return { state: this.state, index: this.index, stepIndex: this.stepIndex, taps: this.taps.map((t) => ({ ...t })), stepResults: [...this.results], lastStep: this.lastStep, answered: [...this.answered], questions: this.questions };
  }

  /**
   * FR-056a: whether a tap repeats a position already in this question's answer ("in-answer": tapped
   * and accepted or placed, or revealed) or already marked wrong ("wrong"). Such a tap is ignored.
   */
  repeatOf(pos: FretPosition): 'in-answer' | 'wrong' | undefined {
    const q = this.current;
    if (!q || q.drillType !== 'root-fifth-octave') return undefined;
    if (this.results.some((r) => r?.revealed && same(r.revealed, pos))) return 'in-answer';
    const t = this.taps.find((x) => same(x.pos, pos));
    if (!t) return undefined;
    return t.correct || t.placed ? 'in-answer' : 'wrong';
  }

  /**
   * One tap. Returns the finished question when its last step is judged (FR-040: one attempt per
   * question, arpeggio and root–fifth–octave included; step results are shown, never recorded).
   * - Arpeggio (FR-057): steps are judged in order; a wrong step is flagged and the drill continues.
   * - Root–fifth–octave (FR-056, FR-056a): taps come in any order and are judged against the
   *   question's valid shapes (see `tapShape`).
   * - Other multi-step drills: a wrong tap ends the question.
   */
  tap(pos: FretPosition, now: number): { correct: boolean; finished?: AnsweredQuestion } | undefined {
    const q = this.current;
    if (this.state !== 'running' || !q) return undefined;
    // FR-030: a tap on another string is ignored and records nothing.
    if (q.promptedString && pos.string !== q.promptedString) return undefined;
    let correct: boolean;
    let flagAndContinue = q.drillType === 'arpeggio';
    if (q.drillType === 'root-fifth-octave') {
      if (this.repeatOf(pos)) return undefined; // FR-056a: not judged, charged or recorded
      correct = this.tapShape(q, q.shapes ?? shapesFromSteps(q), pos);
      flagAndContinue = true;
    } else {
      const k = this.stepIndex;
      correct = judgeTap(q, k, pos);
      this.results[k] = { pos, correct };
      this.lastStep = k;
      this.taps.push({ pos, correct });
    }
    if (!correct) this.anyWrong = true;
    this.lastTapAt = now;
    const nextPending = q.steps.findIndex((_, i) => !this.results[i]);
    if ((correct || flagAndContinue) && nextPending >= 0) {
      this.stepIndex = nextPending;
      return { correct };
    }
    const rootString = isStepJudged(q) ? this.rootStringOf(q) : undefined;
    const finished: AnsweredQuestion = {
      question: q,
      taps: this.taps.map((t) => t.pos),
      correct: !this.anyWrong,
      responseMs: Math.max(0, Math.round(now - this.shownAt)),
      ...(rootString !== undefined ? { rootString } : {}),
    };
    this.answered.push(finished);
    this.state = 'answered'; // no more taps until advance(); resume never re-asks an answered question
    return { correct, finished };
  }

  /** FR-034: Step 1's position string: the user's tap, else the revealed root (else the first valid root). */
  private rootStringOf(q: Question): number | undefined {
    const r = this.results[0];
    if (r?.correct) return r.pos.string;
    return r?.revealed?.string ?? q.steps[0]?.valid[0]?.string;
  }

  /**
   * FR-034: whether the current question has been started but not finished (some tap judged or
   * placed, last step not judged). Ending the drill discards it.
   */
  get hasUnfinished(): boolean {
    if (this.state !== 'running' && this.state !== 'paused') return false;
    return !!this.current && (this.taps.length > 0 || this.results.some(Boolean));
  }

  /**
   * FR-056 / FR-056a. A tap is accepted if some valid shape holds it together with every fixed
   * (accepted or revealed) position, each in its role, and the placed tap in the root or octave role.
   * An accepted tap's role is fixed when every such shape gives it the same role; a root-pitch-class
   * tap with both roles still possible is "placed". A wrong tap first resolves a placed tap (the
   * first shape, in reveal order, preferring the placed tap as the root), then is charged by pitch
   * class to one pending step, which is missed and revealed from the first fitting shape.
   */
  private tapShape(q: Question, shapes: readonly RfoShape[], pos: FretPosition): boolean {
    const fixed = (): (FretPosition | undefined)[] => [0, 1, 2].map((k) => {
      const r = this.results[k];
      return r ? (r.correct ? r.pos : r.revealed) : undefined;
    });
    const fits = (sh: RfoShape, extra?: FretPosition) => {
      const f = fixed();
      if (!f.every((x, k) => !x || same(sh.pos[k]!, x))) return false;
      if (this.placed && !same(sh.pos[0], this.placed) && !same(sh.pos[2], this.placed)) return false;
      if (extra && !sh.pos.some((x) => same(x, extra))) return false;
      return true;
    };
    const roleIn = (sh: RfoShape, x: FretPosition) => sh.pos.findIndex((y) => same(y, x));
    const markTap = (x: FretPosition, correct: boolean, placed?: boolean) => {
      const t = this.taps.findIndex((y) => same(y.pos, x));
      const rec: TapRecord = placed ? { pos: x, correct, placed } : { pos: x, correct };
      if (t >= 0) this.taps[t] = rec; else this.taps.push(rec);
    };
    const assign = (x: FretPosition, k: number) => {
      this.results[k] = { pos: x, correct: true };
      this.lastStep = k;
      markTap(x, true);
    };
    /** Fixes the placed tap's role once every fitting shape agrees on it. */
    const settlePlaced = () => {
      const p = this.placed;
      if (!p) return;
      const roles = new Set(shapes.filter((sh) => fits(sh)).map((sh) => roleIn(sh, p)));
      if (roles.size === 1) { this.placed = undefined; assign(p, [...roles][0]!); }
    };

    const cands = shapes.filter((sh) => fits(sh, pos));
    if (cands.length) {
      const roles = new Set(cands.map((sh) => roleIn(sh, pos)));
      if (roles.size === 1) assign(pos, [...roles][0]!);
      else { this.placed = pos; this.lastStep = 0; markTap(pos, true, true); }
      // A second accepted position fixes the placed tap's role.
      if (this.placed && !same(this.placed, pos)) settlePlaced();
      return true;
    }

    // Wrong tap. A placed tap is resolved first, preferring the root role.
    if (this.placed) {
      const p = this.placed;
      const fitting = shapes.filter((sh) => fits(sh));
      const sh = fitting.find((x) => same(x.pos[0], p)) ?? fitting[0]!;
      this.placed = undefined;
      assign(p, roleIn(sh, p));
    }
    const pending = [0, 1, 2].filter((k) => !this.results[k]);
    const rootPc = q.steps[0]!.accepts[0];
    const fifthPc = q.steps[1]!.accepts[0];
    // Without the open-string pitches the tap's pitch class is unknown: charge the lowest pending step.
    const pc = q.openMidi ? pcOf(q.openMidi[pos.string - 1]! + pos.fret) : -1;
    const rootOrOctave = pending.filter((k) => k === 0 || k === 2);
    const k = pc === fifthPc && pending.includes(1) ? 1 : pc === rootPc && rootOrOctave.length ? rootOrOctave[0]! : pending[0]!;
    const reveal = shapes.find((sh) => fits(sh));
    this.results[k] = reveal ? { pos, correct: false, revealed: reveal.pos[k] } : { pos, correct: false };
    this.lastStep = k;
    this.taps.push({ pos, correct: false });
    return false;
  }

  /** Moves to the next question after feedback. */
  advance(now: number): void {
    if (this.state !== 'answered' && this.state !== 'running') return;
    this.state = 'running';
    this.index++;
    this.stepIndex = 0;
    this.taps = [];
    this.results = [];
    this.placed = undefined;
    this.lastStep = 0;
    this.anyWrong = false;
    this.shownAt = now;
    this.lastTapAt = now;
    this.activeBeforePause = 0;
    if (this.index >= this.questions.length) this.state = 'completed';
  }

  /**
   * Edge Cases "Interrupted drill": pausing stops the current question's clock. `now` is when the
   * pause began; without it, the time of the latest tap is used (no active time is invented).
   */
  pause(now?: number): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.activeBeforePause = Math.max(0, (now ?? this.lastTapAt) - this.shownAt);
  }

  /** Whether the current question has been answered and is waiting for advance(). */
  get awaitingAdvance(): boolean {
    return this.state === 'answered';
  }

  /**
   * Edge Cases "Interrupted drill": resume re-shows the current question. A single-step question's
   * timer restarts. A multi-step question (arpeggio, root–fifth–octave) keeps its judged steps, taps,
   * placed and revealed positions and continues at the next pending step; its response time is its
   * active time before the pause plus the time since resume (paused time never counts).
   */
  resume(now: number): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    const q = this.current;
    if (q && isStepJudged(q)) {
      this.shownAt = now - this.activeBeforePause;
      this.lastTapAt = now;
      this.activeBeforePause = 0;
      const next = q.steps.findIndex((_, i) => !this.results[i]);
      if (next >= 0) this.stepIndex = next;
      return;
    }
    this.stepIndex = 0;
    this.taps = [];
    this.results = [];
    this.placed = undefined;
    this.lastStep = 0;
    this.anyWrong = false;
    this.shownAt = now;
    this.lastTapAt = now;
    this.activeBeforePause = 0;
  }

  /** True when End drill discarded a started, unfinished question (FR-034). */
  discardedUnfinished = false;

  end(): void {
    if (this.state === 'running' || this.state === 'paused' || this.state === 'answered') {
      this.discardedUnfinished = this.hasUnfinished;
      this.endedEarly = this.answered.length < this.questions.length;
      this.state = this.answered.length ? 'completed' : 'abandoned';
    }
  }
}
