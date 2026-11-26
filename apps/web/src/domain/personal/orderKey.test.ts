import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ORDER_KEY_RE, keyBetween, moveItem, rebalance } from './orderKey';

type Item = { id: string; orderKey: string };
const cmp = (x: Item, y: Item) =>
  x.orderKey < y.orderKey ? -1 : x.orderKey > y.orderKey ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
const applyWrites = (items: Item[], writes: Item[]) => {
  const m = new Map(items.map((i) => [i.id, i.orderKey]));
  for (const w of writes) m.set(w.id, w.orderKey);
  return [...m].map(([id, orderKey]) => ({ id, orderKey })).sort(cmp);
};
const strictlyIncreasing = (ks: string[]) => ks.every((k, i) => i === 0 || ks[i - 1]! < k);

describe('FR-016 keyBetween', () => {
  it('hand cases', () => {
    expect(keyBetween()).toMatch(ORDER_KEY_RE);
    const lo = keyBetween(undefined, '1') as string;
    expect(lo < '1').toBe(true);
    expect(lo).toMatch(ORDER_KEY_RE);
    const hi = keyBetween('z') as string;
    expect(hi > 'z').toBe(true);
    expect(hi).toMatch(ORDER_KEY_RE);
    const mid = keyBetween('A', 'B') as string;
    expect(mid > 'A' && mid < 'B').toBe(true);
    expect(mid).toMatch(ORDER_KEY_RE);
  });

  it('throws when a >= b', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
    expect(() => keyBetween('a', 'a')).toThrow();
  });

  it('property: random inserts match brute-force array insertion', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(1000), { minLength: 1, maxLength: 120 }), (positions) => {
        let keys: string[] = [];
        const order: number[] = []; // brute-force: ids in expected display order
        positions.forEach((p, id) => {
          const idx = p % (keys.length + 1);
          let r = keyBetween(keys[idx - 1], keys[idx]);
          if (r === 'rebalance') {
            keys = rebalance(keys.length);
            r = keyBetween(keys[idx - 1], keys[idx]);
            expect(r).not.toBe('rebalance');
          }
          const k = r as string;
          expect(k).toMatch(ORDER_KEY_RE);
          expect(k.length).toBeLessThanOrEqual(24);
          if (idx > 0) expect(keys[idx - 1]! < k).toBe(true);
          if (idx < keys.length) expect(k < keys[idx]!).toBe(true);
          keys.splice(idx, 0, k);
          order.splice(idx, 0, id);
        });
        expect(strictlyIncreasing(keys)).toBe(true);
        expect(order.length).toBe(keys.length);
      }),
      { numRuns: 200 },
    );
  });

  it('repeated insertion at one end stays bounded or asks to rebalance', () => {
    let k: string | undefined;
    for (let i = 0; i < 200; i++) {
      const r = keyBetween(k);
      if (r === 'rebalance') return;
      expect(r.length).toBeLessThanOrEqual(24);
      expect(r).toMatch(ORDER_KEY_RE);
      expect(!k || k < r).toBe(true);
      k = r;
    }
  });
});

describe('FR-016 rebalance', () => {
  it.each([0, 1, 2, 10, 61, 62, 63, 1000, 50_000])('n=%i', (n) => {
    const ks = rebalance(n);
    expect(ks).toHaveLength(n);
    expect(strictlyIncreasing(ks)).toBe(true);
    for (const k of ks) expect(k).toMatch(ORDER_KEY_RE);
    expect(new Set(ks.map((k) => k.length)).size).toBeLessThanOrEqual(1);
    if (n === 50_000) expect(ks[0]!.length).toBeLessThanOrEqual(4);
  });
});

describe('FR-016 moveItem', () => {
  const distinct: Item[] = rebalance(10).map((orderKey, i) => ({ id: `i${i}`, orderKey }));

  it.each(Array.from({ length: 10 }, (_, i) => i))('distinct keys, move to index %i', (to) => {
    for (let from = 0; from < 10; from++) {
      const writes = moveItem(distinct, distinct[from]!.id, to);
      const expected = distinct.map((i) => i.id);
      expected.splice(to, 0, ...expected.splice(from, 1));
      const after = applyWrites(distinct, writes);
      expect(after.map((i) => i.id)).toEqual(expected);
      for (const w of writes) expect(w.orderKey).toMatch(ORDER_KEY_RE);
      if (from === to) continue;
      expect(writes).toHaveLength(1);
    }
  });

  it('tied keys: moving into the middle of a tied run', () => {
    const tied: Item[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, orderKey: 'V' }));
    for (let from = 0; from < 5; from++) {
      for (let to = 0; to < 5; to++) {
        const writes = moveItem(tied, tied[from]!.id, to);
        const expected = tied.map((i) => i.id);
        expected.splice(to, 0, ...expected.splice(from, 1));
        const after = applyWrites(tied, writes);
        expect(after.map((i) => i.id)).toEqual(expected);
        for (const w of writes) expect(w.orderKey).toMatch(ORDER_KEY_RE);
      }
    }
  });
});
