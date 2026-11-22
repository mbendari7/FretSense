import { midi, mod, pitchClass, sharpSpelling, withOctaveForMidi, samePitchClassNote, type Note, type PitchClassNote } from './note';
import { openString, type InstrumentProfile } from './instrument';
import { err, ok, type Result } from './result';
import { spellInContext, type SpellingContext } from './spelling';

/** FR-008: string 1 = highest pitched; fret 0 = open. */
export interface FretPosition {
  readonly string: number;
  readonly fret: number;
}

export type NoteSpelling = { root: PitchClassNote } & Partial<{ typeId: string; qualityId: string }>;

function checkPos(profile: InstrumentProfile, pos: FretPosition): Result<Note> {
  if (!Number.isInteger(pos.string) || pos.string < 1 || pos.string > profile.stringCount) {
    return err('OutOfRange', `String ${pos.string} is not on this ${profile.stringCount}-string instrument`);
  }
  if (!Number.isInteger(pos.fret) || pos.fret < 0 || pos.fret > profile.fretCount) {
    return err('OutOfRange', `Fret ${pos.fret} is outside 0–${profile.fretCount}`);
  }
  return ok(openString(profile, pos.string)!);
}

export function midiAt(profile: InstrumentProfile, pos: FretPosition): Result<number> {
  const open = checkPos(profile, pos);
  return open.ok ? ok(midi(open.value) + pos.fret) : open;
}

/**
 * Spelled note at a position. With a context, notes take the context spelling (FR-012, FR-060);
 * without one, open strings keep their tuning spelling and fretted notes use sharps.
 */
export function noteAt(profile: InstrumentProfile, pos: FretPosition, spelling?: NoteSpelling): Result<Note> {
  const open = checkPos(profile, pos);
  if (!open.ok) return open;
  const m = midi(open.value) + pos.fret;
  let pc: PitchClassNote;
  if (spelling && (spelling.typeId || spelling.qualityId)) {
    const ctx: SpellingContext = spelling.typeId ? { typeId: spelling.typeId } : { qualityId: spelling.qualityId! };
    pc = spellInContext(spelling.root, ctx, mod(m, 12)).spelled;
  } else if (pos.fret === 0) {
    pc = open.value;
  } else {
    pc = sharpSpelling(m);
  }
  return ok(withOctaveForMidi(pc, m));
}

export type PositionTarget = { pitchClass: number } | { midi: number };
export interface PositionRange {
  readonly fromFret: number;
  readonly toFret: number;
  readonly strings?: readonly number[];
}

/** All positions of a pitch class or exact pitch inside a fret range (string asc, then fret asc). */
export function positionsOf(profile: InstrumentProfile, target: PositionTarget, range: PositionRange): FretPosition[] {
  const from = Math.max(0, Math.ceil(range.fromFret));
  const to = Math.min(profile.fretCount, Math.floor(range.toFret));
  const strings = range.strings ?? Array.from({ length: profile.stringCount }, (_, i) => i + 1);
  const out: FretPosition[] = [];
  for (const s of [...strings].sort((a, b) => a - b)) {
    const open = openString(profile, s);
    if (!open) continue;
    const base = midi(open);
    for (let f = from; f <= to; f++) {
      const p = base + f;
      if ('midi' in target ? p === target.midi : mod(p, 12) === mod(target.pitchClass, 12)) out.push({ string: s, fret: f });
    }
  }
  return out;
}

/**
 * FR-062: horizontal position of a fret line in [0, 1]. Uniform: n / N. Proportional: equal-tempered
 * distance from the nut, xₙ = 1 − 2^(−n/12), normalised so the last fret is 1.
 */
export function fretX(profile: InstrumentProfile, fret: number, mode: 'uniform' | 'proportional'): number {
  const n = Math.min(Math.max(fret, 0), profile.fretCount);
  const N = profile.fretCount;
  if (mode === 'uniform') return n / N;
  return (1 - 2 ** (-n / 12)) / (1 - 2 ** (-N / 12));
}

export { pitchClass, samePitchClassNote };
