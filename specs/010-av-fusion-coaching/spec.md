# Feature Specification: Audio-Visual Fusion and Camera Coaching

**Feature Branch**: `010-av-fusion-coaching`

**Created**: 2026-11-21

**Status**: Draft (specify only; clarify/plan pending)

**Input**: User description: "Audio-visual fusion: audio says WHICH notes are sounding, vision says WHERE on the neck. Fuse them into the exact (string, fret). Compare a rules-based fusion against a probabilistic one (HMM or Bayesian combination of likelihoods). Lessons follow Read → See → Drill → Play → Camera-coach; the coach overlays target finger positions and flags wrong frets or fingers, muted strings and timing drift."

**Practice-session value**: the same pitch can be played in up to five places on the neck. Only
fusion can tell the user "right note, wrong position" or "string 4 is muted". That is the feedback
a teacher gives while watching you play.

**Depends on**: 015 (audio devices, A/V offset calibration), 002/003 (pitch, onsets, timing), 008 (positions), 009 (polyphonic notes, optional),
001 (lessons; Camera-coach stage). Feature-flagged; off by default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fused (String, Fret) per Played Note (Priority: P1)

For each detected note onset, the system combines the audio pitch evidence with the vision
position evidence and reports the exact (string, fret, finger), with a confidence.

**Why this priority**: The core capability. Coaching depends on it.

**Independent Test**: On held-out synchronised audio+video clips with (string, fret) labels, compare
the fused output against audio-only and vision-only estimates.

**Acceptance Scenarios**:

1. **Given** a note whose pitch exists at several positions, **Then** fusion picks the one matching
   the fretting hand, and its accuracy exceeds both single-modality estimates.
2. **Given** vision is lost mid-phrase, **Then** fusion degrades to audio-only position priors with
   lowered confidence. It never stalls.

---

### User Story 2 - Rules vs Probabilistic Fusion (Priority: P1)

Two fusion strategies are implemented behind one interface and evaluated on the same held-out set:
(a) rules (pick the vision position whose pitch matches the audio, within tolerance); (b)
probabilistic (combine audio and vision likelihoods over candidate positions, with a temporal model
across notes).

**Why this priority**: The owner's brief asks for an evidence-based choice. The simpler rule wins
unless the probabilistic model is measurably better.

**Independent Test**: Run the harness and compare accuracy, robustness cells and latency.

**Acceptance Scenarios**:

1. **Given** the evaluation, **Then** both strategies' accuracy, per-condition results, latency and
   failure analyses are committed, and the default is set by SC-002.

---

### User Story 3 - Camera-Coach Lesson Stage (Priority: P2)

In a lesson's Camera-coach stage, target finger positions are overlaid on the camera view. As the
user plays, the coach flags wrong fret, wrong string, wrong finger, muted or dead strings, and
timing drift against the target rhythm.

**Why this priority**: This is the lesson stage the whole vision and ML stack exists for.

**Independent Test**: Replay labelled clips containing deliberate errors, and verify each error type
is flagged with the stated precision and recall.

**Acceptance Scenarios**:

1. **Given** a target C major chord shape, **When** string 2 is muted by a finger, **Then** the coach
   flags "string 2 muted" within 300 ms of the strum.
2. **Given** a target sequence at 80 BPM, **When** the user drifts by more than 40 ms on average over
   4 beats, **Then** "timing drift: late/early" is shown.
3. **Given** the camera is off, **Then** the stage offers audio-only coaching (pitch and timing only).

---

### Edge Cases

- Audio and video clocks out of sync: 015's calibration measures the offset (clap/pluck test). If
  the drift exceeds the tolerance, fusion is disabled and the user is told.
- Open strings (no fretting finger): vision evidence is "no finger on string". Fusion uses audio plus
  the open-string prior.
- Harmonics, bends and slides: flagged as unsupported by fusion until 011. Not mis-scored.
- Bass: positions per InstrumentProfile, using the bass latency budget (ADR-0002).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A synchronised audio+video held-out evaluation set (from 007) with per-note (string,
  fret, finger, onset) labels and injected-error clips MUST exist before any fusion code.
- **FR-002**: Fusion MUST consume note events (002/009) and position events (008) from the real-time
  event bus and publish fused note events.
- **FR-003**: The rules-based and probabilistic strategies MUST implement one fusion interface and be
  switchable at runtime.
- **FR-004**: Fused (string, fret) accuracy MUST be reported per instrument and condition, with CIs,
  against audio-only (position prior) and vision-only baselines.
- **FR-005**: Fusion MUST apply the A/V offset measured by 015's calibration (015 FR-015) and be
  disabled if no valid calibration exists. It MUST monitor in-session drift (the median residual
  between fused audio and visual onsets over the last 20 notes) and disable fusion, with a
  recalibration prompt, if the drift exceeds 30 ms.
- **FR-006**: The coach MUST detect and flag: wrong fret, wrong string, wrong finger, muted/dead
  string (expected but not sounding), and timing drift (mean absolute onset error over a 4-beat
  window > a configurable threshold, default 40 ms).
- **FR-007**: The Camera-coach stage MUST read targets (positions, fingers, rhythm) from the lesson's
  `camera_coach` section (001 FR-022, reserved there).
- **FR-008**: Fusion and coaching MUST be behind a feature flag, off by default, and degrade to
  audio-only coaching (Constitution XI).
- **FR-009**: Processing MUST stay on the device. No frames or audio leave it (Constitution IX).

### Key Entities

- **Fused note event**: onset, pitch, (string, fret, finger), confidence, strategy, source evidence.
- **Coach target**: positions, fingers, rhythm grid, tolerances.
- **Coach flag**: type, note/beat reference, severity, timestamp.
- **A/V calibration**: measured offset, residual, timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fused (string, fret) accuracy ≥ 95% on held-out guitar clips (normal conditions),
  exceeding the best single modality by ≥ 5 pp (lower CI bound > 0), reported per instrument.
- **SC-002**: The probabilistic strategy becomes the default only if its accuracy beats the rules
  strategy (lower CI bound of Δ > 0) and its added latency is ≤ 10 ms p95. Otherwise rules stay the
  default.
- **SC-003**: Coach error flags reach precision ≥ 0.85 and recall ≥ 0.80 per error type on the
  injected-error set.
- **SC-004**: Note onset → coach flag displayed in ≤ 300 ms p95.

## Assumptions

- The temporal model of the probabilistic strategy (e.g. HMM-style smoothing over positions) and its
  comparison against rules are decided in research.md/ADR at plan time.
- 011 extends coaching to technique events.
