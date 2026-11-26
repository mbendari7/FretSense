/**
 * 016 FR-012 / FR-015, research R3: fractional order keys for path items.
 * Keys are base-62 digit strings read as fractions in (0, 1) (ASCII order = string order = numeric
 * order), never ending in '0', at most 24 characters. Midpoint algorithm after D. Greenspan,
 * "Implementing Fractional Indexing" (2020), fractional part only.
 */
export const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const ORDER_KEY_RE = /^[0-9A-Za-z]{0,23}[1-9A-Za-z]$/;
export const MAX_KEY_LENGTH = 24;

export interface Ordered { readonly id: string; readonly orderKey: string }

/** Display order: (orderKey, id), plain code-unit comparison (never localeCompare). */
export const compareOrdered = (x: Ordered, y: Ordered): number =>
  x.orderKey < y.orderKey ? -1 : x.orderKey > y.orderKey ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0;

function midpoint(a: string, b: string | undefined): string {
  if (b !== undefined) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0]!) : 0;
  const db = b !== undefined ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)]!;
  if (b !== undefined && b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), undefined);
}

/** A key strictly between `a` and `b` (either may be open), or 'rebalance' if it would exceed 24 chars. */
export function keyBetween(a?: string, b?: string): string | 'rebalance' {
  if (a !== undefined && !ORDER_KEY_RE.test(a)) throw new Error(`invalid order key "${a}"`);
  if (b !== undefined && !ORDER_KEY_RE.test(b)) throw new Error(`invalid order key "${b}"`);
  if (a !== undefined && b !== undefined && !(a < b)) throw new Error(`order keys out of order: "${a}" >= "${b}"`);
  const k = midpoint(a ?? '', b);
  return k.length > MAX_KEY_LENGTH ? 'rebalance' : k;
}

/**
 * n evenly spaced keys of one length L = ceil(log62(n + 1)) + 1, none ending in '0': the first
 * L - 1 digits are base 62 and the last digit runs over 1..61, so same-length string order is
 * numeric order.
 */
export function rebalance(n: number): string[] {
  if (n <= 0) return [];
  let L = 1;
  while (62 ** (L - 1) < n + 1) L++;
  L = Math.max(L, 2);
  const space = 62 ** (L - 1) * 61;
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const v = Math.floor((i * space) / (n + 1));
    let rest = Math.floor(v / 61);
    let head = '';
    for (let d = 0; d < L - 1; d++) { head = DIGITS[rest % 62]! + head; rest = Math.floor(rest / 62); }
    out.push(head + DIGITS[(v % 61) + 1]!);
  }
  return out;
}

/**
 * Writes that move `id` to `toIndex` in display order. Usually one write; inside a run of equal
 * keys (concurrent inserts) the run is rekeyed; if a key would grow past 24 chars, the whole path
 * is rebalanced. Applying the writes and sorting by (orderKey, id) gives the array-splice order.
 */
export function moveItem(items: readonly Ordered[], id: string, toIndex: number): Ordered[] {
  const sorted = [...items].sort(compareOrdered);
  const from = sorted.findIndex((x) => x.id === id);
  if (from < 0) throw new Error(`unknown item "${id}"`);
  const moving = sorted[from]!;
  const others = sorted.filter((x) => x.id !== id);
  const at = Math.max(0, Math.min(toIndex, others.length));
  const target = [...others.slice(0, at), moving, ...others.slice(at)];
  const prev = others[at - 1];
  const next = others[at];
  if (!prev || !next || prev.orderKey !== next.orderKey) {
    const k = keyBetween(prev?.orderKey, next?.orderKey);
    if (k !== 'rebalance') return k === moving.orderKey && sameOrder(sorted, target) ? [] : [{ id, orderKey: k }];
    return rekeyAll(target, sorted);
  }
  // Target is inside a tied run: rekey that run (with the moved item in place) between its outer neighbours.
  let lo = at - 1;
  while (lo > 0 && others[lo - 1]!.orderKey === prev.orderKey) lo--;
  let hi = at;
  while (hi < others.length - 1 && others[hi + 1]!.orderKey === next.orderKey) hi++;
  const left = others[lo - 1]?.orderKey;
  const right = others[hi + 1]?.orderKey;
  const run = target.slice(lo, hi + 2);
  const writes: Ordered[] = [];
  let cur = left;
  for (const r of run) {
    const k = keyBetween(cur, right);
    if (k === 'rebalance') return rekeyAll(target, sorted);
    writes.push({ id: r.id, orderKey: k });
    cur = k;
  }
  return writes;
}

function sameOrder(a: readonly Ordered[], b: readonly Ordered[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i]!.id);
}

function rekeyAll(target: readonly Ordered[], before: readonly Ordered[]): Ordered[] {
  const keys = rebalance(target.length);
  const old = new Map(before.map((x) => [x.id, x.orderKey]));
  return target.map((x, i) => ({ id: x.id, orderKey: keys[i]! })).filter((w) => old.get(w.id) !== w.orderKey);
}
