# Feature Specification: Theory Engine, Interactive Fretboard and Lesson System (Guitar + Bass, No Audio)

**Feature Branch**: `001-theory-fretboard-lessons`

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21 for constitution v2.0.0: InstrumentProfile, bass, spec-reviewer findings)

**Input**: User description: "Theory engine, interactive fretboard and lesson system (no audio). US1 (P1) Fretboard explorer: any of 12 roots × scales (major, natural/harmonic/melodic minor, the 7 modes, major and minor pentatonic, blues) and chords (maj, min, dim, aug, sus2, sus4, 7, maj7, m7, m7b5, dim7, add9); labels toggle between note names, scale degrees and none; root highlighted. US2 (P1) Lessons: open a lesson tied to a book chapter and go Read → See (fretboard preset from frontmatter) → Drill in one place. US3 (P1) Note-finding drill with accuracy and response time per string. US4 (P2) Interval and chord-tone drills. US5 (P2) Key helper: diatonic chords with Roman numerals and their neck positions. US6 (P3) Local progress tracking that weights questions toward weak spots, with JSON export/import. Also: tunings (standard, Drop D, Eb, DADGAD), configurable fret count, left-handed view, 390 px phone layout, offline use, measurable success criteria (100% pass on theory fixtures, feedback under 100 ms)." Amendment: "Make everything instrument-agnostic with an InstrumentProfile (string count, tuning, fret count, pitch range, scale length). Profiles: 6-string guitar (standard, Drop D, Eb, DADGAD), 4-string bass (EADG, Drop D), 5-string bass (BEADG), custom tunings. Lessons and drills declare which instruments they apply to. Bass lesson types: root–fifth–octave patterns, arpeggios, walking bass lines, locking into chord tones."

**Practice-session value** (Constitution VI): before picking up the guitar or bass, the owner opens
one screen to see a scale, chord or key on *their* instrument and tuning, reads the matching book
chapter in their own words, and runs a 2–5 minute drill that targets their weakest strings,
intervals and patterns.

**Book mapping** (Constitution v2: book part → lesson track): 001 is the foundation feature. It
enables the Read/See/Drill stages of every lesson track whose chapters need no audio (notes on the
neck, intervals, scales and modes, chords, keys and diatonic harmony, bass patterns). Play stages
arrive with 002/003, and Camera-coach stages with 010.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fretboard Explorer (Priority: P1)

The owner selects an instrument profile, picks a root (any of the 12 pitch classes) and either a
scale or a chord, and sees every position of its notes across the neck. Labels switch between
note names, degrees/functions and none. Root positions stand out.

**Why this priority**: This is the "See" surface every lesson and drill builds on, and the single
most useful tool before a practice session.

**Independent Test**: With no lessons and no drills, select each profile × root × scale/chord type
and verify the highlighted positions and labels against the theory fixtures.

**Acceptance Scenarios**:

1. **Given** the 6-string Standard profile with frets 0–12 visible, **When** the owner selects root
   D and "Major", **Then** every position of D, E, F#, G, A, B, C# is highlighted with those
   spellings (never Gb or Db), and every D is marked as a root.
2. **Given** A minor pentatonic with note-name labels, **When** labels switch to "Degrees",
   **Then** the same positions read 1, b3, 4, 5, b7, with no page reload.
3. **Given** any scale is shown, **When** labels switch to "None", **Then** positions stay
   highlighted, roots stay distinguishable, and no text labels are shown.
4. **Given** root B and chord "m7b5", **Then** the tones are B, D, F, A with labels R, b3, b5, b7.
5. **Given** the 4-string bass EADG profile and C major, **When** displayed, **Then** exactly 4
   strings are drawn and every C, D, E, F, G, A, B is highlighted on them.
6. **Given** a black-key root, **When** the owner toggles its spelling (F# ↔ Gb), **Then** every
   label is re-spelled consistently: F# major shows E# (not F); Gb major shows Cb (not B).
7. **Given** the owner taps any position, **Then** its spelled note with octave (e.g. "F#3") and
   its degree in the current context are shown. For a note outside the scale or chord, the
   spelling follows FR-060 and the degree is shown as a chromatic degree (e.g. b6).

---

### User Story 2 - Lessons: Read → See → Drill (Priority: P1)

The owner opens a lesson tied to a book chapter. In one place they read their own notes, see the
fretboard configured by the lesson, and launch the lesson's drills. Lessons declare which
instruments they apply to.

**Why this priority**: Lessons turn the book's structure into daily practice.

**Independent Test**: Add one placeholder-text lesson with a preset and one drill; open it and step
through Read, See and Drill without leaving the lesson screen.

**Acceptance Scenarios**:

1. **Given** lesson files exist, **When** the owner opens the library, **Then** lessons are grouped
   by book part, ordered by chapter, and filtered to the active instrument (with a "show all" toggle).
2. **Given** a lesson preset "G Mixolydian, degrees, frets 0–12", **When** See opens, **Then** the
   fretboard shows exactly that configuration.
3. **Given** See, **When** the owner changes the root or labels and taps "Reset to lesson",
   **Then** the preset is restored.
4. **Given** a preset that specifies Drop D, **When** See opens, **Then** Drop D applies only within
   the lesson, a banner says so, and the owner's saved tuning is restored on leaving.
5. **Given** a lesson defining a note-finding drill on the two lowest strings, **When** Drill starts,
   **Then** it runs with those parameters inside the lesson.
6. **Given** a lesson lists songs, **Then** Read shows them as "Songs to practice" (title and
   optional note only; no audio).
7. **Given** the owner completes a stage, **Then** the library shows that stage as complete.
8. **Given** a lesson declared for bass only while the active instrument is guitar, **When** it is
   opened through "show all", **Then** a notice offers to switch to a bass profile.

---

### User Story 3 - Note-Finding Drill (Priority: P1)

The app names a note and a string; the owner taps where it is. Feedback is immediate. Accuracy and
response time are tracked per string.

**Why this priority**: Knowing the notes on the neck comes before everything else in the book, and
it is the drill the owner will run most often, on guitar and bass.

**Independent Test**: Run 20 questions on the two lowest strings with a mix of right and wrong
answers, then verify the feedback and the per-string accuracy and median time.

**Acceptance Scenarios**:

1. **Given** the prompt "Find G on string 6" (6-string Standard), **When** the owner taps a
   string-6 position sounding a G, **Then** it is marked correct with feedback within the budget
   of FR-032.
2. **Given** the same prompt, **When** the owner taps a wrong position on string 6, **Then** it is
   marked incorrect and the correct positions on string 6 are revealed until the owner continues.
3. **Given** the same prompt, **When** the owner taps a position on another string, **Then** the tap
   is ignored, a hint "Tap on string 6" appears, and nothing is recorded.
4. **Given** a completed session, **Then** the summary shows, per string and in total: number
   asked, accuracy %, and median response time.
5. **Given** the settings "naturals only", strings 1–3 and frets 0–5, **Then** every prompt
   satisfies all three constraints and has at least one valid answer.

---

### User Story 4 - Interval and Chord-Tone Drills (Priority: P2)

Interval drill: a reference position is highlighted and an interval named; the owner taps a target.
Chord-tone drill: a chord and a function are named (e.g. "b7 of A7"); the owner taps it within a
fret window.

**Why this priority**: The next layer of the book, building on US1 and US3.

**Independent Test**: Run each drill for 10 questions with a fixed set of intervals or chords, and
verify the judgements and per-item stats.

**Acceptance Scenarios**:

1. **Given** 6-string Standard, reference C3 at string 5 fret 3, and the prompt "major 3rd up",
   **When** the owner taps any position sounding E3, **Then** it is correct.
2. **Given** the interval set {m3, M3, P5}, **Then** only those intervals are asked, and every
   question has at least one reachable answer within the fret range.
3. **Given** "b7 of A7" with window frets 5–8, **When** the owner taps a G inside the window,
   **Then** it is correct; a G outside the window is incorrect.
4. **Given** a completed session, **Then** the summary shows accuracy and median time per interval
   (or per chord function).

---

### User Story 5 - Key Helper (Priority: P2)

The owner picks a key and sees its diatonic triads and seventh chords with Roman numerals and chord
names. Selecting a chord shows its tones on the neck of the active instrument.

**Why this priority**: Directly supports learning songs and progressions.

**Independent Test**: For all 30 keys, compare the chords and numerals with the key fixtures;
select one chord and verify its positions on a guitar profile and a bass profile.

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

---

### User Story 6 - Bass Patterns and Lines (Priority: P2)

Bass-oriented drills and lesson types: root–fifth–octave patterns, arpeggios, walking bass lines
and locking into chord tones. All are tap-based and untimed in 001, and available on any instrument
(declared bass-first in lessons).

**Why this priority**: The owner is learning bass as well as guitar. These are the core bass
skills, and they reuse the engine with no audio.

**Independent Test**: On 4-string EADG, run each bass drill type once with a fixed progression and
verify the rule-based judgements against fixtures.

**Acceptance Scenarios**:

1. **Given** a root–fifth–octave drill for chord C on 4-string EADG, **When** the owner taps C, G
   and the C an octave above in any playable shape (FR-056), **Then** the pattern is marked correct
   and shown as a shape.
2. **Given** an arpeggio drill for Am7, **When** the owner taps A, C, E, G in ascending pitch order
   within the window, **Then** it is correct; any out-of-order or non-chord tone is flagged at
   that step.
3. **Given** a walking-bass drill over | C | Am | Dm | G | (4 beats each), **When** the owner enters
   4 notes per bar, **Then** each note is judged against the walking-line rules (FR-058) and every
   broken rule is named (e.g. "beat 4 doesn't approach the next root").
4. **Given** a chord-tone lock drill over the same progression, **When** the owner taps one note per
   chord, **Then** chord tones are correct and non-chord tones are flagged with the chord's actual
   tones revealed.

---

### User Story 7 - Local Progress and Weak-Spot Weighting (Priority: P3)

Every drill answer is stored on the device. Future questions favour weak items. Progress can be
viewed, exported to JSON and imported.

**Why this priority**: Makes practice efficient over weeks, but drills are useful without it.

**Independent Test**: Seed a history with poor accuracy on one string, generate 200 seeded prompts,
and compare that string's share with an empty-history run. Then export, reset, import, and compare
the progress views.

**Acceptance Scenarios**:

1. **Given** history where string 3 accuracy is 40% and the others are ≥ 90% (≥ 20 attempts each),
   **When** 200 prompts are generated across all strings with a fixed seed, **Then** string 3's
   share is at least 1.5× its share under empty history.
2. **Given** progress exists, **When** the owner exports, **Then** a JSON file with a schema
   version, all attempts and lesson completion is saved.
3. **Given** that file, **When** the owner imports it on a fresh install (after first load),
   **Then** the progress views match the original exactly.
4. **Given** a malformed or newer-schema file, **When** imported, **Then** it is rejected with a
   readable reason and existing progress is unchanged.

---

### Edge Cases

- **Theoretical spellings**: Cb, Fb, E#, B#, and double accidentals (G# major has F##; G# harmonic
  minor has F##; Cdim7 has Bbb). Anything that would need a triple accidental is rejected with a
  typed error.
- **Octave numbering follows the letter**: Cb4 has the pitch of B3, and B#3 the pitch of C4. The
  octave number wraps at C.
- **Default root spelling**: black-key roots default to the spelling with fewer accidentals in the
  resulting scale, key or chord tones (a double accidental counts as 2). Ties go to sharps (F# major, D# minor).
  The owner can toggle.
- **Non-heptatonic scales**: pentatonic and blues don't follow the one-letter rule. Blues b5 is a
  diminished 5th above the root (A blues: A C D Eb E G).
- **Tunings and profiles**: positions and octaves are recomputed from the profile's open strings.
  Open strings are labelled in the current context's spelling (Eb tuning in Ab major: string 5
  open = "Ab").
- **Fret range vs preset**: a preset beyond the active profile's fret count is clamped, with a notice.
- **Left-handed view**: the neck is mirrored, labels stay upright, and string numbering is unchanged.
- **Unanswerable questions** are never generated: every question has at least one valid answer
  inside the allowed strings and frets (FR-061).
- **Interrupted drill**: when the app is backgrounded or the lesson is left, the session pauses.
  Answered questions are kept. On resume, the current question is shown again and its timer restarts.
- **Slow answers**: answers over 30 s count toward accuracy but are excluded from time statistics.
- **Storage unavailable or full**: the app stays usable, with a persistent "progress won't be
  saved" notice.
- **Invalid lesson files** fail validation at build time with the file and field named; the
  release is blocked.
- **Empty library**: an empty state is shown; the explorer and drills still work.
- **Import conflicts**: attempts are merged by attempt id. A duplicate id with different content
  rejects the whole file.

## Requirements *(mandatory)*

### Functional Requirements

**Theory engine**

- **FR-001**: System MUST represent a spelled note as a letter (A–G), an accidental (bb, b, natural,
  #, ##) and an octave in scientific pitch notation (C4 = middle C, MIDI 60), where the octave
  follows the letter (Cb4 = MIDI 59, B#3 = MIDI 60). System MUST convert a spelled note to a pitch
  number and a pitch class.
- **FR-002**: System MUST compute the direction-aware interval between two spelled notes as quality
  (P, M, m, A, d) plus number (unison to double octave, compound included), and MUST transpose a
  spelled note up or down by an interval with correct spelling. Doubly augmented or diminished
  results MUST produce a typed error.
- **FR-003**: System MUST build each of these 12 scale types from an interval formula for any
  spelled root: Ionian (major), Dorian, Phrygian, Lydian, Mixolydian, Aeolian (natural minor),
  Locrian, harmonic minor, melodic minor (ascending form), major pentatonic, minor pentatonic,
  blues (1 b3 4 b5 5 b7).
- **FR-004**: For heptatonic scales, each letter name MUST appear exactly once (D major has F#;
  G# major has F##; Gb major has Cb).
- **FR-005**: System MUST build each of these 12 chord qualities from an interval formula for any
  spelled root, spelled by interval, with these canonical symbols (shown for C): C, Cm, Cdim, Caug,
  Csus2, Csus4, C7, Cmaj7, Cm7, Cm7b5, Cdim7 (C Eb Gb Bbb), Cadd9. The UI MAY render b/# as ♭/♯.
- **FR-006**: System MUST label scale notes with degrees relative to the major scale on the same
  root (1, b2, 2, b3, 3, 4, #4, b5, 5, #5, b6, 6, bb7, b7, 7, following the scale's formula). It
  MUST label chord tones with functions (R, b3, 3, 2, 4, b5, 5, #5, bb7, b7, 7, 9).
- **FR-007**: For the 30 keys (15 major and 15 minor key signatures, from 7 flats to 7 sharps),
  System MUST produce the 7 diatonic triads and 7 sevenths with chord symbols (FR-005) and Roman
  numerals. Major: I ii iii IV V vi vii°; Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7. Natural minor:
  i ii° III iv v VI VII; i7 iiø7 IIImaj7 iv7 v7 VImaj7 VII7. Harmonic-minor alternatives: V, V7,
  vii°, vii°7.
- **FR-008**: System MUST map (profile, string, fret) to a spelled note and pitch, and MUST find all
  (string, fret) positions of a pitch class or an exact pitch within a fret range for any profile.
- **FR-009**: System MUST ship these built-in profiles (open strings low → high):
  - 6-string guitar: Standard E2 A2 D3 G3 B3 E4; Drop D D2 A2 D3 G3 B3 E4; Eb Eb2 Ab2 Db3 Gb3 Bb3
    Eb4; DADGAD D2 A2 D3 G3 A3 D4
  - 4-string bass: EADG E1 A1 D2 G2; Drop D D1 A1 D2 G2
  - 5-string bass: BEADG B0 E1 A1 D2 G2
- **FR-010**: System MUST reject invalid input (unknown type, a result needing a triple accidental,
  a string or fret outside the profile, an invalid profile) with a typed, descriptive error, and
  MUST be deterministic.

**Fretboard explorer**

- **FR-011**: Users MUST be able to choose a root (12 pitch classes) and one of the 12 scale types
  or 12 chord qualities, and see every matching position within the visible range of the active
  profile.
- **FR-012**: Users MUST be able to switch labels between note names, degrees/functions and none.
  Note names MUST use the spelling of the current context.
- **FR-013**: Root positions MUST be distinguished by a means other than colour alone (shape or
  outline). The palette MUST be colour-blind-safe (distinguishable under deuteranopia, protanopia
  and tritanopia simulation).
- **FR-014**: Users MUST be able to set the fret count between 12 and 24, per profile. The default
  is [NEEDS CLARIFICATION: guitar default 21 or 22? bass default?].
- **FR-015**: Users MUST be able to choose a visible fret window (start and end) within the fret count.
- **FR-016**: Users MUST be able to select the active instrument profile (FR-009, FR-053). The
  fretboard and all drills MUST use it.
- **FR-017**: Users MUST be able to switch to a left-handed (mirrored) view, with labels upright.
- **FR-018**: The fretboard MUST show fret numbers and inlay markers at frets 3, 5, 7, 9, 12
  (double), 15, 17, 19, 21 and 24 (double), when visible.
- **FR-019**: For black-key roots, users MUST be able to toggle the spelling. The default follows
  the Edge Cases rule. Key-helper tonics are chosen from the 30 key signatures directly.
- **FR-020**: Tapping a position MUST show its spelled note with octave and its degree in context
  (FR-060 applies for notes outside the context), in every label mode.
- **FR-021**: Display settings (profile, fret count, window, handedness, label mode, text size)
  MUST persist on the device.

**Lessons**

- **FR-022**: System MUST load owner-authored markdown lessons with structured metadata: id, title,
  track (a book part number, or an owner-defined track id such as `bass` for material not in the
  book), book chapter (optional for owner-defined tracks), instruments, concepts, optional fretboard preset, drills, optional
  songs, an optional `needs` list (`audio-input`, `camera`; default empty; used from 015 on), and
  optional Play / Camera-coach sections (reserved, ignored in 001). Lessons MUST be
  grouped by part and ordered by chapter.
- **FR-023**: Every lesson MUST be validated against the lesson schema at build time. A missing
  field, an unknown scale/chord/drill/profile value, a duplicate id, a progression without a key,
  or a preset fret beyond 24 MUST fail the build with the file and field named. A preset beyond
  the owner's configured fret count is clamped at runtime (Edge Cases). The same
  check MUST be runnable locally.
- **FR-024**: The lesson screen MUST present Read, See and Drill in one place with direct navigation.
- **FR-025**: Read MUST render headings, paragraphs, lists, emphasis, tables, images and links, MUST
  NOT execute embedded scripts or raw HTML, and MUST list songs as "Songs to practice".
- **FR-026**: See MUST apply the lesson preset (root, type, labels, optional window, optional
  family-qualified profile id such as `bass4-drop-d`) temporarily for the lesson, with a banner. The owner's saved settings MUST be
  restored on leaving, and "Reset to lesson" MUST restore the preset.
- **FR-027**: Drill MUST list and launch the lesson's drills with their parameters.
- **FR-028**: System MUST record which stages of each lesson are complete: Read when the end of the
  body has been visible; See when opened; Drill when every question of one of the lesson's drills has been answered (an abandoned session
  doesn't count). The
  library MUST show this.
- **FR-029**: Play and Camera-coach are out of scope. No non-functional controls for them may be shown.

**Note-finding drill**

- **FR-030**: The drill MUST prompt a note and a string and accept taps on that string only. Taps
  on other strings are ignored, with a hint. In pitch-class mode a tap is correct if its pitch class
  matches [NEEDS CLARIFICATION: should an octave-specific mode ("Find G3") also be offered?].
- **FR-031**: Settings MUST include strings (any subset of the active profile), fret range, question
  count (5–100, default 20), and note set: naturals (7); naturals + sharps (C# D# F# G# A#);
  naturals + flats (Db Eb Gb Ab Bb); all (17 spellings). Cb, Fb, E# and B# are never prompted.
- **FR-032**: Feedback MUST be visible within 100 ms of the tap at p95 (SC-002). It MUST use icon +
  text + colour and be announced to screen readers. After a correct answer, the next prompt follows
  after 600 ms. After an incorrect answer, the correct positions stay visible until the owner taps
  Continue.
- **FR-033**: Response time MUST be measured in milliseconds from the moment the prompt is displayed
  to the answering tap.
- **FR-034**: The summary MUST show, per string and in total: number asked, accuracy %, and median
  response time (answers over 30 s excluded from times only).

**Interval and chord-tone drills**

- **FR-035**: The interval drill MUST highlight a reference position, name an interval from the
  selected set (m2 M2 m3 M3 P4 A4 d5 P5 m6 M6 m7 M7 P8; up, down or both), and accept any position
  sounding the exact target pitch. Settings: strings, fret range, interval set, direction, question
  count.
- **FR-036**: The chord-tone drill MUST name a chord (from selected roots × qualities, FR-005) and a
  function, and accept any position of that tone within an inclusive window [s, s + w − 1]
  (default w = 4, with s chosen so the window fits). Settings: strings, fret range, qualities,
  functions, window width, question count.
- **FR-037**: Both drills MUST follow FR-032–FR-034, with stats grouped per interval (and
  direction) or per chord function.

**Key helper**

- **FR-038**: Users MUST be able to choose one of the 30 keys and see the triads and sevenths of
  FR-007, with a toggle for the harmonic-minor alternatives.
- **FR-039**: Selecting a diatonic chord MUST show its tones on the active profile with function
  labels and the root distinguished, optionally within a fret window.

**Progress**

- **FR-040**: System MUST record every drill answer on the device: attempt id, drill type,
  instrument profile, input modality (tap in 001; fret and audio are added by 008 and 003), prompt,
  answer position(s), outcome, response time, timestamp, and lesson id if any. Stats are grouped per
  modality.
- **FR-041**: Question generation MUST weight toward weak items. An item is (profile id, string,
  pitch class) for note-finding (so stats from different tunings are never mixed), (interval, direction) for intervals, (quality, function) for chord
  tones, and (drill type, chord quality) for bass drills. Weighting uses the last 50 attempts per
  item and [NEEDS CLARIFICATION: simple miss-count weighting or SM-2?]. Given the same history and
  seed, the sequence MUST be identical, and it MUST meet US7 scenario 1.
- **FR-042**: A progress view MUST show accuracy and median time per item group, per instrument
  family, over the last 7 days (rolling, device local time) and all time.
- **FR-043**: Users MUST be able to export all progress (schema version, attempts, lesson completion,
  optionally settings) to JSON and import it.
  - Import MUST validate the file and merge attempts by id.
  - Lesson completion MUST be merged as a union.
  - Settings MUST be imported only if the owner chooses to.
  - The whole file MUST be rejected, with no change, if it is invalid, has conflicting duplicate
    ids, or comes from a newer schema version.
  - Older schema versions MUST be migrated.
- **FR-044**: Users MUST be able to reset attempts and completion after confirmation. Settings are kept.

**Cross-cutting**

- **FR-045**: After the first load, every feature in this spec MUST work offline, including import
  from a local file.
- **FR-046**: The app MUST be installable on Chrome for Android, Safari on iOS (Add to Home Screen),
  and Chrome or Edge on desktop.
- **FR-047**: At 390 px width there MUST be no page-level horizontal scroll (the fretboard MAY
  scroll inside its own area), and every target MUST be at least 44 × 44 CSS px.
- **FR-048**: At least 3 text sizes MUST be offered, with fretboard labels of at least 24 CSS px at
  the largest. The app MUST meet WCAG 2.2 AA contrast in light and dark themes.
- **FR-049**: Every control and fretboard position MUST be keyboard-operable and have a screen-reader
  name (e.g. "String 3, fret 2, A3, degree 5").
- **FR-050**: No account is required. No progress, settings or personal data may leave the device.

**Instruments (amendment)**

- **FR-051**: System MUST model an InstrumentProfile: id, family (guitar | bass), string count,
  ordered open-string notes, fret count, scale length (mm), and derived pitch range. No engine or
  UI behaviour may assume a string count, tuning or fret count outside a profile.
- **FR-052**: Built-in profiles (FR-009) MUST have default scale lengths: guitar 648 mm, 4- and
  5-string bass 864 mm.
- **FR-053**: Users MUST be able to create, rename and delete custom tunings based on a built-in
  profile's family and string count. Each open string MUST lie within that family's range (guitar
  B1–E4, bass B0–C3), and the strings MUST be strictly ascending low → high. String counts are
  those of the built-in profiles (4, 5, 6) [7-string guitar: see Clarifications]. Invalid entries
  are rejected with a reason. Custom profiles are user data (always exported, FR-043). Deleting
  one keeps its attempts, which then appear under "deleted tuning" in all-time stats.
- **FR-054**: Every lesson and drill definition MUST declare its applicable instrument families,
  or "any". The library MUST filter by the active family.
- **FR-055**: Progress and statistics MUST be kept and reported per instrument family.

**Bass patterns and lines (amendment)**

- **FR-056**: The root–fifth–octave drill MUST ask, for a given root, for the root, the perfect 5th
  above it, and the octave above the root, in any order. Positions sounding those exact pitches are
  accepted if their frets span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret
  0). The shape is shown afterwards.
- **FR-057**: The arpeggio drill MUST ask for the tones of a chord (FR-005), one octave ascending
  from the lowest root inside an inclusive fret window (default 5 frets). Each step is judged.
  A wrong tone or ordering error is flagged and the correct position revealed, and the drill
  continues to the next step.
- **FR-058**: The walking-bass drill MUST take a progression of 2–8 chords at 4 beats each with a
  declared key (tonic + mode; required in the lesson data). The progression loops, so the last bar
  approaches bar 1. The drill accepts 4 notes per bar and judges each against these rules:
  - (R1) beat 1 is the chord root;
  - (R2) beats 2–3 are chord tones, tones of the declared key's scale, or chromatic passing tones
    (a semitone between two such tones);
  - (R3) beat 4 is a step of 1–2 semitones to the next bar's beat-1 note, or that note's perfect
    5th above or below (dominant approach);
  - (R4) no leap larger than an octave (an exact octave is allowed), including across bar lines.

  Each broken rule MUST be named.
- **FR-059**: The chord-tone lock drill MUST take a progression (with a declared key) and accept one
  note per chord. Chord tones are correct; otherwise the chord's tones are revealed.
- **FR-062**: The fretboard MUST offer uniform fret spacing (the default; best at 390 px) and
  proportional spacing computed from the profile's scale length (equal-tempered fret positions),
  as a display setting.

**Spelling and generation rules (from spec review)**

- **FR-060**: A note outside the current scale or chord MUST be spelled and labelled by a fixed
  12-pitch-class map relative to the context root: 1 b2 2 b3 3 4 #4 5 b6 6 b7 7 (in C: C Db D Eb E
  F F# G Ab A Bb B). The note is spelled as the root transposed by that interval. Double
  accidentals are allowed (Cb root: b6 = Abb). Notes inside the context keep the context spelling.
- **FR-061**: Every generated drill question MUST have at least one valid answer within the allowed
  strings, frets and window. A setting combination that makes this impossible MUST be rejected
  before the drill starts, with a reason.

### Key Entities *(include if feature involves data)*

- **Note**: letter, accidental, octave; derived pitch number and pitch class.
- **Interval**: quality, number, direction; semitone size.
- **Scale type / Chord quality**: name, interval formula, canonical symbol; heptatonic flag.
- **Key**: tonic + mode; diatonic chords with Roman numerals.
- **InstrumentProfile**: id, family, string count, open strings, fret count, scale length, pitch
  range; built-in or custom.
- **Fret position**: string (1 = highest pitched), fret; resolves to a Note under a profile.
- **Fretboard view settings**: profile, fret count, window, handedness, label mode, text size.
- **Lesson**: id, title, book part, chapter, instruments, concepts, body, preset, drills, songs,
  reserved Play/Camera-coach sections; per-stage completion.
- **Drill definition**: type (note-finding, interval, chord-tone, root–fifth–octave, arpeggio,
  walking-bass, chord-tone-lock), instruments, parameters.
- **Drill session / Attempt**: generated questions, answers, outcome, timing, profile.
- **Progress export**: schema version, timestamp, attempts, completion, optional settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the theory fixtures pass. They cover 21 spelled roots (7 naturals, 7 sharps,
  7 flats) × 12 scale types and × 12 chord qualities (expecting a typed error wherever a triple
  accidental would be needed), the 30 keys, every built-in profile's mapping for frets 0–24, and
  the named edge cases. The owner and theory-checker sign off the expected values.
- **SC-002**: Drill tap → feedback is under 100 ms at p95 over at least 200 taps on the reference
  phone (device, OS and browser to be recorded in Clarifications), measured and reported
  separately for the 6-string Standard and 5-string BEADG profiles (Constitution VIII).
- **SC-003**: Changing root, type, labels, profile or handedness updates the fretboard within 100 ms
  at p95 on the same phone, reported separately for the 6-string Standard and 5-string BEADG
  profiles at 24 frets.
- **SC-004**: From a cold start, any scale or chord can be shown on the active instrument in at
  most 3 interactions and under 10 s.
- **SC-005**: Offline after first load, 100% of the acceptance scenarios for US1–US7 pass.
- **SC-006**: At 390 px, 0 screens scroll horizontally at page level, and 100% of targets are at
  least 44 × 44 px (automated check).
- **SC-007**: A 20-question note-finding session, including setup, takes under 3 minutes at
  ≤ 5 s per answer.
- **SC-008**: A valid new lesson appears after a rebuild with no code change. 100% of invalid
  lesson fixtures fail validation with the file and field named.
- **SC-009**: Export → reset → import restores 100% of attempts with 0 duplicates.
- **SC-010**: Theory engine line and branch coverage is at least 90%.
- **SC-011**: All theory, explorer and drill property tests pass across all 7 built-in profiles
  and at least 100 randomly generated valid custom profiles (no hidden 6-string assumption).

## Assumptions

- Single user (the owner); no multi-user profiles on one device.
- String 1 is the highest-pitched string.
- Melodic minor means the ascending ("jazz") form.
- "Neck positions" means where the chord tones lie; voicings, CAGED shapes and fingerings are
  out of scope (005).
- Bass drills in 001 are untimed and tap-based; timed play-along is feature 003.
- Fixture lessons use placeholder text only (Constitution IV); the owner writes all real lessons.
- Progressions in lessons are given as structured root + quality data; chord-symbol parsing is
  feature 005.
- Audio, camera, ML, sync and spaced repetition beyond FR-041 are out of scope (002–013).
