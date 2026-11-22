import { buildChord, chordSymbol } from './chord';
import { intervalBetween } from './interval';
import { parsePitchClassNote, type PitchClassNote } from './note';
import { err, ok, unwrap, type Result } from './result';
import { buildScale } from './scale';

/** FR-007: the 30 key signatures, 7 flats to 7 sharps. */
export interface Key {
  readonly tonic: PitchClassNote;
  readonly mode: 'major' | 'minor';
}
export interface DiatonicChord {
  readonly degree: number; // 1..7
  readonly numeral: string;
  readonly root: PitchClassNote;
  readonly qualityId: string;
  readonly symbol: string;
  readonly tones: PitchClassNote[];
  readonly functions: string[];
}

const MAJORS = 'Cb Gb Db Ab Eb Bb F C G D A E B F# C#'.split(' ');
const MINORS = 'Ab Eb Bb F C G D A E B F# C# G# D# A#'.split(' ');

/** In circle-of-fifths order (7 flats → 7 sharps), majors then minors. */
export function keys(): Key[] {
  const mk = (t: string, mode: Key['mode']): Key => ({ tonic: unwrap(parsePitchClassNote(t)), mode });
  return [...MAJORS.map((t) => mk(t, 'major')), ...MINORS.map((t) => mk(t, 'minor'))];
}

/** Number of sharps (+) or flats (−) in the key signature. */
export function keySignature(key: Key): number {
  const list = key.mode === 'major' ? MAJORS : MINORS;
  const name = key.tonic.letter + (key.tonic.accidental === 1 ? '#' : key.tonic.accidental === -1 ? 'b' : '');
  return list.indexOf(name) - 7;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function qualityOf(root: PitchClassNote, tones: PitchClassNote[]): string | undefined {
  const r = { ...root, octave: 4 };
  const names = tones.slice(1).map((t) => {
    let n = { ...t, octave: 4 };
    const i0 = intervalBetween(r, n);
    if (i0.ok && i0.value.direction === 'down') n = { ...t, octave: 5 };
    const i = intervalBetween(r, n);
    return i.ok ? `${i.value.quality}${i.value.number}` : '?';
  });
  const sig = names.join(' ');
  const table: Record<string, string> = {
    'M3 P5': 'major', 'm3 P5': 'minor', 'm3 d5': 'dim', 'M3 A5': 'aug',
    'M3 P5 M7': 'maj7', 'M3 P5 m7': 'dom7', 'm3 P5 m7': 'min7', 'm3 d5 m7': 'm7b5', 'm3 d5 d7': 'dim7',
  };
  return table[sig];
}

function numeralFor(degree: number, qualityId: string): string {
  const up = ROMAN[degree - 1]!;
  const low = up.toLowerCase();
  switch (qualityId) {
    case 'major': return up;
    case 'minor': return low;
    case 'dim': return `${low}°`;
    case 'aug': return `${up}+`;
    case 'maj7': return `${up}maj7`;
    case 'dom7': return `${up}7`;
    case 'min7': return `${low}7`;
    case 'm7b5': return `${low}ø7`;
    case 'dim7': return `${low}°7`;
    default: return up;
  }
}

export function diatonicChords(key: Key, opts: { sevenths: boolean; harmonicMinor: boolean }): Result<DiatonicChord[]> {
  const base = buildScale(key.tonic, key.mode === 'major' ? 'major' : 'natural-minor');
  if (!base.ok) return base;
  const out: DiatonicChord[] = [];
  const add = (sc: PitchClassNote[], d: number) => {
    const idx = opts.sevenths ? [0, 2, 4, 6] : [0, 2, 4];
    const tones = idx.map((k) => sc[(d + k) % 7]!);
    const root = tones[0]!;
    const qualityId = qualityOf(root, tones);
    if (!qualityId) return err('UnknownType', `Could not classify the chord on degree ${d + 1}`);
    const built = buildChord(root, qualityId);
    if (!built.ok) return built;
    out.push({ degree: d + 1, numeral: numeralFor(d + 1, qualityId), root, qualityId, symbol: chordSymbol(root, qualityId), tones: built.value, functions: qualityFunctions(qualityId) });
    return undefined;
  };
  for (let d = 0; d < 7; d++) {
    const e = add(base.value, d);
    if (e) return e;
  }
  // FR-038: harmonic-minor alternatives (V, V7, vii°, vii°7) are shown in addition, not instead.
  if (key.mode === 'minor' && opts.harmonicMinor) {
    const harm = buildScale(key.tonic, 'harmonic-minor');
    if (!harm.ok) return harm;
    for (const d of [4, 6]) {
      const e = add(harm.value, d);
      if (e) return e;
    }
  }
  return ok(out);
}

import { functionLabels } from './chord';
const qualityFunctions = (qid: string) => functionLabels({ letter: 'C', accidental: 0 }, qid);
