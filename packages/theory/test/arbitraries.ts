// Test support for @fretsense/theory (T014): fast-check arbitraries plus tiny, test-local
// reference helpers. Nothing here is the implementation: the helpers only parse fixture text and
// apply the published MIDI definition (C4 = 60, MIDI = 12 * (octave + 1) + letter pc + accidental).
import fc from 'fast-check';
import { expect } from 'vitest';
import type {
  Accidental,
  InstrumentFamily,
  InstrumentProfileInput,
  Interval,
  Letter,
  Note,
  PitchClassNote,
  Result,
  TheoryError,
} from '../src/index';
import instruments from '../../../fixtures/theory/instruments.json';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Natural pitch class of each letter (C major scale on the piano's white keys). */
export const NATURAL_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const ACC_TEXT: Readonly<Record<string, Accidental>> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 };

/** Parse fixture pitch-class text such as "F##" or "Bbb" (test-local, no octave). */
export function pcn(text: string): PitchClassNote {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(text);
  if (!m) throw new Error(`fixture pitch-class text not understood: ${text}`);
  return { letter: m[1] as Letter, accidental: ACC_TEXT[m[2] ?? ''] as Accidental };
}

/** Parse fixture note text such as "Cb4" or "Bbb2" (test-local). */
export function note(text: string): Note {
  const m = /^([A-G])(bb|b|##|#)?(-?\d+)$/.exec(text);
  if (!m) throw new Error(`fixture note text not understood: ${text}`);
  return { letter: m[1] as Letter, accidental: ACC_TEXT[m[2] ?? ''] as Accidental, octave: Number(m[3]) };
}

/** Parse fixture interval text such as "M3" or "-P5" into an Interval value (test-local). */
export function iv(text: string): Interval {
  const m = /^(-?)([PMmAd])(\d+)$/.exec(text);
  if (!m) throw new Error(`fixture interval text not understood: ${text}`);
  return {
    quality: m[2] as Interval['quality'],
    number: Number(m[3]),
    direction: m[1] === '-' ? 'down' : 'up',
  } as Interval;
}

export const accText = (a: number): string => (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));
export const fmtPc = (p: PitchClassNote): string => `${p.letter}${accText(p.accidental)}`;
export const fmtNote = (n: Note): string => `${fmtPc(n)}${n.octave}`;
/** Only the spelling fields, so extra fields on returned values don't break equality. */
export const spell = (p: PitchClassNote): PitchClassNote => ({ letter: p.letter, accidental: p.accidental });
export const spellN = (n: Note): Note => ({ letter: n.letter, accidental: n.accidental, octave: n.octave });

/** Published MIDI definition (independent of the implementation). */
export const refMidi = (n: Note): number => 12 * (n.octave + 1) + NATURAL_PC[n.letter] + n.accidental;
export const refPc = (p: PitchClassNote): number => (((NATURAL_PC[p.letter] + p.accidental) % 12) + 12) % 12;

export type ErrorKind = TheoryError['kind'];

/** Assert ok and return the value. */
export function unwrap<T>(r: Result<T, TheoryError>): T {
  if (!r.ok) {
    expect.fail(`expected ok, got error ${JSON.stringify(r.error)}`);
  }
  return r.value;
}

/**
 * Assert a typed, descriptive error (FR-010): { ok: false, error: { kind, message } }.
 * Pass no kind where the spec doesn't name one.
 */
export function expectErr(r: Result<unknown, TheoryError>, kind?: ErrorKind): TheoryError {
  expect(r.ok, `expected an error result, got ${JSON.stringify(r)}`).toBe(false);
  if (r.ok) throw new Error('unreachable');
  if (kind !== undefined) expect(r.error.kind).toBe(kind);
  expect(typeof r.error.message).toBe('string');
  expect(r.error.message.length).toBeGreaterThan(0);
  return r.error;
}

// ---------------------------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------------------------

export const letterArb: fc.Arbitrary<Letter> = fc.constantFrom(...LETTERS);
export const accidentalArb = (maxAbs: 1 | 2 = 2): fc.Arbitrary<Accidental> =>
  fc.integer({ min: -maxAbs, max: maxAbs }) as fc.Arbitrary<Accidental>;

export const pitchClassNoteArb = (maxAbs: 1 | 2 = 2): fc.Arbitrary<PitchClassNote> =>
  fc.record({ letter: letterArb, accidental: accidentalArb(maxAbs) });

export const noteArb = (maxAbs: 1 | 2 = 2): fc.Arbitrary<Note> =>
  fc.record({ letter: letterArb, accidental: accidentalArb(maxAbs), octave: fc.integer({ min: 1, max: 6 }) });

const PERFECT_NUMBERS = new Set([1, 4, 5, 8, 11, 12, 15]);
const qualitiesFor = (n: number): Interval['quality'][] =>
  PERFECT_NUMBERS.has(n) ? ['P', 'A', 'd'] : ['M', 'm', 'A', 'd'];

/** Every valid Interval value with number in [min, max] (no d1: a diminished unison is not used). */
export const intervalArb = (min = 1, max = 15): fc.Arbitrary<Interval> =>
  fc
    .integer({ min, max })
    .chain((number) =>
      fc.record({
        quality: fc.constantFrom(...qualitiesFor(number).filter((q) => !(number === 1 && q === 'd'))),
        number: fc.constant(number),
        direction: fc.constantFrom<'up' | 'down'>('up', 'down'),
      }),
    ) as fc.Arbitrary<Interval>;

/** Reference interval size in semitones, independent of the implementation. */
export function refSemitones(i: Interval): number {
  const simple = (i.number - 1) % 7;
  const base = [0, 2, 4, 5, 7, 9, 11][simple]! + 12 * Math.floor((i.number - 1) / 7);
  const adj = PERFECT_NUMBERS.has(i.number)
    ? { P: 0, A: 1, d: -1 }[i.quality as 'P' | 'A' | 'd']
    : { M: 0, m: -1, A: 1, d: -2 }[i.quality as 'M' | 'm' | 'A' | 'd'];
  const size = base + (adj ?? NaN);
  return i.direction === 'down' ? 0 - size : size; // never -0 (Object.is)
}

// --- instruments --------------------------------------------------------------------------------

type FamilyRange = { lowMidi: number; highMidi: number; minStrings: number; maxStrings: number };
/** Provisional family ranges (O3) come from the fixture, so T016 updates one place. */
export const FAMILY_RANGES: Readonly<Record<InstrumentFamily, FamilyRange>> = {
  guitar: instruments.familyRanges.guitar,
  bass: instruments.familyRanges.bass,
};
export const FRET_MIN = instruments.fretCountRange.min;
export const FRET_MAX = instruments.fretCountRange.max;

/** Every (family, string count) the spec allows: guitar 6-8, bass 4-6 (FR-053, SC-011). */
export const STRING_COUNTS: ReadonlyArray<{ family: InstrumentFamily; stringCount: number }> = (
  ['guitar', 'bass'] as const
).flatMap((family) => {
  const r = FAMILY_RANGES[family];
  return Array.from({ length: r.maxStrings - r.minStrings + 1 }, (_, k) => ({ family, stringCount: r.minStrings + k }));
});

/** All spellings (accidental -2..2) of a MIDI number, as Notes whose refMidi equals it. */
export function spellingsOf(midiNumber: number): Note[] {
  const out: Note[] = [];
  for (const letter of LETTERS) {
    for (let a = -2; a <= 2; a++) {
      const rest = midiNumber - NATURAL_PC[letter] - a;
      if (rest % 12 === 0) out.push({ letter, accidental: a as Accidental, octave: rest / 12 - 1 });
    }
  }
  return out;
}

/**
 * A valid InstrumentProfileInput: strictly ascending open strings (by pitch) inside the family
 * range, each spelled at random (so enharmonic spellings like Eb2 / D#2 both occur), fret count
 * 12-24, scale length sometimes omitted (defaults apply).
 */
export function instrumentInputArb(opts: { family?: InstrumentFamily; stringCount?: number } = {}): fc.Arbitrary<InstrumentProfileInput> {
  const familyArb = opts.family ? fc.constant(opts.family) : fc.constantFrom<InstrumentFamily>('guitar', 'bass');
  return familyArb.chain((family) => {
    const r = FAMILY_RANGES[family];
    const countArb = opts.stringCount !== undefined ? fc.constant(opts.stringCount) : fc.integer({ min: r.minStrings, max: r.maxStrings });
    return countArb.chain((n) =>
      fc
        .uniqueArray(fc.integer({ min: r.lowMidi, max: r.highMidi }), { minLength: n, maxLength: n })
        .map((ms) => [...ms].sort((a, b) => a - b))
        .chain((ms) => fc.tuple(...ms.map((m) => fc.constantFrom(...spellingsOf(m)))))
        .chain((tuning) =>
          fc.record({
            family: fc.constant(family),
            tuning: fc.constant(tuning as Note[]),
            fretCount: fc.integer({ min: FRET_MIN, max: FRET_MAX }),
            scaleLengthMm: fc.option(fc.integer({ min: 500, max: 1000 }), { nil: undefined }),
          }),
        )
        .map((rec) => {
          const input: Record<string, unknown> = { family: rec.family, tuning: rec.tuning, fretCount: rec.fretCount };
          if (rec.scaleLengthMm !== undefined) input.scaleLengthMm = rec.scaleLengthMm;
          return input as unknown as InstrumentProfileInput;
        }),
    );
  });
}

/** Build an input from fixture text. */
export function inputFromText(family: string, tuning: string[], fretCount: number, scaleLengthMm?: number): InstrumentProfileInput {
  const input: Record<string, unknown> = { family, tuning: tuning.map(note), fretCount };
  if (scaleLengthMm !== undefined) input.scaleLengthMm = scaleLengthMm;
  return input as unknown as InstrumentProfileInput;
}
