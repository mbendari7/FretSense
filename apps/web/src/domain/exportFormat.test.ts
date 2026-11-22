/**
 * T075 (domain part): profile export format v1 parsing (data-model §4, contracts/profile-export.md)
 * [FR-043, FR-066a, SC-009; THREAT-MODEL T13, T14].
 * Written test-after: the implementation already existed. Hostile inputs and limits come from the
 * contract and data-model §4 step 1. The application-level checks (File.size before read,
 * payloadHash recomputation, 24 h bound against the device clock, migration, preview counts, one
 * transaction) are not in this module and are not covered here.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { presetById } from '@fretsense/theory';
import { depthWithin, EXPORT_FORMAT, exportSchema, hasPrototypeKeys, MAX_DEPTH, MAX_IMPORT_BYTES, parseExport } from './exportFormat';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H = `2026-11-22T12:00:00.000Z-0000-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const common = (id: string) => ({ id, localProfileId: PID, created: H, updated: H, schemaVersion: 1, deleted: false });
const guitar = presetById('guitar6-standard')!.profile;

function validExport() {
  return {
    format: 'fretsense-profile-export',
    schemaVersion: 1,
    exportedAt: H,
    localProfile: { ...common(PID), displayName: 'Me' },
    instruments: [{ ...common('33333333-3333-4333-8333-333333333333'), name: 'Strat', profile: JSON.parse(JSON.stringify(guitar)) }],
    attempts: [{
      ...common('44444444-4444-4444-8444-444444444444'),
      drillType: 'note-finding',
      instrumentId: '33333333-3333-4333-8333-333333333333',
      geometryId: guitar.geometryId,
      modality: 'tap',
      prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
      answer: [{ string: 6, fret: 3 }],
      outcome: 'correct',
      responseMs: 812,
      timestamp: '2026-11-22T12:00:00.000Z',
      lessonId: null,
      drillId: null,
      itemKey: `nf|${guitar.geometryId}|6|7`,
      payloadHash: 'ab'.repeat(32),
    }],
    lessonCompletion: [{ ...common('55555555-5555-4555-8555-555555555555'), lessonId: 'notes-on-the-neck', stages: { read: H } }],
  };
}
const parse = (o: unknown) => parseExport(JSON.stringify(o));

describe('FR-043 export format v1: shape', () => {
  it('a valid export parses', () => {
    const r = parse(validExport());
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });

  it('the top-level keys are exactly the documented ones (profileSettings optional)', () => {
    expect(Object.keys(exportSchema.shape).sort()).toEqual(
      ['attempts', 'exportedAt', 'format', 'instruments', 'lessonCompletion', 'localProfile', 'profileSettings', 'schemaVersion'],
    );
    expect(EXPORT_FORMAT).toBe('fretsense-profile-export');
  });

  it('an unknown top-level field is rejected with a readable reason', () => {
    const r = parse({ ...validExport(), extra: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
  });

  it('deviceId is rejected anywhere (it is never part of an export)', () => {
    expect(parse({ ...validExport(), deviceId: 'x' }).ok).toBe(false);
    const e = validExport();
    expect(parse({ ...e, localProfile: { ...e.localProfile, deviceId: 'x' } }).ok).toBe(false);
  });

  it('an unknown nested field is rejected', () => {
    const e = validExport();
    expect(parse({ ...e, attempts: [{ ...e.attempts[0], note: 'hi' }] }).ok).toBe(false);
    expect(parse({ ...e, attempts: [{ ...e.attempts[0], prompt: { ...e.attempts[0]!.prompt, hint: 1 } }] }).ok).toBe(false);
  });

  it('wrong format string, newer schema version and malformed exportedAt are rejected (US7-4)', () => {
    expect(parse({ ...validExport(), format: 'something-else' }).ok).toBe(false);
    expect(parse({ ...validExport(), schemaVersion: 2 }).ok).toBe(false);
    expect(parse({ ...validExport(), exportedAt: '2026-11-22' }).ok).toBe(false);
  });

  it('missing required arrays are rejected', () => {
    const { attempts: _a, ...noAttempts } = validExport();
    expect(parse(noAttempts).ok).toBe(false);
  });

  it('invalid JSON is rejected with a readable reason', () => {
    const r = parseExport('{"format": ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/JSON/);
  });

  it('array caps: instruments ≤ 50, lessonCompletion ≤ 1,000', () => {
    const e = validExport();
    const inst = e.instruments[0]!;
    expect(parse({ ...e, instruments: Array.from({ length: 50 }, () => inst) }).ok).toBe(true);
    expect(parse({ ...e, instruments: Array.from({ length: 51 }, () => inst) }).ok).toBe(false);
    const lc = e.lessonCompletion[0]!;
    expect(parse({ ...e, lessonCompletion: Array.from({ length: 1001 }, () => lc) }).ok).toBe(false);
  });

  it('the size limit is the spec’s single 50 MB profile-export limit (FR-043)', () => {
    // spec.md FR-043: "size ≤ 50 MB, the single limit for the profile export format".
    expect(MAX_IMPORT_BYTES).toBeGreaterThanOrEqual(50_000_000);
    expect(MAX_IMPORT_BYTES).toBeLessThanOrEqual(50 * 1024 * 1024);
  });
});

describe('FR-043 / T13 depth pre-scan (≤ 16, before JSON.parse)', () => {
  const nest = (n: number) => '['.repeat(n) + ']'.repeat(n);
  it('the limit is 16', () => expect(MAX_DEPTH).toBe(16));

  it('depth 16 passes, depth 17 fails', () => {
    expect(depthWithin(nest(16))).toBe(true);
    expect(depthWithin(nest(17))).toBe(false);
    expect(depthWithin('{"a":'.repeat(17) + '1' + '}'.repeat(17))).toBe(false);
  });

  it('brackets inside strings are ignored, including after escaped quotes', () => {
    expect(depthWithin(`{"a":"${'['.repeat(40)}"}`)).toBe(true);
    expect(depthWithin(`{"a":"\\"${'{'.repeat(40)}"}`)).toBe(true);
  });

  it('parseExport rejects deep nesting with a reason, even when the deep part is far down', () => {
    const r = parseExport(`{"format":${nest(5000)}}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/nested/i);
  });

  it('property: pre-scan agrees with a brute-force depth count on bracket-only strings', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('[', ']', '{', '}'), { maxLength: 60 }), (chars) => {
        let d = 0;
        let max = 0;
        for (const c of chars) {
          d += c === '[' || c === '{' ? 1 : -1;
          max = Math.max(max, d);
        }
        expect(depthWithin(chars.join(''))).toBe(max <= 16);
      }),
    );
  });
});

describe('FR-043 / T14 prototype keys rejected at any depth', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('%s', (k) => {
    expect(hasPrototypeKeys(JSON.parse(`{"${k}":{}}`))).toBe(true);
    expect(hasPrototypeKeys(JSON.parse(`{"a":[{"b":{"${k}":1}}]}`))).toBe(true);
    const text = JSON.stringify(validExport()).replace('"displayName":"Me"', `"displayName":"Me","${k}":{"polluted":true}`);
    const r = parseExport(text);
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('ordinary keys are fine', () => {
    expect(hasPrototypeKeys({ a: [{ b: { c: 1 } }] })).toBe(false);
  });
});

describe('FR-043 text rules: names reject control, bidi-override and zero-width characters', () => {
  const bad = [
    ...['‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩'],
    ...['​', '‌', '‍', '‎', '‏'],
    ...['\u0000', '\u0007', '\u001B', '\u001F', '\n', '\t'],
  ];
  it.each(bad.map((c) => [c.codePointAt(0)!.toString(16).padStart(4, '0'), c]))('U+%s in the profile name or instrument name is rejected', (_cp, c) => {
    const e = validExport();
    expect(parse({ ...e, localProfile: { ...e.localProfile, displayName: `Me${c}x` } }).ok).toBe(false);
    expect(parse({ ...e, instruments: [{ ...e.instruments[0], name: `Strat${c}` }] }).ok).toBe(false);
  });

  it('ordinary Unicode names are accepted', () => {
    const e = validExport();
    expect(parse({ ...e, localProfile: { ...e.localProfile, displayName: 'José 🎸' } }).ok).toBe(true);
  });

  it('names are NFC: a decomposed name is either rejected or normalised to NFC', () => {
    const e = validExport();
    const r = parse({ ...e, localProfile: { ...e.localProfile, displayName: 'José' } });
    if (r.ok) expect(r.data.localProfile.displayName).toBe('José');
  });
});
