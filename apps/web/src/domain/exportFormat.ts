import { z } from 'zod';
import { payloadOf } from './canonicalJson';
import { migrateAttempt } from './migrate';
import { HLC_PATTERN, type InstrumentRecord, hasUnsafeChars, stripUnsafeChars, attemptSchema, instrumentSchema, lessonCompletionSchema, localProfileSchema, profileSettingsSchema } from './records';

/** Profile export format v1 (data-model §4, FR-043). */
export const EXPORT_FORMAT = 'fretsense-profile-export';
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // FR-043: one 50 MB limit
export const MAX_DEPTH = 16;

const safeText = (s: string) => !hasUnsafeChars(s);

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

/**
 * A v0.1 attempt migrated on import (T093a): its position in `attempts`, its original payload and
 * checksum. Keyed by array index, never by id: ids are attacker-controlled and may repeat
 * (security-reviewer T093 r1 MAJOR #1).
 */
export interface MigratedEntry { readonly index: number; readonly originalPayload: string; readonly originalHash: string }
export type ParseImport = { ok: true; data: ProfileExport; migrated: readonly MigratedEntry[] } | { ok: false; reason: string };

export function parseExport(text: string): ParseImport {
  if (!depthWithin(text)) return { ok: false, reason: 'The file is nested too deeply to be a FretSense export.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The file is not valid JSON.' };
  }
  if (hasPrototypeKeys(raw)) return { ok: false, reason: 'The file contains keys that are not allowed.' };
  // Envelope checks first, so no per-attempt work runs on a file already known to be invalid
  // (security-reviewer T093 r1 MINOR #3).
  const env = envelopeError(raw);
  if (env) return { ok: false, reason: env };
  // T093a: v0.1 drill ids are migrated before validation. The original payload is kept so the
  // caller can check the original checksum, then re-hash the migrated payload.
  const migrated: MigratedEntry[] = [];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { attempts?: unknown }).attempts)) {
    const list = (raw as { attempts: unknown[] }).attempts;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const m = migrateAttempt(a);
      if (!m.ok) {
        if (a && typeof a === 'object' && typeof (a as { drillType?: unknown }).drillType === 'string' && /^bass-/.test((a as { drillType: string }).drillType)) {
          return { ok: false, reason: safeReason(`The file has attempt ${i + 1} that can’t be read (${m.reason}).`) };
        }
        continue; // ordinary validation reports the problem below
      }
      if (!m.changed) continue;
      const { payloadHash, ...original } = a as Record<string, unknown>;
      // security r2 N3: never coerce an untrusted value with String() (it can throw).
      if (typeof payloadHash !== 'string') return { ok: false, reason: `The file has attempt ${i + 1} whose checksum isn’t text.` };
      migrated.push({ index: i, originalPayload: payloadOf(original), originalHash: payloadHash });
      list[i] = { ...m.attempt, payloadHash: '0'.repeat(64) }; // re-hashed by the caller
    }
  }
  const r = exportSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { ok: false, reason: safeReason(`The file doesn’t match the export format (${i.path.join('.') || 'top level'}: ${i.message}).`) };
  }
  return { ok: true, data: r.data as unknown as ProfileExport, migrated };
}

const MAX_ATTEMPTS = 200_000;
const MAX_REASON = 240;

/** Format, schemaVersion and the attempts limit, checked before migration (data-model §4). */
function envelopeError(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'The file doesn’t match the export format (top level).';
  const r = raw as Record<string, unknown>;
  if (r.format !== EXPORT_FORMAT) return 'The file doesn’t match the export format (format).';
  if (r.schemaVersion !== 1) return 'The file doesn’t match the export format (schemaVersion).';
  if (!Array.isArray(r.attempts)) return 'The file doesn’t match the export format (attempts).';
  if (r.attempts.length > MAX_ATTEMPTS) return 'The file has too many attempts (the limit is 200,000).';
  return undefined;
}

/** UI-safe reason text: no control or bidi characters, bounded length (threat model). */
export function safeReason(s: string): string {
  const clean = stripUnsafeChars(s);
  return clean.length > MAX_REASON ? `${clean.slice(0, MAX_REASON - 1)}…` : clean;
}
