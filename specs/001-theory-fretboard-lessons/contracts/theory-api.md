# Contract: `@fretsense/theory` Public API (v1)

Pure TypeScript, zero runtime dependencies, deterministic, no DOM, I/O or global mutable state
(Constitution II). Every function that can fail returns `Result<T, TheoryError>`:

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Signatures are the contract. Bodies are implementation (tests first, per task). Types are defined in
[../data-model.md](../data-model.md) §1.

## Notes and intervals (FR-001, FR-002)

| Function | Returns | Errors |
|----------|---------|--------|
| `parseNote(text: string)` | `Result<Note>`, e.g. `"F#3"`, `"Bbb2"` | `InvalidNote`, `TripleAccidental` |
| `formatNote(note: Note, style?: 'ascii' \| 'unicode')` | `string` | — |
| `midi(note: Note)` | `number` (Cb4 = 59, B#3 = 60) | — |
| `pitchClass(note: Note \| PitchClassNote)` | `0..11` | — |
| `intervalBetween(a: Note, b: Note)` | `Result<Interval>`, direction-aware, compound included | `InvalidInterval` (doubly augmented/diminished) |
| `transpose(note: Note, interval: Interval)` | `Result<Note>` | `TripleAccidental`, `InvalidInterval` |
| `parseInterval(text: string)` | `Result<Interval>`, e.g. `"M3"`, `"-P5"` | `InvalidInterval` |

## Scales, chords, keys (FR-003–FR-007, FR-019, FR-060)

| Function | Returns |
|----------|---------|
| `scaleTypes()` / `chordQualities()` | the 12 + 12 catalogues (`ScaleType[]`, `ChordQuality[]`) |
| `buildScale(root: PitchClassNote, typeId: string)` | `Result<PitchClassNote[]>` |
| `buildChord(root: PitchClassNote, qualityId: string)` | `Result<PitchClassNote[]>` |
| `chordSymbol(root, qualityId, style?)` | `string` (canonical, FR-005) |
| `degreeLabels(root, typeId)` / `functionLabels(root, qualityId)` | `string[]` (FR-006) |
| `defaultSpelling(pitchClass: 0..11, context: { typeId } \| { qualityId })` | `PitchClassNote` (fewest-accidentals rule, ties to sharps; Edge Cases) |
| `chromaticLabel(root, note)` | `{ spelled: PitchClassNote; degree: string }` (FR-060 map) |
| `keys()` | the 30 `Key` values (FR-007) |
| `diatonicChords(key: Key, opts: { sevenths: boolean; harmonicMinor: boolean })` | `Result<DiatonicChord[]>` |

## Instruments and fretboard (FR-008, FR-009, FR-051–FR-053, FR-062)

| Function | Returns |
|----------|---------|
| `presets()` | the 7 `Preset` values (FR-009, FR-052) |
| `validateProfile(input: InstrumentProfileInput)` | `Result<InstrumentProfile>` (computes `pitchRange`, `geometryId`) |
| `geometryId(family, tuning: Note[])` | `GeometryId` |
| `noteAt(profile, pos: FretPosition, spelling?: SpellingContext)` | `Result<Note>` |
| `positionsOf(profile, target: { pitchClass: 0..11 } \| { midi: number }, range: { fromFret; toFret; strings? })` | `FretPosition[]` |
| `fretX(profile, fret, mode: 'uniform' \| 'proportional')` | `number` in [0, 1] (FR-062; xₙ = 1 − 2^(−n/12), normalised to the last fret) |

## Instrument data exports (v1.2, 2026-11-22, provisional; code-reviewer r2 M2)

- `SUGGESTED_TUNINGS: Record<InstrumentFamily, Record<number, readonly string[]>>`: starting tunings for the custom-instrument form, low to high, for every string count `FAMILY_RULES` allows (guitar 6, 7, 8; bass 4, 5, 6). Standard tunings: guitar 6 E2 A2 D3 G3 B3 E4, 7 adds B1, 8 adds F♯1 below that; bass 4 E1 A1 D2 G2, 5 adds B0, 6 adds C3 on top.
- `suggestedTuning(family, strings): readonly string[] | undefined`: the entry above, or `undefined` for a count the family doesn't allow.
- Every suggested tuning MUST pass `validateProfile` for its family. Tuning data lives here, never in the UI (ADR-0003).

## Helper exports (v1.1, added 2026-11-22 during T017 implementation; provisional under the standing approval)

The app needs these small helpers. They are part of the public API, so the contract test covers them too.

| Export | Returns / purpose |
|--------|-------------------|
| `parsePitchClassNote(text)` | `Result<PitchClassNote>` (no octave), e.g. `"F#"` |
| `formatPitchClass(note, style?)` | `string` |
| `mod(n, m)` | non-negative remainder (pitch-class arithmetic) |
| `formatInterval(interval)` | `string`, e.g. `"-P5"` |
| `semitones(interval)` | signed semitone size |
| `scaleType(typeId)` / `chordQuality(qualityId)` | `Result<ScaleType>` / `Result<ChordQuality>` (alias-aware lookup) |
| `keySignature(key)` | sharps (+) or flats (−), −7..7 |
| `spellInContext(root, ctx, pitchClass)` | `{ spelled, label, inContext, isRoot }` (context tones keep the context spelling; others follow FR-060) |
| `presetById(id)` | `Preset \| undefined` |
| `openString(profile, string)` | `Note \| undefined` (string 1 = highest) |
| `midiAt(profile, pos)` | `Result<number>` |
| `FAMILY_RULES` | per-family string counts, pitch range (provisional, O3), default fret count and scale length |

`diatonicChords(key, { harmonicMinor: true })` on a minor key returns the 7 natural-minor chords
followed by the harmonic-minor alternatives (V/V7 and vii°/vii°7), per US5-2 ("also shown").

## Stability and versioning

- The package is versioned with the app (workspace). A change to any signature in this file is a
  contract change and needs a spec/plan update first (Constitution I).
- No function may take a string count, tuning or fret count except through `InstrumentProfile`
  (Constitution VIII; research R11).
