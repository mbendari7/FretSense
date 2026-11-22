import {
  diatonicIndex, LETTERS, letterIndex, midi, mod, naturalPc,
  type Accidental, type Note, type PitchClassNote,
} from './note';
import { err, ok, type Result } from './result';

/** FR-002: interval = quality + number (1..15) + direction. */
export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd';
export interface Interval {
  readonly quality: IntervalQuality;
  readonly number: number;
  readonly direction: 'up' | 'down';
}

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11]; // per simple number 1..7
const PERFECT = new Set([1, 4, 5]);

export const isPerfectType = (n: number): boolean => PERFECT.has(((n - 1) % 7) + 1);

function baseSemitones(n: number): number {
  return MAJOR_SEMIS[(n - 1) % 7]! + 12 * Math.floor((n - 1) / 7);
}

const OFFSET_PERFECT: Partial<Record<IntervalQuality, number>> = { P: 0, A: 1, d: -1 };
const OFFSET_MAJOR: Partial<Record<IntervalQuality, number>> = { M: 0, m: -1, A: 1, d: -2 };

/** Size in semitones (always ≥ 0 for up; negative for down). */
export function semitones(iv: Interval): number {
  const table = isPerfectType(iv.number) ? OFFSET_PERFECT : OFFSET_MAJOR;
  const size = baseSemitones(iv.number) + (table[iv.quality] ?? 0);
  return iv.direction === 'up' ? size : -size;
}

function validInterval(q: IntervalQuality, n: number): boolean {
  if (!Number.isInteger(n) || n < 1 || n > 15) return false;
  return (isPerfectType(n) ? OFFSET_PERFECT : OFFSET_MAJOR)[q] !== undefined;
}

export function makeInterval(quality: IntervalQuality, number: number, direction: 'up' | 'down' = 'up'): Result<Interval> {
  if (!validInterval(quality, number)) return err('InvalidInterval', `${quality}${number} is not a valid interval`);
  // A diminished unison has no meaningful upward form; treat it as an augmented unison downward.
  if (number === 1 && quality === 'd') return err('InvalidInterval', 'A diminished unison is not used; use an augmented unison');
  return ok({ quality, number, direction });
}

function qualityFor(number: number, size: number): IntervalQuality | undefined {
  const diff = size - baseSemitones(number);
  const table = isPerfectType(number) ? OFFSET_PERFECT : OFFSET_MAJOR;
  for (const [q, off] of Object.entries(table)) if (off === diff) return q as IntervalQuality;
  return undefined;
}

/** Direction-aware interval from a to b, by letter distance (compound up to a double octave). */
export function intervalBetween(a: Note, b: Note): Result<Interval> {
  let steps = diatonicIndex(b) - diatonicIndex(a);
  let size = midi(b) - midi(a);
  let direction: 'up' | 'down' = 'up';
  if (steps < 0 || (steps === 0 && size < 0)) {
    direction = 'down';
    steps = -steps;
    size = -size;
  }
  const number = steps + 1;
  if (number > 15) return err('InvalidInterval', 'Intervals beyond a double octave are not supported');
  const quality = qualityFor(number, size);
  if (!quality) return err('InvalidInterval', 'The result would be doubly augmented or diminished');
  return ok({ quality, number, direction });
}

/** Transposes a spelled note; letters move by the interval number, so spelling is exact. */
export function transpose(note: Note, iv: Interval): Result<Note> {
  if (!validInterval(iv.quality, iv.number)) return err('InvalidInterval', 'Invalid interval');
  const sign = iv.direction === 'up' ? 1 : -1;
  const target = diatonicIndex(note) + sign * (iv.number - 1);
  const octave = Math.floor(target / 7);
  const letter = LETTERS[mod(target, 7)]!;
  const wanted = midi(note) + semitones(iv);
  const accidental = wanted - (12 * (octave + 1) + naturalPc(letter));
  if (accidental > 2 || accidental < -2) {
    return err('TripleAccidental', 'The result would need a triple accidental');
  }
  return ok({ letter, accidental: accidental as Accidental, octave });
}

/** Transposes a pitch-class note upward (octave-free spelling). */
export function transposePc(root: PitchClassNote, iv: Interval): Result<PitchClassNote> {
  const r = transpose({ ...root, octave: 4 }, { ...iv, direction: 'up' });
  return r.ok ? ok({ letter: r.value.letter, accidental: r.value.accidental }) : r;
}

/** Parses "M3", "-P5", "A4", "m10". */
export function parseInterval(text: string): Result<Interval> {
  const m = /^\s*(-)?([PMmAd])(\d{1,2})\s*$/.exec(text);
  if (!m) return err('InvalidInterval', `"${text}" is not an interval like M3`);
  return makeInterval(m[2] as IntervalQuality, Number(m[3]), m[1] ? 'down' : 'up');
}

export function formatInterval(iv: Interval): string {
  return `${iv.direction === 'down' ? '-' : ''}${iv.quality}${iv.number}`;
}

/** Shorthand for formula tables: "M3" → Interval (throws on a bad literal). */
export function iv(text: string): Interval {
  const r = parseInterval(text);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/**
 * Degree label relative to the major scale on the same root (FR-006):
 * P/M → "n", m → "bn", d → "bn" (perfect) or "bbn" (major type), A → "#n".
 */
export function degreeLabel(i: Interval): string {
  const n = i.number;
  switch (i.quality) {
    case 'P':
    case 'M':
      return String(n);
    case 'm':
      return `b${n}`;
    case 'A':
      return `#${n}`;
    case 'd':
      return isPerfectType(n) ? `b${n}` : `bb${n}`;
  }
}

/** Chord function label (FR-006): like a degree, but the root is "R". */
export function functionLabel(i: Interval): string {
  return i.number === 1 && i.quality === 'P' ? 'R' : degreeLabel(i);
}

export { letterIndex };
