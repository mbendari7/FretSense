/**
 * T021 (part): canonical JSON for `payloadHash` (data-model §3.1) [FR-040, FR-066a, SC-013].
 * Written test-after: the implementation already existed. Expected strings are written by hand from
 * the §3.1 rules: keys sorted by code point, no whitespace, integers only, null for absent fields.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalJson, payloadOf, PAYLOAD_FIELDS } from './canonicalJson';

describe('FR-066a canonical JSON (data-model §3.1)', () => {
  it('sorts keys and emits no whitespace', () => {
    expect(canonicalJson({ b: 1, a: 2, c: { z: true, y: 'x' } })).toBe('{"a":2,"b":1,"c":{"y":"x","z":true}}');
  });

  it('keeps array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson([{ b: 1, a: 1 }])).toBe('[{"a":1,"b":1}]');
  });

  it('null and undefined both encode as null', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"a":null,"b":null}');
  });

  it('integers only: non-integers, NaN and infinities are rejected', () => {
    expect(canonicalJson(-42)).toBe('-42');
    expect(canonicalJson(0)).toBe('0');
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(() => canonicalJson(bad)).toThrow();
  });

  it('escapes strings as JSON', () => {
    expect(canonicalJson('a"b\\c\n')).toBe('"a\\"b\\\\c\\n"');
    expect(canonicalJson('é')).toBe('"é"');
  });

  it('rejects values JSON cannot represent', () => {
    expect(() => canonicalJson(() => 1)).toThrow();
    expect(() => canonicalJson(10n)).toThrow();
  });

  it('upper-case keys sort before lower-case (code point order, not locale order)', () => {
    expect(canonicalJson({ a: 1, B: 2, _: 3 })).toBe('{"B":2,"_":3,"a":1}');
  });

  it('keys outside the BMP sort by code point, not by UTF-16 code unit', () => {
    // U+FF61 < U+1F600 by code point; in UTF-16 the surrogate 0xD83D sorts before 0xFF61.
    const halfwidth = '｡';
    const emoji = '\u{1F600}';
    expect(canonicalJson({ [emoji]: 1, [halfwidth]: 2 })).toBe(`{"${halfwidth}":2,"${emoji}":1}`);
  });

  const jsonValue = fc.letrec((tie) => ({
    value: fc.oneof(
      { depthSize: 'small' },
      fc.integer(),
      fc.string(),
      fc.boolean(),
      fc.constant(null),
      fc.array(tie('value'), { maxLength: 4 }),
      fc.dictionary(fc.string({ maxLength: 6 }).filter((k) => k !== '__proto__'), tie('value'), { maxKeys: 4 }),
    ),
  })).value;

  it('property: output parses back to an equal value', () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        expect(JSON.parse(canonicalJson(v))).toEqual(v);
      }),
    );
  });

  it('property: insertion order of keys does not change the output', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ maxLength: 6 }).filter((k) => k !== '__proto__'), fc.integer(), { maxKeys: 8 }), (d) => {
        const reversed = Object.fromEntries(Object.entries(d).reverse());
        expect(canonicalJson(reversed)).toBe(canonicalJson(d));
      }),
    );
  });

  it('property: output contains no whitespace outside strings', () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const outside = canonicalJson(v).replace(/"(?:[^"\\]|\\.)*"/g, '""');
        expect(/\s/.test(outside)).toBe(false);
      }),
    );
  });
});

describe('FR-066a immutable attempt payload (data-model §3.1)', () => {
  it('the payload fields are exactly the 14 listed in FR-066a', () => {
    expect([...PAYLOAD_FIELDS].sort()).toEqual([
      'answer', 'drillId', 'drillType', 'geometryId', 'id', 'instrumentId', 'itemKey', 'lessonId', 'localProfileId',
      'modality', 'outcome', 'prompt', 'responseMs', 'timestamp',
    ]);
  });

  const attempt = {
    id: '00000000-0000-4000-8000-000000000001',
    localProfileId: '00000000-0000-4000-8000-000000000002',
    created: '2026-11-22T12:00:00.000Z-0000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    updated: '2026-11-22T12:00:00.000Z-0000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schemaVersion: 1,
    deleted: false,
    drillType: 'note-finding',
    instrumentId: null,
    geometryId: 'guitar:E2-A2-D3-G3-B3-E4',
    modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null },
    answer: [{ string: 6, fret: 3 }],
    outcome: 'correct',
    responseMs: 812,
    timestamp: '2026-11-22T12:00:00.000Z',
    itemKey: 'nf|guitar:E2-A2-D3-G3-B3-E4|6|7',
    payloadHash: 'ab'.repeat(32),
  };

  it('encodes exactly the payload fields, sorted, with null for absent lessonId and drillId', () => {
    expect(payloadOf(attempt)).toBe(
      '{"answer":[{"fret":3,"string":6}],"drillId":null,"drillType":"note-finding","geometryId":"guitar:E2-A2-D3-G3-B3-E4",'
      + '"id":"00000000-0000-4000-8000-000000000001","instrumentId":null,"itemKey":"nf|guitar:E2-A2-D3-G3-B3-E4|6|7",'
      + '"lessonId":null,"localProfileId":"00000000-0000-4000-8000-000000000002","modality":"tap","outcome":"correct",'
      + '"prompt":{"drillType":"note-finding","midi":null,"pitchClass":7,"string":6},"responseMs":812,'
      + '"timestamp":"2026-11-22T12:00:00.000Z"}',
    );
  });

  it('created, updated, schemaVersion, deleted and payloadHash do not affect the payload', () => {
    const changed = { ...attempt, created: 'x', updated: 'y', schemaVersion: 2, deleted: true, payloadHash: 'cd'.repeat(32) };
    expect(payloadOf(changed)).toBe(payloadOf(attempt));
  });

  it('any payload field change changes the payload', () => {
    expect(payloadOf({ ...attempt, responseMs: 813 })).not.toBe(payloadOf(attempt));
    expect(payloadOf({ ...attempt, lessonId: 'notes-on-the-neck' })).not.toBe(payloadOf(attempt));
    expect(payloadOf({ ...attempt, answer: [{ string: 6, fret: 15 }] })).not.toBe(payloadOf(attempt));
  });
});
