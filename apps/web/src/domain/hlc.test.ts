/**
 * T019: hybrid logical clock (research R5, data-model §2 `Hlc`) [FR-066, FR-066a].
 * Written test-after: the implementation already existed. Expected values come from the R5 rules
 * (send, receive, overflow, 24 h bound) and from a brute-force tuple comparison written here.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compareHlc, formatHlc, hlcReceive, hlcSend, maxHlc, parseHlc, FUTURE_BOUND_MS, type HlcState } from './hlc';

const W_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const W_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const W_F = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0); // 2026-11-22T12:00:00.000Z
const DAY = 24 * 60 * 60 * 1000;

/** Independent R5 string builder: "<ISO-8601 ms>-<4-digit counter>-<writerId>". */
const hlcString = (wall: number, counter: number, writer: string) =>
  `${new Date(wall).toISOString()}-${String(counter).padStart(4, '0')}-${writer}`;

describe('FR-066 HLC format (research R5)', () => {
  it('formats "<ISO ms>-<counter 0000-9999>-<writerId>"', () => {
    expect(formatHlc(T0, 7, W_A)).toBe(`2026-11-22T12:00:00.000Z-0007-${W_A}`);
    expect(formatHlc(T0 + 5, 9999, W_B)).toBe(`2026-11-22T12:00:00.005Z-9999-${W_B}`);
  });

  it('parses its own output back to (wall, counter, writerId)', () => {
    expect(parseHlc(`2026-11-22T12:00:00.000Z-0042-${W_A}`)).toEqual({ wall: T0, counter: 42, writerId: W_A });
  });

  it.each([
    ['missing counter', `2026-11-22T12:00:00.000Z-${W_A}`],
    ['3-digit counter', `2026-11-22T12:00:00.000Z-042-${W_A}`],
    ['no milliseconds', `2026-11-22T12:00:00Z-0042-${W_A}`],
    ['uppercase writer id', `2026-11-22T12:00:00.000Z-0042-${W_A.toUpperCase()}`],
    ['empty', ''],
    ['impossible date', `2026-13-45T99:99:99.999Z-0001-${W_A}`],
    ['writer id that is not a UUID (36 dashes)', `2026-11-22T12:00:00.000Z-0001-${'-'.repeat(36)}`],
  ])('rejects a malformed HLC: %s', (_label, text) => {
    expect(parseHlc(text)).toBeUndefined();
  });

  it('the bound constant is exactly 24 hours', () => {
    expect(FUTURE_BOUND_MS).toBe(DAY);
  });
});

describe('FR-066a HLC send rule (research R5)', () => {
  it('wall advances to now and the counter resets to 0 when now > last.wall', () => {
    expect(hlcSend({ wall: T0, counter: 17 }, T0 + 1)).toEqual({ wall: T0 + 1, counter: 0 });
  });

  it('counter increments when now equals last.wall', () => {
    expect(hlcSend({ wall: T0, counter: 17 }, T0)).toEqual({ wall: T0, counter: 18 });
  });

  it('keeps last.wall and increments the counter when the device clock went backwards', () => {
    expect(hlcSend({ wall: T0, counter: 3 }, T0 - 60_000)).toEqual({ wall: T0, counter: 4 });
  });

  it('overflow: counter 9999 + 1 becomes wall + 1 ms, counter 0', () => {
    expect(hlcSend({ wall: T0, counter: 9999 }, T0)).toEqual({ wall: T0 + 1, counter: 0 });
    expect(hlcSend({ wall: T0, counter: 9999 }, T0 - 1000)).toEqual({ wall: T0 + 1, counter: 0 });
  });

  it('property: successive sends are strictly increasing as strings, whatever the clock does', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -5000, max: 5000 }), { minLength: 1, maxLength: 200 }), (deltas) => {
        let state: HlcState = { wall: T0, counter: 0 };
        let prev = hlcString(state.wall, state.counter, W_A);
        let now = T0;
        for (const d of deltas) {
          now += d;
          state = hlcSend(state, now);
          const cur = hlcString(state.wall, state.counter, W_A);
          expect(cur > prev).toBe(true);
          expect(state.counter).toBeGreaterThanOrEqual(0);
          expect(state.counter).toBeLessThanOrEqual(9999);
          prev = cur;
        }
      }),
    );
  });
});

describe('FR-066a HLC receive rule and 24 h clock bound (research R5)', () => {
  it('a newer remote advances last, so the next local send sorts after the remote', () => {
    const remote = hlcString(T0 + 10_000, 5, W_F); // writer id "fff…" is the largest possible
    const after = hlcReceive({ wall: T0, counter: 0 }, remote, T0);
    expect(after).toEqual({ wall: T0 + 10_000, counter: 5 });
    const next = hlcSend(after!, T0); // local clock still behind the remote
    expect(hlcString(next.wall, next.counter, W_A) > remote).toBe(true);
  });

  it('same wall, larger remote counter: last takes the remote counter', () => {
    expect(hlcReceive({ wall: T0, counter: 2 }, hlcString(T0, 9, W_B), T0)).toEqual({ wall: T0, counter: 9 });
  });

  it('an older remote leaves last unchanged', () => {
    const s = { wall: T0, counter: 4 };
    expect(hlcReceive(s, hlcString(T0 - 1, 9999, W_B), T0)).toEqual(s);
    expect(hlcReceive(s, hlcString(T0, 1, W_B), T0)).toEqual(s);
  });

  it('a remote exactly 24 h ahead is accepted; 24 h + 1 ms ahead is rejected', () => {
    expect(hlcReceive({ wall: T0, counter: 0 }, hlcString(T0 + DAY, 0, W_B), T0)).toEqual({ wall: T0 + DAY, counter: 0 });
    expect(hlcReceive({ wall: T0, counter: 0 }, hlcString(T0 + DAY + 1, 0, W_B), T0)).toBeUndefined();
  });

  it('a malformed remote is rejected', () => {
    expect(hlcReceive({ wall: T0, counter: 0 }, 'not-an-hlc', T0)).toBeUndefined();
  });

  it('property: after any receive the state never exceeds now + 24 h', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2 * DAY, max: 2 * DAY }), fc.integer({ min: 0, max: 9999 }), (offset, counter) => {
        const r = hlcReceive({ wall: T0, counter: 0 }, hlcString(T0 + offset, counter, W_B), T0);
        if (offset > DAY) expect(r).toBeUndefined();
        else expect(r!.wall).toBeLessThanOrEqual(T0 + DAY);
      }),
    );
  });
});

describe('FR-066a ordering: wall time, then counter, then writer id', () => {
  it('ties on wall and counter break by writer id', () => {
    const a = hlcString(T0, 3, W_A);
    const b = hlcString(T0, 3, W_B);
    expect(compareHlc(a, b)).toBe(-1);
    expect(compareHlc(b, a)).toBe(1);
    expect(compareHlc(a, a)).toBe(0);
    expect(maxHlc(a, b)).toBe(b);
    expect(maxHlc(b, a)).toBe(b);
  });

  it('counter dominates writer id; wall dominates counter', () => {
    expect(compareHlc(hlcString(T0, 2, W_F), hlcString(T0, 3, W_A))).toBe(-1);
    expect(compareHlc(hlcString(T0, 9999, W_F), hlcString(T0 + 1, 0, W_A))).toBe(-1);
  });

  it('property: string order equals brute-force (wall, counter, writer) tuple order', () => {
    const hex = fc.constantFrom(...'0123456789abcdef'.split(''));
    const writer = fc.array(hex, { minLength: 32, maxLength: 32 }).map((h) => {
      const s = h.join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    });
    // Years 2000–2099 keep the ISO year at 4 digits.
    const stamp = fc.record({
      wall: fc.integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2099, 11, 31) }),
      counter: fc.integer({ min: 0, max: 9999 }),
      writer,
    });
    const tupleCmp = (x: { wall: number; counter: number; writer: string }, y: typeof x) =>
      x.wall !== y.wall ? Math.sign(x.wall - y.wall)
        : x.counter !== y.counter ? Math.sign(x.counter - y.counter)
          : x.writer < y.writer ? -1 : x.writer > y.writer ? 1 : 0;
    fc.assert(
      fc.property(stamp, stamp, (x, y) => {
        expect(compareHlc(hlcString(x.wall, x.counter, x.writer), hlcString(y.wall, y.counter, y.writer))).toBe(tupleCmp(x, y));
      }),
    );
  });
});
