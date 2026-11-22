/**
 * Hybrid logical clock (research R5): "<ISO ms>-<counter 0000–9999>-<writerId>".
 * Strings sort lexicographically in causal order; ties break by writer id (FR-066a).
 */
export type Hlc = string;
export interface HlcState { wall: number; counter: number }

const MAX_COUNTER = 9999;
export const FUTURE_BOUND_MS = 24 * 60 * 60 * 1000;
const HLC_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-(\d{4})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function formatHlc(wall: number, counter: number, writerId: string): Hlc {
  return `${new Date(wall).toISOString()}-${String(counter).padStart(4, '0')}-${writerId}`;
}

export function parseHlc(h: string): { wall: number; counter: number; writerId: string } | undefined {
  const m = HLC_RE.exec(h);
  if (!m) return undefined;
  const wall = Date.parse(m[1]!);
  return Number.isFinite(wall) ? { wall, counter: Number(m[2]), writerId: m[3]! } : undefined;
}

/** Local event (send rule). */
export function hlcSend(state: HlcState, now: number): HlcState {
  const bounded = Math.min(Math.max(now, state.wall), now + FUTURE_BOUND_MS);
  let wall = Math.max(bounded, state.wall);
  let counter = wall > state.wall ? 0 : state.counter + 1;
  if (counter > MAX_COUNTER) {
    wall += 1;
    counter = 0;
  }
  return { wall, counter };
}

/** Remote timestamp seen (receive rule). Returns undefined if it is beyond the 24 h bound. */
export function hlcReceive(state: HlcState, remote: Hlc, now: number): HlcState | undefined {
  const r = parseHlc(remote);
  if (!r || r.wall > now + FUTURE_BOUND_MS) return undefined;
  if (r.wall > state.wall || (r.wall === state.wall && r.counter > state.counter)) return { wall: r.wall, counter: r.counter };
  return state;
}

export const compareHlc = (a: Hlc, b: Hlc): number => (a < b ? -1 : a > b ? 1 : 0);
export const maxHlc = (a: Hlc, b: Hlc): Hlc => (compareHlc(a, b) >= 0 ? a : b);
