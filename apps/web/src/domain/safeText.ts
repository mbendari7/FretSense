import { z } from 'zod';

/**
 * The one shared UI-safe character class (016 research R6; security-reviewer T093 r2 N5 and 016
 * Phase 2 #5): C0 and C1 controls, DEL, soft hyphen, U+061C, U+180E, zero-width and bidi controls,
 * line and paragraph separators, U+2060–U+2064, BOM and the Unicode tag block. `records.ts` re-exports
 * this as UNSAFE_CHARS, so there is no second copy to drift.
 */
export const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\u{e0000}-\u{e007f}]/u;

/**
 * The text schema for every string field of the v2 records and imported files: a coarse length cap
 * before normalising (so a huge input is never normalised), NFC, the real length cap, then no
 * forbidden characters.
 */
export function safeText(max: number) {
  return z
    .string()
    .max(max * 4)
    .transform((s) => s.normalize('NFC'))
    .pipe(z.string().max(max).refine((s) => !FORBIDDEN_CHARS.test(s), 'text has control or invisible characters'));
}
