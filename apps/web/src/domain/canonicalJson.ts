/** Canonical JSON for payloadHash (data-model §3.1): sorted keys, no whitespace, null for absent. */
export function canonicalJson(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error('canonicalJson: integers only');
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    // Sort by Unicode code point, not UTF-16 code unit (data-model §3.1).
    const cp = (s: string) => Array.from(s, (c) => c.codePointAt(0)!);
    const cmp = (a: string, b: string) => {
      const x = cp(a), y = cp(b);
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
      return x.length - y.length;
    };
    const keys = Object.keys(value as object).sort(cmp);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new Error(`canonicalJson: unsupported ${typeof value}`);
}

export const PAYLOAD_FIELDS = [
  'id', 'localProfileId', 'drillType', 'instrumentId', 'geometryId', 'modality', 'prompt', 'answer',
  'outcome', 'responseMs', 'timestamp', 'lessonId', 'drillId', 'itemKey',
] as const;

export function payloadOf(attempt: Record<string, unknown>): string {
  const o: Record<string, unknown> = {};
  for (const f of PAYLOAD_FIELDS) o[f] = attempt[f] ?? null;
  return canonicalJson(o);
}
