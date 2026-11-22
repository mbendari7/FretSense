import { formatNote, midi, type Note } from './note';
import { err, ok, type Result } from './result';

/** FR-051–FR-053, ADR-0003: every instrument assumption lives in an InstrumentProfile. */
export type InstrumentFamily = 'guitar' | 'bass';
export type GeometryId = string & { readonly __brand: 'GeometryId' };

export interface InstrumentProfileInput {
  readonly family: InstrumentFamily;
  readonly tuning: readonly Note[]; // low → high
  readonly fretCount: number;
  readonly scaleLengthMm?: number;
}

export interface InstrumentProfile {
  readonly family: InstrumentFamily;
  readonly stringCount: number;
  readonly tuning: readonly Note[];
  readonly fretCount: number;
  readonly scaleLengthMm: number;
  readonly pitchRange: { readonly lowMidi: number; readonly highMidi: number };
  readonly geometryId: GeometryId;
}

/** Family rules. Ranges are provisional (research O3): guitar E1–E4, bass A0–C3. */
export const FAMILY_RULES: Record<InstrumentFamily, {
  minStrings: number; maxStrings: number; lowMidi: number; highMidi: number;
  defaultScaleLengthMm: number; defaultFretCount: number;
}> = {
  guitar: { minStrings: 6, maxStrings: 8, lowMidi: 28, highMidi: 64, defaultScaleLengthMm: 648, defaultFretCount: 22 },
  bass: { minStrings: 4, maxStrings: 6, lowMidi: 21, highMidi: 48, defaultScaleLengthMm: 864, defaultFretCount: 20 },
};
export const MIN_FRETS = 12;
export const MAX_FRETS = 24;

/** Research R6: "<family>:<note>-<note>-…", low → high, ASCII accidentals. */
export function geometryId(family: InstrumentFamily, tuning: readonly Note[]): GeometryId {
  return `${family}:${tuning.map((n) => formatNote(n, 'ascii')).join('-')}` as GeometryId;
}

export function validateProfile(input: InstrumentProfileInput): Result<InstrumentProfile> {
  const rules = FAMILY_RULES[input.family];
  if (!rules) return err('InvalidProfile', `Unknown instrument family "${String(input.family)}"`);
  const n = input.tuning.length;
  if (n < rules.minStrings || n > rules.maxStrings) {
    return err('InvalidProfile', `A ${input.family} needs ${rules.minStrings}–${rules.maxStrings} strings (got ${n})`);
  }
  if (!Number.isInteger(input.fretCount) || input.fretCount < MIN_FRETS || input.fretCount > MAX_FRETS) {
    return err('InvalidProfile', `Fret count must be a whole number from ${MIN_FRETS} to ${MAX_FRETS}`);
  }
  for (const t of input.tuning) {
    const okNote = t && 'CDEFGAB'.includes(t.letter) && t.letter.length === 1 && Number.isInteger(t.accidental) && Math.abs(t.accidental) <= 2 && Number.isInteger(t.octave);
    if (!okNote) return err('InvalidProfile', 'A tuning note is not a valid spelled note');
  }
  const pitches = input.tuning.map(midi);
  for (let i = 0; i < n; i++) {
    const p = pitches[i]!;
    if (p < rules.lowMidi || p > rules.highMidi) {
      return err('InvalidProfile', `String ${n - i} (${formatNote(input.tuning[i]!)}) is outside the ${input.family} range`);
    }
    if (i > 0 && p <= pitches[i - 1]!) {
      return err('InvalidProfile', 'Strings must rise in pitch from low to high (re-entrant tunings are not supported)');
    }
  }
  const scaleLengthMm = input.scaleLengthMm ?? rules.defaultScaleLengthMm;
  if (!(scaleLengthMm > 0 && scaleLengthMm <= 2000)) return err('InvalidProfile', 'Scale length must be between 1 and 2000 mm');
  return ok({
    family: input.family,
    stringCount: n,
    tuning: input.tuning.map((t) => ({ ...t })),
    fretCount: input.fretCount,
    scaleLengthMm,
    pitchRange: { lowMidi: pitches[0]!, highMidi: pitches[n - 1]! + input.fretCount },
    geometryId: geometryId(input.family, input.tuning),
  });
}

/** String 1 = highest pitched (FR-008). Returns the open note for a string number. */
export function openString(profile: InstrumentProfile, stringNumber: number): Note | undefined {
  return profile.tuning[profile.stringCount - stringNumber];
}

/**
 * Starting tunings for the custom-instrument form, per family and string count (ADR-0003:
 * tuning data lives with the instrument definitions, never in the UI). Low to high.
 */
export const SUGGESTED_TUNINGS: Record<InstrumentFamily, Readonly<Record<number, readonly string[]>>> = {
  guitar: {
    6: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    7: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    8: ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  bass: {
    4: ['E1', 'A1', 'D2', 'G2'],
    5: ['B0', 'E1', 'A1', 'D2', 'G2'],
    6: ['B0', 'E1', 'A1', 'D2', 'G2', 'C3'],
  },
};

export function suggestedTuning(family: InstrumentFamily, strings: number): readonly string[] | undefined {
  return SUGGESTED_TUNINGS[family][strings];
}
