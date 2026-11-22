/**
 * T071: weak-spot weighting (research R9) [FR-041]; US7 scenarios 1 and 5.
 * Written test-after: the implementation already existed. Expected weights are computed by hand from
 * the R9 formula w = 1 + 3(m + 1)/(n + 2) over the item's last 50 attempts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { presetById } from '@fretsense/theory';
import { historiesFrom, itemWeight, HISTORY_WINDOW, type ItemHistory } from './weighting';
import { mulberry32 } from './prng';
import { generateQuestions } from './drills/generate';
import type { DrillSettings } from './drills/types';

const r9 = (n: number, m: number) => 1 + (3 * (m + 1)) / (n + 2);

describe('FR-041 item weight (research R9)', () => {
  it.each([
    [undefined, 2.5], // no history: 1 + 3·1/2
    [{ attempts: 0, misses: 0 }, 2.5],
    [{ attempts: 20, misses: 12 }, 1 + 39 / 22],
    [{ attempts: 20, misses: 2 }, 1 + 9 / 22],
    [{ attempts: 50, misses: 0 }, 1 + 3 / 52],
    [{ attempts: 50, misses: 50 }, 1 + 153 / 52],
  ] as [ItemHistory | undefined, number][])('adaptive on: %o → %f', (h, w) => {
    expect(itemWeight(h, true)).toBeCloseTo(w, 12);
  });

  it('adaptive off: every item weighs 1 (US7-5)', () => {
    expect(itemWeight(undefined, false)).toBe(1);
    expect(itemWeight({ attempts: 20, misses: 20 }, false)).toBe(1);
    expect(itemWeight({ attempts: 50, misses: 0 }, false)).toBe(1);
  });

  it('only the last 50 attempts count', () => {
    expect(HISTORY_WINDOW).toBe(50);
    expect(itemWeight({ attempts: 80, misses: 10 }, true)).toBeCloseTo(r9(50, 10), 12);
  });

  it('property: weight is in (1, 4) and increases monotonically with misses for a fixed n', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }).chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n }))), ([n, m]) => {
        const w = itemWeight({ attempts: n, misses: m }, true);
        expect(w).toBeCloseTo(r9(n, m), 12);
        expect(w).toBeGreaterThan(1);
        expect(w).toBeLessThan(4);
        if (m < n) expect(itemWeight({ attempts: n, misses: m + 1 }, true)).toBeGreaterThan(w);
      }),
    );
  });
});

describe('FR-041 histories over the last 50 attempts per item', () => {
  it('groups by item key and counts misses', () => {
    const h = historiesFrom([
      { itemKey: 'iv|M3|up', outcome: 'correct' },
      { itemKey: 'iv|M3|up', outcome: 'incorrect' },
      { itemKey: 'iv|P5|up', outcome: 'incorrect' },
    ]);
    expect(h.get('iv|M3|up')).toEqual({ attempts: 2, misses: 1 });
    expect(h.get('iv|P5|up')).toEqual({ attempts: 1, misses: 1 });
    expect(h.has('iv|m3|up')).toBe(false);
  });

  it('keeps only the newest 50 (input is oldest first)', () => {
    const old = Array.from({ length: 10 }, () => ({ itemKey: 'k', outcome: 'incorrect' as const }));
    const recent = Array.from({ length: 50 }, () => ({ itemKey: 'k', outcome: 'correct' as const }));
    expect(historiesFrom([...old, ...recent]).get('k')).toEqual({ attempts: 50, misses: 0 });
    expect(historiesFrom([...recent, ...old]).get('k')).toEqual({ attempts: 50, misses: 10 });
  });
});

// ---------------------------------------------------------------------------------------------
// US7 scenarios 1 and 5 (6-string Standard, the FR-031 note-finding defaults: naturals, all
// strings, frets 0–12). Items are (geometryId, string, pitch class), data-model §3.1 grammar.
// ---------------------------------------------------------------------------------------------
const profile = presetById('guitar6-standard')!.profile;
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const settings: DrillSettings = {
  type: 'note-finding', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12, count: 100, octaveMode: 'any', notes: NATURALS,
};
const SEED = 20261122;
const key = (s: number, pc: number) => `nf|${profile.geometryId}|${s}|${pc}`;

/** String 3 at 40% (12 misses in 20), every other string at 90% (2 misses in 20). */
function weakString3(): Map<string, ItemHistory> {
  const m = new Map<string, ItemHistory>();
  for (let s = 1; s <= 6; s++) for (const pc of NATURALS) m.set(key(s, pc), s === 3 ? { attempts: 20, misses: 12 } : { attempts: 20, misses: 2 });
  return m;
}

/**
 * 200 prompts from one fixed-seed generator. FR-031 caps a session at 100 questions, so the 200
 * prompts of US7-1 are two consecutive 100-question sessions drawn from the same seeded stream.
 */
function run(histories: Map<string, ItemHistory>, adaptive: boolean) {
  const rng = mulberry32(SEED);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const r = generateQuestions({ profile, settings, rng, histories, adaptive });
    if (!r.ok) throw new Error(r.reason);
    out.push(...r.questions);
  }
  expect(out).toHaveLength(200);
  return out;
}
const shareOf3 = (qs: ReturnType<typeof run>) => qs.filter((q) => q.promptedString === 3).length / qs.length;

describe('FR-041 US7-1: weak string share ≥ 1.5× its empty-history share', () => {
  it('the R9 formula itself predicts ≥ 1.5× (analytic check from research R9)', () => {
    const w3 = r9(20, 12);
    const wo = r9(20, 2);
    const share = (7 * w3) / (7 * w3 + 35 * wo);
    expect(share / (1 / 6)).toBeGreaterThanOrEqual(1.5);
  });

  it('with a fixed seed over 200 prompts, the measured share is ≥ 1.5× the empty-history share', () => {
    const weak = shareOf3(run(weakString3(), true));
    const empty = shareOf3(run(new Map(), true));
    expect(weak).toBeGreaterThanOrEqual(1.5 * empty);
  });
});

describe('FR-041 US7-5: adaptive off is uniform over valid prompts', () => {
  it('with the weak-string history and adaptive off, the sequence equals the empty-history sequence', () => {
    const off = run(weakString3(), false);
    const empty = run(new Map(), false);
    expect(off.map((q) => q.itemKey)).toEqual(empty.map((q) => q.itemKey));
  });

  it('adaptive off: string 3 share stays within 4 binomial SDs of 1/6', () => {
    const n = 200;
    const share = shareOf3(run(weakString3(), false));
    const sd = Math.sqrt((1 / 6) * (5 / 6) / n);
    expect(Math.abs(share - 1 / 6)).toBeLessThan(4 * sd);
  });
});

describe('FR-041 determinism: the same history and seed give the identical sequence', () => {
  it('two runs are deep-equal', () => {
    expect(run(weakString3(), true)).toEqual(run(weakString3(), true));
  });
});
