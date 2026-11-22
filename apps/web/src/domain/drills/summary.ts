import type { AnsweredQuestion } from './session';

/** Session summary (FR-034): accuracy and median time per group; answers over 30 s excluded from time. */
export const SLOW_MS = 30_000;

export function median(xs: readonly number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface GroupStat { group: string; total: number; correct: number; accuracy: number; medianMs: number | undefined }

export function summarize(answered: readonly { group: string; correct: boolean; responseMs: number }[]): { overall: GroupStat; groups: GroupStat[] } {
  const stat = (group: string, xs: typeof answered): GroupStat => {
    const correct = xs.filter((a) => a.correct).length;
    return {
      group,
      total: xs.length,
      correct,
      accuracy: xs.length ? correct / xs.length : 0,
      medianMs: median(xs.filter((a) => a.responseMs <= SLOW_MS).map((a) => a.responseMs)),
    };
  };
  const by = new Map<string, typeof answered[number][]>();
  for (const a of answered) by.set(a.group, [...(by.get(a.group) ?? []), a]);
  return {
    overall: stat('All', answered),
    groups: [...by.entries()].map(([g, xs]) => stat(g, xs)).sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true })),
  };
}

export const fromAnswered = (xs: readonly AnsweredQuestion[]) =>
  xs.map((a) => ({ group: a.question.group, correct: a.correct, responseMs: a.responseMs }));
