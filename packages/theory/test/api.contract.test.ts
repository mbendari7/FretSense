// T017: the public API of @fretsense/theory matches contracts/theory-api.md (Constitution II, VIII;
// research R11, R13). Runtime checks run under Vitest; the expectTypeOf checks are enforced by
// `pnpm typecheck` (tsc includes test/).
import { describe, it, expect, expectTypeOf } from 'vitest';
import * as api from '../src/index';
import type {
  Accidental,
  ChordQuality,
  DiatonicChord,
  FretPosition,
  GeometryId,
  InstrumentFamily,
  InstrumentProfile,
  InstrumentProfileInput,
  Interval,
  Key,
  Letter,
  Note,
  PitchClassNote,
  Preset,
  Result,
  ScaleType,
  SpellingContext,
  TheoryError,
} from '../src/index';

/** name -> [required params, total params] from contracts/theory-api.md. */
const CONTRACT: Record<string, [number, number]> = {
  parseNote: [1, 1],
  formatNote: [1, 2],
  midi: [1, 1],
  pitchClass: [1, 1],
  intervalBetween: [2, 2],
  transpose: [2, 2],
  parseInterval: [1, 1],
  scaleTypes: [0, 0],
  chordQualities: [0, 0],
  buildScale: [2, 2],
  buildChord: [2, 2],
  chordSymbol: [2, 3],
  degreeLabels: [2, 2],
  functionLabels: [2, 2],
  defaultSpelling: [2, 2],
  chromaticLabel: [2, 2],
  keys: [0, 0],
  diatonicChords: [2, 2],
  presets: [0, 0],
  validateProfile: [1, 1],
  geometryId: [2, 2],
  noteAt: [2, 3],
  positionsOf: [3, 3],
  fretX: [3, 3],
  // Helper exports (contract v1.1)
  parsePitchClassNote: [1, 1],
  formatPitchClass: [1, 2],
  mod: [2, 2],
  formatInterval: [1, 1],
  semitones: [1, 1],
  scaleType: [1, 1],
  chordQuality: [1, 1],
  keySignature: [1, 1],
  spellInContext: [3, 3],
  presetById: [1, 1],
  openString: [2, 2],
  midiAt: [2, 2],
  // Instrument data exports (contract v1.2)
  suggestedTuning: [2, 2],
};

/** Non-function exports from contract v1.1 (FAMILY_RULES) and v1.2 (SUGGESTED_TUNINGS). */
const NON_FUNCTION_EXPORTS = ['FAMILY_RULES', 'SUGGESTED_TUNINGS'];

describe('Constitution II: public exports match contracts/theory-api.md', () => {
  it('exports exactly the contract functions and helpers as runtime values (no undocumented API)', () => {
    expect(Object.keys(api).sort()).toEqual([...Object.keys(CONTRACT), ...NON_FUNCTION_EXPORTS].sort());
  });

  it.each(NON_FUNCTION_EXPORTS)('%s is a plain data export, not a function', (name) => {
    const value = (api as Record<string, unknown>)[name];
    expect(value).toBeDefined();
    expect(typeof value).toBe('object');
    expect(value).not.toBeNull();
  });

  it.each(Object.entries(CONTRACT))('%s is a function with a contract-compatible arity', (name, [required, total]) => {
    const fn = (api as Record<string, unknown>)[name];
    expect(typeof fn).toBe('function');
    // Function.length counts parameters before the first default/rest one.
    expect((fn as (...a: unknown[]) => unknown).length).toBeGreaterThanOrEqual(required);
    expect((fn as (...a: unknown[]) => unknown).length).toBeLessThanOrEqual(total);
  });

  it('catalogue sizes: 12 scale types, 12 chord qualities, 30 keys, 7 presets', () => {
    expect(api.scaleTypes()).toHaveLength(12);
    expect(api.chordQualities()).toHaveLength(12);
    expect(api.keys()).toHaveLength(30);
    expect(api.presets()).toHaveLength(7);
  });
});

describe('Constitution II / R13: contract types (checked by tsc)', () => {
  it('Result and TheoryError shapes', () => {
    expectTypeOf<Result<number, TheoryError>>().toEqualTypeOf<{ ok: true; value: number } | { ok: false; error: TheoryError }>();
    expectTypeOf<TheoryError['kind']>().toEqualTypeOf<
      'UnknownType' | 'TripleAccidental' | 'OutOfRange' | 'InvalidProfile' | 'InvalidInterval' | 'InvalidNote'
    >();
    expectTypeOf<TheoryError['message']>().toEqualTypeOf<string>();
  });

  it('value types (data-model.md section 1)', () => {
    expectTypeOf<Letter>().toEqualTypeOf<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'>();
    expectTypeOf<Accidental>().toEqualTypeOf<-2 | -1 | 0 | 1 | 2>();
    expectTypeOf<Note>().toMatchTypeOf<{ letter: Letter; accidental: Accidental; octave: number }>();
    expectTypeOf<PitchClassNote>().toMatchTypeOf<{ letter: Letter; accidental: Accidental }>();
    expectTypeOf<Interval>().toMatchTypeOf<{ quality: 'P' | 'M' | 'm' | 'A' | 'd'; number: number; direction: 'up' | 'down' }>();
    expectTypeOf<ScaleType>().toMatchTypeOf<{ id: string; name: string; formula: readonly Interval[]; heptatonic: boolean }>();
    expectTypeOf<ChordQuality>().toMatchTypeOf<{ id: string; symbolSuffix: string; formula: readonly Interval[]; functions: readonly string[] }>();
    expectTypeOf<Key>().toMatchTypeOf<{ tonic: PitchClassNote; mode: 'major' | 'minor' }>();
    expectTypeOf<DiatonicChord>().toMatchTypeOf<{
      numeral: string;
      symbol: string;
      tones: readonly PitchClassNote[];
      functions: readonly string[];
      qualityId: string;
      root: PitchClassNote;
    }>();
    expectTypeOf<InstrumentFamily>().toEqualTypeOf<'guitar' | 'bass'>();
    expectTypeOf<InstrumentProfile>().toMatchTypeOf<{
      family: InstrumentFamily;
      stringCount: number;
      tuning: readonly Note[];
      fretCount: number;
      scaleLengthMm: number;
      pitchRange: { lowMidi: number; highMidi: number };
      geometryId: GeometryId;
    }>();
    expectTypeOf<GeometryId>().toMatchTypeOf<string>();
    expectTypeOf<Preset>().toMatchTypeOf<{ presetId: string; profile: InstrumentProfile }>();
    expectTypeOf<FretPosition>().toMatchTypeOf<{ string: number; fret: number }>();
    // Callers can pass a scale context or a chord context (coordinator: { root, typeId?, qualityId? }).
    expectTypeOf<{ root: PitchClassNote; typeId: string }>().toMatchTypeOf<SpellingContext>();
    expectTypeOf<{ root: PitchClassNote; qualityId: string }>().toMatchTypeOf<SpellingContext>();
  });

  it('function signatures', () => {
    expectTypeOf(api.parseNote).toEqualTypeOf<(text: string) => Result<Note, TheoryError>>();
    expectTypeOf(api.midi).parameter(0).toEqualTypeOf<Note>();
    expectTypeOf(api.midi).returns.toEqualTypeOf<number>();
    expectTypeOf(api.intervalBetween).returns.toEqualTypeOf<Result<Interval, TheoryError>>();
    expectTypeOf(api.transpose).returns.toEqualTypeOf<Result<Note, TheoryError>>();
    expectTypeOf(api.parseInterval).returns.toEqualTypeOf<Result<Interval, TheoryError>>();
    expectTypeOf(api.buildScale).parameters.toEqualTypeOf<[root: PitchClassNote, typeId: string]>();
    expectTypeOf(api.buildScale).returns.toMatchTypeOf<Result<readonly PitchClassNote[], TheoryError>>();
    expectTypeOf(api.buildChord).returns.toMatchTypeOf<Result<readonly PitchClassNote[], TheoryError>>();
    expectTypeOf(api.chordSymbol).returns.toEqualTypeOf<string>();
    expectTypeOf(api.diatonicChords).parameter(0).toEqualTypeOf<Key>();
    expectTypeOf(api.diatonicChords).returns.toMatchTypeOf<Result<readonly DiatonicChord[], TheoryError>>();
    expectTypeOf(api.validateProfile).parameter(0).toEqualTypeOf<InstrumentProfileInput>();
    expectTypeOf(api.validateProfile).returns.toEqualTypeOf<Result<InstrumentProfile, TheoryError>>();
    expectTypeOf(api.geometryId).returns.toEqualTypeOf<GeometryId>();
    expectTypeOf(api.noteAt).returns.toEqualTypeOf<Result<Note, TheoryError>>();
    expectTypeOf(api.fretX).returns.toEqualTypeOf<number>();
    expectTypeOf(api.presets).returns.toMatchTypeOf<readonly Preset[]>();
    expectTypeOf(api.suggestedTuning).parameters.toEqualTypeOf<[family: InstrumentFamily, strings: number]>();
    expectTypeOf(api.suggestedTuning).returns.toEqualTypeOf<readonly string[] | undefined>();
  });

  it('InstrumentProfileInput carries no separate string count (derived from tuning.length)', () => {
    expectTypeOf<InstrumentProfileInput>().toMatchTypeOf<{ family: InstrumentFamily; tuning: readonly Note[]; fretCount: number; scaleLengthMm?: number }>();
    expectTypeOf<'stringCount' extends keyof InstrumentProfileInput ? true : false>().toEqualTypeOf<false>();
  });
});

describe('Constitution VIII / R11: no export takes a raw string count, tuning or fret count', () => {
  it('fretboard functions take the geometry only through an InstrumentProfile', () => {
    expectTypeOf(api.noteAt).parameter(0).toEqualTypeOf<InstrumentProfile>();
    expectTypeOf(api.noteAt).parameter(1).toEqualTypeOf<FretPosition>();
    expectTypeOf(api.positionsOf).parameter(0).toEqualTypeOf<InstrumentProfile>();
    expectTypeOf(api.fretX).parameter(0).toEqualTypeOf<InstrumentProfile>();
    expectTypeOf(api.openString).parameter(0).toEqualTypeOf<InstrumentProfile>();
    expectTypeOf(api.midiAt).parameter(0).toEqualTypeOf<InstrumentProfile>();
    expectTypeOf(api.midiAt).parameter(1).toEqualTypeOf<FretPosition>();
  });

  it('only geometryId (contract exception) and validateProfile (via its input) accept a tuning', () => {
    type TakesTuning<F> = F extends (...args: infer A) => unknown ? (Extract<A[number], readonly Note[]> extends never ? false : true) : false;
    expectTypeOf<TakesTuning<typeof api.noteAt>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.positionsOf>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.fretX>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.buildScale>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.diatonicChords>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.openString>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.midiAt>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.spellInContext>>().toEqualTypeOf<false>();
    expectTypeOf<TakesTuning<typeof api.geometryId>>().toEqualTypeOf<true>();
  });
});
