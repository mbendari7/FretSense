# Spec 001 part: US1 Fretboard Explorer

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fretboard Explorer (Priority: P1)

The user selects one of their instruments, picks a root (any of the 12 pitch classes) and either a
scale or a chord, and sees every position of its notes across the neck. Labels switch between
note names, degrees/functions and none. Root positions stand out.

**Why this priority**: This is the "See" surface every lesson and drill builds on, and the single
most useful tool before a practice session.

**Independent Test**: With no lessons and no drills, select each preset × root × scale/chord type
and verify the highlighted positions and labels against the theory fixtures.

**Acceptance Scenarios**:

1. **Given** the 6-string Standard preset with frets 0–12 visible, **When** the user selects root
   D and "Major", **Then** every position of D, E, F#, G, A, B, C# is highlighted with those
   spellings (never Gb or Db), and every D is marked as a root.
2. **Given** A minor pentatonic with note-name labels, **When** labels switch to "Degrees",
   **Then** the same positions read 1, b3, 4, 5, b7, with no page reload.
3. **Given** any scale is shown, **When** labels switch to "None", **Then** positions stay
   highlighted, roots stay distinguishable, and no text labels are shown.
4. **Given** root B and chord "m7b5", **Then** the tones are B, D, F, A with labels R, b3, b5, b7.
5. **Given** the 4-string bass EADG preset and C major, **When** displayed, **Then** exactly 4
   strings are drawn and every C, D, E, F, G, A, B is highlighted on them.
6. **Given** a black-key root, **When** the user toggles its spelling (F# ↔ Gb), **Then** every
   label is re-spelled consistently: F# major shows E# (not F); Gb major shows Cb (not B).
7. **Given** the user taps any position, **Then** its spelled note with octave (e.g. "F#3") and
   its degree in the current context are shown. For a note outside the scale or chord, the
   spelling follows FR-060 and the degree is shown as a chromatic degree (e.g. b6).
8. **Given** 5-string BEADG, E minor pentatonic and Degrees labels, **Then** exactly 5 strings are
   drawn and string 5 reads 5 at fret 0 (B0), b7 at fret 3 (D1), and 1 with the root marker at
   fret 5 (E1).

## Requirements *(mandatory)*

### Functional Requirements

**Fretboard explorer**

- **FR-011**: Users MUST be able to choose a root (12 pitch classes) and one of the 12 scale types
  or 12 chord qualities, and see every matching position within the visible range of the active profile. With no saved
  explorer selection, the explorer opens fully rendered on C major with note-name labels and frets
  0–12 (clamped to the fret count), with the root and type pickers visible without scrolling at
  390 × 844 px. After that it reopens on the last-used root and scale or chord type, saved in the
  profile settings (FR-067).
- **FR-012**: Users MUST be able to switch labels between note names, degrees/functions and none.
  Note names MUST use the spelling of the current context.
- **FR-013**: Root positions MUST be distinguished by a means other than colour alone (shape or
  outline). The palette MUST be colour-blind-safe (distinguishable under deuteranopia, protanopia
  and tritanopia simulation). The fretboard's marker categories are: in-context tone, root, prompted
  string, interval reference, drill window, the user's tap, correct, incorrect, revealed answer, and
  pattern outline (root–fifth–octave and arpeggio shapes). Each MUST differ from the others by
  shape, outline or label as well as colour, and MUST have an accessible-name suffix (e.g. "root",
  "reference", "inside window", "correct"). 018 FR-015's colour-vision check covers every pair.
- **FR-014**: Each instrument's fret count MUST come from that instrument in My Gear (FR-053), between
  12 and 24. Defaults for new instruments and presets: guitar 22, bass 20; editable.
- **FR-015**: Users MUST be able to choose a visible fret window (start and end) within the fret count.
- **FR-016**: Users MUST be able to select the active instrument from their My Gear instruments
  (FR-053). The fretboard and all drills MUST use it.
- **FR-017**: Users MUST be able to switch to a left-handed (mirrored) view, with labels upright; screen-reader order stays string 1 → N,
  then frets ascending, in both views.
- **FR-018**: The fretboard MUST show fret numbers and inlay markers at frets 3, 5, 7, 9, 12
  (double), 15, 17, 19, 21 and 24 (double), when visible.
- **FR-019**: For black-key roots, users MUST be able to toggle the spelling. The default follows
  the Edge Cases rule. Key-helper tonics are chosen from the 30 key signatures directly.
- **FR-020**: Tapping a position MUST show its spelled note with octave and its degree in context
  (FR-060 applies for notes outside the context), in every label mode.
- **FR-021**: Display settings (active instrument, window, handedness, label mode, text size, fret
  spacing, theme) MUST persist on the device in the active local profile (FR-066). First-run
  defaults for every settings field: no instrument (FR-053); window frets 0–12, clamped to the fret
  count; right-handed; note-name labels; text size 2 of 3; uniform spacing; theme follows the system
  (018 FR-014 adds the choice); octave mode any; adaptive weighting on; stages Read, See, Drill;
  pack General Theory; auto-advance 600 ms; lesson tunings "use the lesson's". The instrument
  picker (FR-053) shows a "Left-handed" switch, default off.
- **FR-062**: The fretboard MUST offer uniform fret spacing (the default; best at 390 px) and
  proportional spacing computed from the profile's scale length (equal-tempered fret positions),
  as a display setting.
