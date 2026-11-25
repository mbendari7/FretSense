# Spec 001 part: Shared requirements, edge cases and key entities

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

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
