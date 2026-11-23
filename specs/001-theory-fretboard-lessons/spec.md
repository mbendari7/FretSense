# Feature Specification: Theory Engine, Interactive Fretboard and Lesson System (Guitar + Bass, No Audio)

**Feature Branch**: `001-theory-fretboard-lessons`

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21 for constitution v2.2.0: personalised for every user, no locked content,
curriculum packs; clarify answers recorded in Clarifications; spec-reviewer re-review and product-owner
review 2026-11-22 folded in and re-checked against constitution v2.3.0; owner approval pending)

**Input**: User description: "Theory engine, interactive fretboard and lesson system (no audio). US1 (P1) Fretboard explorer: any of 12 roots × scales (major, natural/harmonic/melodic minor, the 7 modes, major and minor pentatonic, blues) and chords (maj, min, dim, aug, sus2, sus4, 7, maj7, m7, m7b5, dim7, add9); labels toggle between note names, scale degrees and none; root highlighted. US2 (P1) Lessons: open a lesson tied to a book chapter and go Read → See (fretboard preset from frontmatter) → Drill in one place. US3 (P1) Note-finding drill with accuracy and response time per string. US4 (P2) Interval and chord-tone drills. US5 (P2) Key helper: diatonic chords with Roman numerals and their neck positions. US6 (P3) Local progress tracking that weights questions toward weak spots, with JSON export/import. Also: tunings (standard, Drop D, Eb, DADGAD), configurable fret count, left-handed view, 390 px phone layout, offline use, measurable success criteria (100% pass on theory fixtures, feedback under 100 ms)." Amendment: "Make everything instrument-agnostic with an InstrumentProfile (string count, tuning, fret count, pitch range, scale length). Profiles: 6-string guitar (standard, Drop D, Eb, DADGAD), 4-string bass (EADG, Drop D), 5-string bass (BEADG), custom tunings. Lessons and drills declare which instruments they apply to. Bass lesson types: root–fifth–octave patterns, arpeggios, walking bass lines, locking into chord tones."

**Practice-session value** (Constitution VI): before picking up their guitar or bass, a user opens
one screen to see a scale, chord or key on *their* instrument and tuning, opens any lesson they like
in the stages they prefer, and runs a 2–5 minute drill that targets their weakest strings,
intervals and patterns.

**Release** (`docs/PRODUCT.md`): **v0.1 "Fretboard"**, in full. Every FR and SC in this spec ships
in v0.1. 001 meets two of v0.1's exit criteria directly: 100% of the theory fixtures pass (SC-001),
and the app works offline after the first load (FR-045, SC-005). It also enables a third, the
≤ 2-minute path from landing page to first drill answer measured by 018 SC-001, through FR-053's
one-tap preset picker and US3. Later capabilities are separate specs, not deferred 001 FRs: Play
stages in v0.2 (002, 003), Camera-coach stages in v0.4 (010), and 017's approved extensions to
001's drills and labels, specified and planned in 017 (core v0.1, complete v0.3).

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
8. **Given** 5-string BEADG, E minor pentatonic and Degrees labels, **Then** exactly 5 strings are
   drawn and string 5 reads 5 at fret 0 (B0), b7 at fret 3 (D1), and 1 with the root marker at
   fret 5 (E1).

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
11. **Given** a lesson preset `bass4-drop-d` and an active 5-string BEADG, **When** the user taps
    "Use my instrument instead", **Then** See shows the lesson's root, type, labels and window on 5
    strings, and drill attempts are stored with the 5-string's instrument id.

---

### User Story 3 - Note-Finding Drill (Priority: P1)

The app names a note and a string; the user taps where it is. Feedback is immediate. Accuracy and
response time are tracked per string.

**Why this priority**: Knowing the notes on the neck underpins everything else, and it is the drill
users will run most often, on guitar and bass.

**Independent Test**: Run 20 questions on the two lowest strings with a mix of right and wrong
answers, then verify the feedback and the per-string accuracy and median time.

**Acceptance Scenarios**:

1. **Given** the prompt "Find G on string 6, low E" (6-string Standard), **When** the user taps a
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
6. **Given** the user's octave setting is "exact octave", **When** the prompt is "Find G3 on string 5, A" (6-string Standard, 22 frets), **Then** only string 5 fret 10 is correct and fret 22 (G4) is
   incorrect. With the default "any octave", both are correct.
7. **Given** a 20-question session with 8 answered, **When** the user taps End drill, **Then** the
   summary, marked "Ended early", shows those 8 per string and in total, the 8 attempts appear in
   progress, and the lesson's Drill stage is not marked complete (FR-028).
8. **Given** the saved label mode is "Note names", **When** a note-finding question is open,
   **Then** the neck shows no note text, every position's accessible name is reduced as in
   FR-032a (string and fret, "open" at fret 0, plus marker suffixes only), and after the answer the labels and full names return, with the saved label mode unchanged.
9. **Given** 5-string BEADG (20 frets) in exact-octave mode, **When** the prompt is "Find E1 on
   string 5, low B", **Then** only fret 5 is correct and fret 17 (E2) is incorrect.

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
3. **Given** "Find the ♭7th of the A dominant 7th chord (A7), frets 5 to 8", **When** the user taps a G inside the window,
   **Then** it is correct; a G outside the window is incorrect, with the reason "Outside frets 5 to 8".
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
   4 notes per bar, **Then** R1, R2 and R4 are judged as each note is entered, R3 for each bar once the next bar's
   beat 1 exists (bar 1 for bar 4), every broken rule is named on its slot (in FR-058's wording), Undo and re-entering a slot work before "Check line", and 16 attempts
   are recorded at Check line.
4. **Given** a chord-tone lock drill over the same progression, **When** the user taps one note per
   chord, **Then** chord tones are correct and non-chord tones are flagged with the chord's actual
   tones revealed.

---
5. **Given** 4-string EADG, chord C, strings 1–3, frets 0 to 17, adaptive weighting off (the shared fixture for scenarios 5–12), **When** the user taps C3 1/5, then G2 2/5, then C2 3/3, **Then** Step 3 (octave) is ✓ at the first tap with no "placed" state, then Step 2 ✓, then Step 1 ✓; the feedback is "Correct, C root–fifth–octave shape", the shape is shown, and one attempt with outcome correct is recorded for item (root-fifth-octave, C).
6. **Given** the fixture, **When** the user taps C3 3/15, then C4 1/17, then G3 2/17, **Then** Steps 1, 3 and 2 are ✓ in that order and the question is correct.
7. **Given** the fixture, **When** the user taps C2 3/3 and then C4 1/17, **Then** Step 1 is ✓; 1/17 is flagged "Doesn't fit the shape (more than 3 frets apart or wrong octave)"; Step 3 is missed and C3 1/5 is revealed; after G2 2/5 (Step 2 ✓) the feedback reads "Incorrect. 2 of 3 steps correct. Missed: octave C3 at string 1 fret 5."; one attempt with outcome incorrect is recorded.
8. **Given** the fixture, **When** the first tap is A2 2/7, **Then** it is flagged "Not C or G", Step 1 (root) is missed and C2 3/3 is revealed (lowest-pitched root); that shape is fixed for the rest of the question.
9. **Given** the fixture, **When** the first tap is G2 1/0, **Then** it is flagged "Doesn't fit the shape (…)", Step 2 is missed and G2 2/5 is revealed.
10. **Given** the fixture, **When** the first tap is C3 2/10, **Then** it is flagged "Doesn't fit the shape (…)" and charged to Step 1; Step 1 is missed and C2 3/3 is revealed.
11. **Given** the fixture, **When** the user taps C2 3/3 twice, **Then** the second tap is not judged, charged or recorded, and is announced "String 3, fret 3 is already in this answer".
12. **Given** the fixture, **When** any question ends, **Then** exactly one attempt is recorded for it (FR-040), never one per step.
13. **Given** 5-string BEADG, chord C, all strings, frets 0 to 12, **When** the user taps C2 3/3, **Then** it shows as "placed" (accessible suffix ", placed, root or octave") and Steps 1 and 3 stay pending; then (a) G2 2/5 makes it Step 1 ✓ and Step 2 ✓; (b) G1 4/3 makes it Step 3 ✓ (octave) and Step 2 ✓; (c) the wrong tap C3 2/10 first resolves it as the root (Step 1 ✓), then is flagged "Doesn't fit the shape (…)", Step 3 is missed and C3 1/5 is revealed (never 3/3).
14. **Given** an arpeggio drill for Am7 on 6-string Standard, **When** the user plays Steps 1, 3 and 4 correctly and misses Step 2, **Then** exactly one attempt with outcome incorrect is recorded for item (arpeggio, m7), holding every judged tap in tap order, and the drill summary and Progress each count 1 question.
15. **Given** an arpeggio question with Steps 1 and 2 judged, **When** the app is backgrounded and then resumed, **Then** Steps 1 and 2 keep their marks and revealed positions, the drill asks for Step 3, nothing has been recorded yet, and one attempt is recorded when the last step is judged.
16. **Given** the first arpeggio question with Steps 1 and 2 judged, **When** the user selects "End drill", **Then** the summary reads "No questions answered. Your unfinished question wasn't saved.", nothing is recorded, and the session does not count as abandoned (FR-028).
*(Scenarios 5–16: product-owner 2026-11-22, provisional)*

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
  In the explorer and key helper, an open string whose pitch class is in the context takes the
  context spelling (Eb tuning in Ab major: string 5 open = "Ab"; Standard in Gb major: string 2 open
  = "Cb"); other open strings keep the instrument's spelling. Drills follow FR-032a.
- **Fret range vs preset**: a preset beyond the active instrument's fret count is clamped, with a notice.
- **Left-handed view**: the neck is mirrored, labels stay upright, and string numbering is unchanged.
- **Unanswerable questions** are never generated: every question has at least one valid answer
  inside the allowed strings and frets (FR-061).
- **Interrupted drill**: when the app is backgrounded or the lesson is left, the session pauses.
  Answered questions are kept. On resume, the current question is shown again. A single-step question's timer restarts. A multi-step question (root–fifth–octave, arpeggio) keeps its judged steps, taps, placed and revealed positions, and continues at the next pending step; nothing is recorded for it until its last step is judged, and its response time is its active time before the pause plus the time since resume (paused time never counts). After a reload or restart, an unfinished multi-step question is discarded with the paused session and nothing is recorded for it. *(product-owner 2026-11-22, provisional)* A paused session lives only
  while the app is open: after a reload or restart it is gone, its answered questions stay in
  progress, and the drill opens its setup with the same settings.
- **Slow answers**: answers over 30 s count toward accuracy but are excluded from time statistics.
- **Storage unavailable or full**: the app stays usable, with a persistent "progress won't be saved" notice. If the app
  detects that stored progress was lost since the last visit (for example, evicted by the browser),
  it shows a notice offering to import the last export.
- **Invalid lesson files** fail validation at build time with the file and field named; the
  release is blocked.
- **Empty library**: when the library has no lessons for the active family, it shows an empty state whose heading names the family in plain words ("No guitar lessons yet" or "No bass lessons yet"; the word "family" never appears), says lessons are on the way, and offers two working actions: "Explore scales on your neck" (explorer) and "Start a note-finding drill". While the library is empty for the active family, no screen shows a lesson-first primary action (any action whose label or target is a lesson, such as "Start with a lesson" or "Next lesson"); it returns automatically once a matching lesson exists. If other families have lessons, the empty state also offers "Show lessons for all instruments" (the US2-1 toggle), and "All lessons" (FR-065) stays reachable. Until 018 ships Home, resume wording ("Pick up where you left off") appears only when the profile has at least one live attempt or live lesson-completion record; otherwise the heading reads "Ready to practise on your <instrument name>". *(FN-2, 2026-11-22, provisional)*
- **Empty progress**: with no live attempts of a current drill type (a fresh profile, after reset, or only `legacy` v0.1 attempts, data-model §3.1), the progress view
  shows an empty state with one action, "Start a note-finding drill", instead of empty charts or 0%
  figures.
- **Import conflicts**: in restore-import, attempts are matched by attempt id; a matching id with a
  different immutable payload (FR-066a) rejects the whole file. Copy-import gives every record a new
  id, so it never conflicts on attempts.

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

**Lessons**

- **FR-022**: System MUST load markdown lessons (original text, Constitution IV) with structured metadata: id, title,
  level (beginner | intermediate | advanced), tags (goal, genre and topic tags, used by 016 to
  suggest paths), instruments, concepts, optional fretboard preset, drills, optional songs, an
  optional `needs` list (`audio-input`, `camera`; default empty; used from 015 on; `camera` never
  alone), and optional Play / Camera-coach sections (reserved, ignored in 001). Lessons carry no
  book or chapter reference; grouping and order come from curriculum packs (FR-063).
  While no lesson is available, the Lessons tab stays visible and opens the library, which says "The first lessons are being written" and links to Drills, the explorer and the key helper. No placeholder lesson or "coming soon" control is shown. (CR-B2-9 interim) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-023**: Every lesson and built-in pack MUST be validated against its schema at build time. A
  missing field, an unknown scale/chord/drill/preset/tag-format value, a duplicate id, a progression
  without a key, `needs: [camera]` alone, a pack referencing an unknown lesson, a preset fret beyond 24, or an image that is not a local file inside `content/` (remote URL,
  any scheme, or a path that escapes `content/`) MUST fail the build with the file and field named. A preset beyond the active
  instrument's fret count is clamped at runtime (Edge Cases). The same check MUST be runnable
  locally.
- **FR-024**: The lesson screen MUST present the user's chosen stages (FR-064) in one place, in the
  chosen order, with direct navigation to any stage, including stages hidden by the preference
  ("show all stages").
- **FR-025**: Read MUST render headings, paragraphs, lists, emphasis, tables, images and links, MUST
  NOT execute embedded scripts or raw HTML, and MUST list songs as "Songs to practice".
- **FR-026**: See MUST apply the lesson preset (root, type, labels, optional window, optional
  built-in instrument preset id such as `bass4-drop-d`) temporarily for the lesson, with a banner. A preset for a different family than the active instrument is applied only if the user confirms.
  The banner MUST name the preset in plain words (e.g. "Drop D: lowest string tuned down to D") and
  offer "Use my instrument instead". That option applies the preset's root, type, labels and window
  to the active instrument (window clamped to its fret count). Attempts are then recorded with the
  instrument's id and geometry id. Lesson-drill strings that don't exist on it fall back to all
  strings, with a notice. Declining a preset for a different family than the active instrument does
  the same. The choice holds for the current lesson visit. A profile setting, "Lesson tunings: use
  the lesson's (default) / always use my instrument", makes it permanent.
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

- **FR-030**: The drill MUST prompt a note and a string and accept taps on that string only. The
  prompt names the string by its number and its open note in the active tuning, spelled
  as the instrument's open-string notes (FR-051) so it matches the nut column (FR-032a), adding "low" or "high" for the lowest- and highest-pitched strings (e.g. "Find G on
  string 6, low E"; on 5-string bass "string 5, low B"; in Drop D "string 4, D"). The prompted
  string is marked on the neck by thickness or outline, not colour alone. Taps
  on other strings are ignored, with a hint. The octave mode is a per-user setting that applies to the note-finding drill only (the
  other drills judge as their own FRs state): "any octave"
  (default; a tap is correct if its pitch class matches) or "exact octave" (the prompt names an
  octave, e.g. "Find G3", and only that exact pitch is correct). In exact-octave mode, prompts are
  generated only for pitches that exist on the prompted string within the fret range (FR-061).
- **FR-031**: Settings MUST include strings (any subset of the active instrument's strings), fret range, question
  count (5–100, default 20), and note set: naturals (7); naturals + sharps (C# D# F# G# A#);
  naturals + flats (Db Eb Gb Ab Bb); all (17 spellings). Cb, Fb, E# and B# are never prompted. With no saved settings for this
  drill, the defaults are: note set naturals, all strings of the active instrument, frets 0–12
  (clamped to the fret count), the profile's octave mode, and 20 questions, on every instrument. In
  the UI the note sets are labelled "Letters only (A–G)", "Letters and sharps", "Letters and
  flats" and "All spellings", with the technical term as secondary text.
  Each string chip uses FR-030's string naming (e.g. "6, low E", "1, high E"; 5-string bass "5, low B"). Drill setup names the active instrument above the string chips, with a "Change" control that opens the instrument switcher (FR-016). (CR-B2-5, CR-B2-8) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-032**: Feedback MUST be visible within 100 ms of the tap at p95 (SC-002). It MUST use icon +
  text + colour and be announced to screen readers. After a correct answer, the next prompt follows
  after the profile's auto-advance choice: 600 ms (default), 1.5 s, or wait for Continue (WCAG
  2.2.1). The next prompt's announcement is queued after the feedback announcement and never
  interrupts it. After an incorrect answer, the correct positions stay visible until the user taps
  Continue. When feedback for an incorrect answer appears, the fretboard scrolls (instantly with "reduce motion", FR-049) so that the revealed correct position nearest the tapped position (fewest frets apart, then fewest strings, then lower fret) and the nut column are fully in view, together with the tapped position when both fit; when they do not both fit, the revealed position wins and the clipped-edge cue (FR-047) points toward the tapped position. Keyboard focus stays on the tapped position (FR-049) and is not moved by this scroll; the next focus move scrolls as usual. Other revealed positions outside the view are indicated by the clipped-edge cue. This scroll happens only after the answer is judged, so FR-032a is unaffected. *(code-reviewer T091–T093 r2 #3, provisional)* Within one question, the prompt, every label revealed in feedback and the feedback text
  and announcement MUST use the question's spelling: the prompted note (note-finding), the reference
  transposed by the interval (interval, FR-002), or the chord's spelling (chord-tone and bass drills,
  FR-005); other revealed positions use FR-060 relative to that note (in chord contexts, "that note" is the chord root). Feedback text uses FR-049's
  announcement wording (6-string Standard, prompt "B♭" ⇒ "Correct, B♭ on string 5 fret 1", never "A♯"; "B♭2" in
  exact-octave mode).
  *(FN-5, provisional)*
- **FR-032a**: While a drill question is unanswered (every drill in this spec, FR-030–FR-037 and
  FR-056–FR-059), the fretboard MUST NOT reveal the answer:
  - positions show no note, degree or function labels and no scale or chord highlights, whatever
    the saved label mode;
  - only the drill's own markers are shown: the prompted string, the interval reference, the
    window, and the user's own taps;
  - each position's accessible name is "String N, fret F" plus only those markers' suffixes (FR-013), except the interval reference, whose name also includes its note with octave in the question's spelling (FR-032), because that note is shown visibly and is part of the prompt (WCAG 2.5.3) *(r2 #7, owner-approved 2026-11-22)*, for example "String 6, fret 3, inside window";
  - the interval reference shows its note name;
  - in multi-step drills, only taps that have been judged show their labels;
  - once the question is answered, labels and full accessible names return for the feedback;
  - a drill never changes the saved label mode (FR-021);
  - the open-string name of every string is always shown at the nut column (FR-047): it is part of
    the instrument, not the answer. While a question is unanswered it is spelled exactly as the
    instrument's open-string notes (FR-051); once the question is answered, an open string keeps the instrument's spelling unless its pitch is one of the question's own notes (the prompted note, the interval reference or target, or a tone of the question's chord), in which case it takes that note's spelling, except where that spelling has a double accidental. FR-060 never applies to the nut column. *(CR-B2-3, owner-approved 2026-11-22)* While a question is open, a fret-0 position's accessible name is "String N,
    open" plus marker suffixes. *(FN-4, R3-2; owner-approved 2026-11-22)*
  - fret-0 positions are full answer targets wherever fret 0 is inside a drill's fret range, and in the explorer and key helper whenever fret 0
    is in the visible window: drawn at the nut column with the same minimum 44 × 44 CSS px target
    (FR-047), the same marker categories (FR-013) and at least the same 3:1 non-text contrast
    (FR-048) as fretted positions, never dashed, faint or outside the neck area, and visible while a
    question is open. A visual regression check at 390 px and 1280 px, in light and dark themes,
    covers it. *(A2-3, provisional)*
- **FR-033**: Response time MUST be measured in milliseconds from the moment the prompt is displayed
  to the answering tap.
- **FR-034**: The summary MUST show, per string and in total: number asked, accuracy %, and median
  response time (answers over 30 s excluded from times only). An "End drill" control MUST be
  available at any time. It shows the summary of the questions answered so far, marked "Ended
  early", and those attempts are kept. A session ended early counts as abandoned for FR-028. Median
  response time is shown as "Typical time" with "(median)" as secondary text. The summary also
  lists every missed question (prompt, the user's answer and the correct position, in the prompt's
  spelling) and offers "See progress" and "Back to drills" alongside "Practise again". A lesson's
  Drill stage is recorded complete when the last question is judged, before the summary is shown;
  leaving the summary by any link doesn't change it. "Back to drills" returns to the lesson's Drill
  stage inside a lesson, otherwise to the drill's setup (`/drills/:type`). Missed questions show the
  correct position(s); multi-step and bass drills list each missed step or note with its slot.
  Ending with 0 answered shows "No questions answered", records nothing and does not count as
  abandoned for FR-028. A question counts as answered only when its last step (or note) is judged. Ending early discards an unfinished question: its taps are not recorded and it appears in neither the summary nor Progress. When one is discarded, the summary adds "Your unfinished question wasn't saved." (with 0 answered: "No questions answered. Your unfinished question wasn't saved."). "Number asked" counts the same unit FR-040 records for the drill type (questions; notes for walking-bass; chords for chord-tone lock), so the summary and Progress always agree. For per-string figures, a multi-step question counts toward the string of its Step 1 (root) position: the user's tap, or the revealed root if Step 1 was missed. *(product-owner 2026-11-22, provisional)* The missed list is in question order and shows the first 10 entries (an entry is a missed
  question, step or note), with "Show all (N)", where N is the total number of entries. Note names in
  the list follow FR-049's octave rule for feedback. When the summary opens, after any final feedback
  announcement, focus moves to its heading. *(FN-11, A2-15, provisional)*

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

**Key helper**

- **FR-038**: Users MUST be able to choose one of the 30 keys and see the triads and sevenths of
  FR-007, with a toggle for the harmonic-minor alternatives. The key list MUST follow circle-of-fifths
  order and show enharmonic pairs side by side (B/Cb, F#/Gb and C#/Db major; G#/Ab, D#/Eb and
  A#/Bb minor). The 7-accidental spellings (C# and Cb major, A# and Ab minor) are visually
  secondary but still one tap away.
- **FR-039**: Selecting a diatonic chord MUST show its tones on the active instrument with function
  labels and the root distinguished, optionally within a fret window.

**Progress**

- **FR-040**: System MUST record every drill answer on the device (one attempt per question for note-finding, interval, chord-tone, root–fifth–octave and arpeggio, however many taps or steps it took (FR-056a, FR-057); per note for walking-bass,
  written at Check line (FR-058); per chord for chord-tone-lock): attempt id, drill type,
  instrument id (null under a temporary lesson preset), geometry id, input modality (tap in 001; fret and audio are added by 008 and 003), prompt,
  answer position(s), outcome, response time, timestamp, and lesson id if any. Stats are grouped per
  modality.
- **FR-041**: Question generation MUST weight toward weak items, within the active local profile. An
  item is (geometry id, string, pitch class) for note-finding (so stats from different tunings are
  never mixed, and retuning back to a tuning reuses its stats), (interval, direction) for intervals, (quality, function) for chord
  tones, (root-fifth-octave, root pitch class) for
  root–fifth–octave, and (drill type, quality of the chord the note is played over) for arpeggio,
  walking-bass and chord-tone-lock. Weighting uses simple miss counts: an
  item's weight increases monotonically with its smoothed miss rate over its last 50 live (non-tombstoned) attempts, counted within the
  active instrument's family for interval, chord-tone and pattern items
  (formula documented in plan research R9) Attempts are counted as FR-040 records them: a multi-step question is one attempt, and it is a miss if any step was missed. *(product-owner 2026-11-22, provisional)*. Spaced repetition is feature 006. Given the same history and
  seed, the sequence MUST be identical, and it MUST meet US7 scenario 1. Adaptive weighting is a
  per-user setting (default on); when off, generation is uniform over valid prompts (US7 scenario 5).
- **FR-042**: A progress view MUST show accuracy and median time per item group, per instrument
  family and per My Gear instrument, over the last 7 days (rolling, device local time) and all time. Attempts made under
  a lesson preset are shown as "Lesson preset: <preset name>" in per-instrument stats and count
  toward the preset's family. Attempts of a deleted instrument are shown under "Deleted instrument:
  <name>", grouped by instrument id, even when a live instrument has the same geometry.
  Counts are of recorded attempts (FR-040). Each item group names its unit: "questions" for every drill except walking-bass ("notes") and chord-tone lock ("chords"), e.g. "18 of 24 questions correct". A total across groups, if shown, uses "answers" (one answer = one recorded attempt). Typical time is shown per item group only and is never pooled across drill types. *(product-owner 2026-11-22, provisional)*
- **FR-043**: Users MUST be able to export the active local profile's data (schema version, local
  profile id, attempts, lesson completion, instruments, optionally settings) in the **profile export
  format** (016 extends the same format with its own record types) and import it:
  - into the **same** local profile id (restore): records merge by the FR-066a rules;
  - into a **different** local profile (copy): every record gets a new id and the target's local
    profile id, so no id ever exists in two profiles; natural-key records (settings, lesson
    completion) merge into the target's existing ones by natural key (FR-066, FR-066a). Incoming
    tombstones never apply in copy import: a tombstoned record in the file is not copied and not counted (owner decision 2026-11-22, "Copy import drops deleted"); live attempts in the file that refer to a dropped instrument are copied with instrumentId null and shown under "Deleted instrument" (FR-042). An incoming live natural-key record whose
    target record is tombstoned un-deletes it with only the incoming stages (lesson completion) or
    fields (settings, only when "Apply settings from this file" is on), as a newly written record.
    *(spec-reviewer 2026-11-22 #3b, R2-5, R2-6; provisional)*
  - Import MUST validate the file (schema, size ≤ 50 MB, the single limit for the profile export format,
    which 016 also uses; an export of 50,000 attempts MUST fit under it and import successfully, and
    an export that would exceed it MUST warn before saving, unknown fields rejected). Exports include
    tombstoned records. A record referring to an instrument id absent from both the file and the target profile, or a failed migration step, rejects the whole file. An import is applied in one
    transaction: an interruption leaves no partial change.
  - Lesson completion MUST be merged as a union.
  - Export offers "Include settings" and import offers "Apply settings from this file" (shown
    only when the file has settings); both default off. Before confirming, the preview names the
    import mode (Restore or Copy) and, in one sentence, why that mode
    applies. In Copy mode the preview also states, next to the confirm button: "Copy import adds this file's answers and instruments as new records every time. Importing the
    same file again adds them again."
    *(A2-8 interim; FN-10c held)*
  - The whole file MUST be rejected, with no change, if it is invalid, has an attempt whose id
    matches a local attempt with a different immutable payload (FR-066a), or comes from a newer
    schema version.
  - Older schema versions MUST be migrated.
  - Copy import re-stamps `created` and `updated` with the target profile's writer id (attempt wall
    times are kept).
  - Before export, the screen MUST first show a summary (profile name, instruments, counts of
    attempts, completed stages and records hidden by reset, settings if ticked, and the date range
    of the attempts), with the full list of every attempt with its time and response time one tap
    away, and MUST state above the fold at 390 × 844 px that the file is unencrypted, readable by anyone who has it, and that local
    profiles are not private from other people using the same device.
- **FR-044**: Users MUST be able to reset attempts and completion after confirmation. Settings are
  kept. Reset tombstones the records (FR-066); an export taken before the reset restores them
  (FR-066a). The confirmation MUST say that reset hides progress but does not erase it from the
  device, and that later exports still contain it; permanent erasure is 016 ("erase permanently").

**Cross-cutting**

- **FR-045**: After the first load, every feature in this spec MUST work offline, including import
  from a local file. The app MUST request persistent storage, and if it is denied, MUST show a
  non-blocking reminder to export, at most once every 7 days and only when there are attempts
  newer than the last export.
- **FR-046**: The app MUST be installable on Chrome for Android, Safari on iOS (Add to Home Screen),
  and Chrome or Edge on desktop.
- **FR-047**: At 390 px width there MUST be no page-level horizontal scroll (the fretboard scrolls horizontally only,
  inside its own area, with the nut column (string names and fret 0) kept visible, on the right in
  the left-handed view; changing a preset or window scrolls to the window's first fret; so position targets stay at least 44 × 44 CSS px even for 8
  strings and 24 frets), and every control and fretboard position MUST be at least 44 × 44 CSS
  px (inline links in running text are exempt, as WCAG 2.5.8 allows). Portrait and landscape
  are both supported. When the neck is wider than its area, the area MUST show a visible scroll cue
  at each clipped edge (shape or arrow, not colour alone) and a text indicator of the visible range
  ("Open and frets 1–6 of 12" when fret 0 is in view, otherwise e.g. "Frets 7–12 of 12"), or "No whole fret in view of 12" when fret 0 is outside the current range and no fretted position target is fully visible *(r2 #4, provisional)*, where "of N" is the last fret of the current range (the drill's fret range during a drill,
  otherwise the visible window), and a fret is in view only when its whole position target is visible; fret 0 counts as in view
  only when it is inside the current range, not merely because the nut column is drawn. A segment or
  view of one fret is labelled by that fret alone: visible labels "Open" or "12", accessible names
  "Frets Open" or "Frets 12", indicator "Open of 12" or "Fret 12 of 12" *(A2-r3 #2, #3; owner-approved
  2026-11-22)*, a text node that updates as the area scrolls and is reachable by screen reader but is not a live region, and offer fret-range jump controls that split the frets of the current range
  (the drill's fret range during a drill, otherwise the visible window, FR-015) into contiguous segments of at most K frets each (the last may be shorter), where K is the number of the range's widest fret position targets that fit fully in the area at the current text size; with uniform spacing this gives the fewest segments, and with proportional spacing it may give more, but every segment always fits fully *(r2 #5, provisional)*, labelled by their first and last fret, with fret 0 shown as "Open" (e.g. "Open–6", "7–12"), in a
  group with the visible label "Jump to frets"; each control's accessible name contains its visible
  label and the word "frets" (e.g. "Frets Open–6", "Frets 7–12"), so the visible label is part of the
  name (WCAG 2.5.3, FR-048), laid out as one
  row that scrolls within itself at 390 px at the largest text size; selecting one scrolls its first
  fret next to the nut
  column. Jump controls and the starting scroll position never depend on the answer (FR-032a). The
  first question starts scrolled so that its starting focus position (FR-049), the nut column and
  the stated window, when there is one, are visible. Later questions keep the focused position and the nut column in view (except while incorrect-answer feedback is scrolled to the answer, FR-032); the stated window starts in view when it fits alongside them, otherwise the
  clipped-edge cue points toward it. *(FN-3, R3-3; owner-approved 2026-11-22)*
- **FR-048**: At least 3 text sizes MUST be offered, with fretboard labels of at least 24 CSS px at
  the largest. Every screen MUST meet WCAG 2.2 Level AA in light and dark themes, including
  non-text contrast of at least 3:1 for strings, frets, inlays, markers and root outlines (fret
  numbers at least 4.5:1). Dialogs (instrument editor, export, import preview, reset) move focus to
  their heading on open, keep focus inside while open, close on Escape (except while an import is
  being written) and return focus to the control that opened them; a destructive action is never
  the initially focused button. Form errors are named in text next to the field, linked to it and
  announced. At the largest text size at 390 px, fretboard labels never overlap or truncate (markers
  grow and the neck scrolls), and other text reflows without truncation.
  Every route has exactly one h1, its main heading (FR-049); onboarding pickers use h2. (CR-B2-11) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-049**: Every control and fretboard position MUST be keyboard-operable and have a screen-reader
  name (e.g. "String 3, fret 2, A3, degree 5"; reduced to string and fret while a drill question is
  open, FR-032a). The fretboard is one tab stop; arrow keys move by
  string (up/down) and fret (left/right, following the visual direction in left-handed view), and
  Enter or Space answers. Focus is always visible: moving focus on the fretboard
  scrolls the focused position fully into view inside the fretboard's own scroll area, never under
  fixed UI (018 FR-016). Note-finding feedback in any-octave mode is shown and announced without octave numbers ("Correct,
  G on string 6 fret 3"; (fret range 0–15, after a tap at fret 1) "Incorrect. You tapped F at fret 1; G on string 6 is at frets 3 and 15"; incorrect feedback names the tapped note and its position first, spelled by FR-060 relative to the question's context root: the prompted note in note-finding, and the chord root in chord-tone, arpeggio, root–fifth–octave and chord-tone lock (a tapped chord tone keeps the chord's spelling; e.g. G minor, asked ♭3, tapped B ⇒ "You tapped B…", never "C♭") and following this octave rule *(CR-B2-15, owner-approved 2026-11-22)*) (every correct fret inside the question's fret range, ascending); in exact-octave mode and
  in the other drills it includes the octave ("Correct, G2 on string 6 fret 3"). Whenever a position's accessible name includes its note, the note includes the octave; while a question is open the name has no note, except the interval reference (FR-032a). With "reduce motion" set, feedback animations are off and the chosen auto-advance (FR-032) is kept. Verified by automated checks plus a manual
  NVDA (Windows) and VoiceOver (iOS) pass. On every route change, focus moves to the new view's main
  heading. On drill start, focus moves into the fretboard at the starting position: the first fret
  of the question's range on the prompted string (note-finding), the reference position (interval),
  or the first fret of the window (chord-tone, arpeggio) or of the fret range (other drills) on the highest-numbered string the drill's settings select (string 1 = highest pitched, so this is the lowest-pitched string in non-re-entrant tunings; it is chosen by string number, not pitch) *(r2 #6, provisional)*. On each later question, focus stays on the fretboard at the last answered position
  and does not move automatically, so no focus change interrupts the feedback. Feedback and the
  "Question N of M. <prompt>" announcement use one polite live region, so the prompt is queued after
  the feedback (FR-032). The Home key moves focus to the current question's starting position (as defined above for drill
  start) without answering. Whenever the fretboard has focus and focus is shown as keyboard focus (the last input was a key
  press), the drill screen shows the visible hint "Arrow keys: move. Enter or Space: answer, then continue. Home: go to the start of the question." *(CR-B2-12, owner-approved 2026-11-22)* On drill start, once focus is in
  the fretboard, the same polite live region announces "Question 1 of M. <prompt>". While feedback is shown,
  Enter or Space on the fretboard activates Continue; activating Continue by any means returns focus
  to the fretboard at the last answered position. The visual advance follows the auto-advance
  setting. Drill start overrides the route-change focus rule. *(R3-3, R3-7; owner-approved 2026-11-22)* Position names follow one pattern: "String N, fret F"
  ("String N, open" for fret 0), then the spelled note with octave, then "degree D" (scale contexts)
  or "function X" (chord contexts), then marker suffixes in FR-013 order. Each token appears once; in
  "none" label mode the note and degree are still included. While a question is open, the name is
  reduced as in FR-032a. *(FN-6, provisional)*
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
  After adding a preset, a status message names it and states whether it became the active instrument using the preset's full display name as shown in the picker ("Added 4-string bass, Standard (EADG). It is now your active instrument."; when it did not become active: "Added 4-string bass, Standard (EADG). Your active instrument is still <active instrument name>."). The message is scrolled into view, receives focus and is announced. Opening the custom-instrument form scrolls its heading into view and moves focus to it. (CR-B2-7) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-054**: Every lesson and drill definition MUST declare its applicable instrument families,
  or "any". The library MUST filter by the active family.
- **FR-055**: Progress and statistics MUST be kept and reported per instrument family.

**Bass patterns and lines (amendment)**

- **FR-056**: The root–fifth–octave drill MUST name a root pitch class and ask for a root, the
  perfect 5th above it and the octave above it, in any order. A **valid shape** is a root position R on a selected string within the fret range, plus a position sounding exactly R + 7 semitones (the 5th) and one sounding exactly R + 12 (the octave), all on selected strings within the fret range, whose frets span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret 0). Any octave of the root pitch class may be the root. A tap is **accepted** if at least one valid shape contains it together with every earlier accepted or revealed position in the question; otherwise it is a wrong tap (FR-056a). A step is marked correct as soon as the accepted positions fix its role: the 5th at once; a root-pitch-class tap once a second accepted position shows whether it is the root or the octave . A tap's role is fixed when every valid shape containing it and every accepted or revealed position gives it the same role; it is fixed at once when only one role is possible. Until then it is **placed**: the position shows a "placed" marker (visible "R/8", accessible-name suffix ", placed, root or octave"), the announcement is "<note> placed on string N fret F: root or octave, set by your next note", and Steps 1 and 3 stay pending. The prompt states the fret range in play, as FR-035 does: "Play a root–fifth–octave shape for C, frets 0 to 12". The completed shape is shown afterwards. Only positions inside the fret range are drawn as targets, so no out-of-range reason exists. A settings combination with no valid shape for a selected root is rejected (impossible-settings rule). *(product-owner 2026-11-22, provisional)*
- **FR-056a**: In the root–fifth–octave drill, a wrong tap MUST be flagged at the tapped position with a reason and charged to one pending step: If a placed tap exists when a wrong tap arrives, it is resolved first: the reveal shape is chosen (preferring shapes in which the placed tap is the root, then the reveal order below), the placed tap takes its role in that shape and is marked correct, and the wrong tap is then charged by the rules here to the steps still pending. A revealed position is never a position the user has already tapped. The wrong tap is to Step 2 (5th) if the tap has the 5th's pitch class and Step 2 is pending; to the lowest-numbered pending of Step 1 (root) and Step 3 (octave) if it has the root's pitch class; otherwise to the lowest-numbered pending step. That step is marked missed (FR-057 indicator) and its correct position revealed, from a valid shape containing every accepted and revealed position (if several fit, the first in this order: lowest-pitched root; then root at the lower fret, then on the higher string number; then the same two tests for the 5th's position, then for the octave's). Revealed positions count as fixed for the rest of the question. The drill continues with the remaining pending steps; the question ends when all three steps are judged. Reasons: "Not C or G" (neither pitch class); "Doesn't fit the shape (more than 3 frets apart or wrong octave)". The question is recorded as one attempt (FR-040) when its last step is judged: outcome correct only if no step was missed; answer positions are every judged tap in tap order (the attempt schema, data-model §3, stores positions only; the per-tap result is shown, not stored); response time runs from the prompt to the last step's judgement, excluding paused time (Edge Cases). Step results are shown (FR-057 indicator) but not recorded separately. A tap on a position already tapped or revealed in this question is ignored (not judged, charged or recorded); it is announced "String N, fret F is already in this answer" (or "… was already marked wrong"). *(product-owner 2026-11-22, provisional)*
- **FR-057**: The arpeggio drill MUST ask for the tones of a chord (FR-005) ascending from its lowest root, up to the chord's highest tone (within one octave for every quality except add9, whose last step is the 9th at root + 14 semitones, label "9", spoken "9th"; owner-approved 2026-11-22), inside an inclusive fret window [s, s + w − 1] (default w = 5), where the lowest root is the lowest-pitched position of the root pitch class on a selected string inside the window. The generator chooses s (within the fret range) only where every step's exact pitch, ascending from that lowest root, has at least one position on a selected string inside the window; if no s fits for a chord, that chord is not asked, and if none fits for any selected chord, the settings are rejected. Each step accepts any position inside the window sounding the exact target pitch. The prompt names the chord as FR-036 does and states the window: "Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9". Wrong-step reasons: "Outside frets 5 to 9"; "Not the lowest A in frets 5 to 9" (Step 1, right pitch class, wrong octave); "Not the root of Am7" (Step 1, wrong pitch class) *(code-reviewer r3 #3, provisional)*; "Not the ♭3 of Am7" (wrong tone or out of order). *(product-owner 2026-11-22, provisional)* Each step is judged.
  A wrong tone or ordering error is flagged and the correct position revealed, and the drill continues to the next step. The question is recorded as one attempt (FR-040) when its last step is judged: outcome correct only if no step was missed; answer positions are every judged tap in tap order; response time runs from the prompt to the last step's judgement, excluding paused time (Edge Cases). Step results are shown (step indicator) but not recorded separately. *(product-owner 2026-11-22, provisional)* The window is stated, named and drawn as in FR-036.
  Each step is shown as a step indicator in one of three states, each marked by icon + text + colour: pending (no mark), correct (✓, "correct") or missed (✗, "missed"). A missed step never shows ✓. Steps are numbered from 1 in ascending order, one per chord tone in FR-005 order; the root is Step 1 and is played by the user, not given. Each indicator shows the function label (FR-005; the root as "R"), and its accessible name is "Step N, <function>, <state>", with the root spoken as "root" (e.g. "Step 1, root, correct"; "Step 2, ♭3, missed"). When the last step is judged, the feedback starts "Correct, <chord> arpeggio" (FR-056: "Correct, <chord> root–fifth–octave shape") when no step was missed, otherwise it uses the incorrect style and reads "Incorrect. N of M steps correct. Missed: …"; and the feedback text and announcement list every missed step with its target, in the question's spelling and with octave (FR-032, FR-049), e.g. "Missed: ♭3 F♯4 at string 2 fret 7" (6-string Standard). The root is written and spoken "root" in the missed list, e.g. "Missed: root A2 at string 6 fret 5"; only the visible indicator label is "R". FR-056 uses the same indicator with three fixed steps, numbered by tone and not by tap order: Step 1 root ("R"), Step 2 5th (visible "5", spoken and written "5th"), Step 3 octave (visible "8", spoken and written "octave"), e.g. "Step 3, octave, pending"; its missed list uses the same words, e.g. "Missed: octave C3 at string 1 fret 5" (4-string bass). (CR-B2-2) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-058**: The walking-bass drill MUST take a progression of 2–8 chords at 4 beats each with a
  declared key (tonic + mode; required in the lesson data). Outside a lesson, this drill and
  chord-tone lock (FR-059) use the built-in progression | I | vi | ii | V | of diatonic triads (FR-007) in a major key the user
  picks from the 15 major keys (default C major: | C | Am | Dm | G |); more progressions come from
  017's catalogue (017 FR-007). The progression loops, so the last bar
  approaches bar 1. The drill accepts 4 notes per bar and judges each against these rules:
  - (R1) beat 1 is the chord root;
  - (R2) beats 2–3 are chord tones, tones of the declared key's scale, or chromatic passing tones
    (a semitone between two such tones);
  - (R3) beat 4 is a step of 1–2 semitones to the next bar's beat-1 note, or that note's perfect
    5th above or below (dominant approach);
  - (R4) no leap larger than an octave (an exact octave is allowed), including across bar lines.

  Each broken rule MUST be named on the slot it applies to, in one plain sentence that states the
  rule and what was played, never built by joining the beat label into a sentence (e.g. beat 4: "A
  lead-in is 1–2 semitones from the next bar's first note (C), or a perfect 5th away; you played C
  itself."). The other rules use: R1 "Beat 1 is the chord's root (<root>); you played <note>."; R2
  "Beats 2 and 3 are chord tones, notes of <key>, or a semitone step between them; you played
  <note>."; R4 "Moves between notes are at most an octave; you moved <article> <interval name> (<n>
  semitones)." (interval named by FR-002 from the two spelled notes, with "a" or "an" as the name
  requires, e.g. "a major 9th (14 semitones)", "an augmented octave (13 semitones)"; when FR-002 gives
  no name (beyond a double octave, or a typed error) the message ends "you moved <n> semitones.";
  theory-checker verifies the wording); R3 (other cases) "A lead-in is 1–2 semitones from the next bar's
  first note (<next>), or a perfect 5th away; you played <note>." FR-065 and
  SC-012 are met only once walking-bass is reachable, and the v0.1 release does not ship until it
  is. Interim builds before that release may leave it out; whether they hide it or show a labelled
  preview is held for the owner (FN-7).
  *(FN-7, provisional)*
  - **Entry:** the screen shows bars and beats as slots, each with its bar's chord. The current slot
    is highlighted (not by colour alone) and announced ("Bar 2, beat 3, Am"). Undo removes the last
    note. Any slot can be selected and re-entered before checking, and re-entering a slot re-judges
    it and its neighbours.
  - **Judging:** R1, R2 and R4 are judged as each note is entered, within FR-032's budget. R3 for
    bar n is judged as soon as bar n + 1's beat 1 exists (bar 1 for the last bar).
  - **Revealed notes:** when a slot breaks a rule, the positions revealed for it, inside the drill's fret range, are: R1
    the root of <chord> ("root of <chord>"); R2 the tones of <chord> ("chord tone of <chord>"), plus
    the notes a semitone between the slot's two neighbouring entered notes when both are chord or key
    tones ("passing tone"), with key notes not revealed; R3 the lead-in options ("lead-in option").
    Each position gets one caption, in the order root, chord tone, lead-in option, passing tone.
    Revealed notes need only satisfy the broken rules; an R4 break reveals nothing extra. The suffix follows FR-013's "revealed answer" suffix, and captions never overlap at the
    largest text size (FR-048). *(A2-12, provisional)*
  - **Recording:** "Check line" becomes available once every slot is filled. The line's attempts
    are recorded then, one per note, each with its final judgement (FR-040).
- **FR-059**: The chord-tone lock drill MUST take a progression (with a declared key) and accept one
  note per chord. Chord tones are correct; otherwise the chord's tones are revealed.
  Walking bass (FR-058) and chord-tone lock (FR-059) take the same strings and fret-range settings
  as the other drills, with the same defaults: all strings, frets 0–12 (clamped to the instrument),
  changeable in the drill's settings. Reveals, the drill-start focus position (FR-049) and the
  FR-047 range indicator use that range. *(A2-r3 #1; owner-approved 2026-11-22)*
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

**Personalisation foundation (Constitution XIII)**

- **FR-063**: System MUST support **curriculum packs**: id, title, optional source (the book or
  course it follows, by name only), schema version, and ordered sections (title, optional source
  label such as a chapter, ordered lesson ids). A lesson MAY appear in several packs. 001 ships one
  built-in pack, **General Theory**, built from original lessons that theory-checker has verified and the owner has approved. The active pack is a
  per-profile setting. The pack format and validation are defined here; creating, editing,
  importing and exporting user packs is feature 016. Packs MUST NOT contain lesson prose or text
  copied from their source.
- **FR-064**: Users MUST be able to choose which lesson stages they want (Read, See, Drill; Play and
  Camera-coach join the list when their features ship) and their order, and save that as their
  default (per local profile). At least one stage MUST stay selected. A lesson has Read if it has a body, See if it has a preset, and Drill if it has at
  least one drill, whatever the active instrument. A lesson that lacks a chosen stage skips it
  silently. If a lesson has none of the chosen stages, it opens at its first
  available stage with a notice ("This lesson has no Drill; showing Read").
- **FR-065**: Nothing MAY be locked. Every lesson, every stage of every lesson, every lesson drill,
  every stand-alone drill type, the library ("All lessons"), the explorer, the key helper, progress,
  export, import, reset, settings and My Gear instruments MUST be reachable at any time, from the library and by direct link, whatever the user's progress or
  completion state (Constitution XIII).
- **FR-066**: All user data (instruments, settings, attempts, lesson completion, stage preferences,
  active pack) MUST be scoped to a **local profile**. On first run, 001 creates one local profile
  automatically (no account, no network). The persisted record types are exactly: local profile, profile settings,
  instrument, attempt and lesson completion. Every one MUST carry a globally unique id, the profile
  id, created and updated timestamps, a schema version, and a deletion tombstone instead of hard
  deletion. Device-local metadata (schema version of the database, writer ids, clock state) is
  exempt: it is never exported or synced and holds no user content, and 001 stores no device
  identifier, so later sync (013) and multi-profile management (016) need no migration of existing
  records. Reset (FR-044) tombstones records rather than erasing their ids. Ids are UUIDv4 or
  UUIDv7 strings (choice in plan.md). Records that are unique per natural key (the profile settings
  record per local profile; lesson completion per local profile and lesson) are matched by that
  natural key, not by id, in every merge and import, so two devices or a copy-import never create a
  second one.
- **FR-066a**: Merge rules for records with the same id, or the same natural key for natural-key records (FR-066) (used by restore-import, FR-043, and by the
  later sync, 013):
  - **Attempts are immutable.** Same id with identical payload ⇒ no-op. Same id with a different
    immutable payload ⇒ conflict; restore-import rejects the file. The immutable payload is exactly:
    id, local profile id, drill type, instrument id, geometry id, modality, prompt, answer, outcome,
    response time, timestamp, lesson id, drill id and item key. `created` (re-stamped by copy
    import) and `schemaVersion` (raised by migrations) are excluded.
  - **Restore-import is an explicit user action**: an imported live record replaces a local
    tombstoned copy (un-delete), so export → reset → import restores everything (SC-009).
  - **Profile settings merge per field**: each field carries its own `updated`, and the newest
    wins per field, so concurrent edits to different fields on two devices both survive.
  - **Lesson completion** merges as a per-stage union among live records (earliest completion time
    kept). Its tombstone follows the attempt rules: restore-import un-deletes a locally tombstoned
    completion when the file holds it live, keeping the union, and an incoming tombstone applies only
    if it is newer (HLC) than the local record's last update. Completing a stage while the local
    completion record is tombstoned un-deletes it with only the newly completed stage (the
    tombstoned stages are cleared in that write); the earlier stages return only through
    restore-import of a file that holds them. *(FN-10b, provisional)*
  - **Incoming tombstones** apply by the same last-writer-wins rule in restore-import (never in copy
    import, FR-043). Before writing, both import modes show a preview headed with its mode ("Restore from file" or
    "Copy from file") that lists the added, restored, updated, hidden and unchanged counts (hidden is always 0 in copy
    import) (owner decision R3-5). Copy import drops tombstoned records (owner decision 2026-11-22).
    If the added, restored, updated and hidden counts are all 0, the preview says "This file has
    nothing new to import" and confirming writes nothing. Each count has a plain sentence such as "12
    answers you reset earlier will come back". Nothing is written until the user confirms.
  - **Clock bound**: an imported timestamp more than 24 hours ahead of the device clock rejects the
    file, and the local clock never advances past that bound.
  - **Ordering**: "newest" always means the greatest hybrid logical clock value (wall time, then
    counter, then writer id), so ordering holds under clock skew between devices, within the clock
    bound.
  - **Restore precedence for records with the same id or natural key**: (1) attempts only: a
    different immutable payload ⇒ conflict, the file is rejected; (2) local copy tombstoned, incoming
    copy live ⇒ un-delete (completion keeps the per-stage union); (3) local copy live, incoming copy
    tombstoned ⇒ the tombstone applies only if its HLC is newer than the local record's last update,
    otherwise no-op; (4) both copies live ⇒ the type's rule above: attempts identical ⇒ no-op;
    profile settings per field (only when "Apply settings from this file" is on); lesson completion
    per-stage union, earliest time kept; instruments newest `updated`, writer-id tie-break; (5) both
    copies tombstoned ⇒ no-op. (6) no local copy, incoming copy tombstoned ⇒ not written and not counted in any preview count (it hides nothing). *(code-reviewer T091 r1 #6, provisional)* *(R2-3, R3-1; owner-approved 2026-11-22)*
  - **Other mutable records** (instruments): the copy with the
    newest `updated` wins; ties go to the lexicographically larger **writer id** (a random id per
    local profile per device, used only for this ordering; it is not a device identifier and the
    same device has different writer ids in different profiles).
  - **Generic merge** (013): last-writer-wins on `updated`, where a tombstone is an update.
  The merge function is pure and property-tested (SC-013).
  Count sentences name record kinds in plain words (e.g. "5 answers and 1 instrument will be added"). When the preview says "This file has nothing new to import", its only action is "Close". (CR-B2-14) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-067**: One **profile settings** record per local profile MUST hold: active instrument (the
  same field 016 calls "default instrument"), octave mode (FR-030; default any octave), adaptive
  weighting on/off (FR-041; default on), stage preference (FR-064), active pack (FR-063), the last explorer selection (FR-011), the
  auto-advance choice (FR-032), the lesson-tunings choice (FR-026) and the display settings (FR-021), including handedness (FR-017, which is the player's handedness: it
  mirrors the view here and identifies the fretting hand in 008). Later features (016, 017 and 018) add fields to this same record, each with its own
  per-field `updated` (FR-066a); they never move or rename 001's fields. Settings are included in export when the user chooses (FR-043).
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
  pack, last explorer selection, auto-advance, lesson tunings, display settings (incl. handedness).
- **Fret position**: string (1 = highest pitched), fret; resolves to a Note under an instrument geometry.
- **Fretboard view settings**: active instrument, window, handedness, label mode, text size,
  fret spacing.
- **Lesson**: id, title, level, tags, instruments, concepts, body, preset, drills, songs, needs,
  reserved Play/Camera-coach sections; per-stage completion (informational).
- **Drill definition**: type, one of exactly these ids: `note-finding`, `interval`, `chord-tone`,
  `root-fifth-octave`, `arpeggio`, `walking-bass`, `chord-tone-lock`, instruments, parameters. Stored attempts may also carry the drill type `legacy` (migrated v0.1 attempts only, data-model §3.1); it is never a drill definition type. *(r2 #9, provisional)*
- **Drill session / Attempt**: generated questions, answers, outcome, timing, instrument id, geometry id.
- **Profile export** (format v1, FR-043): schema version, profile id, timestamp, attempts, completion, instruments,
  optional settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the theory fixtures pass. They cover 21 spelled roots (7 naturals, 7 sharps,
  7 flats) × 12 scale types and × 12 chord qualities (expecting a typed error wherever a triple
  accidental would be needed), the 30 keys, every built-in profile's mapping for frets 0–24, and
  the named edge cases. The owner and theory-checker sign off the expected values.
- **SC-002**: Drill tap → feedback is under 100 ms at p95 over at least 200 taps on the reference phone and on the reference laptop (both named in Clarifications), measured and reported
  separately for the 6-string Standard and 5-string BEADG presets and for the worst case allowed
  geometry (8 strings, 24 frets) (Constitution VIII).
- **SC-003**: Changing root, type, labels, profile or handedness updates the fretboard within 100 ms
  at p95 on the same devices, reported separately for the 6-string Standard and 5-string BEADG
  presets and the 8-string, 24-fret worst case.
- **SC-004**: From a cold start (app launch with an existing instrument), any scale or chord can be shown on the active instrument in at
  most 3 interactions and under 10 s on the reference phone and laptop; from a fresh profile, in at
  most 4 interactions (including the one-tap instrument pick) and under 15 s.
- **SC-005**: Offline after first load, 100% of the acceptance scenarios for US1–US7 pass.
- **SC-006**: At 390 px, 0 screens scroll horizontally at page level, and 100% of controls and fretboard positions are at
  least 44 × 44 px (automated check; inline text links exempt).
- **SC-007**: A 20-question note-finding session, including setup, takes under 3 minutes at
  ≤ 5 s per answer, measured with the FR-031 defaults.
- **SC-008**: A valid new lesson appears after a rebuild with no code change. 100% of invalid
  lesson fixtures fail validation with the file and field named.
- **SC-009**: Export → reset → restore-import (same local profile) leaves 100% of the attempts that were live at export time live with identical payloads, and every lesson-completion stage that was complete at export time complete with its original time, with no two live records sharing an id or a natural key (0 duplicates).
- **SC-010**: Theory engine line and branch coverage is at least 90%.
- **SC-011**: All theory, explorer and drill property tests pass across all 7 built-in presets
  and at least 100 randomly generated valid My Gear instruments covering every allowed string count
  (guitar 6–8, bass 4–6) and fret counts 12–24 (no hidden 6-string or 22-fret assumption).
- **SC-012**: 100% of lessons, stages, drills and tools are reachable by direct link from a fresh
  profile with no progress and from a seeded profile (every stage complete, low accuracy) (automated
  crawl); both reach the identical set (FR-065), and 0 controls are disabled or hidden for progress
  reasons.
- **SC-013**: Every persisted record type in 001 carries the FR-066 fields (schema check over all
  stores), and property tests of the FR-066a generic merge (013) over two divergent exports of the same
  local profile show no id collisions, convergence (merge order doesn't matter) and idempotence
  (merging the same export twice equals merging it once). Restore-import, which by design favours
  the file's live records over local tombstones, is property-tested for idempotence and the SC-009
  round trip. The only migration in 001 is the v0.1 drill-type rename (Clarifications, data-model §3.1): it runs on load and on import, is idempotent, keeps `schemaVersion: 1`, and is tested to produce the same payload hash on both paths. *(r2 #9, provisional)*

## Assumptions

- 001 creates and uses one local profile, with no rename or switch UI. Creating, switching and
  deleting several profiles is feature 016; 001's data model already supports it (FR-066).
  Boundaries: 001 owns that profile, instruments, the settings record, the pack format and export v1;
  016 owns profile create, rename, switch and delete, erase permanently, other gear, paths and pack
  authoring; 018 owns onboarding (including renaming the profile), Home, navigation and the theme
  choice.
- String 1 is the highest-pitched string. On every screen the lowest-pitched string is drawn at the
  bottom of the neck and the highest at the top (the player's view looking down at the instrument,
  as in tab). The left-handed view mirrors the fret direction, never the string order.
- Melodic minor means the ascending ("jazz") form.
- "Neck positions" means where the chord tones lie; voicings, CAGED shapes and fingerings are
  out of scope (005).
- Bass drills in 001 are untimed and tap-based; timed play-along is feature 003.
- Fixture lessons use placeholder text only. Real lessons, including the built-in General Theory
  pack, are written by agents in original wording, checked by theory-checker and approved by the
  owner (Constitution IV, v3.0.0).
- Progressions in lessons are given as structured root + quality data; chord-symbol parsing is
  feature 005.
- Audio, camera, ML, sync and spaced repetition beyond FR-041 are out of scope (002–013).
- Cross-spec changes approved in 017 (017 Clarifications, 2026-11-22) are applied when 017 is
  planned, not in 001's current tasks: wider drill inputs (017 FR-031 extends FR-031, FR-035,
  FR-036 and FR-057–FR-059); extra degree and function labels (017 FR-003 and FR-004 extend
  FR-006); and a handbook deep-link preview on the 6-string Standard preset (017 Edge Cases), an
  exception to FR-053's picker-first rule for handbook deep links only. 018's "I don't play yet"
  (018 FR-005) is an explicit user choice of a preset, so it is consistent with FR-053.

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
  (FR-053). The family pitch ranges were first proposed as guitar F#1–E4 and bass B0–C3,
  then widened in spec review to guitar E1–E4 and bass A0–C3 (FR-053); they remain a proposal for
  owner confirmation (research O3).
- Q: Reference devices for SC-002/SC-003? → A: The owner's laptop is the development benchmark
  machine. **OPEN (owner):** its model, CPU, GPU and RAM, and the reference phone (model, OS,
  browser), must be written here before SC-002/SC-003 benchmark tasks run (Constitution V).
- Spec review 2026-11-21 (BLOCK, 2 blockers + 14 others) folded in: FR-066a merge rules, geometry id
  (FR-040, FR-041, FR-051, FR-053), terminology, copy vs restore import (FR-043), profile settings
  record (FR-067), no-instrument and last-instrument rules (FR-053), empty stage set (FR-064), tag
  format and drill ids (FR-068), worst-case geometry in SC-002/003, per-instrument stats (FR-042),
  persistent storage (FR-045). Family ranges widened to guitar E1–E4, bass A0–C3 (owner to
  confirm).

### Session 2026-11-22 (team loop A and spec-reviewer re-review; proposals, owner approval pending)

- spec-reviewer re-review: BLOCK on the missing Release line only (fixed: Release paragraph), plus
  8 MAJOR and 15 MINOR findings and 19 checklist gaps.
- product-owner review: REVISE → APPROVE once edits are in (subject to the owner). user-tester Mode A
  (`docs/feedback/001-theory-fretboard-lessons-2026-11-22.md`, 3/5, 2 BLOCKER) triaged: 19 fix now,
  1 moved to 017 (CR-017), 3 backlogged (017 playback, 006 weighting reasons, 016 library filter).
- Applied: Release line; drills never reveal their answer (FR-032a, FR-049); first-run drill and
  explorer defaults (FR-011, FR-021, FR-031, FR-035, FR-036); End drill and paused-session rule
  (FR-034, Edge Cases); prompts name strings by open note and neck orientation (FR-030,
  Assumptions); "Use my instrument instead" (FR-026); auto-advance choice (FR-032); walking-bass
  entry and judging (FR-058); window stated and drawn (FR-036, FR-057); marker categories (FR-013);
  full WCAG 2.2 AA incl. dialogs and forms (FR-048); export/import preview wording (FR-043,
  FR-066a); empty progress state.
- **Frozen encodings settled before T021/T022** (data-model §3.1 must follow): the immutable attempt
  payload (FR-066a), the closed list of record types with device-local metadata exempt and no device
  id in 001 (FR-066), the canonical drill-type ids (Key Entities), and one attempt per judged unit
  with the pattern-drill item keys (FR-040, FR-041). One export limit of 50 MB shared with 016
  (FR-043).
- **Held for the owner (not applied):** saving last drill settings per drill type (in 001 as
  FR-031a, or in 018; 018 FR-009 depends on it); default profile name ("Player 1" per 018 FR-005 vs
  "Me" in data-model); where the explorer and key helper live in 018's navigation (`/` route);
  idempotent copy import and "Continue this file's profile" (privacy trade-off: copied records become
  traceable to their source profile; affects frozen encodings); cross-spec changes to 016, 017 and
  018; a11y colour-difference threshold (proposal: CIEDE2000 ≥ 20, as 018 FR-015) and music-stand
  legibility distance (proposal: 1 m); O1–O4.

### Session 2026-11-22 (v0.1 build, team loop D; provisional under the standing approval, owner review pending)

- Export/import size limit (FN-10a): one 50 MB limit (spec wins); data-model.md and contracts/profile-export.md aligned. (product-owner FN-10)
- The simplified walking-bass drill is hidden until full FR-058 ships in a later 001 task group; the other three bass drills (root–fifth–octave, arpeggio, chord-tone lock) ship. (FN-7, NEEDS MAHMOUD to confirm hide vs labelled preview)
- Harmonic-minor alternatives are shown in addition to the natural-minor chords (US5-2 "also shown"); theory API v1.1 adds helper exports (contracts/theory-api.md).
- 4-string EADG bass preset id: `bass4-standard`.
- Lesson-completion tombstones (FN-10b, provisional, applied): completion merges as a per-stage union (earliest time per stage kept); restore-import un-deletes a locally tombstoned completion when the file holds it live, keeping the union of both records' stages; an incoming tombstone applies only if its HLC is newer than the local record's last update. SC-009 covers completion as well as attempts.
- Root–fifth–octave (FR-056, applied): a step counts only within 3 frets of the root, and the finished shape must span at most 4 frets (max − min ≤ 3).
- Spec change requests FN-2, FN-3, FN-4, FN-5, FN-6, FN-7, FN-10b and FN-11 are written into the FRs (marked provisional) and are in loop A; their code changes wait for loop A to pass.
- Idempotent copy import (FN-10c) stays **held for the owner** (privacy trade-off: a stable copied id makes copied records traceable to their source; needs privacy-auditor). It is not in FR-043. "Continue this file's profile" also remains held. (NEEDS MAHMOUD)
- 2026-11-22, owner: "And now you have all my full approval, so keep going." The FN-2 to FN-11 spec change requests are written into the FRs above (marked provisional) and go through loop A now.
- 2026-11-22, owner (spec gate escalation after spec-reviewer r3): "Apply all 7 fixes (Recommended)". R3-1 to R3-7 applied with spec-reviewer's exact wording.
- Mode A2 triage (product-owner, 2026-11-22, provisional): fix-now edits A2-1, 2/11, 3, 5, 6, 8 (interim warning), 9, 12, 13, 14 and 15 applied. Held (NEEDS MAHMOUD): A2-7 nut spelling after the answer (would reverse owner-approved R3-2), FN-10c, FN-7. Backlog: "Just looking" (018 FR-005), Undo reset (016), more walking-bass progressions (017).
- 2026-11-22, owner (A2 spec gate escalation): range for walking bass and chord-tone lock = "Same as other drills (Recommended)"; FR-047 wording fixes = "Apply both (Recommended)".
- Q: How are attempts stored by the v0.1 pre-release (4695363) under the old drill-type ids handled? → A (provisional, product-owner, 2026-11-22): A versioned migration on load and import renames `bass-root-fifth-octave`, `bass-arpeggio` and `bass-walking` to `root-fifth-octave`, `arpeggio` and `walking-bass`. Old root–fifth–octave keys and `bass-octave-shapes` attempts are kept under a legacy id in storage and in exports (so older exports import whole and round-trip, FR-043, SC-009), but never shown on Progress, never offered as a drill, and never used for weighting or mastery (r2 #8), so older exports still import whole (FR-043); see data-model §3.1. *(code-reviewer T091 r1 #4. Owner 2026-11-22: "Keep migration, drop drill (Recommended)": the migration stays and `bass-octave-shapes` stays removed.)*
- Q: code-reviewer T091–T093 r2 #3–#6, #8, #9 and r1 #6 → A (provisional, product-owner, 2026-11-22): applied to FR-032 (scroll to the revealed answer after a wrong answer), FR-047 (range text "No whole fret in view of N"; segments sized by the widest cell), FR-049 (start on the highest-numbered selected string), the T093a clarification (legacy attempts kept in storage and exports, not shown on Progress), SC-013 and Key Entities (the v0.1 rename is the only migration; stored `legacy` drill type), FR-066a restore precedence (6) (an unmatched incoming tombstone is not written or counted). r2 #7 (the interval reference's accessible name includes its note) was approved by the owner on 2026-11-22 and applied to FR-032a/FR-049.
- Q: test-writer T100 ambiguities → A (provisional, product-owner, 2026-11-22): the tapped note in chord drills is spelled relative to the chord root (FR-049, FR-032); arpeggio steps are numbered by chord tone, with the root as Step 1 played by the user (per US6 scenario 2); FR-056 uses 3 fixed steps R/5/8 ("octave"); FR-053 messages use the preset's full display name.
- Q: test-writer FR-056/FR-057 gaps → A (provisional, product-owner, 2026-11-22): FR-056 accepts any octave of the root as long as the three notes form an exact-pitch shape (5th +7, octave +12, span ≤ 3 frets), judged against every shape still possible; a wrong tap is charged by pitch class to one pending step, which is missed and revealed, and the drill continues (FR-056a); FR-057 picks the window so the full arpeggio fits from the lowest root, and the prompt says "up from its lowest A"; the root is written and spoken "root" in missed lists; add9 arpeggio steps are R, 3, 5, 9 with the 9 at +14 (owner-approved 2026-11-22). The 3-fret limit applies to the whole shape.
- Q: test-writer T100b gaps → A (provisional, product-owner, 2026-11-22): one attempt per rfo question (FR-040 wins over per-step); no out-of-range reason (unreachable); a placed tap is resolved first (root-preferred) before a wrong tap is charged; "placed" only when both roles remain possible (marker "R/8", suffix ", placed, root or octave"); revealed positions can fix a placed tap's role; full reveal tie-break order; repeat taps ignored; the 5th is spoken and written "5th"; final feedback "Correct, <chord> arpeggio" or "Incorrect. N of M steps correct. Missed: …"; US6 scenarios 5–13 added. Open MINOR: FR-034 per-string summary for multi-string questions (proposal: the shape root's string).
- Q: FR-056a per-tap "accepted or wrong" marks vs the data model → A (provisional, coordinator, 2026-11-22): not stored; the attempt keeps `answer: FretPosition[]` in tap order, so no schema change. Final feedback lines end with a full stop.
- Q: Arpeggio per-step attempts (FR-040) vs weighting, Progress, pause and End drill → A (provisional, product-owner, 2026-11-22): arpeggio records one attempt per question, like root–fifth–octave (FR-040, FR-057); weighting counts FR-040 attempts (FR-041, R9); the summary and Progress count the same unit and Progress groups name it (FR-034, FR-042); a multi-step question resumes at its next pending step with paused time excluded (Edge Cases); ending early discards an unfinished question with a notice (FR-034); per-string stats use the Step 1 root's string. The per-step wording was a pending proposal, never owner-signed. No frozen-encoding change.
- Q: Owner decisions 2026-11-22 (copied into reviews/README.md) → A: (1) add9 arpeggio steps R, 3, 5, 9 with the 9th at root + 14 ("R-3-5-9, 9th above"). (2) Copy import (FR-066a copy mode) drops records that are deleted (tombstoned) in the file: they are not written and not counted ("Copy import drops deleted"). (3) Interval drill (FR-035, FR-032): each black-key reference is spelled so that the answer needs no E♯, B♯, C♭, F♭ or double accidental; when one spelling of the reference would give such an answer and the other would not, the other is used; if both would, the question is not asked ("Avoid F♭-style references"). (4) The 10 General Theory lessons are approved to ship ("Approve all 10").
