import type { FretPosition } from '@fretsense/theory';
import { judgeTap } from './generate';
import type { Question } from './types';

/** DrillSession state machine (data-model §2): idle → running ⇄ paused → completed | abandoned. */
export type SessionState = 'running' | 'answered' | 'paused' | 'completed' | 'abandoned';

export interface AnsweredQuestion {
  readonly question: Question;
  readonly taps: FretPosition[];
  readonly correct: boolean;
  readonly responseMs: number;
}

export interface SessionSnapshot {
  readonly state: SessionState;
  readonly index: number;
  readonly stepIndex: number;
  readonly taps: readonly { pos: FretPosition; correct: boolean }[];
  readonly answered: readonly AnsweredQuestion[];
  readonly questions: readonly Question[];
}

export class DrillSession {
  private state: SessionState = 'running';
  private index = 0;
  private stepIndex = 0;
  private taps: { pos: FretPosition; correct: boolean }[] = [];
  private answered: AnsweredQuestion[] = [];
  private shownAt: number;
  private anyWrong = false;
  /** True when the user ended the drill before answering every question (FR-034). */
  endedEarly = false;

  constructor(readonly questions: readonly Question[], now: number) {
    this.shownAt = now;
  }

  get current(): Question | undefined {
    return this.questions[this.index];
  }

  snapshot(): SessionSnapshot {
    return { state: this.state, index: this.index, stepIndex: this.stepIndex, taps: [...this.taps], answered: [...this.answered], questions: this.questions };
  }

  /**
   * One tap. Returns the finished question when the judged unit is complete (FR-031: one attempt
   * per question). A wrong tap ends a multi-step question.
   */
  tap(pos: FretPosition, now: number): { correct: boolean; finished?: AnsweredQuestion } | undefined {
    const q = this.current;
    if (this.state !== 'running' || !q) return undefined;
    // FR-030: a tap on another string is ignored and records nothing.
    if (q.promptedString && pos.string !== q.promptedString) return undefined;
    const correct = judgeTap(q, this.stepIndex, pos);
    this.taps.push({ pos, correct });
    if (!correct) this.anyWrong = true;
    // FR-057: arpeggios flag a wrong step and continue.
    const flagAndContinue = q.drillType === 'bass-arpeggio';
    if ((correct || flagAndContinue) && this.stepIndex < q.steps.length - 1) {
      this.stepIndex++;
      return { correct };
    }
    // FR-056: the whole root–fifth–octave shape must span at most 4 frets (max − min ≤ 3).
    if (q.drillType === 'bass-root-fifth-octave' && correct) {
      const frets = [...q.reference, ...this.taps.filter((t) => t.correct).map((t) => t.pos)].map((x) => x.fret);
      if (Math.max(...frets) - Math.min(...frets) > 3) this.anyWrong = true;
    }
    const finished: AnsweredQuestion = {
      question: q,
      taps: this.taps.map((t) => t.pos),
      correct: !this.anyWrong,
      responseMs: Math.max(0, Math.round(now - this.shownAt)),
    };
    this.answered.push(finished);
    this.state = 'answered'; // no more taps until advance(); resume never re-asks an answered question
    return { correct, finished };
  }

  /** Moves to the next question after feedback. */
  advance(now: number): void {
    if (this.state !== 'answered' && this.state !== 'running') return;
    this.state = 'running';
    this.index++;
    this.stepIndex = 0;
    this.taps = [];
    this.anyWrong = false;
    this.shownAt = now;
    if (this.index >= this.questions.length) this.state = 'completed';
  }

  pause(): void {
    if (this.state === 'running') this.state = 'paused';
  }

  /** Whether the current question has been answered and is waiting for advance(). */
  get awaitingAdvance(): boolean {
    return this.state === 'answered';
  }

  /** Resume re-shows the current question and restarts its timer (Edge Cases). */
  resume(now: number): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.stepIndex = 0;
    this.taps = [];
    this.anyWrong = false;
    this.shownAt = now;
  }

  end(): void {
    if (this.state === 'running' || this.state === 'paused' || this.state === 'answered') {
      this.endedEarly = this.answered.length < this.questions.length;
      this.state = this.answered.length ? 'completed' : 'abandoned';
    }
  }
}
