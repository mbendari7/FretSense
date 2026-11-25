# Spec 001 part: US5 Key Helper

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 5 - Key Helper (Priority: P2)

The user picks a key and sees its diatonic triads and seventh chords with Roman numerals and chord
names. Selecting a chord shows its tones on the neck of the active instrument.

**Why this priority**: Directly supports learning songs and progressions.

**Independent Test**: For all 30 keys, compare the chords and numerals with the key fixtures;
select one chord and verify its positions on a guitar instrument and a bass instrument.

**Acceptance Scenarios**:

1. **Given** G major, **Then** the triads read I G, ii Am, iii Bm, IV C, V D, vi Em, vii° F#dim,
   and the sevenths read Imaj7 Gmaj7, ii7 Am7, iii7 Bm7, IVmaj7 Cmaj7, V7 D7, vi7 Em7,
   viiø7 F#m7b5.
2. **Given** A minor, **Then** the triads read i Am, ii° Bdim, III C, iv Dm, v Em, VI F, VII G, and
   the sevenths read i7 Am7, iiø7 Bm7b5, IIImaj7 Cmaj7, iv7 Dm7, v7 Em7, VImaj7 Fmaj7, VII7 G7.
   **When** "harmonic-minor alternatives" is enabled, **Then** V E, V7 E7, vii° G#dim and
   vii°7 G#dim7 are also shown.
3. **Given** V (D) in G major on 5-string BEADG, **Then** every D, F# and A on all 5 strings is
   highlighted with labels R, 3, 5, optionally limited to a fret window.

## Requirements *(mandatory)*

### Functional Requirements

**Key helper**

- **FR-038**: Users MUST be able to choose one of the 30 keys and see the triads and sevenths of
  FR-007, with a toggle for the harmonic-minor alternatives. The key list MUST follow circle-of-fifths
  order and show enharmonic pairs side by side (B/Cb, F#/Gb and C#/Db major; G#/Ab, D#/Eb and
  A#/Bb minor). The 7-accidental spellings (C# and Cb major, A# and Ab minor) are visually
  secondary but still one tap away.
- **FR-039**: Selecting a diatonic chord MUST show its tones on the active instrument with function
  labels and the root distinguished, optionally within a fret window.
