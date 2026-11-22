/**
 * T051 (summary part): session summary [FR-034, FR-037; Edge Cases "Slow answers"].
 * Written test-after: the implementation already existed. Medians are checked against hand
 * computations and a counting property (half the values on each side), not the implementation.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fromAnswered, median, SLOW_MS, summarize } from './summary';
import type { AnsweredQuestion } from './session';
import type { Question } from './types';

describe('FR-034 median response time', () => {
  it('odd, even, single and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeUndefined();
  });

  it('does not reorder its input', () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });

  it('property: at most half the values lie strictly below and at most half strictly above', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 30_000 }), { minLength: 1, maxLength: 60 }), (xs) => {
        const m = median(xs)!;
        expect(xs.filter((x) => x < m).length).toBeLessThanOrEqual(xs.length / 2);
        expect(xs.filter((x) => x > m).length).toBeLessThanOrEqual(xs.length / 2);
        expect(m).toBeGreaterThanOrEqual(Math.min(...xs));
        expect(m).toBeLessThanOrEqual(Math.max(...xs));
      }),
    );
  });
});

describe('FR-034 per-group and total stats; answers over 30 s excluded from time only', () => {
  it('the slow threshold is 30 s', () => expect(SLOW_MS).toBe(30_000));

  it('an answer over 30 s counts toward accuracy but not toward the median', () => {
    const s = summarize([
      { group: 'String 6', correct: true, responseMs: 1000 },
      { group: 'String 6', correct: false, responseMs: 3000 },
      { group: 'String 6', correct: true, responseMs: 45_000 },
    ]);
    const g = s.groups.find((x) => x.group === 'String 6')!;
    expect(g.total).toBe(3);
    expect(g.correct).toBe(2);
    expect(g.accuracy).toBeCloseTo(2 / 3, 12);
    expect(g.medianMs).toBe(2000);
  });

  it('exactly 30 s is not "over 30 s" and is kept', () => {
    const s = summarize([{ group: 'A', correct: true, responseMs: 30_000 }]);
    expect(s.overall.medianMs).toBe(30_000);
    expect(summarize([{ group: 'A', correct: true, responseMs: 30_001 }]).overall.medianMs).toBeUndefined();
  });

  it('per string and in total (US3-4)', () => {
    const s = summarize([
      { group: 'String 5', correct: true, responseMs: 900 },
      { group: 'String 6', correct: true, responseMs: 1200 },
      { group: 'String 6', correct: false, responseMs: 2000 },
      { group: 'String 5', correct: false, responseMs: 1500 },
      { group: 'String 5', correct: true, responseMs: 600 },
    ]);
    expect(s.overall).toMatchObject({ total: 5, correct: 3, medianMs: 1200 });
    expect(s.overall.accuracy).toBeCloseTo(0.6, 12);
    expect(s.groups.map((g) => [g.group, g.total, g.correct, g.medianMs])).toEqual([
      ['String 5', 3, 2, 900],
      ['String 6', 2, 1, 1600],
    ]);
  });

  it('groups sort in natural numeric order (String 2 before String 10)', () => {
    const s = summarize([{ group: 'String 10', correct: true, responseMs: 1 }, { group: 'String 2', correct: true, responseMs: 1 }]);
    expect(s.groups.map((g) => g.group)).toEqual(['String 2', 'String 10']);
  });

  it('empty session: zero totals and no median', () => {
    const s = summarize([]);
    expect(s.overall).toMatchObject({ total: 0, correct: 0, accuracy: 0, medianMs: undefined });
    expect(s.groups).toEqual([]);
  });

  it('property: group totals and correct counts sum to the overall figures', () => {
    const row = fc.record({ group: fc.constantFrom('String 1', 'String 2', 'M3 up', 'b7'), correct: fc.boolean(), responseMs: fc.integer({ min: 0, max: 60_000 }) });
    fc.assert(
      fc.property(fc.array(row, { maxLength: 80 }), (rows) => {
        const s = summarize(rows);
        expect(s.groups.reduce((a, g) => a + g.total, 0)).toBe(s.overall.total);
        expect(s.groups.reduce((a, g) => a + g.correct, 0)).toBe(s.overall.correct);
        expect(s.overall.total).toBe(rows.length);
      }),
    );
  });

  it('fromAnswered maps each answered question to its group, correctness and time', () => {
    const q = { group: 'String 3' } as Question;
    const answered: AnsweredQuestion[] = [{ question: q, taps: [], correct: true, responseMs: 1234 }];
    expect(fromAnswered(answered)).toEqual([{ group: 'String 3', correct: true, responseMs: 1234 }]);
  });
});
