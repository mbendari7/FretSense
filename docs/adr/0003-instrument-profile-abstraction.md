# 0003. InstrumentProfile as the Single Source of Instrument Geometry

- Status: Proposed
- Date: 2026-11-21
- Deciders: owner
- Related: Constitution II, VIII; spec 001 (FR-008, FR-009, FR-051–FR-056); ADR-0002

## Context
FretSense must support 6-string guitar, 4- and 5-string bass, and custom tunings. String count,
tuning, fret count, pitch range and scale length affect theory mapping, rendering, drills, DSP
window sizing (ADR-0002) and vision geometry (fret spacing comes from scale length).

## Decision
A pure, immutable `InstrumentProfile` value in the theory domain:
`{ id, family: guitar|bass, stringCount, tuning: SpelledNote[] (low→high), fretCount,
scaleLengthMm, pitchRange (derived) }`. Built-in profiles are data. Custom profiles are validated
(string counts of the built-in families, 4–6; strictly ascending open strings; ≤ 24 frets; 7-string guitar is pending the owner's decision). **Every** fretboard, drill, DSP and vision
function takes a profile argument. No module may reference a string count or tuning literal
outside the profile definitions, and a lint rule plus property tests (run across all profiles)
enforce this.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Separate Guitar/Bass classes (inheritance) | Familiar OOP | Bass isn't a subtype of guitar. Duplicate logic, harder property testing | Composition over inheritance; geometry is just data |
| Tuning only (string count implied) | Minimal | Scale length and fret count missing, which vision and DSP need | Incomplete |
| Global "current instrument" singleton | Convenient | Hidden state, breaks the pure engine (Constitution II) | Untestable |

## Consequences
- 001's engine API changes from `(tuning, string, fret)` to `(profile, string, fret)`.
- Every fixture table gains a profile column; property tests are parameterised over all profiles.
- Fret positions for vision come from `scaleLengthMm` (equal-tempered fret formula); 001 also uses it for optional proportional fret spacing (FR-062).
- Open: whether custom 7-string guitar profiles are allowed (clarify batch).

## AI involvement
_To be written by the owner._
