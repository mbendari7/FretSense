import { functionLabel, iv, transposePc, type Interval } from './interval';
import { formatPitchClass, type PitchClassNote } from './note';
import { err, ok, type Result } from './result';

/** FR-005: the 12 chord qualities, spelled by interval. */
export interface ChordQuality {
  readonly id: string;
  readonly name: string;
  readonly symbolSuffix: string;
  readonly formula: readonly Interval[];
  readonly functions: readonly string[];
}

const q = (id: string, name: string, symbolSuffix: string, formula: string): ChordQuality => {
  const fm = formula.split(' ').map(iv);
  return { id, name, symbolSuffix, formula: fm, functions: fm.map(functionLabel) };
};

const QUALITIES: readonly ChordQuality[] = [
  q('major', 'Major', '', 'P1 M3 P5'),
  q('minor', 'Minor', 'm', 'P1 m3 P5'),
  q('dim', 'Diminished', 'dim', 'P1 m3 d5'),
  q('aug', 'Augmented', 'aug', 'P1 M3 A5'),
  q('sus2', 'Suspended 2nd', 'sus2', 'P1 M2 P5'),
  q('sus4', 'Suspended 4th', 'sus4', 'P1 P4 P5'),
  q('dom7', 'Dominant 7th', '7', 'P1 M3 P5 m7'),
  q('maj7', 'Major 7th', 'maj7', 'P1 M3 P5 M7'),
  q('min7', 'Minor 7th', 'm7', 'P1 m3 P5 m7'),
  q('m7b5', 'Half-diminished (m7b5)', 'm7b5', 'P1 m3 d5 m7'),
  q('dim7', 'Diminished 7th', 'dim7', 'P1 m3 d5 d7'),
  q('add9', 'Add 9', 'add9', 'P1 M3 P5 M9'),
];
const BY_ID = new Map(QUALITIES.map((c) => [c.id, c]));

export const chordQualities = (): ChordQuality[] => [...QUALITIES];

export function chordQuality(qualityId: string): Result<ChordQuality> {
  const c = BY_ID.get(qualityId);
  return c ? ok(c) : err('UnknownType', `Unknown chord quality "${qualityId}"`);
}

export function buildChord(root: PitchClassNote, qualityId: string): Result<PitchClassNote[]> {
  const c = chordQuality(qualityId);
  if (!c.ok) return c;
  const out: PitchClassNote[] = [];
  for (const i of c.value.formula) {
    const n = transposePc(root, i);
    if (!n.ok) return n;
    out.push(n.value);
  }
  return ok(out);
}

export function functionLabels(_root: PitchClassNote, qualityId: string): string[] {
  const c = chordQuality(qualityId);
  return c.ok ? [...c.value.functions] : [];
}

export function chordSymbol(root: PitchClassNote, qualityId: string, style: 'ascii' | 'unicode' = 'ascii'): string {
  const c = chordQuality(qualityId);
  const suffix = c.ok ? c.value.symbolSuffix : qualityId;
  const s = formatPitchClass(root, style) + suffix;
  return style === 'unicode' ? formatPitchClass(root, style) + suffix.replace(/b/g, '♭').replace(/#/g, '♯') : s;
}
