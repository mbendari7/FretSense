/**
 * FR-066a restore precedence rule (6), spec change (code-reviewer T091 r1 #6, provisional) (red):
 * "(6) no local copy, incoming copy tombstoned ⇒ not written and not counted in any preview count
 * (it hides nothing)."
 *
 * NOTE: this contradicts the older case in merge.test.ts, "no local copy, incoming tombstone: written
 * as hidden (tombstones are kept for merging)". That case must be updated to this rule by whoever
 * owns merge.test.ts; it was left unchanged here (edit not permitted in this pass).
 * Builders are hand-written (same shapes as merge.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { mergeAttempt, mergeCompletion, mergeInstrument } from './merge';
import type { AttemptRecord, InstrumentRecord, LessonCompletionRecord } from './records';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BASE = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const h = (sec: number, counter = 0, writer = WA) => `${new Date(BASE + sec * 1000).toISOString()}-${String(counter).padStart(4, '0')}-${writer}`;
const fresh = () => h(10_000, 0, WL);
const PID = '11111111-1111-4111-8111-111111111111';

const attempt: AttemptRecord = {
  id: '44444444-4444-4444-8444-444444444444', localProfileId: PID, created: h(0), updated: h(4), schemaVersion: 1, deleted: true,
  drillType: 'note-finding', instrumentId: null, geometryId: 'guitar:E2-A2-D3-G3-B3-E4', modality: 'tap',
  prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }],
  outcome: 'correct', responseMs: 800, timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null,
  itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7', payloadHash: 'a'.repeat(64),
};
const instrument: InstrumentRecord = {
  id: '33333333-3333-4333-8333-333333333333', localProfileId: PID, created: h(0), updated: h(4), schemaVersion: 1, deleted: true,
  name: 'Bass', profile: presetById('bass4-standard')!.profile,
};
const completion: LessonCompletionRecord = {
  id: '55555555-5555-4555-8555-555555555555', localProfileId: PID, created: h(0), updated: h(4), schemaVersion: 1, deleted: true,
  lessonId: 'notes-on-the-neck', stages: { read: h(1) },
};

describe('FR-066a restore precedence (6): no local copy, incoming tombstoned ⇒ not written', () => {
  it('attempt: { kind: "keep" }', () => {
    expect(mergeAttempt(undefined, attempt, fresh)).toEqual({ kind: 'keep' });
  });
  it('instrument: { kind: "keep" }', () => {
    expect(mergeInstrument(undefined, instrument, fresh)).toEqual({ kind: 'keep' });
  });
  it('lesson completion: { kind: "keep" }', () => {
    expect(mergeCompletion(undefined, completion)).toEqual({ kind: 'keep' });
  });
});
