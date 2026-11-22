// T010: intervals and transposition (FR-002, FR-010). Expected values: fixtures/theory/intervals.json
// (hand-worked) and reference arithmetic in ./arbitraries (published interval sizes).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { intervalBetween, transpose, parseInterval, midi } from '../src/index';
import type { Interval, Note } from '../src/index';
import fixture from '../../../fixtures/theory/intervals.json';
import { LETTERS, expectErr, intervalArb, iv, note, noteArb, refMidi, refSemitones, spellN, unwrap } from './arbitraries';

const shape = (i: Interval) => ({ quality: i.quality, number: i.number, direction: i.direction });

describe('FR-002 intervalBetween (direction-aware, compound included)', () => {
  it.each(fixture.between.values)('$from -> $to = $quality$number $direction ($why)', (row) => {
    const got = unwrap(intervalBetween(note(row.from), note(row.to)));
    expect(got.quality).toBe(row.quality);
    expect(got.number).toBe(row.number);
    if (row.direction !== null) expect(got.direction).toBe(row.direction);
  });

  it.each(fixture.betweenRejects.values)('$from -> $to is $kind ($why)', (row) => {
    expectErr(intervalBetween(note(row.from), note(row.to)), 'InvalidInterval');
  });

  it.each(fixture.beyondDoubleOctave.values)('$from -> $to (beyond a double octave) is an error', (row) => {
    expectErr(intervalBetween(note(row.from), note(row.to)));
  });

  it('swapping the notes keeps quality and number and flips direction (non-unison rows)', () => {
    for (const row of fixture.between.values.filter((r) => r.number !== 1)) {
      const there = unwrap(intervalBetween(note(row.from), note(row.to)));
      const back = unwrap(intervalBetween(note(row.to), note(row.from)));
      expect(back.quality).toBe(there.quality);
      expect(back.number).toBe(there.number);
      expect(back.direction).toBe(there.direction === 'up' ? 'down' : 'up');
    }
  });
});

describe('FR-002 transpose with correct spelling', () => {
  it.each(fixture.transpose.values)('$from + $interval = $to ($why)', (row) => {
    const got = unwrap(transpose(note(row.from), iv(row.interval)));
    expect(spellN(got)).toEqual(note(row.to));
  });

  it.each(fixture.transposeRejects.values)('$from + $interval is $kind ($why)', (row) => {
    expectErr(transpose(note(row.from), iv(row.interval)), 'TripleAccidental');
  });

  it.each(fixture.invalidIntervalValues.values)('rejects the impossible interval $quality$number', (bad) => {
    expectErr(transpose(note('C4'), bad as unknown as Interval), 'InvalidInterval');
  });
});

describe('FR-002 parseInterval', () => {
  it.each(fixture.parse.values)('parses "$text"', (row) => {
    expect(shape(unwrap(parseInterval(row.text)))).toEqual({ quality: row.quality, number: row.number, direction: row.direction });
  });

  it.each(fixture.parseRejects.values)('rejects "%s" with InvalidInterval', (text) => {
    expectErr(parseInterval(text), 'InvalidInterval');
  });
});

describe('FR-002 properties', () => {
  const opts = { numRuns: 1000 };

  it('transpose up then down by the same interval is the identity', () => {
    fc.assert(
      fc.property(noteArb(1), intervalArb(1, 15), (n, i) => {
        const upI = { ...i, direction: 'up' } as Interval;
        const downI = { ...i, direction: 'down' } as Interval;
        const there = transpose(n, upI);
        if (!there.ok) return; // only a triple-accidental result may fail; covered by fixtures
        const back = transpose(there.value, downI);
        expect(back.ok).toBe(true);
        if (back.ok) expect(spellN(back.value)).toEqual(n);
      }),
      opts,
    );
  });

  it('a successful transpose moves the pitch by exactly the interval size and the letter by number - 1 steps', () => {
    fc.assert(
      fc.property(noteArb(2), intervalArb(1, 15), (n, i) => {
        const r = transpose(n, i);
        if (!r.ok) {
          expect(r.error.kind).toBe('TripleAccidental');
          return;
        }
        expect(midi(r.value) - midi(n)).toBe(refSemitones(i));
        const steps = (i.number - 1) * (i.direction === 'up' ? 1 : -1);
        const expectedLetter = LETTERS[(((LETTERS.indexOf(n.letter) + steps) % 7) + 7) % 7];
        expect(r.value.letter).toBe(expectedLetter);
        expect(Math.abs(r.value.accidental)).toBeLessThanOrEqual(2);
      }),
      opts,
    );
  });

  it('transpose only fails when the reference result would need a triple accidental', () => {
    fc.assert(
      fc.property(noteArb(2), intervalArb(1, 15), (n, i) => {
        const steps = (i.number - 1) * (i.direction === 'up' ? 1 : -1);
        const li = LETTERS.indexOf(n.letter) + steps;
        const letter = LETTERS[((li % 7) + 7) % 7]!;
        const octave = n.octave + Math.floor(li / 7);
        const target = refMidi(n) + refSemitones(i);
        const acc = target - refMidi({ letter, accidental: 0, octave });
        const r = transpose(n, i);
        if (Math.abs(acc) > 2) expectErr(r, 'TripleAccidental');
        else expect(spellN(unwrap(r))).toEqual({ letter, accidental: acc, octave });
      }),
      opts,
    );
  });

  it('intervalBetween(n, transpose(n, i)) recovers i (non-unison)', () => {
    fc.assert(
      fc.property(noteArb(1), intervalArb(2, 15), (n, i) => {
        const t = transpose(n, i);
        if (!t.ok) return;
        expect(shape(unwrap(intervalBetween(n, t.value)))).toEqual(shape(i));
      }),
      opts,
    );
  });

  it('an interval plus its inversion is an octave (simple intervals 2..7)', () => {
    const invert = (i: Interval): Interval =>
      ({
        quality: ({ M: 'm', m: 'M', A: 'd', d: 'A', P: 'P' } as const)[i.quality],
        number: 9 - i.number,
        direction: 'up',
      }) as Interval;
    fc.assert(
      fc.property(noteArb(1), intervalArb(2, 7), (n, i0) => {
        const i = { ...i0, direction: 'up' } as Interval;
        const a = transpose(n, i);
        if (!a.ok) return;
        const b = transpose(a.value, invert(i));
        if (!b.ok) return;
        const octaveUp: Note = { ...n, octave: n.octave + 1 };
        expect(spellN(b.value)).toEqual(octaveUp);
      }),
      opts,
    );
  });

  it('intervalBetween and transpose are deterministic (FR-010)', () => {
    fc.assert(
      fc.property(noteArb(2), noteArb(2), intervalArb(), (a, b, i) => {
        expect(intervalBetween(a, b)).toEqual(intervalBetween(a, b));
        expect(transpose(a, i)).toEqual(transpose(a, i));
      }),
      { numRuns: 200 },
    );
  });
});
