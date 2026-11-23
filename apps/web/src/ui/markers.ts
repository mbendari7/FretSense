import {
  chromaticLabel, formatNote, formatPitchClass, midi, midiAt, mod, noteAt, pitchClass, spellInContext, type FretPosition, type InstrumentProfile, type Note,
  type PitchClassNote, type Result,
} from '@fretsense/theory';
import type { Marker } from './fretboard/Fretboard';

export type Ctx = { root: PitchClassNote; typeId?: string; qualityId?: string };
export type LabelMode = 'notes' | 'degrees' | 'none';

const pretty = (s: string) => s.replace(/bb/g, '𝄫').replace(/##/g, '𝄪').replace(/b/g, '♭').replace(/#/g, '♯');
export const prettyNote = (n: PitchClassNote) => pretty(formatPitchClass(n));
export const prettyText = (s: string) =>
  s.replace(/([A-G])(bb|##|b|#)/g, (_m, l: string, a: string) => l + pretty(a))
    // Degree and function labels such as "the b7th" or "(b3)" (code-reviewer r1 #9).
    .replace(/(^|[\s(])(bb|##|b|#)(\d)/g, (_m, pre: string, a: string, d: string) => pre + pretty(a) + d);

const ctxOf = (c: Ctx) => (c.typeId ? { typeId: c.typeId } : { qualityId: c.qualityId! });

/** Markers for every in-context tone in the window (explorer, See stage, key helper). */
export function contextMarkers(profile: InstrumentProfile, c: Ctx, from: number, to: number, mode: LabelMode): Marker[] {
  const out: Marker[] = [];
  for (let s = 1; s <= profile.stringCount; s++) {
    for (let f = from; f <= to; f++) {
      const m = midiAt(profile, { string: s, fret: f });
      if (!m.ok) continue;
      const sp = spellInContext(c.root, ctxOf(c), mod(m.value, 12));
      if (!sp.inContext) continue;
      out.push({
        pos: { string: s, fret: f },
        kind: sp.isRoot ? 'root' : 'tone',
        label: mode === 'notes' ? prettyNote(sp.spelled) : mode === 'degrees' ? pretty(sp.label) : '',
        name: `${c.qualityId ? 'function' : 'degree'} ${sp.label}${sp.isRoot ? ', root' : ''}`,
      });
    }
  }
  return out;
}

/** Describes any position: "String 3, fret 5, C4" ("String 6, open, E2" at fret 0), FR-020, FR-049. */
export function describePosition(profile: InstrumentProfile, pos: FretPosition, c?: Ctx, spellings?: readonly PitchClassNote[]): string {
  const n = spelledAt(profile, pos, c, spellings);
  const base = positionHead(pos);
  return n.ok ? `${base}, ${pretty(formatNote(n.value))}` : base;
}

/** FR-049 name head: "String N, fret F", or "String N, open" for fret 0. */
export const positionHead = (pos: FretPosition) => (pos.fret === 0 ? `String ${pos.string}, open` : `String ${pos.string}, fret ${pos.fret}`);

/**
 * The spelled note at a position. `spellings` (a question's own spelling source, FR-032, FR-032a:
 * the interval reference, then its answer) wins for a matching pitch class (Bb + m3 = Db, never
 * A# or C#); any other pitch class is spelled by FR-060 relative to the question's answer note (the
 * last entry: F + m3 = Ab, so MIDI 42 is Gb2, never F#2; code-reviewer r3 #1). Without
 * `spellings`: the context spelling, else the instrument default.
 */
export function spelledAt(profile: InstrumentProfile, pos: FretPosition, c?: Ctx, spellings?: readonly PitchClassNote[]): Result<Note> {
  const n = noteAt(profile, pos, c);
  if (!n.ok || !spellings?.length) return n;
  const m = midi(n.value);
  const sp = spellings.find((x) => pitchClass(x) === mod(m, 12)) ?? chromaticLabel(spellings[spellings.length - 1]!, mod(m, 12)).spelled;
  // Octave so that the spelled note sounds at m (B#3 and C4 are the same pitch).
  const octave = Math.round((m - midi({ ...sp, octave: -1 })) / 12) - 1;
  return { ok: true, value: { letter: sp.letter, accidental: sp.accidental, octave } };
}

export function positionInfo(profile: InstrumentProfile, pos: FretPosition, c?: Ctx, spellings?: readonly PitchClassNote[]) {
  const n = spelledAt(profile, pos, c, spellings);
  const m = midiAt(profile, pos);
  if (!n.ok || !m.ok) return undefined;
  const sp = c ? spellInContext(c.root, ctxOf(c), mod(m.value, 12)) : undefined;
  return { note: pretty(formatNote(n.value)), degree: sp ? pretty(sp.label) : undefined, inContext: sp?.inContext ?? false, midi: m.value };
}
