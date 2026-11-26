import { z } from 'zod';

/**
 * 016 research R6: the one text schema for every string field of the v2 records and imported
 * files. NFC first, then the length cap, then no C0/C1 controls, DEL, U+061C, bidi controls, LRM/RLM,
 * zero-width characters or BOM (security-reviewer 016 r1 #6).
 */
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;

export function safeText(max: number) {
  return z
    .string()
    .transform((s) => s.normalize('NFC'))
    .pipe(z.string().max(max).refine((s) => !FORBIDDEN.test(s), 'text has control or invisible characters'));
}
