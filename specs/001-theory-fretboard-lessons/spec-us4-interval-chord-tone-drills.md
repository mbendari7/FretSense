# Spec 001 part: US4 Interval and Chord-Tone Drills

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 4 - Interval and Chord-Tone Drills (Priority: P2)

Interval drill: a reference position is highlighted and an interval named; the user taps a target.
Chord-tone drill: a chord and a function are named (e.g. "b7 of A7"); the user taps it within a
fret window.

**Why this priority**: The next layer of theory, building on US1 and US3.

**Independent Test**: Run each drill for 10 questions with a fixed set of intervals or chords, and
verify the judgements and per-item stats.

**Acceptance Scenarios**:

1. **Given** 6-string Standard, reference C3 at string 5 fret 3, and the prompt "major 3rd up",
   **When** the user taps any position sounding E3, **Then** it is correct.
2. **Given** the interval set {m3, M3, P5}, **Then** only those intervals are asked, and every
   question has at least one reachable answer within the fret range.
3. **Given** "Find the ♭7th of the A dominant 7th chord (A7), frets 5 to 8", **When** the user taps a G inside the window,
   **Then** it is correct; a G outside the window is incorrect, with the reason "Outside frets 5 to 8".
4. **Given** a completed session, **Then** the summary shows accuracy and median time per interval
   (or per chord function).

## Requirements *(mandatory)*

### Functional Requirements

**Interval and chord-tone drills**

- **FR-035**: The interval drill MUST highlight a reference position, name an interval from the
  selected set (m2 M2 m3 M3 P4 A4 d5 P5 m6 M6 m7 M7 P8; up, down or both), and accept any position
  sounding the exact target pitch. Settings: strings, fret range, interval set, direction, question
  count. Defaults: all strings, frets 0–12 (clamped), intervals {M2, m3, M3, P4, P5, P8}, direction
  up, 20 questions.
  The prompt states the fret range in play, as FR-036 does for windows: "Find the perfect 5th above this D, frets 0 to 12". (CR-B2-13) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-036**: The chord-tone drill MUST name a chord (from selected roots × qualities, FR-005) and a
  function, and accept any position of that tone within an inclusive window [s, s + w − 1]
  (default w = 4, with s chosen so the window fits). Settings: strings, fret range, qualities,
  functions, window width, question count. Defaults: all strings, frets 0–12 (clamped), the 7
  natural roots, qualities {maj, min, 7}, functions {R, the chord's 3rd, 5}, window width 4, 20
  questions. The prompt MUST name the chord in words with its symbol, name the function as an ordinal
  ("the root", "the 3rd", "the ♭7th"), and state the window: "Find the ♭7th of the A dominant 7th
  chord (A7), frets 5 to 8". Quality names (theory-checked): maj "major", min "minor", dim "diminished",
  aug "augmented", sus2 "suspended 2nd", sus4 "suspended 4th", 7 "dominant 7th", maj7 "major 7th",
  m7 "minor 7th", m7b5 "half-diminished 7th", dim7 "diminished 7th", add9 "add 9". The function
  ordinal uses the function label (min 3rd ⇒ "the ♭3rd"). *(FN-4, provisional)* Positions inside it
  carry "inside window" in their accessible name. The window's edges are drawn with a line or
  pattern, not only a tint. A correct tone tapped outside the window is marked incorrect with the
  reason "Outside frets 5 to 8".
- **FR-037**: Both drills MUST follow FR-032–FR-034, with stats grouped per interval (and
  direction) or per chord function.
