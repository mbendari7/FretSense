/**
 * T073: FR-066a merge rules (data-model §4 import algorithm) [FR-066a, SC-009, SC-013].
 * Written test-after: the implementation already existed. Expected outcomes are taken from the
 * FR-066a rule list and the data-model §4 restore steps.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeAttempt, mergeCompletion, mergeInstrument, mergeSettings } from './merge';
import { PAYLOAD_FIELDS } from './canonicalJson';
import type { AttemptRecord, InstrumentRecord, LessonCompletionRecord, ProfileSettingsRecord } from './records';
import { presetById } from '@fretsense/theory';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BASE = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
/** Builds an HLC string per research R5 (independent of formatHlc). */
const h = (sec: number, counter = 0, writer = WA) =>
  `${new Date(BASE + sec * 1000).toISOString()}-${String(counter).padStart(4, '0')}-${writer}`;
const FRESH = h(10_000, 0, WL);
const fresh = () => FRESH;
const PID = '11111111-1111-4111-8111-111111111111';

const attempt = (over: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id: '44444444-4444-4444-8444-444444444444',
  localProfileId: PID,
  created: h(0),
  updated: h(0),
  schemaVersion: 1,
  deleted: false,
  drillType: 'note-finding',
  instrumentId: null,
  geometryId: 'guitar:E2-A2-D3-G3-B3-E4',
  modality: 'tap',
  prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
  answer: [{ string: 6, fret: 3 }],
  outcome: 'correct',
  responseMs: 800,
  timestamp: '2026-11-22T12:00:00.000Z',
  lessonId: null,
  drillId: null,
  itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7',
  payloadHash: 'a'.repeat(64),
  ...over,
});

const instrument = (over: Partial<InstrumentRecord> = {}): InstrumentRecord => ({
  id: '33333333-3333-4333-8333-333333333333',
  localProfileId: PID,
  created: h(0),
  updated: h(1),
  schemaVersion: 1,
  deleted: false,
  name: 'Bass',
  profile: presetById('bass4-standard')!.profile,
  ...over,
});

const FIELDS = ['activeInstrumentId', 'octaveMode', 'adaptiveWeighting', 'stagePreference', 'activePackId', 'display', 'explorer', 'autoAdvanceMs'] as const;
const settings = (id: string, stamp: Partial<Record<(typeof FIELDS)[number], string>>, over: Partial<ProfileSettingsRecord> = {}): ProfileSettingsRecord => {
  const fieldUpdated = Object.fromEntries(FIELDS.map((f) => [f, stamp[f] ?? h(0)])) as ProfileSettingsRecord['fieldUpdated'];
  const max = Object.values(fieldUpdated).sort().at(-1)!;
  return {
    id, localProfileId: PID, created: h(0), updated: max, schemaVersion: 1, deleted: false,
    fieldUpdated,
    activeInstrumentId: null,
    octaveMode: 'any',
    adaptiveWeighting: true,
    stagePreference: ['read', 'see', 'drill'],
    activePackId: 'general-theory',
    display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
    explorer: { root: 'C', kind: 'scale', typeId: 'major' },
    autoAdvanceMs: 600,
    ...over,
  };
};

const completion = (id: string, stages: LessonCompletionRecord['stages'], over: Partial<LessonCompletionRecord> = {}): LessonCompletionRecord => ({
  id, localProfileId: PID, created: h(0), updated: h(5), schemaVersion: 1, deleted: false, lessonId: 'notes-on-the-neck', stages, ...over,
});

const payload = (a: AttemptRecord) => Object.fromEntries(PAYLOAD_FIELDS.map((f) => [f, a[f as keyof AttemptRecord]]));

describe('FR-066a attempts are immutable (restore precedence)', () => {
  it('no local copy: the incoming record is added', () => {
    const inc = attempt();
    expect(mergeAttempt(undefined, inc, fresh)).toEqual({ kind: 'write', record: inc, change: 'added' });
  });

  // spec FR-066a: "(6) no local copy, incoming copy tombstoned ⇒ not written and not counted in any preview count (it hides nothing)."
  it('no local copy, incoming tombstone: not written and not counted (rule 6)', () => {
    const inc = attempt({ deleted: true });
    expect(mergeAttempt(undefined, inc, fresh)).toEqual({ kind: 'keep' });
  });

  it('same id, identical payload, both live: no-op', () => {
    expect(mergeAttempt(attempt(), attempt({ updated: h(3) }), fresh)).toEqual({ kind: 'keep' });
  });

  it('same id, different payload: conflict with a reason (rule 1)', () => {
    const r = mergeAttempt(attempt(), attempt({ payloadHash: 'b'.repeat(64), responseMs: 900 }), fresh);
    expect(r.kind).toBe('conflict');
    if (r.kind === 'conflict') expect(r.reason.length).toBeGreaterThan(0);
  });

  it('conflict takes precedence over un-delete (rule 1 before rule 2)', () => {
    const r = mergeAttempt(attempt({ deleted: true, updated: h(5) }), attempt({ payloadHash: 'b'.repeat(64) }), fresh);
    expect(r.kind).toBe('conflict');
  });

  it('local tombstone + incoming live: un-delete with a fresh local updated (rule 2, SC-009)', () => {
    const local = attempt({ deleted: true, updated: h(5) });
    const r = mergeAttempt(local, attempt({ updated: h(0) }), fresh);
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.change).toBe('restored');
      expect(r.record.deleted).toBe(false);
      expect(r.record.updated).toBe(FRESH);
      expect(payload(r.record)).toEqual(payload(local));
    }
  });

  it('local live + newer incoming tombstone: hidden by LWW, payload untouched', () => {
    const local = attempt({ updated: h(1) });
    const r = mergeAttempt(local, attempt({ deleted: true, updated: h(2) }), fresh);
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.change).toBe('hidden');
      expect(r.record.deleted).toBe(true);
      expect(r.record.updated).toBe(h(2));
      expect(payload(r.record)).toEqual(payload(local));
    }
  });

  it('local live + older or equal incoming tombstone: no-op', () => {
    expect(mergeAttempt(attempt({ updated: h(3) }), attempt({ deleted: true, updated: h(2) }), fresh)).toEqual({ kind: 'keep' });
    expect(mergeAttempt(attempt({ updated: h(3) }), attempt({ deleted: true, updated: h(3) }), fresh)).toEqual({ kind: 'keep' });
  });

  it('tombstone LWW tie-break by writer id: same wall and counter, larger writer wins', () => {
    const r = mergeAttempt(attempt({ updated: h(3, 0, WA) }), attempt({ deleted: true, updated: h(3, 0, WB) }), fresh);
    expect(r.kind).toBe('write');
  });

  it('both tombstoned: no-op', () => {
    expect(mergeAttempt(attempt({ deleted: true, updated: h(1) }), attempt({ deleted: true, updated: h(4) }), fresh)).toEqual({ kind: 'keep' });
  });

  it('property: idempotent — merging the same incoming again after applying the result is a no-op', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (ld, id, lu, iu) => {
        const local = attempt({ deleted: ld, updated: h(lu) });
        const inc = attempt({ deleted: id, updated: h(iu) });
        const r1 = mergeAttempt(local, inc, fresh);
        const after = r1.kind === 'write' ? r1.record : local;
        expect(mergeAttempt(after, inc, fresh)).toEqual({ kind: 'keep' });
      }),
    );
  });

  it('property: no merge ever changes an immutable payload field', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (ld, id, lu, iu) => {
        const local = attempt({ deleted: ld, updated: h(lu) });
        const r = mergeAttempt(local, attempt({ deleted: id, updated: h(iu) }), fresh);
        if (r.kind === 'write') expect(payload(r.record)).toEqual(payload(local));
      }),
    );
  });
});

describe('FR-066a instruments (mutable, LWW; restore un-deletes)', () => {
  it('no local copy: added', () => {
    expect(mergeInstrument(undefined, instrument(), fresh)).toMatchObject({ kind: 'write', change: 'added' });
  });

  it('local tombstone + incoming live: restored with a fresh updated', () => {
    const r = mergeInstrument(instrument({ deleted: true, updated: h(9) }), instrument({ name: 'Fretless', updated: h(2) }), fresh);
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.change).toBe('restored');
      expect(r.record.deleted).toBe(false);
      expect(r.record.updated).toBe(FRESH);
    }
  });

  it('newer incoming wins; older or equal incoming is ignored', () => {
    expect(mergeInstrument(instrument({ updated: h(1) }), instrument({ name: 'New', updated: h(2) }), fresh)).toMatchObject({ kind: 'write', change: 'updated', record: { name: 'New' } });
    expect(mergeInstrument(instrument({ updated: h(3) }), instrument({ name: 'Old', updated: h(2) }), fresh)).toEqual({ kind: 'keep' });
    expect(mergeInstrument(instrument({ updated: h(3) }), instrument({ name: 'Same', updated: h(3) }), fresh)).toEqual({ kind: 'keep' });
  });

  it('ties on wall time and counter break by writer id', () => {
    expect(mergeInstrument(instrument({ updated: h(3, 1, WA) }), instrument({ name: 'B', updated: h(3, 1, WB) }), fresh)).toMatchObject({ kind: 'write', record: { name: 'B' } });
    expect(mergeInstrument(instrument({ updated: h(3, 1, WB) }), instrument({ name: 'A', updated: h(3, 1, WA) }), fresh)).toEqual({ kind: 'keep' });
  });

  it('a newer incoming tombstone hides a live local instrument', () => {
    expect(mergeInstrument(instrument({ updated: h(1) }), instrument({ deleted: true, updated: h(2) }), fresh)).toMatchObject({ kind: 'write', change: 'hidden', record: { deleted: true } });
  });

  it('property: idempotent', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (ld, id, lu, iu) => {
        const local = instrument({ deleted: ld, updated: h(lu) });
        const inc = instrument({ deleted: id, updated: h(iu), name: 'Incoming' });
        const r1 = mergeInstrument(local, inc, fresh);
        const after = r1.kind === 'write' ? r1.record : local;
        expect(mergeInstrument(after, inc, fresh)).toEqual({ kind: 'keep' });
      }),
    );
  });
});

describe('FR-066a profile settings: natural key, per-field LWW', () => {
  const LOCAL_ID = '22222222-2222-4222-8222-222222222222';
  const OTHER_ID = '99999999-9999-4999-8999-999999999999';

  it('concurrent edits to different fields both survive', () => {
    const local = settings(LOCAL_ID, { octaveMode: h(5) }, { octaveMode: 'exact' });
    const inc = settings(OTHER_ID, { adaptiveWeighting: h(6), octaveMode: h(1) }, { adaptiveWeighting: false, octaveMode: 'any' });
    const r = mergeSettings(local, inc);
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.record.octaveMode).toBe('exact');
      expect(r.record.adaptiveWeighting).toBe(false);
      expect(r.record.fieldUpdated.octaveMode).toBe(h(5));
      expect(r.record.fieldUpdated.adaptiveWeighting).toBe(h(6));
      expect(r.record.updated).toBe(h(6)); // record updated = max of the field HLCs
      expect(r.record.id).toBe(LOCAL_ID); // matched by natural key, the local id is kept
    }
  });

  it('nothing newer: no-op', () => {
    const local = settings(LOCAL_ID, { display: h(4) });
    expect(mergeSettings(local, settings(OTHER_ID, { display: h(3) }))).toEqual({ kind: 'keep' });
    expect(mergeSettings(local, local)).toEqual({ kind: 'keep' });
  });

  const stampArb = fc.record(Object.fromEntries(FIELDS.map((f) => [f, fc.integer({ min: 0, max: 50 })])) as Record<(typeof FIELDS)[number], fc.Arbitrary<number>>);
  // Distinct writers per side so no two HLCs are ever equal (LWW is then total).
  const side = (id: string, writer: string, s: Record<string, number>, octave: 'any' | 'exact', adaptive: boolean, pack: string) =>
    settings(id, Object.fromEntries(FIELDS.map((f) => [f, h(s[f]!, 0, writer)])), { octaveMode: octave, adaptiveWeighting: adaptive, activePackId: pack });
  const values = (r: ProfileSettingsRecord) => ({ fu: r.fieldUpdated, o: r.octaveMode, a: r.adaptiveWeighting, p: r.activePackId, u: r.updated });

  it('property: per-field merge is commutative in its field values', () => {
    fc.assert(
      fc.property(stampArb, stampArb, fc.boolean(), (sa, sb, flag) => {
        const a = side(LOCAL_ID, WA, sa, flag ? 'any' : 'exact', flag, 'pack-a');
        const b = side(OTHER_ID, WB, sb, flag ? 'exact' : 'any', !flag, 'pack-b');
        const ab = mergeSettings(a, b);
        const ba = mergeSettings(b, a);
        const ra = ab.kind === 'write' ? ab.record : a;
        const rb = ba.kind === 'write' ? ba.record : b;
        expect(values(ra)).toEqual(values(rb));
      }),
    );
  });

  it('property: idempotent', () => {
    fc.assert(
      fc.property(stampArb, stampArb, (sa, sb) => {
        const a = side(LOCAL_ID, WA, sa, 'any', true, 'pack-a');
        const b = side(OTHER_ID, WB, sb, 'exact', false, 'pack-b');
        const r1 = mergeSettings(a, b);
        const after = r1.kind === 'write' ? r1.record : a;
        expect(mergeSettings(after, b)).toEqual({ kind: 'keep' });
      }),
    );
  });

  it('property: each field ends with the value from the side with the newer field HLC', () => {
    fc.assert(
      fc.property(stampArb, stampArb, (sa, sb) => {
        const a = side(LOCAL_ID, WA, sa, 'any', true, 'pack-a');
        const b = side(OTHER_ID, WB, sb, 'exact', false, 'pack-b');
        const r = mergeSettings(a, b);
        const out = r.kind === 'write' ? r.record : a;
        // WB > WA, so an equal wall/counter goes to b.
        expect(out.octaveMode).toBe(sb.octaveMode! >= sa.octaveMode! ? 'exact' : 'any');
        expect(out.adaptiveWeighting).toBe(!(sb.adaptiveWeighting! >= sa.adaptiveWeighting!));
        expect(out.activePackId).toBe(sb.activePackId! >= sa.activePackId! ? 'pack-b' : 'pack-a');
      }),
    );
  });
});

describe('FR-066a / FR-043 lesson completion: natural key, per-stage union (earliest kept)', () => {
  const A = '55555555-5555-4555-8555-555555555555';
  const B = '66666666-6666-4666-8666-666666666666';

  it('no local copy: added', () => {
    const inc = completion(B, { read: h(1) });
    expect(mergeCompletion(undefined, inc)).toEqual({ kind: 'write', record: inc, change: 'added' });
  });

  it('unions stages and keeps the earliest time per stage; local id kept', () => {
    const r = mergeCompletion(completion(A, { read: h(5), see: h(6) }), completion(B, { read: h(2), drill: h(9) }));
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.record.stages).toEqual({ read: h(2), see: h(6), drill: h(9) });
      expect(r.record.id).toBe(A);
    }
  });

  it('nothing earlier or new: no-op', () => {
    expect(mergeCompletion(completion(A, { read: h(1), see: h(2) }), completion(B, { read: h(3) }))).toEqual({ kind: 'keep' });
  });

  it('restore un-deletes a completion tombstoned by reset (FR-066a, SC-009 export → reset → import)', () => {
    const local = completion(A, { read: h(1) }, { deleted: true, updated: h(20) });
    const r = mergeCompletion(local, completion(A, { read: h(1) }, { deleted: false, updated: h(5) }));
    expect(r.kind).toBe('write');
    if (r.kind === 'write') expect(r.record.deleted).toBe(false);
  });

  it('un-delete still merges stages as a union, earliest kept (FR-043 "merged as a union")', () => {
    const local = completion(A, { read: h(1), see: h(3) }, { deleted: true, updated: h(20) });
    const r = mergeCompletion(local, completion(A, { read: h(2), drill: h(4) }, { updated: h(5) }));
    expect(r.kind).toBe('write');
    if (r.kind === 'write') {
      expect(r.record.deleted).toBe(false);
      expect(r.record.stages).toEqual({ read: h(1), see: h(3), drill: h(4) });
    }
  });

  it('a newer incoming tombstone hides a live completion; an older one is ignored (LWW)', () => {
    const local = completion(A, { read: h(1) }, { updated: h(5) });
    expect(mergeCompletion(local, completion(A, { read: h(1) }, { deleted: true, updated: h(6) }))).toMatchObject({ kind: 'write', change: 'hidden', record: { deleted: true } });
    expect(mergeCompletion(local, completion(A, { read: h(1) }, { deleted: true, updated: h(4) }))).toEqual({ kind: 'keep' });
    expect(mergeCompletion({ ...local, deleted: true }, completion(A, { read: h(1) }, { deleted: true, updated: h(9) }))).toEqual({ kind: 'keep' });
  });

  const stagesArb = fc.record(
    { read: fc.integer({ min: 0, max: 30 }), see: fc.integer({ min: 0, max: 30 }), drill: fc.integer({ min: 0, max: 30 }) },
    { requiredKeys: [] },
  );
  const toStages = (s: { read?: number; see?: number; drill?: number }, w: string) =>
    Object.fromEntries(Object.entries(s).map(([k, v]) => [k, h(v!, 0, w)])) as LessonCompletionRecord['stages'];

  it('property: the stage union is commutative and equals a brute-force earliest-per-stage', () => {
    fc.assert(
      fc.property(stagesArb, stagesArb, (sa, sb) => {
        const a = completion(A, toStages(sa, WA));
        const b = completion(B, toStages(sb, WB));
        const ab = mergeCompletion(a, b);
        const ba = mergeCompletion(b, a);
        const ra = ab.kind === 'write' ? ab.record.stages : a.stages;
        const rb = ba.kind === 'write' ? ba.record.stages : b.stages;
        const expected: Record<string, string> = {};
        for (const k of ['read', 'see', 'drill'] as const) {
          const xs = [a.stages[k], b.stages[k]].filter((x): x is string => !!x).sort();
          if (xs.length) expected[k] = xs[0]!;
        }
        expect(ra).toEqual(expected);
        expect(rb).toEqual(expected);
      }),
    );
  });

  it('property: idempotent', () => {
    fc.assert(
      fc.property(stagesArb, stagesArb, (sa, sb) => {
        const a = completion(A, toStages(sa, WA));
        const b = completion(B, toStages(sb, WB));
        const r1 = mergeCompletion(a, b);
        const after = r1.kind === 'write' ? r1.record : a;
        expect(mergeCompletion(after, b)).toEqual({ kind: 'keep' });
      }),
    );
  });
});

// =============================================================================================
// T092 (red, test-first): FR-066a "Restore precedence for records with the same id or natural key"
// (1)–(5), owner-approved 2026-11-22 (R2-3, R3-1), plus the FN-10b completion tombstone rules.
// Expected outcomes are read off the numbered rule list in spec.md FR-066a, one case per rule and
// record type; nothing is derived from merge.ts.
// =============================================================================================
describe('FR-066a restore precedence (1)–(5), per record type', () => {
  const A = '55555555-5555-4555-8555-555555555555';

  describe('(1) attempts only: a different immutable payload ⇒ conflict', () => {
    it.each([
      ['both live', false, false],
      ['local tombstoned', true, false],
      ['incoming tombstoned', false, true],
      ['both tombstoned', true, true],
    ] as const)('%s: conflict wins over every tombstone rule', (_n, ld, id) => {
      const r = mergeAttempt(attempt({ deleted: ld, updated: h(3) }), attempt({ deleted: id, updated: h(4), payloadHash: 'c'.repeat(64), outcome: 'incorrect' }), fresh);
      expect(r.kind).toBe('conflict');
    });
  });

  describe('(2) local tombstoned, incoming live ⇒ un-delete', () => {
    it('attempt: restored', () => {
      expect(mergeAttempt(attempt({ deleted: true, updated: h(9) }), attempt({ updated: h(1) }), fresh)).toMatchObject({ kind: 'write', change: 'restored', record: { deleted: false } });
    });
    it('instrument: restored, even when the local tombstone is newer', () => {
      expect(mergeInstrument(instrument({ deleted: true, updated: h(9) }), instrument({ updated: h(1) }), fresh)).toMatchObject({ kind: 'write', change: 'restored', record: { deleted: false } });
    });
    it('completion: restored (counted as restored), keeping the per-stage union with the earliest time', () => {
      const r = mergeCompletion(completion(A, { read: h(4) }, { deleted: true, updated: h(9) }), completion(A, { read: h(2), see: h(3) }, { updated: h(5) }));
      expect(r).toMatchObject({ kind: 'write', change: 'restored', record: { deleted: false, stages: { read: h(2), see: h(3) } } });
    });
  });

  describe('(3) local live, incoming tombstoned ⇒ applies only if its HLC is newer than the local last update', () => {
    it.each([
      ['newer ⇒ hidden', 6, true],
      ['equal ⇒ no-op', 5, false],
      ['older ⇒ no-op', 4, false],
    ] as const)('%s (attempt, instrument, completion)', (_n, inc, applies) => {
      const ra = mergeAttempt(attempt({ updated: h(5) }), attempt({ deleted: true, updated: h(inc) }), fresh);
      const ri = mergeInstrument(instrument({ updated: h(5) }), instrument({ deleted: true, updated: h(inc) }), fresh);
      const rc = mergeCompletion(completion(A, { read: h(1) }, { updated: h(5) }), completion(A, { read: h(1) }, { deleted: true, updated: h(inc) }));
      for (const r of [ra, ri, rc]) {
        if (applies) expect(r).toMatchObject({ kind: 'write', change: 'hidden', record: { deleted: true } });
        else expect(r).toEqual({ kind: 'keep' });
      }
    });
  });

  describe('(4) both live ⇒ the type rule', () => {
    it('attempts identical ⇒ no-op', () => {
      expect(mergeAttempt(attempt({ updated: h(1) }), attempt({ updated: h(7) }), fresh)).toEqual({ kind: 'keep' });
    });
    it('completion: per-stage union, earliest kept', () => {
      expect(mergeCompletion(completion(A, { read: h(4) }), completion(A, { read: h(2), drill: h(8) }))).toMatchObject({ kind: 'write', record: { stages: { read: h(2), drill: h(8) } } });
    });
    it('instrument: newest updated wins', () => {
      expect(mergeInstrument(instrument({ updated: h(1) }), instrument({ name: 'New', updated: h(2) }), fresh)).toMatchObject({ kind: 'write', record: { name: 'New' } });
    });
  });

  describe('(5) both tombstoned ⇒ no-op', () => {
    it.each([
      ['incoming newer', 2, 8],
      ['incoming older', 8, 2],
      ['equal', 5, 5],
    ] as const)('%s: attempt, instrument and completion all keep', (_n, lu, iu) => {
      expect(mergeAttempt(attempt({ deleted: true, updated: h(lu) }), attempt({ deleted: true, updated: h(iu) }), fresh)).toEqual({ kind: 'keep' });
      expect(mergeInstrument(instrument({ deleted: true, updated: h(lu) }), instrument({ deleted: true, name: 'Other', updated: h(iu) }), fresh)).toEqual({ kind: 'keep' });
      expect(mergeCompletion(completion(A, { read: h(1) }, { deleted: true, updated: h(lu) }), completion(A, { see: h(1) }, { deleted: true, updated: h(iu) }))).toEqual({ kind: 'keep' });
    });
  });

  it('property (SC-013): restore merge of completion is idempotent over every tombstone combination', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (ld, id, lu, iu, ls, is) => {
        const local = completion(A, { read: h(ls, 0, WA) }, { deleted: ld, updated: h(lu, 0, WA) });
        const inc = completion(A, { see: h(is, 0, WB) }, { deleted: id, updated: h(iu, 0, WB) });
        const r1 = mergeCompletion(local, inc);
        const after = r1.kind === 'write' ? r1.record : local;
        expect(mergeCompletion(after, inc)).toEqual({ kind: 'keep' });
      }),
    );
  });

  it('property (SC-013): restore merge of instruments never resurrects or rewrites a record when both copies are tombstoned', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (lu, iu) => {
        const r = mergeInstrument(instrument({ deleted: true, updated: h(lu, 0, WA) }), instrument({ deleted: true, name: 'Incoming', updated: h(iu, 0, WB) }), fresh);
        expect(r).toEqual({ kind: 'keep' });
      }),
    );
  });
});
