# Feature Specification: Automatic Transcription to Tab and Notation

**Feature Branch**: `012-transcription-tab-notation`

**Created**: 2026-11-21

**Status**: Draft (specify only; clarify/plan pending)

**Input**: User description: "Automatic transcription: record yourself playing → tab and notation output, with rhythm and onset detection."

**Practice-session value**: the owner records a riff, line or improvisation and gets readable tab
and notation for their instrument. They can review what they actually played, save ideas, and
compare against a target.

**Depends on**: 003 (onsets, tempo), 009 (notes) or 002 (monophonic fallback), 005 (fingering
optimizer, to choose playable positions), 010 (fused positions, optional), 011 (technique
markings, optional), 007 (consented recording).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record → Tab (Priority: P1)

The owner records (with opt-in) up to 2 minutes, and gets tab for the active InstrumentProfile.
Positions come from fusion when the camera is on, otherwise from the fingering optimizer.

**Why this priority**: Tab is the format the owner reads most.

**Independent Test**: Transcribe held-out labelled clips, and compare notes, positions and onsets
against the labels.

**Acceptance Scenarios**:

1. **Given** a monophonic guitar riff at 100 BPM, **Then** the tab lists the notes with positions,
   quantised to the detected beat grid.
2. **Given** a 5-string bass line, **Then** 5-line tab is produced.

---

### User Story 2 - Rhythm and Notation (Priority: P1)

The system estimates tempo and meter, quantises onsets to a grid (up to 16ths and triplets), and
renders standard notation alongside tab (bass clef for bass, treble 8vb for guitar).

**Why this priority**: Rhythm is half of a transcription.

**Independent Test**: Compare tempo, beat positions and quantised durations against labels.

**Acceptance Scenarios**:

1. **Given** a clip with a steady tempo, **Then** the tempo estimate is within ±2 BPM and ≥ 90% of
   onsets are quantised to the labelled grid position.

---

### User Story 3 - Edit and Export (Priority: P2)

The owner corrects notes, positions and rhythms in the editor (corrections may feed 007 active
learning with opt-in) and exports to a standard interchange format and PDF.

**Why this priority**: Automatic output is never perfect. Corrections make it useful and improve
the models.

**Independent Test**: Edit fixture transcriptions, export, re-import, and verify the round trip.

**Acceptance Scenarios**:

1. **Given** an edited transcription, **When** exported and re-imported, **Then** it is identical.

---

### Edge Cases

- Rubato or tempo changes: a tempo map is supported. If it can't be estimated, the output is
  unquantised "proportional" notation with a notice.
- Polyphony beyond model support: notes are flagged low-confidence and shown greyed.
- Techniques (from 011) are shown as tab symbols when available (b, /, h, p, ~, P.M.).
- Recording denied or not opted in: the feature is unavailable. Nothing is recorded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The held-out evaluation set with note, position, onset, tempo and technique labels
  (007) MUST exist before transcription code (Constitution III, X).
- **FR-002**: Transcription MUST produce note events (pitch, onset, duration, string, fret,
  confidence) for the active InstrumentProfile.
- **FR-003**: Positions MUST come from fused events (010) when available, else from 005's fingering
  optimizer over the detected pitches.
- **FR-004**: Tempo, beat and meter estimation and quantisation (to 16ths and triplets) MUST be
  provided, with a tempo map for tempo changes.
- **FR-005**: Output MUST render as tab (string count per profile) and standard notation (clef per
  family), with technique symbols when available.
- **FR-006**: The editor MUST support correcting pitch, position, duration and technique, with
  undo/redo.
- **FR-007**: Export MUST support at least one standard interchange format and PDF. Import of the
  exported format MUST round-trip.
- **FR-008**: Recording requires opt-in, and processing is on-device (Constitution IX).
- **FR-009**: Accuracy MUST be reported per instrument against a baseline pipeline (YIN + onset
  detector + nearest-position mapping).

### Key Entities

- **Transcription**: profile, tempo map, meter, note events, technique marks, provenance, version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Note-level F1 (pitch + onset ±50 ms) ≥ 0.85 on monophonic held-out clips, and above the
  baseline pipeline, per instrument.
- **SC-002**: Position accuracy (string, fret) ≥ 90% with fusion, and ≥ 75% optimizer-only (positions
  are inherently ambiguous without vision).
- **SC-003**: Tempo within ±2 BPM on ≥ 90% of steady-tempo clips; ≥ 90% of onsets on the correct grid
  position.
- **SC-004**: A 2-minute recording is transcribed in ≤ 30 s on the reference laptop.

## Assumptions

- The interchange format (e.g. MusicXML or Guitar Pro-compatible) is chosen at plan time via ADR.
