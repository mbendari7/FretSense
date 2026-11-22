import { z } from 'zod';
import { HLC_PATTERN, type InstrumentRecord, attemptSchema, instrumentSchema, lessonCompletionSchema, localProfileSchema, profileSettingsSchema } from './records';

/** Profile export format v1 (data-model §4, FR-043). */
export const EXPORT_FORMAT = 'fretsense-profile-export';
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // FR-043: one 50 MB limit
export const MAX_DEPTH = 16;

const safeText = (s: string) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069\u200b-\u200f]/.test(s);

export const exportSchema = z.strictObject({
  format: z.literal(EXPORT_FORMAT),
  schemaVersion: z.literal(1),
  exportedAt: z.string().regex(HLC_PATTERN),
  localProfile: localProfileSchema.refine((p) => safeText(p.displayName), 'name has control or invisible characters'),
  instruments: z.array(instrumentSchema.refine((i) => safeText(i.name), 'name has control or invisible characters')).max(50),
  attempts: z.array(attemptSchema).max(200_000),
  lessonCompletion: z.array(lessonCompletionSchema).max(1000),
  profileSettings: profileSettingsSchema.optional(),
});
/** Instruments carry a validated InstrumentProfile (branded geometry id). */
export type ProfileExport = Omit<z.infer<typeof exportSchema>, 'instruments'> & { instruments: InstrumentRecord[] };

/** Linear pre-scan of bracket depth outside strings; rejects deep nesting before JSON.parse. */
export function depthWithin(text: string, max = MAX_DEPTH): boolean {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') {
      if (++depth > max) return false;
    } else if (c === '}' || c === ']') depth--;
  }
  return true;
}

export function hasPrototypeKeys(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasPrototypeKeys);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
      if (hasPrototypeKeys((v as Record<string, unknown>)[k])) return true;
    }
  }
  return false;
}

export type ParseImport = { ok: true; data: ProfileExport } | { ok: false; reason: string };

export function parseExport(text: string): ParseImport {
  if (!depthWithin(text)) return { ok: false, reason: 'The file is nested too deeply to be a FretSense export.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The file is not valid JSON.' };
  }
  if (hasPrototypeKeys(raw)) return { ok: false, reason: 'The file contains keys that are not allowed.' };
  const r = exportSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { ok: false, reason: `The file doesn’t match the export format (${i.path.join('.') || 'top level'}: ${i.message}).` };
  }
  return { ok: true, data: r.data as unknown as ProfileExport };
}
