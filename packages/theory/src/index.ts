/** @fretsense/theory public API v1.1 (contracts/theory-api.md). Only documented values are exported. */
export type { Result, TheoryError, TheoryErrorKind } from './result';
export { type Letter, type Accidental, type Note, type PitchClassNote, midi, pitchClass, parseNote, parsePitchClassNote, formatNote, formatPitchClass, mod } from './note';
export { type Interval, type IntervalQuality, intervalBetween, transpose, parseInterval, formatInterval, semitones } from './interval';
export { type ScaleType, scaleTypes, scaleType, buildScale, degreeLabels } from './scale';
export { type ChordQuality, chordQualities, chordQuality, buildChord, chordSymbol, functionLabels } from './chord';
export { type SpellingContext, defaultSpelling, chromaticLabel, spellInContext } from './spelling';
export { type Key, type DiatonicChord, keys, keySignature, diatonicChords } from './key';
export { type InstrumentFamily, type InstrumentProfile, type InstrumentProfileInput, type GeometryId, FAMILY_RULES, SUGGESTED_TUNINGS, suggestedTuning, geometryId, validateProfile, openString } from './instrument';
export { type Preset, presets, presetById } from './presets';
export { type FretPosition, type NoteSpelling, type PositionTarget, type PositionRange, noteAt, midiAt, positionsOf, fretX } from './fretboard';
