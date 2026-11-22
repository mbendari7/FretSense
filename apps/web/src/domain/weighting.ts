/**
 * Research R9: weight w = 1 + 3·(m + 1)/(n + 2), with n attempts and m misses among the item's
 * last 50 attempts. With adaptive weighting off, every item has weight 1 (US7-5).
 */
export interface ItemHistory { attempts: number; misses: number }
export const HISTORY_WINDOW = 50;

export function itemWeight(h: ItemHistory | undefined, adaptive: boolean): number {
  if (!adaptive) return 1;
  const n = Math.min(h?.attempts ?? 0, HISTORY_WINDOW);
  const m = Math.min(h?.misses ?? 0, n);
  return 1 + (3 * (m + 1)) / (n + 2);
}

/** Builds per-item histories from outcomes, newest last, keeping the last 50 per item. */
export function historiesFrom(attempts: readonly { itemKey: string; outcome: 'correct' | 'incorrect' }[]): Map<string, ItemHistory> {
  const byKey = new Map<string, ('correct' | 'incorrect')[]>();
  for (const a of attempts) {
    const list = byKey.get(a.itemKey) ?? [];
    list.push(a.outcome);
    byKey.set(a.itemKey, list);
  }
  const out = new Map<string, ItemHistory>();
  for (const [k, list] of byKey) {
    const last = list.slice(-HISTORY_WINDOW);
    out.set(k, { attempts: last.length, misses: last.filter((o) => o === 'incorrect').length });
  }
  return out;
}
