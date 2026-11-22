# Feature Specification: Studio: Transcription to Tab and Notation

**Feature Branch**: `012-transcription-tab-notation`

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21: transcription becomes the headline feature of the **Studio**
destination, with live input, playback, a library and export formats; spec-reviewer BLOCK and
product-owner REVISE folded in; clarified 2026-11-22; spec-reviewer re-review PASS WITH NOTES, product-owner REVISE (small); see reviews/)

**Input**: User description: "Automatic transcription: record yourself playing → tab and notation output, with rhythm and onset detection." Amended: "Make transcription a headline feature of the 'Studio' page: record or play live → notes with string and fret (from audio + vision fusion) → tab and standard notation, editable, playable, and exportable (MusicXML, PDF, Guitar Pro or plain text tab)."

**Practice-session value**: the user plays a riff, a bass line or an improvisation, and watches it
turn into tab and notation for *their* instrument, with the right strings and frets. They can fix
it, play it back slower to check it, keep it in their library, and export it to share or print.
Ideas aren't lost. (Comparing a take against an intended part is a later play-along feature with
003, not part of this spec.)

**Release** (`docs/PRODUCT.md`): **v1.0 "It writes it down"**. It is the Studio destination (018
FR-008) and the end point of demo mode (018 US6).

**Depends on**: 003 (onsets, tempo), 009 (polyphonic notes) or 002 (monophonic fallback), 005
(fingering optimizer, to choose playable positions), 010 (fused positions, optional), 011
(technique markings, optional), 007 (consented recordings and evaluation sets), 015 (audio input),
008 (camera, optional), 018 (Studio destination, design system, error states, demo mode), 016
(profile-scoped records), 018 FR-035 (listening and camera indicators). **Constitution**: III and X (evaluation set and baseline first), IX
(on-device, recording opt-in), XI (works audio-only and with a laptop mic), VIII (any
instrument), XIII (profile-scoped, sync-ready).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Live or Record in the Studio (Priority: P1)

The user opens **Studio** and chooses **Live** or **Record**. In Live, they play and the tab grows
as they play. In Record, they play a take of up to 2 minutes and get the transcription when they
stop. Notes carry a string and fret: from audio + vision fusion (010) when the camera is on,
otherwise from the fingering optimizer (005). Each note shows how confident the system is.

**Why this priority**: it's the headline. It's the moment the app visibly hears and sees you play.

**Independent Test**: transcribe held-out labelled clips (FR-001) through both Live and Record
paths, and compare notes, positions and onsets against the labels, per instrument.

**Acceptance Scenarios**:

1. **Given** a monophonic guitar riff at 100 BPM in Record, **Then** the tab lists the notes with
   string and fret, quantised to the detected beat grid.
2. **Given** a 5-string bass line, **Then** 5-line tab is produced, with the low B string used where
   the positions call for it.
3. **Given** Live mode with the camera on, **When** the user plays the same pitch on two different
   strings, **Then** the tab shows the two different positions they actually played.
4. **Given** Live mode with the camera off, **Then** positions come from the fingering optimizer,
   are marked "estimated", and may update within a short look-ahead window as more notes arrive
   (FR-011).
5. **Given** only the laptop mic and no interface, **Then** Live and Record still work for
   monophonic playing, with a notice that an interface improves accuracy.
6. **Given** the mic is denied or unplugged, **Then** the Studio shows 018's error state and offers
   the demo clips and the editor (US3) instead.

---

### User Story 2 - Rhythm and Notation (Priority: P1)

The system estimates tempo and meter (or uses the click, FR-021), quantises onsets to a grid
(down to 16ths and triplets), and shows standard notation alongside tab. Both instruments are
written an octave above the pitch they sound, as is standard: guitar on a treble clef marked with
an 8 below, bass on a bass clef.

**Why this priority**: rhythm is half of a transcription. Notation makes it readable by any
musician.

**Independent Test**: compare tempo, beat positions and quantised durations against labels.

**Acceptance Scenarios**:

1. **Given** a clip with a steady tempo, **Then** the tempo estimate is within ±2 BPM and ≥ 90% of
   onsets are quantised to the labelled grid position.
2. **Given** a rubato passage, **Then** a tempo map is used, or, if no tempo can be estimated,
   unquantised proportional notation is shown with a notice.

---

### User Story 3 - Edit (Priority: P1)

The user corrects notes, positions, rhythms and techniques in an editor that shows tab and
notation together. They can insert and delete notes, change tempo and time signature, and start
a transcription from scratch with no input at all. Undo and redo cover every change.

**Why this priority**: automatic output is never perfect. Editing is what makes it usable. A
blank-score start also makes the Studio useful with no gear.

**Independent Test**: apply a scripted list of edits to fixture transcriptions and check the
resulting note events, then undo all of them and check the original is restored.

**Acceptance Scenarios**:

1. **Given** a note's pitch is changed, **Then** its string and fret are re-chosen by the fingering
   optimizer, unless the user has pinned that note's position.
2. **Given** the user moves a note to another string (by drag or keyboard), **Then** the fret updates to keep the pitch,
   or the move is refused (with the reason) if that string can't play the pitch.
3. **Given** a user correction to an automatically detected note, **Then** it is recorded as a
   correction, and offered to 007's active learning only if the user opts in (Constitution IX).

---

### User Story 4 - Play Back (Priority: P2)

The user plays the transcription back with a moving cursor across tab and notation, slows it
down or speeds it up, loops a selection, and adds a count-in. If they kept the recording, they can
switch between hearing the recording and the transcription.

**Why this priority**: hearing the transcription is how the user checks it, and slowed-down loops
are how they practise it.

**Independent Test**: play fixture transcriptions and compare the scheduled note times with the
note events at several speeds.

**Acceptance Scenarios**:

1. **Given** a transcription at 120 BPM, **When** played at 50% speed, **Then** notes sound at
   60 BPM, at the transcribed pitches, with the cursor on the sounding note.
2. **Given** a selected 2-bar loop, **Then** it repeats seamlessly until stopped.

---

### User Story 5 - Export and Import (Priority: P1)

The user exports a transcription as MusicXML (tab and notation), PDF (printable tab and
notation) or plain-text tab, and can re-import MusicXML. Guitar Pro export follows after v1.0.

**Why this priority**: a transcription that can't leave the app is a toy. Standard formats make it
usable in other notation programs, in lessons and in band rehearsals.

**Independent Test**: export fixture transcriptions to every format, validate each one, re-import
MusicXML, and open the exports in independent applications.

**Acceptance Scenarios**:

1. **Given** an edited transcription, **When** exported to MusicXML and re-imported, **Then** every field in FR-007's round-trip set, including the extension data, is identical.
2. **Given** a 5-string bass transcription, **When** exported to plain-text tab, **Then** it has 5
   labelled lines in the documented layout (FR-016), and is readable in a fixed-width font.
3. **Given** a PDF export, **Then** it has a title, tempo, meter, tab and notation, page breaks at
   bar lines, and is legible in greyscale.

---

### User Story 6 - Library (Priority: P2)

Transcriptions are saved in the user's profile. The user can name, rename, duplicate, delete and
search them, and see when each was made, on which instrument, and whether the recording was kept.

**Why this priority**: the Studio is where ideas are kept. Without a library, every take is
throwaway.

**Independent Test**: create, rename, duplicate and delete transcriptions across two profiles,
export and re-import the profile, and verify isolation and the round trip.

**Acceptance Scenarios**:

1. **Given** two profiles, **Then** each sees only its own transcriptions.
2. **Given** a transcription whose recording wasn't kept, **Then** it shows "notes only", and
   playback uses the transcription.

---

### Edge Cases

- **Rubato or tempo changes**: a tempo map is supported. If it can't be estimated, the output is
  unquantised proportional notation with a notice.
- **Polyphony beyond model support**: notes are flagged low-confidence and shown with the
  low-confidence marker (FR-005).
- **Techniques** (from 011): shown as tab symbols when available (b, /, \\, h, p, ~, P.M.). Without
  011, none are shown, and the user can add them in the editor.
- **Recording not opted in**: Live and Record still transcribe, keeping only the note events. The
  audio and video are never stored (Constitution IX).
- **Take longer than 2 minutes**: recording stops at the limit with a notice. The transcription so
  far is kept.
- **Alternate tunings and extended range** (Drop D, DADGAD, 7-string, 6-string bass): tab and
  positions follow the active instrument. Notation shows the pitches actually played (written an
  octave up, FR-005), not the shapes as if in standard tuning.
- **Instrument changed after transcribing**: the transcription keeps its own instrument. Opening
  it on another instrument offers to re-map positions with the optimizer, as a copy.
- **Effects-heavy signal** (015's clean/effected classifier): a notice says accuracy may drop.
- **Very fast passages beyond the grid**: they're quantised to the finest grid allowed and flagged.
- **Import of a malformed or oversized MusicXML file**: rejected as a whole with a readable message
  (same rules as other imports: size checked first, schema validated, no partial import).
- **Storage full**: saving fails atomically, with a message and a link to export.

- **Input lost mid-take** (disconnect, audio suspended): capture stops, the notes so far are kept
  and transcribed, 018's disconnect state shows, and the user can continue in a new take (FR-027). 015 owns reconnection.
- **Live session length**: a Live session stops after 10 minutes with a notice; the transcription so
  far is kept.

## Requirements *(mandatory)*

### Functional Requirements

FR IDs are kept stable from the first draft and grouped by topic, so they are not in numeric order.

**Evaluation first**

- **FR-001**: The held-out evaluation set with note, position, onset, tempo and technique labels
  (007) MUST exist before transcription code (Constitution III, X), and MUST include clips for
  every built-in instrument family (6-string guitar, 4-string and 5-string bass), including
  strummed-chord clips recorded on a laptop mic.
- **FR-009**: Accuracy MUST be reported per instrument against a baseline pipeline (YIN + onset
  detector + nearest-position mapping), separately for Live and Record, and separately for
  interface and built-in-mic input, per instrument, including the 5-string's low B.

**Transcription**

- **FR-002**: Transcription MUST produce note events (pitch, onset, duration, string, fret,
  confidence, position source: fused | estimated | user) for the active InstrumentProfile.
- **FR-003**: Positions MUST come from fused events (010) when available, else from 005's
  fingering optimizer over the detected pitches. Users MAY set a preferred fret region, which is
  passed to the optimizer as a preference, not a constraint.
- **FR-004**: Tempo, beat and meter estimation and quantisation (down to 16ths and triplets) MUST
  be provided, with a tempo map for tempo changes. The finest quantisation grid MUST be a user
  setting: off, 8ths, 16ths (default), 16ths + triplets, saved per profile.
- **FR-010**: The Studio MUST offer three input sources: **Live** (continuous, shown as it is
  played), **Record** (a take of up to 2 minutes, transcribed on stop), and **Demo clip** (018 FR-022
  clips, no permission needed), plus **Blank score** (FR-006's empty start). The first visit MUST
  show each source with a one-line plain explanation, with Demo clip marked "no microphone
  needed". Before the first permission request, the Studio uses 018 FR-007a's screen; Not now
  offers Demo clip and Blank score. Importing an audio or video file is not a source in v1.0.
- **FR-011**: In Live mode, each detected note MUST appear in the tab within 500 ms of its onset
  (p95, per instrument, on the reference setup named in 001's plan and ADR-0002), reported
  separately with the camera off and on. It is measured from the labelled onset in a clip played
  through the live input path in real time, to the first frame in which the note is drawn. Live
  mode MUST also meet Constitution V's onset acknowledgement (≤ 30 ms) and ADR-0002's
  pitch-confirmed budgets. Estimated positions MAY change for up to 2 s after the note while
  look-ahead context arrives, and MUST be visibly marked as provisional, by a marker that isn't
  colour alone, until they settle. The first time a provisional position changes for a profile, a
  one-line inline hint explains that positions settle as more notes arrive; it shows once. Screen
  readers get a polite summary at most once per bar ("Bar 4: 6 notes"), with full detail on pause. Quantisation MAY be refined when the user stops. Phones are
  reported, not gated.
- **FR-008**: Mic and camera are used only while Live or Record is active, with 018's visible
  "listening" and "camera on" indicators (018 FR-035). All processing is on the device. Raw audio
  and video MUST be held in memory only, never in temporary or browser storage, and discarded as
  soon as the take is processed, abandoned or declined. Keeping the raw audio of a take MUST be a
  per-take opt-in, off by default, chosen before the take or answered in a "Keep the recording of
  this take?" prompt when it stops; until it's answered, the audio stays in memory only, and it's
  discarded on decline or on leaving the screen. Keeping video MUST be a separate opt-in, offered
  in the same two places.
  Without them, only note events are stored (Constitution IX). This feature MUST add its stored-
  media rows to `docs/THREAT-MODEL.md` and pass privacy-auditor.
- **FR-021**: Live and Record MUST offer an optional click and count-in (1–2 bars) at a user-set
  tempo (40–240 BPM) and meter. When the click is on, quantisation uses that grid and tempo estimation is skipped. The click and
  count-in MUST NOT be mixed into a kept recording, and the click's own sound MUST NOT be
  transcribed as notes. When the input is a built-in mic and the click plays through the
  speakers, a one-line notice recommends headphones.
- **FR-022**: Transcription MUST offer quality tiers (Constitution XI) chosen by 016 FR-017: low (DSP
  pitch and onsets, no fusion), medium (ML audio models, no vision), high (ML audio plus fusion when the camera is on; with the camera off,
  high runs as medium and says so once). The
  DSP path MUST always be selectable, and a failed model load MUST fall back one tier with a notice.

**Rendering and editing**

- **FR-005**: Output MUST render as tab (one line per string, from the profile) and standard
  notation, aligned bar by bar, with technique symbols when available. Notation is written one
  octave above the sounding pitch for both families: guitar on a treble clef marked with an 8
  below, bass on a bass clef (the octave transposition is encoded in exports for both). Notes are
  spelled by the theory engine (001 FR-001–FR-007) in the transcription's key, which is estimated
  from the pitches and editable; the key signature follows it. Notation MUST show rests, ties
  across bar lines, and chords as stacked notes in one voice per staff. Users MUST be able to show
  tab and notation, tab only, or notation only, saved per profile. Estimated, provisional and
  low-confidence notes MUST each have a distinct non-colour marker with an on-tab legend, keep at
  least 3:1 contrast in both themes, and include their state in the text alternative.
- **FR-006**: The editor MUST support inserting, deleting and correcting pitch, position, duration
  and technique; changing tempo, meter and bar lines; pinning a note's position; starting from an
  empty transcription; changing the key; and undo and redo of every change. Each edit MUST show
  within 100 ms (p95) for transcriptions of up to 2 minutes. Every edit MUST be possible by
  keyboard (no drag-only actions): Left and Right move between notes, Up and Down change string
  (an FR-012 refusal is announced), digits type a fret, and documented shortcuts set duration and
  technique, listed in the Docs and in an in-editor help panel. A screen reader MUST announce the selected note (string, fret,
  pitch, duration, bar and beat). The editor MUST work at 390 px (Constitution VI). The
  low-confidence threshold below which notes are greyed MUST be a user setting, and greyed notes
  also carry a non-colour marker.
- **FR-012**: When a pitch is edited, its position MUST be re-chosen by the fingering optimizer,
  unless pinned. A move to a string that can't play the pitch MUST be refused, with the reason.
- **FR-013**: User corrections of detected notes MUST be recorded as corrections. A correction is
  eligible for 007's active learning only if the take's recording was kept, the profile has 007's
  active-learning opt-in on, and the user gives 007's per-item share consent (007 FR-027, FR-028).
  An eligible correction contributes a segment of at most 10 s around
  the corrected note, counted against 007's daily cap. Without a kept recording, corrections stay
  in the transcription only.

**Playback**

- **FR-014**: Playback MUST support play, pause and stop, a cursor on the sounding note in tab and
  notation, speed from 25% to 200% without changing pitch, a loop of any bar range, and a count-in.
  Notes MUST sound within ±10 ms of their scheduled times, measured on the rendered audio output,
  and the cursor MUST be within ±30 ms of the sounding note. When the take's recording was kept,
  the user MUST be able to switch between the recording (played at 100% speed) and the synthesised
  transcription.

**Export and import**

- **FR-007**: Export MUST support MusicXML (with a tab staff carrying string and fret, and a notation
  staff), PDF and plain-text tab in v1.0. Guitar Pro export follows after v1.0. Import of MusicXML MUST round-trip a FretSense
  export exactly for this field set: spelled pitch, onset and duration in beat units (MusicXML
  divisions), string, fret, techniques, tempo map, meter, key, and the instrument's tuning.
  FretSense-only fields (confidence, position source, pinned flag, corrections) MUST travel in
  MusicXML's extension data, which other applications ignore. Unquantised passages are exported
  quantised to the finest grid, with a notice. Each export option MUST have a one-line plain
  description, with plain-text tab and PDF listed first. User-facing notices MUST NOT use
  "quantise", "tempo map" or "proportional" without a glossary link. 
- **FR-015**: Every export MUST be produced on the device, offline. MusicXML exports MUST validate
  against the MusicXML schema. MusicXML exports (and Guitar Pro exports, once they ship) MUST open in at least one
  independent notation application, named in the plan, checked by a scripted import and note
  comparison where that application can be scripted, and otherwise by a per-release manual
  checklist. Plain-text tab exports MUST be parsed back in a test and match the note events.
- **FR-016**: Plain-text tab MUST follow a documented fixed-width layout: one labelled line per
  string (highest string at the top), bar lines, fret numbers, technique letters, and a header with
  title, tuning and tempo.
- **FR-017**: PDF export MUST include the title, tempo, meter, tab and notation, break pages at bar
  lines, use A4 or Letter (default from the locale), and be legible in greyscale: every glyph has a
  contrast ratio of at least 4.5:1 against the page after greyscale conversion.
- **FR-018**: MusicXML import MUST reject malformed, oversized or unsupported files as a whole,
  with a readable message (size checked before parsing, schema validated, no partial import).

**Library and data**

- **FR-019**: Transcriptions MUST be profile-scoped, sync-ready records (001 FR-066), merged by 001
  FR-066a and included in the profile export (016 FR-004), with name, created and modified
  times, instrument geometry, source (live | record | demo | blank | import), and whether a
  recording is attached. Users MUST be able to rename, duplicate, delete and search them. Search
  matches name and instrument, with a date-range filter, and results show the instrument, date,
  length and whether a recording is attached.
- **FR-020**: Kept recordings MUST be stored only on the device, listed with their size, and
  deletable separately from the transcription. They are never part of the profile export (they can
  be exported as a separate file on request), and are always excluded from 013 sync.
- **FR-023**: The Studio's **Demo clip** source opens a bundled clip in the user's own profile, and its
  transcription can be saved there. It is separate from 018's demo mode, which runs in a temporary demo profile and never writes to a user profile (018 FR-023). Demo clips
  download on demand as in 018 FR-025. Offline before the first download, Demo clip shows 018's
  "needs a one-time download" notice, and Blank score stays available.
- **FR-024**: The library MUST have loading and empty states (018 FR-018). The empty state explains the sources and offers a demo clip.

- **FR-025**: When the active pipeline is monophonic and a strum or polyphony is detected, the Studio
  MUST show one notice ("This device transcribes single notes; chords aren't supported yet") with a
  Docs link, instead of filling the tab with low-confidence notes.
- **FR-026**: When the input is a built-in mic and the instrument's lowest open string is below the instrument family's mic-reliable frequency (the lowest pitch
  band whose built-in-mic note F1 under FR-009 meets the threshold set at plan time, stored per
  family), a warning MUST show before Live or Record starts.
- **FR-027**: If the input disconnects or audio is suspended during Live or Record, capture MUST stop,
  the notes so far MUST be kept and transcribed, 018's disconnect state shows, and the user can
  continue in a new take. An automated hot-unplug test checks that 0 captured notes are lost.

### Key Entities

- **Transcription**: profile, name, instrument geometry, source, tempo map, meter, note events,
  technique marks, corrections, provenance (model and baseline versions), schema version.
- **Note event**: pitch, onset, duration, string, fret, confidence, position source, pinned flag,
  techniques.
- **Recording** (optional, per-take opt-in): audio (and video if the camera was on), linked to one
  transcription, stored on the device only.
- **Correction**: the original detected value, the user's value, and whether it may be shared
  (007).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Note-level F1 (pitch + onset ±50 ms) ≥ 0.85 on monophonic held-out clips, and above
  the baseline pipeline, per instrument, for Record. Live is reported separately, and is at most
  0.05 below Record.
- **SC-002**: Position accuracy (string, fret), per instrument, on 012's held-out set: ≥ 90% with
  fusion under 010's normal conditions, and ≥ 75% optimizer-only (positions are inherently ambiguous
  without vision).
- **SC-003**: Tempo within ±2 BPM on ≥ 90% of steady-tempo clips. ≥ 90% of onsets on the correct
  grid position.
- **SC-004**: A 2-minute recording is transcribed in ≤ 30 s on the reference laptop.
- **SC-005**: Live mode meets FR-011 (≤ 500 ms p95 to appear) per instrument, in a committed
  benchmark.
- **SC-006**: 100% of fixture transcriptions round-trip through MusicXML exactly. 100% of MusicXML
  exports validate against the schema. Every MusicXML fixture export opens in the
  independent application named in the plan, with matching notes.
- **SC-007**: Playback timing meets FR-014 (±10 ms) at 25%, 100% and 200% speed in an automated
  test.
- **SC-008**: In timed runs with at least 5 testers (the owner and at least one other person), the
  median time from opening Studio to an exported tab of a 4-bar riff is ≤ 3 minutes, including at
  least one correction.
- **SC-009**: With "keep recording" off, or the "Keep the recording of this take?" prompt declined
  or abandoned, an automated scan of every storage area (including
  temporary and cache storage) after Live and Record sessions finds 0 bytes of stored audio or
  video.
- **SC-010**: Polyphonic (chord) note F1 is reported per instrument against the baseline. In v1.0
  it is reported, not gated, unless 009 sets a margin.

## Assumptions

- The notation renderer is chosen at plan time by ADR. alphaTab is the proposed choice (tab and
  notation together, guitar and bass, a playback cursor, Guitar Pro support for later); VexFlow
  and OpenSheetMusicDisplay are the alternatives to compare.
- Studio playback is synthesised on the device, as in 017.
- Technique marks depend on 011. Without it, the user adds them by hand.
- Every timing gate in this spec (FR-006, FR-011, FR-014, SC-004, SC-005, SC-007) runs on 001's
  reference setup. Naming it (001 open items O1 and O2) is a precondition for 012's plan.
- The Studio is a standalone tool in v1.0, always reachable (Constitution XIII). No lesson stage
  depends on it; linking lessons' Play stage into it is a later decision.
- The 2-minute take limit matches SC-004's processing budget. Longer takes are a later decision.

## Clarifications

### Session 2026-11-22 (owner accepted every recommended answer)

- Q: Which export formats ship first? → A: v1.0 ships MusicXML (export and import), PDF and
  plain-text tab. Guitar Pro follows after v1.0 (FR-007, US5).
- Q: Can users import their own audio or video file as a source? → A: Not in v1.0. Later, only for
  the user's own recordings (FR-010).
- Q: May a take's audio stay in memory until a "keep?" prompt after the take? → A: Yes, memory only,
  discarded on decline or on leaving the screen, with a privacy-auditor review (FR-008).
- Q: Is chord (polyphonic) accuracy a ship gate? → A: Reported in v1.0, gated only if 009 sets a
  margin (SC-010).
- Q: Confirm Live within 500 ms, Live stops after 10 minutes, kept recordings play at 100% only?
  → A: Confirmed (FR-011, Edge Cases, FR-014).
- Q: Which notation renderer? → A: alphaTab is proposed; the final choice is an ADR at plan time
  (Assumptions).
