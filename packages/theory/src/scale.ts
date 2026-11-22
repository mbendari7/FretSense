import { degreeLabel, iv, transposePc, type Interval } from './interval';
import type { PitchClassNote } from './note';
import { err, ok, type Result } from './result';

/** FR-003: the 12 scale types, each an interval formula from the root. */
export interface ScaleType {
  readonly id: string;
  readonly name: string;
  readonly formula: readonly Interval[];
  readonly heptatonic: boolean;
}

const f = (s: string): Interval[] => s.split(' ').map(iv);
const scale = (id: string, name: string, formula: string): ScaleType => {
  const fm = f(formula);
  return { id, name, formula: fm, heptatonic: fm.length === 7 };
};

const SCALES: readonly ScaleType[] = [
  scale('major', 'Major (Ionian)', 'P1 M2 M3 P4 P5 M6 M7'),
  scale('dorian', 'Dorian', 'P1 M2 m3 P4 P5 M6 m7'),
  scale('phrygian', 'Phrygian', 'P1 m2 m3 P4 P5 m6 m7'),
  scale('lydian', 'Lydian', 'P1 M2 M3 A4 P5 M6 M7'),
  scale('mixolydian', 'Mixolydian', 'P1 M2 M3 P4 P5 M6 m7'),
  scale('natural-minor', 'Natural minor (Aeolian)', 'P1 M2 m3 P4 P5 m6 m7'),
  scale('locrian', 'Locrian', 'P1 m2 m3 P4 d5 m6 m7'),
  scale('harmonic-minor', 'Harmonic minor', 'P1 M2 m3 P4 P5 m6 M7'),
  scale('melodic-minor', 'Melodic minor (ascending)', 'P1 M2 m3 P4 P5 M6 M7'),
  scale('major-pentatonic', 'Major pentatonic', 'P1 M2 M3 P5 M6'),
  scale('minor-pentatonic', 'Minor pentatonic', 'P1 m3 P4 P5 m7'),
  scale('blues', 'Blues', 'P1 m3 P4 d5 P5 m7'),
];
const ALIASES: Record<string, string> = { ionian: 'major', aeolian: 'natural-minor', minor: 'natural-minor' };
const BY_ID = new Map(SCALES.map((s) => [s.id, s]));

export const scaleTypes = (): ScaleType[] => [...SCALES];

export function scaleType(typeId: string): Result<ScaleType> {
  const t = BY_ID.get(ALIASES[typeId] ?? typeId);
  return t ? ok(t) : err('UnknownType', `Unknown scale type "${typeId}"`);
}

export function buildScale(root: PitchClassNote, typeId: string): Result<PitchClassNote[]> {
  const t = scaleType(typeId);
  if (!t.ok) return t;
  const out: PitchClassNote[] = [];
  for (const i of t.value.formula) {
    const n = transposePc(root, i);
    if (!n.ok) return n;
    out.push(n.value);
  }
  return ok(out);
}

export function degreeLabels(_root: PitchClassNote, typeId: string): string[] {
  const t = scaleType(typeId);
  return t.ok ? t.value.formula.map(degreeLabel) : [];
}
