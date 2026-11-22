/**
 * T051 (session part): DrillSession state machine (data-model §2) and the Edge Cases rules
 * [FR-030, FR-033, FR-034, FR-040, FR-056, FR-057, US3-3, US3-7].
 * Written test-after: the implementation already existed. Questions are hand-built here so the
 * session is tested apart from the generators.
 */
import { describe, expect, it } from 'vitest';
import { DrillSession } from './session';
import type { Question } from './types';

/** "Find G on string 6, low E": G2 at fret 3 and G3 at fret 15. */
const noteQ = (n = 0): Question => ({
  drillType: 'note-finding',
  itemKey: `nf|guitar:E2-A2-D3-G3-B3-E4|6|7`,
  prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
  text: `Find G on string 6, low E (${n})`,
  steps: [{ label: 'G', valid: [{ string: 6, fret: 3 }, { string: 6, fret: 15 }], accepts: [7] }],
  reference: [],
  promptedString: 6,
  group: 'String 6',
});

/** Root–fifth–octave from C2 (string 3 fret 3 on EADG): 5th G2, octave C3. One attempt per question (FR-040). */
const rfoQ = (): Question => ({
  drillType: 'bass-root-fifth-octave',
  itemKey: 'bs|bass-root-fifth-octave|major',
  prompt: { drillType: 'bass-root-fifth-octave', root: { string: 3, fret: 3 }, qualityId: 'major' },
  text: 'Play the 5th, then the octave, from this root (C)',
  steps: [
    { label: '5', valid: [{ string: 2, fret: 5 }], accepts: [7] },
    { label: 'octave', valid: [{ string: 1, fret: 5 }], accepts: [0] },
  ],
  reference: [{ string: 3, fret: 3 }],
  group: 'Major',
});

/** Am7 arpeggio from A1 (string 4 fret 5): C, E, G. FR-057: each step is judged; the drill continues. */
const arpQ = (): Question => ({
  drillType: 'bass-arpeggio',
  itemKey: 'bs|bass-arpeggio|min7',
  prompt: { drillType: 'bass-arpeggio', root: { string: 4, fret: 5 }, qualityId: 'min7' },
  text: 'Play the Am7 arpeggio up from this root (A)',
  steps: [
    { label: 'b3', valid: [{ string: 4, fret: 8 }, { string: 3, fret: 3 }], accepts: [0] },
    { label: '5', valid: [{ string: 3, fret: 7 }, { string: 2, fret: 2 }], accepts: [4] },
    { label: 'b7', valid: [{ string: 2, fret: 5 }, { string: 1, fret: 0 }], accepts: [7] },
  ],
  reference: [{ string: 4, fret: 5 }],
  group: 'Minor 7th',
});

describe('FR-033 response time and single-step judging', () => {
  it('starts running; a correct tap finishes the question with the time since display', () => {
    const s = new DrillSession([noteQ()], 1000);
    expect(s.snapshot().state).toBe('running');
    const r = s.tap({ string: 6, fret: 15 }, 1750);
    expect(r?.correct).toBe(true);
    expect(r?.finished).toMatchObject({ correct: true, responseMs: 750, taps: [{ string: 6, fret: 15 }] });
    expect(s.snapshot().answered).toHaveLength(1);
  });

  it('a wrong tap on the prompted string finishes the question as incorrect (US3-2)', () => {
    const s = new DrillSession([noteQ()], 0);
    const r = s.tap({ string: 6, fret: 4 }, 500);
    expect(r?.correct).toBe(false);
    expect(r?.finished?.correct).toBe(false);
  });

  it('after a finished question the session waits for advance (feedback is showing)', () => {
    const s = new DrillSession([noteQ(1), noteQ(2)], 0);
    s.tap({ string: 6, fret: 3 }, 100);
    expect((s as unknown as { awaitingAdvance?: boolean }).awaitingAdvance).toBe(true);
    s.advance(200);
    expect((s as unknown as { awaitingAdvance?: boolean }).awaitingAdvance).toBe(false);
  });

  it('advance shows the next question and restarts the timer', () => {
    const s = new DrillSession([noteQ(1), noteQ(2)], 0);
    s.tap({ string: 6, fret: 3 }, 400);
    s.advance(2000);
    expect(s.snapshot().index).toBe(1);
    expect(s.tap({ string: 6, fret: 3 }, 2300)?.finished?.responseMs).toBe(300);
  });

  it('answering the last question and advancing completes the session', () => {
    const s = new DrillSession([noteQ()], 0);
    s.tap({ string: 6, fret: 3 }, 100);
    s.advance(200);
    expect(s.snapshot().state).toBe('completed');
    expect(s.current).toBeUndefined();
    expect(s.tap({ string: 6, fret: 3 }, 300)).toBeUndefined();
    s.end();
    expect(s.snapshot().state).toBe('completed');
  });
});

describe('FR-030 / US3-3 taps on another string are ignored and nothing is recorded', () => {
  it('a tap off the prompted string neither finishes the question nor records an answer', () => {
    const s = new DrillSession([noteQ()], 0);
    const r = s.tap({ string: 4, fret: 5 }, 300); // G3 on string 4: right pitch, wrong string
    expect(r?.finished).toBeUndefined();
    expect(s.snapshot().answered).toHaveLength(0);
    // The question is still open and can be answered correctly.
    expect(s.tap({ string: 6, fret: 3 }, 600)?.finished?.correct).toBe(true);
  });
});

describe('FR-040 one attempt per question', () => {
  it('a second tap after the question is finished (before advance) records nothing more', () => {
    const s = new DrillSession([noteQ(), noteQ(2)], 0);
    s.tap({ string: 6, fret: 4 }, 100);
    s.tap({ string: 6, fret: 3 }, 200);
    expect(s.snapshot().answered).toHaveLength(1);
    expect(s.snapshot().answered[0]!.correct).toBe(false);
  });
});

describe('FR-056 multi-step root–fifth–octave: one judged unit', () => {
  it('correct steps advance the step index without finishing', () => {
    const s = new DrillSession([rfoQ()], 0);
    const r1 = s.tap({ string: 2, fret: 5 }, 100);
    expect(r1).toEqual({ correct: true });
    expect(s.snapshot().stepIndex).toBe(1);
    const r2 = s.tap({ string: 1, fret: 5 }, 900);
    expect(r2?.finished).toMatchObject({ correct: true, responseMs: 900 });
    expect(r2?.finished?.taps).toEqual([{ string: 2, fret: 5 }, { string: 1, fret: 5 }]);
  });

  it('a wrong tap ends the multi-step question as incorrect', () => {
    const s = new DrillSession([rfoQ()], 0);
    const r = s.tap({ string: 2, fret: 6 }, 100);
    expect(r?.finished?.correct).toBe(false);
    expect(s.snapshot().answered).toHaveLength(1);
  });

  it('a wrong second step ends it as incorrect, even after a correct first step', () => {
    const s = new DrillSession([rfoQ()], 0);
    s.tap({ string: 2, fret: 5 }, 100);
    expect(s.tap({ string: 1, fret: 7 }, 200)?.finished?.correct).toBe(false);
  });
});

describe('FR-057 arpeggio: each step is judged and the drill continues to the next step', () => {
  it('a wrong tone at step 1 is flagged but does not end the arpeggio', () => {
    const s = new DrillSession([arpQ()], 0);
    const r = s.tap({ string: 4, fret: 7 }, 100); // B, not C
    expect(r?.correct).toBe(false);
    expect(s.snapshot().stepIndex).toBe(1);
    expect(s.tap({ string: 3, fret: 7 }, 200)?.correct).toBe(true);
  });
});

describe('Edge Cases: interrupted drill (pause / resume)', () => {
  it('taps are ignored while paused', () => {
    const s = new DrillSession([noteQ()], 0);
    s.pause();
    expect(s.snapshot().state).toBe('paused');
    expect(s.tap({ string: 6, fret: 3 }, 100)).toBeUndefined();
    expect(s.snapshot().answered).toHaveLength(0);
  });

  it('resume re-shows the current question and restarts its timer', () => {
    const s = new DrillSession([noteQ(1), noteQ(2)], 0);
    s.tap({ string: 6, fret: 3 }, 100);
    s.advance(1000);
    s.pause();
    s.resume(60_000);
    expect(s.snapshot().state).toBe('running');
    expect(s.snapshot().index).toBe(1);
    expect(s.tap({ string: 6, fret: 3 }, 60_450)?.finished?.responseMs).toBe(450);
  });

  it('resume discards a partly entered multi-step answer (the question is shown again)', () => {
    const s = new DrillSession([rfoQ()], 0);
    s.tap({ string: 2, fret: 5 }, 100);
    s.pause();
    s.resume(5000);
    expect(s.snapshot().stepIndex).toBe(0);
    expect(s.snapshot().taps).toHaveLength(0);
  });

  it('answered questions are kept across pause and resume', () => {
    const s = new DrillSession([noteQ(1), noteQ(2)], 0);
    s.tap({ string: 6, fret: 3 }, 100);
    s.pause();
    s.resume(500);
    expect(s.snapshot().answered).toHaveLength(1);
  });

  it('resume without a pause and pause twice are harmless', () => {
    const s = new DrillSession([noteQ()], 0);
    s.resume(10_000);
    expect(s.tap({ string: 6, fret: 3 }, 500)?.finished?.responseMs).toBe(500);
    const t = new DrillSession([noteQ()], 0);
    t.pause();
    t.pause();
    expect(t.snapshot().state).toBe('paused');
  });
});

describe('FR-034 End drill', () => {
  it('end() with no answers → abandoned', () => {
    const s = new DrillSession([noteQ(), noteQ()], 0);
    s.end();
    expect(s.snapshot().state).toBe('abandoned');
  });

  it('end() while paused with no answers → abandoned', () => {
    const s = new DrillSession([noteQ()], 0);
    s.pause();
    s.end();
    expect(s.snapshot().state).toBe('abandoned');
  });

  it('US3-7: ending early keeps the answered questions, and the session counts as abandoned for FR-028', () => {
    const qs = Array.from({ length: 20 }, (_, i) => noteQ(i));
    const s = new DrillSession(qs, 0);
    for (let i = 0; i < 8; i++) {
      s.tap({ string: 6, fret: 3 }, i * 1000 + 500);
      s.advance(i * 1000 + 1000);
    }
    s.end();
    const snap = s.snapshot();
    expect(snap.answered).toHaveLength(8);
    // FR-034: "A session ended early counts as abandoned for FR-028". Either the abandoned state or
    // an explicit ended-early marker satisfies that, as long as the session is not plain "completed".
    const early = snap.state === 'abandoned' || (s as unknown as { endedEarly?: boolean }).endedEarly === true;
    expect(early).toBe(true);
  });

  it('answering every question and then ending is not "ended early"', () => {
    const s = new DrillSession([noteQ()], 0);
    s.tap({ string: 6, fret: 3 }, 100);
    s.end();
    expect(s.snapshot().state).toBe('completed');
    expect((s as unknown as { endedEarly?: boolean }).endedEarly ?? false).toBe(false);
  });

  it('after end, taps and advance do nothing', () => {
    const s = new DrillSession([noteQ(), noteQ()], 0);
    s.end();
    expect(s.tap({ string: 6, fret: 3 }, 100)).toBeUndefined();
    s.advance(200);
    expect(s.snapshot().index).toBe(0);
  });
});
