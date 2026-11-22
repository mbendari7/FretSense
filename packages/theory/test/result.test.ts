// T010: the Result<T, TheoryError> contract (FR-010, research R13, contracts/theory-api.md).
// Every fallible function returns a value, never throws, and errors are typed and descriptive.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseNote, parseInterval, intervalBetween, transpose, buildScale, buildChord } from '../src/index';
import type { Interval, Result, TheoryError } from '../src/index';
import { note, noteArb, pcn } from './arbitraries';

const KINDS = ['UnknownType', 'TripleAccidental', 'OutOfRange', 'InvalidProfile', 'InvalidInterval', 'InvalidNote'];

function assertResultShape(r: Result<unknown, TheoryError>): void {
  expect(typeof r.ok).toBe('boolean');
  if (r.ok) {
    expect(r).toHaveProperty('value');
    expect(r).not.toHaveProperty('error');
  } else {
    expect(r).not.toHaveProperty('value');
    expect(KINDS).toContain(r.error.kind);
    expect(typeof r.error.message).toBe('string');
    expect(r.error.message.length).toBeGreaterThan(0);
  }
}

describe('FR-010 Result shape', () => {
  it('ok results are { ok: true, value }', () => {
    const r = parseNote('C4');
    assertResultShape(r);
    expect(r.ok).toBe(true);
  });

  it('error results are { ok: false, error: { kind, message } } with a known kind', () => {
    const cases: Result<unknown, TheoryError>[] = [
      parseNote('H9'),
      parseNote('C###4'),
      parseInterval('P3'),
      transpose(note('F##4'), { quality: 'A', number: 1, direction: 'up' } as Interval),
      buildScale(pcn('C'), 'no-such-scale'),
      buildChord(pcn('C'), 'no-such-chord'),
    ];
    for (const r of cases) {
      assertResultShape(r);
      expect(r.ok).toBe(false);
    }
  });

  it('error messages are descriptive: they mention the offending input', () => {
    const r = buildScale(pcn('C'), 'no-such-scale');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('no-such-scale');
  });
});

describe('FR-010 fallible functions never throw on arbitrary input', () => {
  it('parseNote / parseInterval on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (s) => {
        assertResultShape(parseNote(s));
        assertResultShape(parseInterval(s));
      }),
      { numRuns: 500 },
    );
  });

  it('buildScale / buildChord on arbitrary ids', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (id) => {
        assertResultShape(buildScale(pcn('C'), id));
        assertResultShape(buildChord(pcn('C'), id));
      }),
      { numRuns: 300 },
    );
  });

  it('prototype-ish ids are unknown types, not lookups on Object.prototype', () => {
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const s = buildScale(pcn('C'), id);
      const c = buildChord(pcn('C'), id);
      expect(s.ok).toBe(false);
      expect(c.ok).toBe(false);
      if (!s.ok) expect(s.error.kind).toBe('UnknownType');
      if (!c.ok) expect(c.error.kind).toBe('UnknownType');
    }
  });

  it('intervalBetween on arbitrary note pairs', () => {
    fc.assert(fc.property(noteArb(2), noteArb(2), (a, b) => assertResultShape(intervalBetween(a, b))), { numRuns: 500 });
  });
});

describe('FR-010 determinism', () => {
  it('the same input gives deep-equal results', () => {
    for (const text of ['C4', 'Cb4', 'B#3', 'nope', 'C###4']) expect(parseNote(text)).toEqual(parseNote(text));
    expect(buildScale(pcn('G#'), 'major')).toEqual(buildScale(pcn('G#'), 'major'));
  });

  it('results are not shared mutable state: mutating a returned value does not change later results', () => {
    const first = buildScale(pcn('D'), 'major');
    if (first.ok) {
      try {
        (first.value as unknown as unknown[]).length = 0;
      } catch {
        // frozen values are fine too
      }
    }
    const second = buildScale(pcn('D'), 'major');
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value).toHaveLength(7);
  });
});
