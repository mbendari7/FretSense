/**
 * T013 gate r1 (red, test-first): restore hygiene [FR-003, FR-066a; research R3; product-owner 2026-11-27].
 * A profile delete tombstones records with deletedBy 'profile'. When a restore-import brings a LIVE record
 * back over such a local tombstone, the written record is live again and MUST NOT keep the stale
 * deletedBy (a live record with deletedBy 'profile' would later be mistaken for a tombstone by R3's
 * syncMerge / restoreApply). mergeSettings has no tombstone-restore branch (profile settings are never
 * un-deleted by merge), so it is not covered. Records are written by hand.
 */
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { mergeAttempt, mergeCompletion, mergeInstrument } from './merge';
import type { AttemptRecord, InstrumentRecord, LessonCompletionRecord } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BASE = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const h = (sec: number, writer = W) => `${new Date(BASE + sec * 1000).toISOString()}-0000-${writer}`;
const FRESH = h(10_000, WL);
const PID = '11111111-1111-4111-8111-111111111111';
const common = (id: string) => ({ id, localProfileId: PID, created: h(0), updated: h(1), schemaVersion: 1 as const });

const liveAttempt = (): AttemptRecord => ({
  ...common('44444444-4444-4444-8444-444444444444'), deleted: false,
  drillType: 'note-finding', instrumentId: null, geometryId: 'guitar:E2-A2-D3-G3-B3-E4', modality: 'tap',
  prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }], outcome: 'correct', responseMs: 800,
  timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null, itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7', payloadHash: 'a'.repeat(64),
});
const liveInstrument = (): InstrumentRecord => ({ ...common('33333333-3333-4333-8333-333333333333'), deleted: false, name: 'Bass', profile: presetById('bass4-standard')!.profile });
const liveCompletion = (): LessonCompletionRecord => ({ ...common('55555555-5555-4555-8555-555555555555'), deleted: false, lessonId: 'notes-on-the-neck', stages: { read: h(1) } });

const tomb = <T extends object>(r: T, by: 'profile' | 'user') => ({ ...r, deleted: true, deletedBy: by, updated: h(5) });

describe.each([['profile'], ['user']] as const)('[T013][FR-003] a live incoming record restoring a local tombstone (deletedBy %s) is written without deletedBy', (by) => {
  const clean = (r: unknown) => {
    expect((r as { deleted: boolean }).deleted).toBe(false);
    expect(r).not.toHaveProperty('deletedBy');
  };

  it('mergeAttempt', () => {
    const res = mergeAttempt(tomb(liveAttempt(), by) as AttemptRecord, liveAttempt(), () => FRESH);
    expect(res.kind).toBe('write');
    if (res.kind === 'write') { expect(res.change).toBe('restored'); clean(res.record); }
  });

  it('mergeInstrument', () => {
    const res = mergeInstrument(tomb(liveInstrument(), by) as InstrumentRecord, liveInstrument(), () => FRESH);
    expect(res.kind).toBe('write');
    if (res.kind === 'write') { expect(res.change).toBe('restored'); clean(res.record); }
  });

  it('mergeCompletion', () => {
    const res = mergeCompletion(tomb(liveCompletion(), by) as LessonCompletionRecord, liveCompletion());
    expect(res.kind).toBe('write');
    if (res.kind === 'write') { expect(res.change).toBe('restored'); clean(res.record); }
  });
});

describe('[T013][FR-003] hiding does not invent a deletedBy', () => {
  it('an incoming newer tombstone hides a live local record: the written tombstone carries no deletedBy of its own making', () => {
    const local = liveAttempt();
    const incoming = { ...liveAttempt(), deleted: true, updated: h(50) };
    const res = mergeAttempt(local, incoming, () => FRESH);
    expect(res.kind).toBe('write');
    if (res.kind === 'write') expect((res.record as { deletedBy?: string }).deletedBy).toBeUndefined();
  });
});
