import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { restoreApply, syncMerge } from './pathMerge';

type Rec = { id: string; updated: string; deleted: boolean; deletedBy?: 'user' | 'profile'; orderKey: string };

// HLC-like: zero-padded wall + counter + '-' + writer => string order = (updated, writer).
const hlc = (wall: number, counter: number, writer: string) =>
  `${String(wall).padStart(13, '0')}${String(counter).padStart(4, '0')}-${writer}`;
const live = (updated: string, orderKey = 'V'): Rec => ({ id: 'p1', updated, deleted: false, orderKey });
const tomb = (updated: string, by: 'user' | 'profile', orderKey = 'V'): Rec => ({
  id: 'p1', updated, deleted: true, deletedBy: by, orderKey,
});

// Payload is a pure function of `updated` => same (id, updated) implies identical payload.
const POOL = Array.from({ length: 6 }, (_, i) => hlc(1000 + (i >> 1), i & 1, i % 2 ? 'devB' : 'devA'));
const recArb = fc.integer({ min: 0, max: POOL.length - 1 }).map((i): Rec => {
  const updated = POOL[i]!;
  if (i % 3 === 0) return live(updated, `k${i}`);
  return tomb(updated, i % 2 ? 'user' : 'profile', `k${i}`);
});

describe('FR-012 syncMerge', () => {
  it('commutative, associative, idempotent', () => {
    fc.assert(
      fc.property(recArb, recArb, recArb, (a, b, c) => {
        expect(syncMerge(a, b)).toEqual(syncMerge(b, a));
        expect(syncMerge(syncMerge(a, b), c)).toEqual(syncMerge(a, syncMerge(b, c)));
        expect(syncMerge(a, a)).toEqual(a);
      }),
      { numRuns: 500 },
    );
  });

  it('returns one of its inputs whole', () => {
    fc.assert(
      fc.property(recArb, recArb, (a, b) => {
        const r = syncMerge(a, b);
        expect(r.updated === a.updated ? r : null).toSatisfy((x: Rec | null) => x === null || JSON.stringify(x) === JSON.stringify(a));
        expect([a, b].some((x) => JSON.stringify(x) === JSON.stringify(r))).toBe(true);
      }),
    );
  });

  it('user tombstone beats a newer live move', () => {
    const t = tomb(hlc(1000, 0, 'devA'), 'user');
    const l = live(hlc(2000, 0, 'devB'), 'Z');
    expect(syncMerge(t, l)).toEqual(t);
    expect(syncMerge(l, t)).toEqual(t);
  });

  it('between two live, higher updated wins', () => {
    const a = live(hlc(1000, 0, 'devA'), 'A');
    const b = live(hlc(1000, 1, 'devA'), 'B');
    expect(syncMerge(a, b)).toEqual(b);
    expect(syncMerge(b, a)).toEqual(b);
    const c = live(hlc(1000, 1, 'devB'), 'C');
    expect(syncMerge(b, c)).toEqual(c); // writer breaks the tie
  });
});

describe('FR-016 restoreApply', () => {
  const stamp = () => hlc(5000, 0, 'restore');

  it('live incoming over local profile tombstone resurrects with fresh stamp', () => {
    const local = tomb(hlc(3000, 0, 'devA'), 'profile');
    const inc = live(hlc(2000, 0, 'devB'), 'Q');
    const r = restoreApply(local, inc, stamp);
    expect(r).toEqual({ ...inc, deleted: false, updated: stamp() });
    expect(r!.updated > local.updated && r!.updated > inc.updated).toBe(true);
  });

  it('user tombstone local survives a live incoming', () => {
    const local = tomb(hlc(1000, 0, 'devA'), 'user');
    expect(restoreApply(local, live(hlc(4000, 0, 'devB')), stamp)).toEqual(local);
  });

  it('local undefined yields incoming', () => {
    const inc = live(hlc(2000, 0, 'devB'), 'Q');
    expect(restoreApply(undefined, inc, stamp)).toEqual(inc);
  });

  it('incoming profile tombstone over live local leaves local unchanged', () => {
    const local = live(hlc(1000, 0, 'devA'));
    expect(restoreApply(local, tomb(hlc(9000, 0, 'devB'), 'profile'), stamp)).toEqual(local);
  });

  it('idempotent with a fixed stamp', () => {
    const cases: [Rec | undefined, Rec][] = [
      [tomb(hlc(3000, 0, 'devA'), 'profile'), live(hlc(2000, 0, 'devB'), 'Q')],
      [undefined, live(hlc(2000, 0, 'devB'))],
      [live(hlc(1000, 0, 'devA')), live(hlc(2000, 0, 'devB'), 'Q')],
      [tomb(hlc(1000, 0, 'devA'), 'user'), live(hlc(2000, 0, 'devB'))],
    ];
    for (const [l, i] of cases) {
      const once = restoreApply(l, i, stamp);
      expect(restoreApply(once, i, stamp)).toEqual(once);
    }
  });

  it('restored record syncMerged with the old profile tombstone stays live', () => {
    const old = tomb(hlc(3000, 0, 'devA'), 'profile');
    const restored = restoreApply(old, live(hlc(2000, 0, 'devB'), 'Q'), stamp)!;
    expect(syncMerge(restored, old).deleted).toBe(false);
    expect(syncMerge(old, restored).deleted).toBe(false);
  });
});
