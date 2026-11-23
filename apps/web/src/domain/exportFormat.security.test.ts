/**
 * security-reviewer T093 r1 MINOR #3 and #4 (red, test-first) [FR-043]:
 *  #3 parseExport rejects a wrong `format`, a wrong `schemaVersion`, or more than 200,000 attempts
 *     (data-model §4 limits) BEFORE any migration runs (no per-attempt work on a file that is
 *     already known to be invalid). migrateAttempt is spied through vi.mock (real implementation).
 *  #4 a rejection reason for a bad bass-* (v0.1) attempt never echoes a raw, non-UUID id: the id is
 *     attacker-controlled text (threat model: no bidi / control characters in UI text).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_FORMAT, parseExport } from './exportFormat';
import { migrateAttempt } from './migrate';

vi.mock('./migrate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./migrate')>();
  return { ...actual, migrateAttempt: vi.fn(actual.migrateAttempt) };
});
const spy = vi.mocked(migrateAttempt);
beforeEach(() => spy.mockClear());

const PID = '11111111-1111-4111-8111-111111111111';
const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H = `2026-11-22T12:00:00.000Z-0000-${W}`;
const v01Attempt = (id: string) => ({
  id, localProfileId: PID, created: H, updated: H, schemaVersion: 1, deleted: false,
  drillType: 'bass-arpeggio', instrumentId: null, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap',
  prompt: { drillType: 'bass-arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' },
  answer: [{ string: 3, fret: 5 }], outcome: 'correct', responseMs: 1500, timestamp: '2026-11-22T12:00:00.000Z',
  lessonId: null, drillId: null, itemKey: 'bs|bass-arpeggio|minor', payloadHash: 'a'.repeat(64),
});
const file = (over: Record<string, unknown>) => JSON.stringify({
  format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: H,
  localProfile: { id: PID, localProfileId: PID, created: H, updated: H, schemaVersion: 1, deleted: false, displayName: 'Me' },
  instruments: [], attempts: [v01Attempt('dddddddd-0000-4000-8000-000000000001')], lessonCompletion: [],
  ...over,
});

describe('security r1 #3: envelope checks run before migration', () => {
  it('control: a valid envelope with a v0.1 attempt does run the migration', () => {
    parseExport(file({}));
    expect(spy).toHaveBeenCalled();
  });

  it('wrong format: rejected, migrateAttempt never called', () => {
    const r = parseExport(file({ format: 'something-else' }));
    expect(r.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('wrong schemaVersion: rejected, migrateAttempt never called', () => {
    const r = parseExport(file({ schemaVersion: 2 }));
    expect(r.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('200,001 attempts: rejected with a format/limit reason, migrateAttempt never called, fast', () => {
    const text = file({ attempts: Array.from({ length: 200_001 }, () => ({})) });
    const t0 = performance.now();
    const r = parseExport(text);
    const ms = performance.now() - t0;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/format|limit|too many|200[, ]?000/i);
    expect(spy).not.toHaveBeenCalled();
    expect(ms, `took ${ms.toFixed(0)} ms`).toBeLessThan(2000);
  });
});

describe('security r1 #4: a bad bass-* attempt reason never echoes a raw id', () => {
  it('id of 5000 x plus U+202E: rejected; reason under 300 chars with no U+202E', () => {
    const badId = `${'x'.repeat(5000)}‮`;
    const bad = { ...v01Attempt(badId), prompt: { drillType: 'bass-arpeggio', nonsense: true } };
    const r = parseExport(file({ attempts: [bad] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.length, r.reason.slice(0, 120)).toBeLessThan(300);
    expect(r.reason).not.toContain('‮');
    expect(r.reason).not.toContain('xxxxxxxxxx');
  });

  it('same, for a bad item key on a bass-* attempt', () => {
    const badId = `${'x'.repeat(5000)}‮`;
    const r = parseExport(file({ attempts: [{ ...v01Attempt(badId), itemKey: 'bs|bass-walking|minor' }] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.length).toBeLessThan(300);
    expect(r.reason).not.toContain('‮');
  });
});
