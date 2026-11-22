/**
 * T023: seeded PRNG and weighted sampling (research R9) [FR-041].
 * Written test-after: the implementation already existed. Distribution bounds are derived here from
 * the binomial standard deviation, not tuned to the generator's output.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mulberry32, pickIndex, weightedPick } from './prng';

describe('FR-041 seeded PRNG determinism', () => {
  it('the same seed gives the same sequence', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('different seeds give different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const xs = Array.from({ length: 20 }, () => a());
    const ys = Array.from({ length: 20 }, () => b());
    expect(xs).not.toEqual(ys);
  });

  it('property: outputs lie in [0, 1) for any 32-bit seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const r = mulberry32(seed);
        for (let i = 0; i < 50; i++) {
          const x = r();
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
        }
      }),
    );
  });

  it('a 32-bit generator: the seed is taken modulo 2^32', () => {
    const a = mulberry32(7);
    const b = mulberry32(7 + 2 ** 32);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('mean of 20,000 draws is within 4 standard errors of 1/2 (uniform variance 1/12)', () => {
    const n = 20_000;
    const r = mulberry32(99);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += r();
    const se = Math.sqrt(1 / 12 / n);
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(4 * se);
  });
});

describe('FR-041 pickIndex', () => {
  it('property: always an integer index in [0, n)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 1, max: 500 }), (seed, n) => {
        const r = mulberry32(seed);
        for (let i = 0; i < 20; i++) {
          const k = pickIndex(r, n);
          expect(Number.isInteger(k)).toBe(true);
          expect(k).toBeGreaterThanOrEqual(0);
          expect(k).toBeLessThan(n);
        }
      }),
    );
  });
});

describe('FR-041 weightedPick distribution (derived binomial bound)', () => {
  it('frequencies match w_i / sum(w) within 4 binomial standard deviations', () => {
    const items = ['a', 'b', 'c', 'd'] as const;
    const weights = [1, 2, 3, 4];
    const total = 10;
    const n = 20_000;
    const r = mulberry32(2026);
    const counts = new Map<string, number>(items.map((i) => [i, 0]));
    for (let k = 0; k < n; k++) {
      const x = weightedPick(r, items, weights);
      counts.set(x, counts.get(x)! + 1);
    }
    items.forEach((item, i) => {
      const p = weights[i]! / total;
      const sd = Math.sqrt(n * p * (1 - p)); // binomial standard deviation
      expect(Math.abs(counts.get(item)! - n * p)).toBeLessThan(4 * sd);
    });
  });

  it('equal weights give a uniform distribution within 4 binomial standard deviations', () => {
    const items = [0, 1, 2, 3, 4, 5];
    const n = 12_000;
    const r = mulberry32(7);
    const counts = new Array(6).fill(0) as number[];
    for (let k = 0; k < n; k++) counts[weightedPick(r, items, [1, 1, 1, 1, 1, 1])]!++;
    const p = 1 / 6;
    const sd = Math.sqrt(n * p * (1 - p));
    for (const c of counts) expect(Math.abs(c - n * p)).toBeLessThan(4 * sd);
  });

  it('an rng at the very top of its range still returns an item (the last one)', () => {
    expect(weightedPick(() => 1, ['a', 'b', 'c'], [1, 1, 1])).toBe('c');
    expect(weightedPick(() => 0, ['a', 'b', 'c'], [1, 1, 1])).toBe('a');
  });

  it('a single item is always picked', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 10; i++) expect(weightedPick(r, ['only'], [2.5])).toBe('only');
  });

  it('property: the result is always one of the items', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.double({ min: 0.01, max: 10, noNaN: true }), { minLength: 1, maxLength: 30 }),
        (seed, weights) => {
          const items = weights.map((_, i) => i);
          const r = mulberry32(seed);
          for (let k = 0; k < 10; k++) expect(items).toContain(weightedPick(r, items, weights));
        },
      ),
    );
  });

  it('same seed and weights give the same picks', () => {
    const w = [1, 4, 2];
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 100; i++) expect(weightedPick(a, ['x', 'y', 'z'], w)).toBe(weightedPick(b, ['x', 'y', 'z'], w));
  });
});
