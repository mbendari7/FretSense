import { err, ok, type Result } from './result';

/** FR-001: spelled notes. Octave follows the letter (Cb4 = MIDI 59, B#3 = MIDI 60). */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = -2 | -1 | 0 | 1 | 2;

export interface PitchClassNote {
  readonly letter: Letter;
  readonly accidental: Accidental;
}
export interface Note extends PitchClassNote {
  readonly octave: number;
}

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const letterIndex = (l: Letter): number => LETTERS.indexOf(l);
export const naturalPc = (l: Letter): number => NATURAL_PC[l];
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function midi(note: Note): number {
  return 12 * (note.octave + 1) + NATURAL_PC[note.letter] + note.accidental;
}

export function pitchClass(note: PitchClassNote): number {
  return mod(NATURAL_PC[note.letter] + note.accidental, 12);
}

/** Diatonic step index: 7 per octave, so letter arithmetic is plain addition. */
export const diatonicIndex = (note: Note): number => note.octave * 7 + letterIndex(note.letter);

const ACC_TEXT: Record<string, Accidental> = {
  '': 0, '#': 1, '##': 2, x: 2, b: -1, bb: -2,
  '♯': 1, '♯♯': 2, '𝄪': 2, '♭': -1, '♭♭': -2, '𝄫': -2, '♮': 0,
};

function parseAccidental(text: string): Result<Accidental> {
  if (text in ACC_TEXT) return ok(ACC_TEXT[text]!);
  if (/^(b|♭){3,}$|^(#|♯){3,}$/u.test(text)) {
    return err('TripleAccidental', `"${text}" needs more than two accidentals`);
  }
  return err('InvalidNote', `Unknown accidental "${text}"`);
}

/** Parses "F#3", "Bbb2", "Eb4", "C♯4". */
export function parseNote(text: string): Result<Note> {
  const m = /^\s*([A-Ga-g])([#♯b♭x𝄪𝄫♮]*)(-?\d{1,2})\s*$/u.exec(text);
  if (!m) return err('InvalidNote', `"${text}" is not a note like F#3`);
  const acc = parseAccidental(m[2]!);
  if (!acc.ok) return acc;
  return ok({ letter: m[1]!.toUpperCase() as Letter, accidental: acc.value, octave: Number(m[3]) });
}

/** Parses a pitch-class note with no octave: "F#", "Bb". */
export function parsePitchClassNote(text: string): Result<PitchClassNote> {
  const m = /^\s*([A-Ga-g])([#♯b♭x𝄪𝄫♮]*)\s*$/u.exec(text);
  if (!m) return err('InvalidNote', `"${text}" is not a note name like F#`);
  const acc = parseAccidental(m[2]!);
  if (!acc.ok) return acc;
  return ok({ letter: m[1]!.toUpperCase() as Letter, accidental: acc.value });
}

const ASCII: Record<Accidental, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const UNICODE: Record<Accidental, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export function accidentalText(a: Accidental, style: 'ascii' | 'unicode' = 'ascii'): string {
  return (style === 'ascii' ? ASCII : UNICODE)[a];
}

export function formatPitchClass(n: PitchClassNote, style: 'ascii' | 'unicode' = 'ascii'): string {
  return n.letter + accidentalText(n.accidental, style);
}

export function formatNote(note: Note | PitchClassNote, style: 'ascii' | 'unicode' = 'ascii'): string {
  const base = formatPitchClass(note, style);
  return 'octave' in note ? base + String(note.octave) : base;
}

export const samePitchClassNote = (a: PitchClassNote, b: PitchClassNote): boolean =>
  a.letter === b.letter && a.accidental === b.accidental;

export const toPitchClassNote = (n: PitchClassNote): PitchClassNote => ({
  letter: n.letter,
  accidental: n.accidental,
});

/** Gives a pitch-class spelling the octave that makes it sound at `midiNumber`. */
export function withOctaveForMidi(pc: PitchClassNote, midiNumber: number): Note {
  const octave = (midiNumber - NATURAL_PC[pc.letter] - pc.accidental) / 12 - 1;
  return { letter: pc.letter, accidental: pc.accidental, octave: Math.round(octave) };
}

/** Spelling of a pitch class using sharps (used only when no context exists). */
const SHARP_NAMES: PitchClassNote[] = [
  { letter: 'C', accidental: 0 }, { letter: 'C', accidental: 1 }, { letter: 'D', accidental: 0 },
  { letter: 'D', accidental: 1 }, { letter: 'E', accidental: 0 }, { letter: 'F', accidental: 0 },
  { letter: 'F', accidental: 1 }, { letter: 'G', accidental: 0 }, { letter: 'G', accidental: 1 },
  { letter: 'A', accidental: 0 }, { letter: 'A', accidental: 1 }, { letter: 'B', accidental: 0 },
];
export const sharpSpelling = (pc: number): PitchClassNote => SHARP_NAMES[mod(pc, 12)]!;
