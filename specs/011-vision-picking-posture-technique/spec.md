# Feature Specification: Vision II: Picking Hand, Posture and Technique Events

**Feature Branch**: `011-vision-picking-posture-technique`

**Created**: 2026-11-21

**Status**: Draft (specify only; clarify/plan pending)

**Input**: User description: "Picking or strumming hand: strum direction, pick vs fingerstyle, and which string is being picked. Posture and technique: wrist angle, thumb position and tension cues, using pose estimation. Technique events from video: bends, slides, hammer-ons, pull-offs, vibrato and palm muting, detected with a temporal model over landmark sequences. Robustness: lighting, camera angle, left-handed players, guitar vs bass neck geometry."

**Practice-session value**: the user gets feedback a mirror can't give: "you're strumming all
downstrokes", "your wrist is bent sharply", "that was a slide, not a hammer-on". It also adds
technique scores over time to the dashboard (006).

**Depends on**: 008 (neck geometry, hand tracking), 007 (labelled technique datasets, pipeline),
003 (onsets, for alignment). Feature-flagged; off by default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Picking-Hand Analysis (Priority: P1)

The app detects strum direction (down/up), pick vs fingerstyle, and the picked string (or string
range for strums).

**Why this priority**: Rhythm and picking accuracy are core practice targets, on guitar and bass.

**Independent Test**: Held-out labelled clips: strum-direction accuracy, pick/finger classification,
picked-string accuracy, per instrument.

**Acceptance Scenarios**:

1. **Given** a down-up strumming pattern at 90 BPM, **Then** ≥ 90% of strokes are labelled with the
   correct direction, aligned to onsets.
2. **Given** bass fingerstyle playing, **Then** "fingerstyle" is detected and the plucked string is
   reported per note.

---

### User Story 2 - Posture and Tension Cues (Priority: P2)

Pose estimation measures fretting-wrist angle, fretting-thumb position (behind the neck vs over the
top), and tension cues (e.g. a raised shoulder, a clenched picking hand). Cues are shown as gentle,
dismissable hints. These are not medical advice.

**Why this priority**: Prevents bad habits and strain, but cues must be reliable or they become noise.

**Independent Test**: Compare measured angles with labelled reference angles (protractor-measured
or annotated), and check hint precision on labelled clips.

**Acceptance Scenarios**:

1. **Given** a wrist flexion above the threshold for > 5 s, **Then** a single hint is shown, rate
   limited to once per 5 minutes.

---

### User Story 3 - Technique Event Detection (Priority: P1)

A temporal model over landmark sequences (plus optional audio features) detects bends, slides,
hammer-ons, pull-offs, vibrato and palm muting, with time spans and strings.

**Why this priority**: Technique is what separates notes from music. It feeds coaching and
transcription (012).

**Independent Test**: Event-level precision, recall and F1 per technique on held-out sessions,
against a rules-based baseline (landmark-velocity thresholds plus pitch-contour rules).

**Acceptance Scenarios**:

1. **Given** held-out clips, **Then** per-technique event F1 (with temporal IoU ≥ 0.5), a confusion
   matrix across techniques, and per-instrument results are committed against the baseline.

---

### Edge Cases

- Picking hand out of frame or occluded by the body: no picking events; a framing hint is shown.
- Left-handed players: the hand roles swap via the handedness setting; evaluated with mirrored and
  real clips.
- Bass-specific techniques (slap/pop): out of scope; reported as "unknown technique", not
  misclassified.
- Pose estimation unavailable on the device: posture features are disabled; the rest continues.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Labelled datasets (strokes, techniques, posture references), split by session, MUST
  exist with cards (007) before any model or tracker code (Constitution III, X).
- **FR-002**: Picking analysis MUST output per-stroke direction, pick/finger mode and string(s),
  aligned to audio onsets when available.
- **FR-003**: Posture analysis MUST output fretting-wrist angle, thumb position class, and
  tension-cue flags with confidences. Hints MUST be rate limited and dismissable, and say plainly
  that they are not medical advice.
- **FR-004**: Technique detection MUST output events (type, start, end, string, confidence) for bend,
  slide, hammer-on, pull-off, vibrato and palm mute.
- **FR-005**: Every model MUST beat its rules-based baseline (lower CI bound of Δ F1 > 0) and meet
  Constitution X (card, held-out set, per-instrument metrics, export and quantisation per 007).
- **FR-006**: Technique and picking scores MUST be published to the event bus, and as aggregates to
  006's dashboard (006 FR-023).
- **FR-007**: All of this MUST run on the device behind a feature flag, off by default. Raw frames
  and landmarks are never persisted without opt-in (Constitution IX, XI).
- **FR-008**: Robustness MUST be reported per condition cell (lighting, angle, handedness, instrument),
  using 008's condition definitions.

### Key Entities

- **Stroke event**, **Posture sample**, **Technique event**, **Technique score aggregate**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Strum-direction accuracy ≥ 90%, and picked-string accuracy ≥ 85% on single-note
  passages, per instrument (held-out).
- **SC-002**: Technique event F1 ≥ 0.75 macro-average, ≥ baseline + 0.10, per instrument where data
  exists.
- **SC-003**: Wrist-angle error ≤ 10° median against references. Posture-hint precision ≥ 0.85.
- **SC-004**: Combined vision pipeline (008 + 011) runs at ≥ 20 fps on the reference laptop with GPU.

## Assumptions

- Temporal model architecture choices are made in research.md/ADR at plan time.
- Posture cues are practice hints only, with no health claims.
