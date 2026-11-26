/**
 * T093a (red, test-first): legacy drill-id migration, pure domain step [FR-043, FR-041, SC-013;
 * spec.md Clarifications 2026-11-22 "How are attempts stored by the v0.1 pre-release (4695363)
 * under the old drill-type ids handled?" (provisional, product-owner); data-model §3.1].
 *
 * Chosen API (domain/migrate.ts, pure, no hashing: hashing sits behind the application Hasher port):
 *
 *   export const LEGACY_DRILL_TYPE = 'legacy';
 *   export const DRILL_TYPE_RENAMES: Readonly<Record<string, string>>;
 *     // exactly { 'bass-root-fifth-octave': 'root-fifth-octave', 'bass-arpeggio': 'arpeggio',
 *     //           'bass-walking': 'walking-bass' }
 *   export type MigratedAttempt = Omit<AttemptRecord, 'payloadHash'>;
 *   export function migrateAttempt(raw: unknown):
 *     | { ok: true; attempt: MigratedAttempt; changed: boolean }
 *     | { ok: false; reason: string };
 *
 * The returned attempt never carries `payloadHash`; the caller verifies the ORIGINAL hash first,
 * then re-hashes the migrated payload (data-model §3.1 payloadHash, §4 step 1).
 *
 * Encodings chosen here for the legacy id (data-model §3.1 must record them when T093a lands):
 *  - drillType 'legacy' (not one of DRILL_TYPES, so never offered as a drill);
 *  - prompt  { drillType: 'legacy', legacyDrillType: <old drillType>, root: FretPosition, qualityId: string | null }
 *    (qualityId null for bass-octave-shapes, whose v0.1 prompt was { drillType, root });
 *  - itemKey `lg|<old drillType>|<old quality>` (the v0.1 key with `bs|` replaced by `lg|`).
 * Every v0.1 root–fifth–octave attempt carries a `bs|bass-root-fifth-octave|<q>` key (v0.1 had no
 * `rfo|` key), so under the clarification all of them land under the legacy id, not 'root-fifth-octave'.
 *
 * Old record shapes come from `git show 4695363:apps/web/src/domain/records.ts` (DRILL_TYPES,
 * promptSchema, itemKey.bass) and `.../drills/generate.ts` (bassShape, walking). Expected migrated
 * values are written out by hand from the clarification, never computed by the code under test.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pitchClass, positionsOf, presets, presetById, type InstrumentProfile } from '@fretsense/theory';
import { buildLine, lineAttempts } from './drills/walkingBass';
import { DRILL_TYPE_RENAMES, LEGACY_DRILL_TYPE, migrateAttempt } from './migrate';
import { DRILL_TYPES, ITEM_KEY_PATTERN, attemptSchema } from './records';
import { PAYLOAD_FIELDS, payloadOf } from './canonicalJson';
import { generateQuestions } from './drills/generate';
import type { DrillSettings, Question } from './drills/types';
import { historiesFrom } from './weighting';
import { mulberry32 } from './prng';

// ---------- v0.1-shaped records (commit 4695363) ----------
const SPEC_DRILL_TYPES = ['note-finding', 'interval', 'chord-tone', 'root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock'];
const PID = '11111111-0000-4000-8000-000000000001';
const INSTR = '11111111-0000-4000-8000-0000000000aa';
const WRITER = '22222222-0000-4000-8000-000000000002';
const bass4 = presetById('bass4-standard')!.profile;
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const hlcAt = (n: number) => `2026-11-20T10:00:${String(n % 60).padStart(2, '0')}.000Z-0000-${WRITER}`;
type Raw = Record<string, unknown>;

function oldAttempt(n: number, drillType: string, prompt: Raw, itemKey: string, over: Raw = {}): Raw {
  const base: Raw = {
    id: `cccccccc-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    localProfileId: PID,
    created: hlcAt(n),
    updated: hlcAt(n),
    schemaVersion: 1,
    deleted: false,
    drillType,
    instrumentId: INSTR,
    geometryId: bass4.geometryId,
    modality: 'tap',
    prompt,
    answer: [{ string: 3, fret: 5 }, { string: 2, fret: 7 }],
    outcome: n % 2 ? 'incorrect' : 'correct',
    responseMs: 1200 + n,
    timestamp: `2026-11-20T10:00:${String(n % 60).padStart(2, '0')}.000Z`,
    lessonId: null,
    drillId: null,
    itemKey,
    ...over,
  };
  return { ...base, payloadHash: sha(payloadOf(base)) };
}
const root = { string: 3, fret: 3 };
const OLD = {
  rfo: oldAttempt(1, 'bass-root-fifth-octave', { drillType: 'bass-root-fifth-octave', root, qualityId: 'major' }, 'bs|bass-root-fifth-octave|major'),
  rfoMinor: oldAttempt(2, 'bass-root-fifth-octave', { drillType: 'bass-root-fifth-octave', root: { string: 4, fret: 5 }, qualityId: 'minor' }, 'bs|bass-root-fifth-octave|minor'),
  arp: oldAttempt(3, 'bass-arpeggio', { drillType: 'bass-arpeggio', root, qualityId: 'minor' }, 'bs|bass-arpeggio|minor'),
  walk: oldAttempt(4, 'bass-walking', {
    drillType: 'bass-walking',
    key: { tonic: 'C', mode: 'major' },
    chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'dom7' }],
  }, 'bs|bass-walking|dom7'),
  oct: oldAttempt(5, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root }, 'bs|bass-octave-shapes|major'),
  octDeleted: oldAttempt(6, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root: { string: 4, fret: 0 } }, 'bs|bass-octave-shapes|major', { deleted: true, updated: hlcAt(40) }),
  /** Unchanged since v0.1: note-finding, interval and chord-tone kept their ids and keys. */
  nf: oldAttempt(7, 'note-finding', { drillType: 'note-finding', pitchClass: 5, string: 3, midi: null }, `nf|${bass4.geometryId}|3|5`),
} as const;
const ALL_OLD = Object.values(OLD);

/** The fields migration must never touch (payload fields other than drillType/prompt/itemKey, plus common fields). */
const KEPT = ['id', 'localProfileId', 'created', 'updated', 'schemaVersion', 'deleted', 'instrumentId', 'geometryId', 'modality', 'answer', 'outcome', 'responseMs', 'timestamp', 'lessonId', 'drillId'];

function migrated(raw: Raw) {
  const r = migrateAttempt(raw);
  if (!r.ok) throw new Error(`migration rejected: ${r.reason}`);
  return r;
}
const hashed = (a: Raw) => ({ ...a, payloadHash: sha(payloadOf(a)) });
const stripHash = (a: Raw) => {
  const { payloadHash: _h, ...rest } = a;
  return rest;
};

// =============================================================================================
describe('FR-043 T093a rename table', () => {
  it('maps exactly the three v0.1 bass ids that have a spec successor', () => {
    expect({ ...DRILL_TYPE_RENAMES }).toEqual({
      'bass-root-fifth-octave': 'root-fifth-octave',
      'bass-arpeggio': 'arpeggio',
      'bass-walking': 'walking-bass',
    });
  });
  it('the legacy id is "legacy" and is not a drill type (DRILL_TYPES stays the 7 spec ids)', () => {
    expect(LEGACY_DRILL_TYPE).toBe('legacy');
    expect([...DRILL_TYPES]).toEqual(SPEC_DRILL_TYPES);
    expect((DRILL_TYPES as readonly string[]).includes(LEGACY_DRILL_TYPE)).toBe(false);
  });
});

describe('FR-043 T093a renamed attempts (bass-arpeggio → arpeggio, bass-walking → walking-bass)', () => {
  it('bass-arpeggio: drillType, prompt.drillType and itemKey renamed; root and quality kept', () => {
    const r = migrated(OLD.arp);
    expect(r.changed).toBe(true);
    expect(r.attempt.drillType).toBe('arpeggio');
    expect(r.attempt.prompt).toEqual({ drillType: 'arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' });
    expect(r.attempt.itemKey).toBe('bs|arpeggio|minor');
  });

  it('bass-walking: drillType, prompt.drillType and itemKey renamed; key and chords kept', () => {
    const r = migrated(OLD.walk);
    expect(r.changed).toBe(true);
    expect(r.attempt.drillType).toBe('walking-bass');
    expect(r.attempt.prompt).toEqual({
      drillType: 'walking-bass',
      key: { tonic: 'C', mode: 'major' },
      chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'dom7' }],
    });
    expect(r.attempt.itemKey).toBe('bs|walking-bass|dom7');
  });

  it.each(['arp', 'walk'] as const)('%s: every other field is carried over unchanged', (k) => {
    const r = migrated(OLD[k]);
    for (const f of KEPT) expect((r.attempt as Raw)[f], f).toEqual(OLD[k][f]);
  });
});

describe('FR-043 T093a legacy attempts (old root–fifth–octave keys and every bass-octave-shapes attempt)', () => {
  it('bass-root-fifth-octave with a bs| key → legacy, quality kept', () => {
    const r = migrated(OLD.rfo);
    expect(r.changed).toBe(true);
    expect(r.attempt.drillType).toBe('legacy');
    expect(r.attempt.prompt).toEqual({ drillType: 'legacy', legacyDrillType: 'bass-root-fifth-octave', root: { string: 3, fret: 3 }, qualityId: 'major' });
    expect(r.attempt.itemKey).toBe('lg|bass-root-fifth-octave|major');
    expect(migrated(OLD.rfoMinor).attempt.itemKey).toBe('lg|bass-root-fifth-octave|minor');
  });

  it('bass-octave-shapes → legacy, qualityId null (the v0.1 prompt had none)', () => {
    const r = migrated(OLD.oct);
    expect(r.changed).toBe(true);
    expect(r.attempt.drillType).toBe('legacy');
    expect(r.attempt.prompt).toEqual({ drillType: 'legacy', legacyDrillType: 'bass-octave-shapes', root: { string: 3, fret: 3 }, qualityId: null });
    expect(r.attempt.itemKey).toBe('lg|bass-octave-shapes|major');
  });

  it('tombstoned v0.1 attempts migrate too and stay tombstoned (history is kept, FR-066a)', () => {
    const r = migrated(OLD.octDeleted);
    expect(r.attempt.drillType).toBe('legacy');
    expect(r.attempt.deleted).toBe(true);
    expect(r.attempt.updated).toBe(OLD.octDeleted.updated);
  });

  it.each(['rfo', 'oct', 'octDeleted'] as const)('%s: every other field is carried over unchanged', (k) => {
    const r = migrated(OLD[k]);
    for (const f of KEPT) expect((r.attempt as Raw)[f], f).toEqual(OLD[k][f]);
  });
});

describe('FR-043 / data-model §3.1 migrated attempts are valid current records', () => {
  it.each(Object.keys(OLD))('%s: no payloadHash is returned; with a fresh hash it passes attemptSchema and ITEM_KEY_PATTERN', (k) => {
    const r = migrated(OLD[k as keyof typeof OLD]);
    expect(Object.hasOwn(r.attempt, 'payloadHash')).toBe(false);
    expect(r.attempt.itemKey).toMatch(ITEM_KEY_PATTERN);
    const parsed = attemptSchema.safeParse(hashed(r.attempt as Raw));
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  });

  it('no migrated attempt mentions a v0.1 drill id outside the legacy prompt field', () => {
    for (const raw of ALL_OLD) {
      const a = migrated(raw).attempt as Raw;
      expect(String(a.drillType)).not.toMatch(/^bass-/);
      expect(String((a.prompt as Raw).drillType)).not.toMatch(/^bass-/);
      expect(String(a.itemKey)).not.toMatch(/^bs\|bass-/);
    }
  });

  it('the current schema does not accept a raw v0.1 bass record (it must go through migration)', () => {
    for (const raw of [OLD.rfo, OLD.arp, OLD.walk, OLD.oct]) expect(attemptSchema.safeParse(raw).success).toBe(false);
  });
});

describe('FR-043 / FR-066a migration is deterministic and idempotent (hashes agree on every path)', () => {
  it('migrating the same v0.1 record twice gives identical payloads, hence identical hashes', () => {
    for (const raw of ALL_OLD) {
      const a = migrated(structuredClone(raw)).attempt as Raw;
      const b = migrated(structuredClone(raw)).attempt as Raw;
      expect(payloadOf(a)).toBe(payloadOf(b));
    }
  });

  it('a migrated record migrates to itself with changed = false', () => {
    for (const raw of ALL_OLD) {
      const once = hashed(migrated(raw).attempt as Raw);
      const twice = migrated(once);
      expect(twice.changed).toBe(false);
      expect(twice.attempt).toEqual(stripHash(once));
    }
  });

  it('an unchanged v0.1 note-finding record and current-encoding records pass through unchanged', () => {
    const current: Raw[] = [
      OLD.nf,
      oldAttempt(20, 'root-fifth-octave', { drillType: 'root-fifth-octave', root, qualityId: 'major' }, 'rfo|0'), // string 3 fret 3 on EADG bass is C (pc 0)
      oldAttempt(21, 'arpeggio', { drillType: 'arpeggio', root, qualityId: 'major' }, 'bs|arpeggio|major'),
      oldAttempt(22, 'chord-tone-lock', { drillType: 'chord-tone-lock', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }] }, 'bs|chord-tone-lock|major'),
    ];
    for (const raw of current) {
      const r = migrated(raw);
      expect(r.changed).toBe(false);
      expect(r.attempt).toEqual(stripHash(raw));
      expect(sha(payloadOf(r.attempt as Raw))).toBe(raw.payloadHash);
    }
  });

  it('migration changes only drillType, prompt and itemKey among the payload fields', () => {
    for (const raw of ALL_OLD) {
      const a = migrated(raw).attempt as Raw;
      for (const f of PAYLOAD_FIELDS) {
        if (f === 'drillType' || f === 'prompt' || f === 'itemKey') continue;
        expect(a[f], f).toEqual(raw[f]);
      }
    }
  });
});

describe('FR-043 T093a unmapped or malformed input still rejects (the whole file is rejected by the caller)', () => {
  it('an unknown drill type is rejected', () => {
    const r = migrateAttempt(oldAttempt(30, 'bass-slap', { drillType: 'bass-slap', root }, 'bs|bass-slap|major'));
    expect(r.ok).toBe(false);
  });
  it('a renamed drill type whose prompt has a different drillType is rejected', () => {
    expect(migrateAttempt(oldAttempt(31, 'bass-arpeggio', { drillType: 'bass-walking', root, qualityId: 'minor' }, 'bs|bass-arpeggio|minor')).ok).toBe(false);
  });
  it('a v0.1 prompt with a missing or extra field is rejected (strict objects, data-model §3.1)', () => {
    expect(migrateAttempt(oldAttempt(32, 'bass-arpeggio', { drillType: 'bass-arpeggio', root }, 'bs|bass-arpeggio|minor')).ok).toBe(false);
    expect(migrateAttempt(oldAttempt(33, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root, qualityId: 'major' }, 'bs|bass-octave-shapes|major')).ok).toBe(false);
    expect(migrateAttempt(oldAttempt(34, 'bass-root-fifth-octave', { drillType: 'bass-root-fifth-octave', root, qualityId: 'major', extra: 1 }, 'bs|bass-root-fifth-octave|major')).ok).toBe(false);
  });
  it('an old drill type with an itemKey of another drill type is rejected', () => {
    expect(migrateAttempt(oldAttempt(35, 'bass-arpeggio', { drillType: 'bass-arpeggio', root, qualityId: 'minor' }, 'bs|bass-walking|minor')).ok).toBe(false);
  });
  it('a client-written "legacy" record that is not a valid legacy encoding is rejected', () => {
    expect(migrateAttempt(oldAttempt(36, 'legacy', { drillType: 'legacy', legacyDrillType: 'bass-slap', root, qualityId: null }, 'lg|bass-slap|major')).ok).toBe(false);
  });
  it.each([null, 42, 'x', [], {}])('non-attempt input %j is rejected', (v) => {
    expect(migrateAttempt(v).ok).toBe(false);
  });
});

// ---------- never offered, never feeds mastery or recommendations (all InstrumentProfiles) ----------
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const settings = (p: InstrumentProfile, type: string, over: Partial<DrillSettings> = {}): DrillSettings => ({
  type: type as DrillSettings['type'], strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 40, octaveMode: 'any', ...over,
});
const WALK = { key: { tonic: 'C', mode: 'major' as const }, chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'dom7' }] };

/**
 * T098: walking bass is one looping line (FR-058), not a generated question list. Its recorded items
 * come from lineAttempts on a filled line: each bar's slots hold that bar's chord root.
 */
function walkItems(p: InstrumentProfile, s: DrillSettings): { drillType: string; itemKey: string; prompt: { drillType: string }; context: { qualityId: string } }[] {
  const b = buildLine(p, s);
  if (!b.ok) throw new Error(b.reason);
  const entries = Array.from({ length: b.line.slotCount }, (_, i) => {
    const c = b.line.chords[Math.floor(i / 4)]!;
    return positionsOf(p, { pitchClass: pitchClass(c.root) }, { fromFret: b.line.fromFret, toFret: b.line.toFret, strings: b.line.strings })[0];
  });
  return lineAttempts(p, b.line, entries).map((a, i) => ({ drillType: 'walking-bass', itemKey: a.itemKey, prompt: a.prompt, context: { qualityId: b.line.chords[Math.floor(i / 4)]!.quality } }));
}

function gen(p: InstrumentProfile, s: DrillSettings, histories: Map<string, { attempts: number; misses: number }>, seed: number): Question[] | undefined {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories, adaptive: true });
  return r.ok ? r.questions : undefined;
}
/** 50 missed legacy attempts per legacy item, for every quality the v0.1 generator used. */
const legacyHistories = () => {
  const rows: Raw[] = [];
  let n = 100;
  for (const q of ['major', 'minor']) {
    for (let i = 0; i < 50; i++) {
      rows.push(oldAttempt(n++, 'bass-root-fifth-octave', { drillType: 'bass-root-fifth-octave', root, qualityId: q }, `bs|bass-root-fifth-octave|${q}`, { outcome: 'incorrect' }));
    }
  }
  for (let i = 0; i < 50; i++) rows.push(oldAttempt(n++, 'bass-octave-shapes', { drillType: 'bass-octave-shapes', root }, 'bs|bass-octave-shapes|major', { outcome: 'incorrect' }));
  return historiesFrom(rows.map((r) => migrated(r).attempt as unknown as { itemKey: string; outcome: 'correct' | 'incorrect' }));
};

describe.each(presets().map((p) => [p.presetId, p.profile] as const))('FR-041 T093a legacy is never a drill nor a weighting input: %s', (_id, p) => {
  it('generateQuestions refuses the legacy id', () => {
    const r = generateQuestions({ profile: p, settings: settings(p, 'legacy'), rng: mulberry32(1), histories: new Map(), adaptive: false });
    expect(r.ok).toBe(false);
  });

  it('no generated question for any spec drill type uses a legacy item key', () => {
    const legacyKeys = new Set(legacyHistories().keys());
    expect(legacyKeys.size).toBe(3);
    for (const t of DRILL_TYPES) {
      const qs = gen(p, settings(p, t, t === 'walking-bass' || t === 'chord-tone-lock' ? WALK : {}), new Map(), 3) ?? [];
      for (const q of qs) {
        expect(q.drillType).not.toBe('legacy');
        expect(q.itemKey.startsWith('lg|')).toBe(false);
        expect(legacyKeys.has(q.itemKey)).toBe(false);
      }
    }
  });

  it('adaptive weighting with a heavy legacy miss history picks exactly what an empty history picks', () => {
    const h = legacyHistories();
    for (const t of ['root-fifth-octave', 'arpeggio'] as const) {
      for (const seed of [1, 2, 3]) {
        const withLegacy = gen(p, settings(p, t), h, seed);
        const without = gen(p, settings(p, t), new Map(), seed);
        expect(withLegacy?.map((q) => q.itemKey)).toEqual(without?.map((q) => q.itemKey));
      }
    }
  });
});

describe('FR-041 T093a renamed attempts keep feeding weighting (their keys are live generator keys)', () => {
  it('a migrated bass-arpeggio minor attempt keys to the current arpeggio minor item', () => {
    const keys = new Set((gen(bass4, settings(bass4, 'arpeggio', { qualities: ['minor'] }), new Map(), 1) ?? []).map((q) => q.itemKey));
    expect(keys.has(migrated(OLD.arp).attempt.itemKey)).toBe(true);
  });
  it('a migrated bass-walking dom7 attempt keys to the current walking-bass dom7 item', () => {
    const keys = new Set(walkItems(bass4, settings(bass4, 'walking-bass', WALK)).map((q) => q.itemKey));
    expect(keys.has(migrated(OLD.walk).attempt.itemKey)).toBe(true);
  });
});
