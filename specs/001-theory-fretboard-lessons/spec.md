# Feature Specification: Theory Engine, Interactive Fretboard and Lesson System (Guitar + Bass, No Audio)

**Feature Branch**: `001-theory-fretboard-lessons`

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21 for constitution v2.2.0: personalised for every user, no locked content,
curriculum packs; clarify answers recorded in Clarifications)

**Input**: User description: "Theory engine, interactive fretboard and lesson system (no audio). US1 (P1) Fretboard explorer: any of 12 roots × scales (major, natural/harmonic/melodic minor, the 7 modes, major and minor pentatonic, blues) and chords (maj, min, dim, aug, sus2, sus4, 7, maj7, m7, m7b5, dim7, add9); labels toggle between note names, scale degrees and none; root highlighted. US2 (P1) Lessons: open a lesson tied to a book chapter and go Read → See (fretboard preset from frontmatter) → Drill in one place. US3 (P1) Note-finding drill with accuracy and response time per string. US4 (P2) Interval and chord-tone drills. US5 (P2) Key helper: diatonic chords with Roman numerals and their neck positions. US6 (P3) Local progress tracking that weights questions toward weak spots, with JSON export/import. Also: tunings (standard, Drop D, Eb, DADGAD), configurable fret count, left-handed view, 390 px phone layout, offline use, measurable success criteria (100% pass on theory fixtures, feedback under 100 ms)." Amendment: "Make everything instrument-agnostic with an InstrumentProfile (string count, tuning, fret count, pitch range, scale length). Profiles: 6-string guitar (standard, Drop D, Eb, DADGAD), 4-string bass (EADG, Drop D), 5-string bass (BEADG), custom tunings. Lessons and drills declare which instruments they apply to. Bass lesson types: root–fifth–octave patterns, arpeggios, walking bass lines, locking into chord tones."

**Practice-session value** (Constitution VI): before picking up their guitar or bass, a user opens
one screen to see a scale, chord or key on *their* instrument and tuning, opens any lesson they like
in the stages they prefer, and runs a 2–5 minute drill that targets their weakest strings,
intervals and patterns.

**Curriculum** (Constitution XIII): 001 ships the built-in **General Theory** curriculum pack and
the pack format. Lessons are not tied to any book. Users create their own packs (mapping lessons to
a book or course) in 016. 001 enables the Read/See/Drill stages of every lesson that needs no audio
(notes on the neck, intervals, scales and modes, chords, keys and diatonic harmony, bass patterns).
Play stages arrive with 002/003, and Camera-coach stages with 010.

**Personalisation foundation**: 001 creates one local profile automatically and stores everything
local-profile-scoped and sync-ready (FR-066). Profile management, full My Gear (interfaces, cameras,
outputs), onboarding, learning paths and pack authoring are feature 016.

**Terminology** (spec review, 2026-11-21): **local profile** = one person's space on the device
(FR-066). **Instrument geometry** (the `InstrumentProfile` value: family, strings, tuning, fret
count, scale length) has a deterministic **geometry id** derived from family + tuning (FR-051).
**Instrument** = a My Gear record holding a name and a geometry (FR-053). **Preset** = a built-in
geometry (FR-009). In this spec, "profile" alone never means an instrument.

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

---

### User Story 2 - Lessons: Any Lesson, Stages of Your Choice (Priority: P1)

The user browses the active curriculum pack (General Theory by default) and opens any lesson. Nothing
is locked. In one place they go through the stages they have chosen (by default Read → See → Drill),
in the order they have chosen. Lessons declare which instruments they apply to.

**Why this priority**: Lessons turn a curriculum into daily practice, at the user's own pace.

**Independent Test**: Add one placeholder-text lesson with a preset and one drill; open it and step
through Read, See and Drill without leaving the lesson screen.

**Acceptance Scenarios**:

1. **Given** lesson files exist, **When** the user opens the library, **Then** lessons are grouped
   by the active pack's sections in pack order, and filtered to the active instrument's family (with
   a "show all" toggle). Lessons not in the active pack are reachable under "All lessons".
2. **Given** a lesson preset "G Mixolydian, degrees, frets 0–12", **When** See opens, **Then** the
   fretboard shows exactly that configuration.
3. **Given** See, **When** the user changes the root or labels and taps "Reset to lesson",
   **Then** the preset is restored.
4. **Given** a preset that specifies Drop D, **When** See opens, **Then** Drop D applies only within
   the lesson, a banner says so, and the user's own instrument is restored on leaving.
5. **Given** a lesson defining a note-finding drill on the two lowest strings, **When** Drill starts,
   **Then** it runs with those parameters inside the lesson.
6. **Given** a lesson lists songs, **Then** Read shows them as "Songs to practice" (title and
   optional note only; no audio).
7. **Given** the user completes a stage, **Then** the library shows that stage as complete. No
   lesson, stage or drill is ever disabled because another one is incomplete.
8. **Given** a lesson declared for bass only while the active instrument is a guitar, **When** it is
   opened through "show all", **Then** a notice offers to switch to one of the user's basses (or to
   add one), and the lesson still opens.
9. **Given** the user's stage preference is "See, Drill" (Read off), **When** any lesson opens,
   **Then** it starts at See, shows only See and Drill in that order, and offers "show all stages"
   for this lesson. The preference persists as the user's default.
10. **Given** a jump from the library straight to a lesson's Drill, **Then** the drill starts with no
    other stage required.

---

### User Story 3 - Note-Finding Drill (Priority: P1)

The app names a note and a string; the user taps where it is. Feedback is immediate. Accuracy and
response time are tracked per string.

**Why this priority**: Knowing the notes on the neck underpins everything else, and it is the drill
users will run most often, on guitar and bass.

**Independent Test**: Run 20 questions on the two lowest strings with a mix of right and wrong
answers, then verify the feedback and the per-string accuracy and median time.

**Acceptance Scenarios**:

1. **Given** the prompt "Find G on string 6" (6-string Standard), **When** the user taps a
   string-6 position sounding a G, **Then** it is marked correct with feedback within the budget
   of FR-032.
2. **Given** the same prompt, **When** the user taps a wrong position on string 6, **Then** it is
   marked incorrect and the correct positions on string 6 are revealed until the user continues.
3. **Given** the same prompt, **When** the user taps a position on another string, **Then** the tap
   is ignored, a hint "Tap on string 6" appears, and nothing is recorded.
4. **Given** a completed session, **Then** the summary shows, per string and in total: number
   asked, accuracy %, and median response time.
5. **Given** the settings "naturals only", strings 1–3 and frets 0–5, **Then** every prompt
   satisfies all three constraints and has at least one valid answer.
6. **Given** the user's octave setting is "exact octave", **When** the prompt is "Find G3 on string
   5" (6-string Standard, 22 frets), **Then** only string 5 fret 10 is correct and fret 22 (G4) is
   incorrect. With the default "any octave", both are correct.

---

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
3. **Given** "b7 of A7" with window frets 5–8, **When** the user taps a G inside the window,
   **Then** it is correct; a G outside the window is incorrect.
4. **Given** a completed session, **Then** the summary shows accuracy and median time per interval
   (or per chord function).

---

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

---

### User Story 6 - Bass Patterns and Lines (Priority: P2)

Bass-oriented drills and lesson types: root–fifth–octave patterns, arpeggios, walking bass lines
and locking into chord tones. All are tap-based and untimed in 001, and available on any instrument
(declared bass-first in lessons).

**Why this priority**: Bassists are first-class users. These are the core bass skills, and they
reuse the engine with no audio.

**Independent Test**: On 4-string EADG, run each bass drill type once with a fixed progression and
verify the rule-based judgements against fixtures.

**Acceptance Scenarios**:

1. **Given** a root–fifth–octave drill for chord C on 4-string EADG, **When** the user taps C, G
   and the C an octave above in any playable shape (FR-056), **Then** the pattern is marked correct
   and shown as a shape.
2. **Given** an arpeggio drill for Am7, **When** the user taps A, C, E, G in ascending pitch order
   within the window, **Then** it is correct; any out-of-order or non-chord tone is flagged at
   that step.
3. **Given** a walking-bass drill over | C | Am | Dm | G | (4 beats each), **When** the user enters
   4 notes per bar, **Then** each note is judged against the walking-line rules (FR-058) and every
   broken rule is named (e.g. "beat 4 doesn't approach the next root").
4. **Given** a chord-tone lock drill over the same progression, **When** the user taps one note per
   chord, **Then** chord tones are correct and non-chord tones are flagged with the chord's actual
   tones revealed.

---

### User Story 7 - Local Progress and Weak-Spot Weighting (Priority: P3)

Every drill answer is stored on the device, in the active local profile. Future questions favour
weak items unless the user turns adaptive weighting off. Progress can be viewed, exported to JSON and
imported.

**Why this priority**: Makes practice efficient over weeks, but drills are useful without it.

**Independent Test**: Seed a history with poor accuracy on one string, generate 200 seeded prompts,
and compare that string's share with an empty-history run. Then export, reset, import, and compare
the progress views.

**Acceptance Scenarios**:

1. **Given** history where string 3 accuracy is 40% and the others are ≥ 90% (≥ 20 attempts each),
   **When** 200 prompts are generated across all strings with a fixed seed, **Then** string 3's
   share is at least 1.5× its share under empty history.
2. **Given** progress exists, **When** the user exports, **Then** a JSON file with a schema
   version, all attempts and lesson completion is saved.
3. **Given** that file, **When** the user imports it on a fresh install (after first load),
   **Then** the progress views match the original exactly.
4. **Given** a malformed or newer-schema file, **When** imported, **Then** it is rejected with a
   readable reason and existing progress is unchanged.
5. **Given** adaptive weighting is turned off, **When** 200 prompts are generated with the same
   seeded weak-string history as scenario 1, **Then** the distribution equals the empty-history
   distribution (uniform over valid prompts).

---

### Edge Cases

- **Theoretical spellings**: Cb, Fb, E#, B#, and double accidentals (G# major has F##; G# harmonic
  minor has F##; Cdim7 has Bbb). Anything that would need a triple accidental is rejected with a
  typed error.
- **Octave numbering follows the letter**: Cb4 has the pitch of B3, and B#3 the pitch of C4. The
  octave number wraps at C.
- **Default root spelling**: black-key roots default to the spelling with fewer accidentals in the
  resulting scale, key or chord tones (a double accidental counts as 2). Ties go to sharps (F# major, D# minor).
  The user can toggle.
- **Non-heptatonic scales**: pentatonic and blues don't follow the one-letter rule. Blues b5 is a
  diminished 5th above the root (A blues: A C D Eb E G).
- **Tunings and instruments**: positions and octaves are recomputed from the instrument's open strings.
  Open strings are labelled in the current context's spelling (Eb tuning in Ab major: string 5
  open = "Ab").
- **Fret range vs preset**: a preset beyond the active instrument's fret count is clamped, with a notice.
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
- **FR-009**: System MUST ship these built-in instrument presets (open strings low → high). They are
  starting points for My Gear instruments, never assumed defaults (Constitution XIII):
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
- **FR-014**: Each instrument's fret count MUST come from that instrument in My Gear (FR-053), between
  12 and 24. Defaults for new instruments and presets: guitar 22, bass 20; editable.
- **FR-015**: Users MUST be able to choose a visible fret window (start and end) within the fret count.
- **FR-016**: Users MUST be able to select the active instrument from their My Gear instruments
  (FR-053). The fretboard and all drills MUST use it.
- **FR-017**: Users MUST be able to switch to a left-handed (mirrored) view, with labels upright.
- **FR-018**: The fretboard MUST show fret numbers and inlay markers at frets 3, 5, 7, 9, 12
  (double), 15, 17, 19, 21 and 24 (double), when visible.
- **FR-019**: For black-key roots, users MUST be able to toggle the spelling. The default follows
  the Edge Cases rule. Key-helper tonics are chosen from the 30 key signatures directly.
- **FR-020**: Tapping a position MUST show its spelled note with octave and its degree in context
  (FR-060 applies for notes outside the context), in every label mode.
- **FR-021**: Display settings (active instrument, window, handedness, label mode, text size, fret
  spacing) MUST persist on the device in the active local profile (FR-066).

**Lessons**

- **FR-022**: System MUST load owner-authored markdown lessons with structured metadata: id, title,
  level (beginner | intermediate | advanced), tags (goal, genre and topic tags, used by 016 to
  suggest paths), instruments, concepts, optional fretboard preset, drills, optional songs, an
  optional `needs` list (`audio-input`, `camera`; default empty; used from 015 on; `camera` never
  alone), and optional Play / Camera-coach sections (reserved, ignored in 001). Lessons carry no
  book or chapter reference; grouping and order come from curriculum packs (FR-063).
- **FR-023**: Every lesson and built-in pack MUST be validated against its schema at build time. A
  missing field, an unknown scale/chord/drill/preset/tag-format value, a duplicate id, a progression
  without a key, `needs: [camera]` alone, a pack referencing an unknown lesson, or a preset fret
  beyond 24 MUST fail the build with the file and field named. A preset beyond the active
  instrument's fret count is clamped at runtime (Edge Cases). The same check MUST be runnable
  locally.
- **FR-024**: The lesson screen MUST present the user's chosen stages (FR-064) in one place, in the
  chosen order, with direct navigation to any stage, including stages hidden by the preference
  ("show all stages").
- **FR-025**: Read MUST render headings, paragraphs, lists, emphasis, tables, images and links, MUST
  NOT execute embedded scripts or raw HTML, and MUST list songs as "Songs to practice".
- **FR-026**: See MUST apply the lesson preset (root, type, labels, optional window, optional
  built-in instrument preset id such as `bass4-drop-d`) temporarily for the lesson, with a banner. A
  preset for a different family than the active instrument is applied only if the user confirms.
  Drill attempts made while a preset is applied are stored with the preset's geometry id and a null
  instrument id (FR-040). The preset replaces the whole geometry temporarily (string count
  included), whatever the user's instrument, and the banner names it (e.g. "Showing 6-string Drop D;
  your 7-string returns when you leave").
  The user's saved settings and instrument MUST be restored on leaving, and "Reset to lesson" MUST
  restore the preset.
- **FR-027**: Drill MUST list and launch the lesson's drills with their parameters.
- **FR-028**: System MUST record which stages of each lesson are complete: Read when the end of the
  body has been visible; See when opened; Drill when every question of one of the lesson's drills
  has been answered (an abandoned session doesn't count). The library MUST show this. Completion is
  informational only: it MUST NOT gate any lesson, stage, drill or tool (FR-065).
- **FR-029**: Play and Camera-coach are out of scope. No non-functional controls for them may be shown.

**Note-finding drill**

- **FR-030**: The drill MUST prompt a note and a string and accept taps on that string only. Taps
  on other strings are ignored, with a hint. The octave mode is a per-user setting: "any octave"
  (default; a tap is correct if its pitch class matches) or "exact octave" (the prompt names an
  octave, e.g. "Find G3", and only that exact pitch is correct). In exact-octave mode, prompts are
  generated only for pitches that exist on the prompted string within the fret range (FR-061).
- **FR-031**: Settings MUST include strings (any subset of the active instrument's strings), fret range, question
  count (5–100, default 20), and note set: naturals (7); naturals + sharps (C# D# F# G# A#);
  naturals + flats (Db Eb Gb Ab Bb); all (17 spellings). Cb, Fb, E# and B# are never prompted.
- **FR-032**: Feedback MUST be visible within 100 ms of the tap at p95 (SC-002). It MUST use icon +
  text + colour and be announced to screen readers. After a correct answer, the next prompt follows
  after 600 ms. After an incorrect answer, the correct positions stay visible until the user taps
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
- **FR-039**: Selecting a diatonic chord MUST show its tones on the active instrument with function
  labels and the root distinguished, optionally within a fret window.

**Progress**

- **FR-040**: System MUST record every drill answer on the device: attempt id, drill type,
  instrument id (null under a temporary lesson preset), geometry id, input modality (tap in 001; fret and audio are added by 008 and 003), prompt,
  answer position(s), outcome, response time, timestamp, and lesson id if any. Stats are grouped per
  modality.
- **FR-041**: Question generation MUST weight toward weak items, within the active local profile. An
  item is (geometry id, string, pitch class) for note-finding (so stats from different tunings are
  never mixed, and retuning back to a tuning reuses its stats), (interval, direction) for intervals, (quality, function) for chord
  tones, and (drill type, chord quality) for bass drills. Weighting uses simple miss counts: an
  item's weight increases monotonically with its smoothed miss rate over its last 50 attempts
  (formula documented in plan research R9). Spaced repetition is feature 006. Given the same history and
  seed, the sequence MUST be identical, and it MUST meet US7 scenario 1. Adaptive weighting is a
  per-user setting (default on); when off, generation is uniform over valid prompts (US7 scenario 5).
- **FR-042**: A progress view MUST show accuracy and median time per item group, per instrument
  family and per My Gear instrument, over the last 7 days (rolling, device local time) and all time.
- **FR-043**: Users MUST be able to export the active local profile's data (schema version, local
  profile id, attempts, lesson completion, instruments, optionally settings) in the **profile export
  format** (016 extends the same format with its own record types) and import it:
  - into the **same** local profile id (restore): records merge by the FR-066a rules;
  - into a **different** local profile (copy): every record gets a new id and the target's local
    profile id, so no id ever exists in two profiles; natural-key records (settings, lesson
    completion) merge into the target's existing ones by natural key (FR-066, FR-066a).
  - Import MUST validate the file (schema, size ≤ 20 MB, unknown fields rejected). Exports include
    tombstoned records. A record referring to an instrument id absent from both the file and the
    device, or a failed migration step, rejects the whole file. An import is applied in one
    transaction: an interruption leaves no partial change.
  - Lesson completion MUST be merged as a union.
  - Settings MUST be imported only if the user chooses to.
  - The whole file MUST be rejected, with no change, if it is invalid, has an attempt whose id
    matches a local attempt with a different immutable payload (FR-066a), or comes from a newer
    schema version.
  - Older schema versions MUST be migrated.
  - Copy import re-stamps `created` and `updated` with the target profile's writer id (attempt wall
    times are kept).
  - Before export, the screen MUST list what the file contains (profile name, instruments, every
    attempt with its time and response time, completion, settings if ticked, and records hidden by
    reset) and state that the file is unencrypted, readable by anyone who has it, and that local
    profiles are not private from other people using the same device.
- **FR-044**: Users MUST be able to reset attempts and completion after confirmation. Settings are
  kept. Reset tombstones the records (FR-066); an export taken before the reset restores them
  (FR-066a). The confirmation MUST say that reset hides progress but does not erase it from the
  device, and that later exports still contain it; permanent erasure is 016 ("erase permanently").

**Cross-cutting**

- **FR-045**: After the first load, every feature in this spec MUST work offline, including import
  from a local file. The app MUST request persistent storage, and if it is denied, MUST show a
  non-blocking reminder to export after every 7 days of new attempts.
- **FR-046**: The app MUST be installable on Chrome for Android, Safari on iOS (Add to Home Screen),
  and Chrome or Edge on desktop.
- **FR-047**: At 390 px width there MUST be no page-level horizontal scroll (the fretboard scrolls
  horizontally inside its own area, so position targets stay at least 44 × 44 CSS px even for 8
  strings and 24 frets), and every target MUST be at least 44 × 44 CSS px. Portrait and landscape
  are both supported.
- **FR-048**: At least 3 text sizes MUST be offered, with fretboard labels of at least 24 CSS px at
  the largest. The app MUST meet WCAG 2.2 AA contrast in light and dark themes.
- **FR-049**: Every control and fretboard position MUST be keyboard-operable and have a screen-reader
  name (e.g. "String 3, fret 2, A3, degree 5"). The fretboard is one tab stop; arrow keys move by
  string (up/down) and fret (left/right, following the visual direction in left-handed view), and
  Enter or Space answers. Focus is always visible. Drill feedback is announced as "Correct, G on
  string 6 fret 3" or "Incorrect; G is at fret 3 and fret 15". With "reduce motion" set, feedback
  animations are off and the 600 ms auto-advance is kept. Verified by automated checks plus a manual
  NVDA (Windows) and VoiceOver (iOS) pass.
- **FR-050**: No account is required. No progress, settings, gear or personal data may leave the
  device.

**Instruments (amendment)**

- **FR-051**: System MUST model an InstrumentProfile: id, family (guitar | bass), string count,
  ordered open-string notes, fret count, scale length (mm), and derived pitch range. No engine or
  UI behaviour may assume a string count, tuning or fret count outside a profile. Its **geometry id**
  MUST be a deterministic function of family and ordered open-string notes (equal tunings ⇒ equal
  ids, on every device). Spelling is part of the input: enharmonically equal tunings (Eb2 vs D#2) get
  different ids. A **My Gear instrument** is a user record (FR-066) holding a name and an
  InstrumentProfile.
- **FR-052**: Built-in profiles (FR-009) MUST have default scale lengths: guitar 648 mm, 4- and
  5-string bass 864 mm.
- **FR-053**: Users MUST be able to add, edit, rename and delete **My Gear instruments**: name,
  family (guitar | bass), string count (guitar 6–8, bass 4–6), tuning, fret count (12–24), scale
  length (default guitar 648 mm, bass 864 mm), starting from a built-in preset (FR-009) or from
  scratch. Each open string MUST lie within the family's range (guitar E1–E4, bass A0–C3; owner to
  confirm), and the strings MUST be strictly ascending low → high (re-entrant tunings are out of
  scope). Invalid entries are rejected with a reason. On first
  run, and whenever a local profile has no instrument, the explorer, drills and key helper first
  ask the user to pick a preset or create an instrument (one tap for a preset); no instrument is
  assumed. A local profile always keeps at least one instrument: the last one can be edited but not
  deleted. Deleting the active instrument makes the most recently used remaining one active.
  Instruments are user data (always exported, FR-043). Deleting one is a tombstone (FR-066): its
  attempts are kept and appear under "deleted instrument" in all-time stats. Editing the tuning or
  string count changes the instrument's geometry id; past attempts keep the geometry id they were
  recorded with (FR-040), so stats never mix tunings. Fret-count and scale-length edits don't
  change the geometry id. The family can't be edited (create a new instrument instead).
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

**Personalisation foundation (constitution v2.2.0)**

- **FR-063**: System MUST support **curriculum packs**: id, title, optional source (the book or
  course it follows, by name only), schema version, and ordered sections (title, optional source
  label such as a chapter, ordered lesson ids). A lesson MAY appear in several packs. 001 ships one
  built-in pack, **General Theory**, built from owner-written lessons. The active pack is a
  per-profile setting. The pack format and validation are defined here; creating, editing,
  importing and exporting user packs is feature 016. Packs MUST NOT contain lesson prose or text
  copied from their source.
- **FR-064**: Users MUST be able to choose which lesson stages they want (Read, See, Drill; Play and
  Camera-coach join the list when their features ship) and their order, and save that as their
  default (per local profile). At least one stage MUST stay selected. A lesson that lacks a chosen
  stage skips it silently. If a lesson has none of the chosen stages, it opens at its first
  available stage with a notice ("This lesson has no Drill; showing Read").
- **FR-065**: Nothing MAY be locked. Every lesson, stage, drill, the explorer and the key helper MUST
  be reachable at any time, from the library and by direct link, whatever the user's progress or
  completion state (Constitution XIII).
- **FR-066**: All user data (instruments, settings, attempts, lesson completion, stage preferences,
  active pack) MUST be scoped to a **local profile**. On first run, 001 creates one local profile
  automatically (no account, no network). Every record MUST carry a globally unique id, the profile
  id, created and updated timestamps, a schema version, and a deletion tombstone instead of hard
  deletion, so later sync (013) and multi-profile management (016) need no migration of existing
  records. Reset (FR-044) tombstones records rather than erasing their ids. Ids are UUIDv4 or
  UUIDv7 strings (choice in plan.md). Records that are unique per natural key (the profile settings
  record per local profile; lesson completion per local profile and lesson) are matched by that
  natural key, not by id, in every merge and import, so two devices or a copy-import never create a
  second one.
- **FR-066a**: Merge rules for records with the same id, or the same natural key for natural-key records (FR-066) (used by restore-import, FR-043, and by the
  later sync, 013):
  - **Attempts are immutable.** Same id with identical payload ⇒ no-op. Same id with a different
    payload (anything except `updated` and the tombstone) ⇒ conflict; restore-import rejects the
    file.
  - **Restore-import is an explicit user action**: an imported live record replaces a local
    tombstoned copy (un-delete), so export → reset → import restores everything (SC-009).
  - **Profile settings merge per field**: each field carries its own `updated`, and the newest
    wins per field, so concurrent edits to different fields on two devices both survive.
  - **Lesson completion** merges as a per-stage union (earliest completion time kept).
  - **Incoming tombstones** apply by the same last-writer-wins rule; restore-import first shows a
    preview (added, restored, updated, hidden counts) and writes only after the user confirms.
  - **Clock bound**: an imported timestamp more than 24 hours ahead of the device clock rejects the
    file, and the local clock never advances past that bound.
  - **Other mutable records** (instruments): the copy with the
    newest `updated` wins; ties go to the lexicographically larger **writer id** (a random id per
    local profile per device, used only for this ordering; it is not a device identifier and the
    same device has different writer ids in different profiles).
  - **Generic merge** (013): last-writer-wins on `updated`, where a tombstone is an update.
  The merge function is pure and property-tested (SC-013).
- **FR-067**: One **profile settings** record per local profile MUST hold: active instrument (the
  same field 016 calls "default instrument"), octave mode (FR-030; default any octave), adaptive
  weighting on/off (FR-041; default on), stage preference (FR-064), active pack (FR-063) and the
  display settings (FR-021), including handedness (FR-017, which is the player's handedness: it
  mirrors the view here and identifies the fretting hand in 008). 016 adds fields to this same
  record; it never moves them. Settings are included in export when the user chooses (FR-043).
- **FR-068**: Lesson tags MUST use the format `namespace:value` (lower-case kebab-case), with
  namespaces `goal`, `genre`, `topic` and `level-hint`. The allowed values live in an owner-curated
  vocabulary file validated at build time (FR-023); an unknown tag fails the build. Drill
  definitions in lessons MUST have a stable `id` (unique within the lesson) so paths (016) can
  reference them.

### Key Entities *(include if feature involves data)*

- **Note**: letter, accidental, octave; derived pitch number and pitch class.
- **Interval**: quality, number, direction; semitone size.
- **Scale type / Chord quality**: name, interval formula, canonical symbol; heptatonic flag.
- **Key**: tonic + mode; diatonic chords with Roman numerals.
- **InstrumentProfile**: id, family, string count, open strings, fret count, scale length, pitch
  range; a built-in preset or the geometry of a My Gear instrument.
- **Local profile**: id, display name, created/updated; owns every other user record (FR-066).
- **My Gear instrument**: id, local profile id, name, InstrumentProfile (with its geometry id),
  timestamps, tombstone.
- **Curriculum pack**: id, title, optional source, schema version, sections → ordered lesson ids.
- **Profile settings**: active instrument, octave mode, adaptive weighting, stage preference, active
  pack, display settings (incl. handedness).
- **Fret position**: string (1 = highest pitched), fret; resolves to a Note under an instrument geometry.
- **Fretboard view settings**: active instrument, window, handedness, label mode, text size,
  fret spacing.
- **Lesson**: id, title, level, tags, instruments, concepts, body, preset, drills, songs, needs,
  reserved Play/Camera-coach sections; per-stage completion (informational).
- **Drill definition**: type (note-finding, interval, chord-tone, root–fifth–octave, arpeggio,
  walking-bass, chord-tone-lock), instruments, parameters.
- **Drill session / Attempt**: generated questions, answers, outcome, timing, instrument id, geometry id.
- **Progress export**: schema version, profile id, timestamp, attempts, completion, instruments,
  optional settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the theory fixtures pass. They cover 21 spelled roots (7 naturals, 7 sharps,
  7 flats) × 12 scale types and × 12 chord qualities (expecting a typed error wherever a triple
  accidental would be needed), the 30 keys, every built-in profile's mapping for frets 0–24, and
  the named edge cases. The owner and theory-checker sign off the expected values.
- **SC-002**: Drill tap → feedback is under 100 ms at p95 over at least 200 taps on the reference
  reference phone and on the reference laptop (both named in Clarifications), measured and reported
  separately for the 6-string Standard and 5-string BEADG presets and for the worst case allowed
  geometry (8 strings, 24 frets) (Constitution VIII).
- **SC-003**: Changing root, type, labels, profile or handedness updates the fretboard within 100 ms
  at p95 on the same devices, reported separately for the 6-string Standard and 5-string BEADG
  presets and the 8-string, 24-fret worst case.
- **SC-004**: From a cold start (app launch with an existing instrument), any scale or chord can be shown on the active instrument in at
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
- **SC-011**: All theory, explorer and drill property tests pass across all 7 built-in presets
  and at least 100 randomly generated valid My Gear instruments covering every allowed string count
  (guitar 6–8, bass 4–6) and fret counts 12–24 (no hidden 6-string or 22-fret assumption).
- **SC-012**: 100% of lessons, stages, drills and tools are reachable by direct link from a fresh
  profile with no progress (automated crawl), and no control is ever disabled for progress reasons.
- **SC-013**: Every persisted record type in 001 carries the FR-066 fields (schema check over all
  stores), and property tests of the FR-066a merge function over two divergent exports of the same
  local profile show: no id collisions, convergence (merge order doesn't matter), and no migration
  step.

## Assumptions

- 001 creates and uses one local profile. Creating, switching and deleting several profiles is
  feature 016; 001's data model already supports it (FR-066).
- String 1 is the highest-pitched string.
- Melodic minor means the ascending ("jazz") form.
- "Neck positions" means where the chord tones lie; voicings, CAGED shapes and fingerings are
  out of scope (005).
- Bass drills in 001 are untimed and tap-based; timed play-along is feature 003.
- Fixture lessons use placeholder text only (Constitution IV); the owner writes all real lessons,
  including those in the built-in General Theory pack.
- Progressions in lessons are given as structured root + quality data; chord-symbol parsing is
  feature 005.
- Audio, camera, ML, sync and spaced repetition beyond FR-041 are out of scope (002–013).

## Clarifications

### Session 2026-11-21 (owner answers, folded in with the v2.2.0 direction change)

- Q: Default fret count? → A: It comes from each My Gear instrument; defaults are 22 for guitar and
  20 for bass, editable (FR-014, FR-053).
- Q: Octave-specific note-finding? → A: A per-user setting; any octave counts by default (FR-030,
  FR-067).
- Q: Weak-spot weighting: miss counts or SM-2? → A: Simple miss counts in 001; FSRS (or SM-2) in
  006. Users can turn adaptive weighting off (FR-041, FR-067).
- Q: Book mapping? → A: No book dependency. Built-in General Theory pack plus a pack system; the
  owner creates their own book pack in 016 (FR-022, FR-063).
- Q: 7-string guitar? → A: Covered by "any user, any gear": guitar 6–8 strings, bass 4–6 strings
  (FR-053). The family pitch ranges (guitar F#1–E4, bass B0–C3) are a proposal for owner
  confirmation.
- Q: Reference devices for SC-002/SC-003? → A: The owner's laptop is the development benchmark
  machine. **OPEN (owner):** its model, CPU, GPU and RAM, and the reference phone (model, OS,
  browser), must be written here before SC-002/SC-003 benchmark tasks run (Constitution V).
- Spec review 2026-11-21 (BLOCK, 2 blockers + 14 others) folded in: FR-066a merge rules, geometry id
  (FR-040, FR-041, FR-051, FR-053), terminology, copy vs restore import (FR-043), profile settings
  record (FR-067), no-instrument and last-instrument rules (FR-053), empty stage set (FR-064), tag
  format and drill ids (FR-068), worst-case geometry in SC-002/003, per-instrument stats (FR-042),
  persistent storage (FR-045). Family ranges widened to guitar E1–E4, bass A0–C3 (owner to
  confirm).
