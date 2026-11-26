# 0003. InstrumentProfile as the Single Source of Instrument Geometry

- **Status**: Accepted (owner approval 2026-11-25, recorded in "Owner approvals recorded" below; earlier status: Proposed)
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
scaleLengthMm, pitchRange (derived) }`, plus a user-given `name` when it lives in a profile's My Gear
(ADR-0006). Built-in profiles are presets. User instruments are validated: guitar 6–8 strings, bass
4–6 strings; strictly ascending open strings within the family range; 12–24 frets (defaults: guitar
22, bass 20). **Every** fretboard, drill, DSP and vision
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
- User instruments are profile-scoped, sync-ready records (ADR-0006, Constitution XIII). The engine
  sees only the immutable geometry value.

## AI involvement
_To be written by the owner._

## Owner approvals recorded

- Accepted 2026-11-25, owner in chat (copied word for word): "approve anything else left and actually build and create the program". Ledger: `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-blanket-approval-build.md`.
