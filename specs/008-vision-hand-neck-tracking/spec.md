# Feature Specification: Vision I: Fretting-Hand and Neck Tracking → (String, Fret, Finger)

**Feature Branch**: `008-vision-hand-neck-tracking`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Webcam-based, real time, entirely on the device. Fretting hand: 21-point hand landmarks, which finger is on which string and fret, fingertip → (string, fret) through a homography. Neck and fretboard: detect the neck, frets and strings; version 1 uses ArUco fiducial markers, version 2 a custom-trained keypoint model with no markers. Robustness: lighting, camera angle, left-handed players, guitar vs bass neck geometry. Camera and ML features sit behind feature flags, off by default."

**Practice-session value**: vision is an **assistant the user can turn on** (Constitution XI,
XIII). With it on, a user can answer fretboard drills *silently*, by fretting the note instead of
tapping the screen, and sees live fretboard highlighting of their fingers on the on-screen neck, building the
link between the diagram and the real instrument. This also provides the "where on the neck" half
needed later for fusion and camera coaching (010).

**Depends on**: 001 (InstrumentProfile, scale length, drills, handedness setting FR-017), 016 (My Gear
camera entry, quality tiers), 007
(labelled video datasets, evaluation harness, registry for the v2 keypoint model), 015 (audio
onsets, used for "pressed" ground truth; A/V offset calibration). **Lesson tracks**: the Drill
stage of the notes-on-the-neck track gains silent answers first. **Human-owned** (Constitution IV): the
homography estimation and the pixel → (string, fret) mapping math.

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Guided Camera Setup (Priority: P1)

The user turns the camera assistant on. A setup wizard shows a live preview, checks camera angle,
lighting and neck visibility (and the fretting hand), suggests fixes, asks which neck mode they want
(markers: most accurate; markerless: when v2 ships), then calibrates. It recommends a stand facing
the neck at about 30° but accepts any reasonable angle, for right- and left-handed players.

**Why this priority**: Every user's room, camera and instrument differ; without a guided setup, the
assistant fails silently.

**Independent Test**: Replay fixture clips covering good and bad framing, angles, lighting and both
handednesses through the wizard and verify each check's verdict and hint.

**Acceptance Scenarios**:

1. **Given** the neck is partly out of frame, **Then** the wizard says which end is cut off and
   doesn't proceed to calibration until it is visible (or the user chooses "continue anyway").
2. **Given** a ~45° side angle (inside the warn band, FR-022), **Then** the wizard accepts it, warns
   that accuracy may be lower, and calibrates.
3. **Given** a left-handed player (001 FR-017 handedness), **Then** every check and the calibration
   work mirrored, with no extra steps.
4. **Given** the user closes the wizard at any point, **Then** the camera stops, the indicator goes
   off, and the app continues without vision.

---

### User Story 1 - Marker-Based Neck Calibration, v1 (Priority: P1)

The user who chose marker mode attaches fiducial marker stickers at defined points on the neck (e.g. near the nut and
the 12th fret, on the edge of the fingerboard or the headstock). The app detects the markers, fits
the neck plane, and overlays a fret/string grid computed from the active InstrumentProfile's
scale length and string count onto the camera image.

**Why this priority**: You can't map anything without the geometry. Markers make v1 reliable
enough to collect ground truth and to evaluate everything else. Markers are optional for users:
marker mode is the most accurate; markerless mode is the v2 goal (US6). Users choose.

**Independent Test**: On recorded fixture clips with surveyed marker positions, verify that the
projected fret and string lines fall within the pixel tolerance of the hand-labelled fret wires
and strings.

**Acceptance Scenarios**:

1. **Given** the camera and markers are visible, **When** calibration starts, **Then** the grid
   overlay locks on within 10 s and shows a quality indicator (reprojection error).
2. **Given** a 5-string bass profile, **Then** the grid shows 5 strings and fret spacing for an
   864 mm scale. **Given** a 6-string guitar profile, **Then** 6 strings at 648 mm.
3. **Given** markers are briefly occluded (hand passing), **Then** the grid holds its last good
   pose for up to 1 s and then shows "tracking lost" instead of a wrong grid.
4. **Given** a left-handed player (the neck points the other way in the image), **Then**
   calibration and the grid work the same after the handedness setting is chosen.

---

### User Story 2 - Fretting-Hand Landmarks (Priority: P1)

The app tracks the fretting hand's 21 landmarks in real time and identifies the fretting hand
(left hand for right-handed players, and the reverse).

**Why this priority**: The fingertips are the measurement. Everything downstream depends on them.

**Independent Test**: Run on the labelled clip set and compare the fingertip landmark error with
the labelled fingertip points per condition.

**Acceptance Scenarios**:

1. **Given** the reference laptop and camera, **When** tracking runs, **Then** fps and per-frame
   processing time are shown in the performance overlay and meet SC-004.
2. **Given** both hands are visible, **Then** the fretting hand is correctly identified using the
   handedness setting and its position relative to the neck.
3. **Given** the hand leaves the frame, **Then** no positions are reported. There are no ghost
   fingers.

---

### User Story 3 - Fingertip → (String, Fret, Finger) (Priority: P1)

For each fretting fingertip near the fingerboard, the app reports (string, fret, finger) with a
confidence, stabilised over time. Each fingertip is projected through the neck-plane mapping, and
"pressing" is distinguished from "hovering".

**Why this priority**: This is the core vision output that drills, fusion and coaching consume.

**Independent Test**: On held-out labelled clips, compare per-frame predicted (string, fret,
finger) with the labels, per instrument and per condition.

**Acceptance Scenarios**:

1. **Given** the user frets string 3 fret 5 with the ring finger, **Then** the app reports
   (3, 5, ring) with confidence ≥ the display threshold within the latency of SC-005.
2. **Given** a finger hovering above the fingerboard without pressing, **Then** it is shown as
   "hovering", not reported as fretted.
3. **Given** a barre with the index finger, **Then** the index finger is reported across the
   covered strings at that fret (string set flagged lower-confidence).
4. **Given** confidence below the threshold, **Then** the position is shown as uncertain and is not
   used to score drill answers.

---

### User Story 4 - Silent Fretting Answers in Drills (Priority: P2)

With the camera enhancement enabled, 001's note-finding and interval drills accept "fret the
note and hold for 500 ms" as an answer, alongside taps.

**Why this priority**: The first real practice payoff from vision. It trains the hand, not the
screen.

**Independent Test**: Replay labelled clips of the owner fretting drill answers through the drill
engine, and verify correctness judgements and response times against labels.

**Acceptance Scenarios**:

1. **Given** the prompt "Find G on string 6", **When** the user frets string 6 fret 3 and holds,
   **Then** the answer is accepted and the response time is measured to hold onset.
2. **Given** tracking is lost or confidence is low, **Then** the drill falls back to tap input with
   a notice. It never mis-scores silently.

---

### User Story 5 - Robustness Evaluation Matrix (Priority: P2)

Accuracy and speed are measured across a fixed condition matrix: lighting (bright, normal, dim),
camera angle (frontal, ~30° side, ~30° above), handedness (right, left via mirrored and real
clips), and instrument (guitar, 4-string bass, 5-string bass).

**Why this priority**: Constitution VIII and X. "It works on my desk" isn't evidence.

**Independent Test**: Run the evaluation harness on the frozen held-out condition set and check that
every cell of the matrix is reported with sample counts and CIs.

**Acceptance Scenarios**:

1. **Given** the evaluation run, **Then** a table of metrics per condition cell is committed, with
   cells below the minimum sample count marked "insufficient data", never omitted.
2. **Given** a cell below its target, **Then** the app's setup guide warns about that condition
   (e.g. "dim light reduces accuracy; add light").

---

### User Story 6 - Markerless Neck Keypoints, v2 (Priority: P3)

A keypoint model detects the neck outline, nut, fret wires and string ends with no markers.
It is trained with 007, using v1 marker-based geometry as automatic ground truth plus owner
corrections (the owner runs every training experiment, Constitution IV). It ships only if it beats a classical-vision baseline and stays within the stated
margin of v1.

**Why this priority**: Removes the stickers (convenience), and is a real trained-model showcase,
but v1 already delivers the practice value.

**Independent Test**: On the held-out set (sessions not used in training), compare v2 against the
classical baseline and v1 on fret-line localisation error and downstream (string, fret) accuracy.

**Acceptance Scenarios**:

1. **Given** the held-out evaluation, **Then** v2's metrics, the baseline comparison, the
   confusion matrix over frets, per-instrument results and the model card are committed together.
2. **Given** v2 fails its gate, **Then** it stays disabled and v1 remains the default.

---

### Edge Cases

- **Camera denied or absent**: vision features are hidden or disabled with a notice. Everything else
  works (Constitution XI).
- **No GPU acceleration**: the CPU path runs at reduced fps (SC-004). If below the minimum, the
  feature stays off with an explanation.
- **Markers missing or partly visible**: no grid is drawn below the minimum marker count. Partial
  views are reported as "tracking lost", never extrapolated.
- **Neck moving quickly**: re-calibration is continuous. Frames where the grid's motion exceeds a
  threshold are flagged low-confidence.
- **Very dark or backlit scenes**: an exposure warning is shown and results are flagged
  low-confidence.
- **Fingers occluding each other or the strings**: reported with lowered confidence. No string is
  guessed beyond the occlusion.
- **Capo**: out of scope for v1. A detected capo-like occlusion is reported as "unsupported" rather
  than mis-mapped.
- **Unusual fingerboard markers (inlays) or a reflective fingerboard**: covered by robustness cells
  where data exists. Otherwise listed as known limitations in the model or feature card.

## Requirements *(mandatory)*

### Functional Requirements

**Enablement, privacy, degradation**

- **FR-001**: Vision MUST sit behind a feature flag, off by default. It is enabled per local profile
  and device by the user (an opt-in assistant), and the camera permission is requested only when it
  is enabled and used. A visible "camera on" indicator shows whenever the camera is live
  (Constitution IX).
- **FR-002**: Camera frames, landmarks and derived positions MUST be processed in memory on the
  device and never persisted or transmitted. The only exception is an explicit per-recording
  opt-in through 007 (Constitution IX). This is verified by `privacy-auditor`.
- **FR-003**: Any vision failure (permission, hardware, model load, tracking loss) MUST fall back to
  tap or audio input with a visible, non-blocking notice (Constitution XI).

**Neck geometry (v1 markers)**

- **FR-004**: System MUST define a marker layout (marker ids, sizes, placement points relative to
  nut and frets) per instrument family, with printable sheets and placement instructions.
- **FR-005**: System MUST estimate the fingerboard mapping from the detected markers each frame
  (human-owned math). It MUST report a reprojection error, and draw no grid when the error exceeds
  the threshold or fewer than the minimum markers are visible. Geometric targets after projection
  (median, per camera angle): string error ≤ 0.25 × string spacing, and fret error ≤ 0.2 × local fret
  width. Headstock marker placement is allowed only for flat (non-tilt-back) headstocks; otherwise
  fingerboard-edge placements are used. The grid MAY extend at most 2 frets beyond the outermost
  marker. Positions beyond that are reported low-confidence, never as confident extrapolations.
- **FR-006**: Fret line positions MUST be computed from the InstrumentProfile's scale length
  (equal-tempered fret formula) and fret count. String lines MUST come from the string count and
  the nut/bridge string spacing (per-family defaults, user-adjustable).
- **FR-007**: The grid MUST hold its last good pose for at most 1 s of marker loss, then show
  "tracking lost".

**Hand tracking**

- **FR-008**: System MUST track 21 hand landmarks per visible hand and identify the fretting hand
  from 001's handedness setting (FR-017) and its position relative to the neck. Front-camera
  mirroring MUST be normalised before handedness is applied.
- **FR-009**: Hand trackers MUST be swappable and evaluated with the same harness [tracker choice
  in research.md/ADR]. A third-party pre-trained tracker counts as a model under Constitution X: it
  needs a model card (licence, training-data notes, known biases such as skin tone and lighting) and
  a per-cell evaluation.
- **FR-010**: Tracking MUST run off the main UI thread. Per-frame hot-path processing MUST NOT
  allocate (Constitution V).

**Position mapping**

- **FR-011**: For each fretting fingertip, System MUST compute (string, fret, finger) via the
  fingerboard mapping (human-owned math), with a confidence and a press/hover state. Default
  confidence thresholds are set on the validation split only; users MAY adjust **sensitivity**
  (FR-026). If press/hover F1 misses SC-002, press/hover
  MUST be disabled, and drills use hold-to-answer (a stable position held for the FR-026 hold time)
  without press/hover. Press/hover is a heuristic in v1; if a trained model ever replaces it, the
  owner trains it (Constitution IV, X).
- **FR-012**: Outputs MUST be temporally stabilised: a position is reported as stable after
  ≥ 100 ms of consistency (time-based, independent of fps). The system MUST also publish a
  low-latency "candidate" position before stabilisation. Both latencies are measured (SC-005).
- **FR-013**: System MUST publish timestamped candidate and stable position events that drills
  (US4) and fusion (010) can consume.
- **FR-014**: Barre detection MUST report one finger across several strings at a fret when the
  finger's projected segment covers them.

**Drills**

- **FR-015**: When vision is enabled, the note-finding and interval drills (001) MUST accept a
  fretted position held for the FR-026 hold time (default 500 ms) at confidence ≥ the drill
  threshold (FR-026) as an answer.
  - With several fingers on one string, the highest fret is the answer.
  - The answer is judged by the pitch the position sounds under the active profile (001 FR-008,
    FR-035).
  - Open-string (fret 0) prompts are answered by tap.
  - Feedback is shown within 100 ms of hold completion and announced to screen readers.
  - Response time is measured from the prompt to hold onset.
  - Each attempt records its input modality (tap or fret; 001 FR-040), and stats are reported per
    modality.
  - Taps remain available.

  Drill attempt records (position + outcome) are app data, not landmark or frame data, so they are
  exempt from FR-002's non-persistence rule.

**Evaluation**

- **FR-016**: A labelled video evaluation set (007) MUST exist before any tracker or mapping code is
  integrated. It holds per-frame fingertip points, (string, fret, finger, pressed) labels and
  neck annotations, covers the US5 condition matrix, and has a dataset card. It uses 007's grouping
  keys (FR-011); mirrored clips stay in their source session's split. "Pressed" ground truth MUST
  come from synchronised audio (the note sounding on that string at the onset) plus string-contact
  annotation, not from video alone.
- **FR-017**: The harness MUST report, per instrument and per condition cell, with sample counts and
  95% **session-level** bootstrap CIs. A cell is reported only with ≥ 5 sessions and ≥ 500
  pressed-finger events; otherwise it is marked "insufficient data". Metrics:
  - per-frame (string, fret) top-1 accuracy;
  - finger-id accuracy;
  - press/hover F1;
  - fingertip landmark error (px, normalised by fret width);
  - fret-line localisation error;
  - fps;
  - frame → event latency.
- **FR-018**: v1 MUST be compared against a naive baseline: nearest-fret mapping from the raw
  fingertip with no stabilisation, where every fingertip within a fixed distance of the fingerboard
  counts as pressed. Stabilisation and the press model ship only if they improve (string, fret)
  accuracy or press/hover F1 (lower CI bound of Δ > 0) **and** neither metric drops (lower CI bound
  of Δ ≥ −1 pp).

**Markerless v2**

- **FR-019**: The v2 keypoint model MUST be trained with 007 (owner-run), using v1-derived neck
  keypoints on sessions disjoint from evaluation, plus owner corrections. Markers MUST be masked or
  inpainted in training frames. The v2 test set MUST be recorded **without markers**, with neck and
  (string, fret) labels annotated by a human, independently of v1.
- **FR-020**: On the markerless held-out set, v2 MUST beat a classical-vision baseline (line/edge-based
  fret detection) by ≥ 10 pp of downstream (string, fret) accuracy (lower 95% bound of Δ ≥ +5 pp),
  and on fret-line error. It MUST be non-inferior to v1 measured on a matched marker set (same
  conditions, independent human labels): the lower 95% bound of (v2 − v1) is ≥ −3 pp. It MUST be
  exported and quantised per 007 (FR-024, FR-025) and pass `ml-evaluator`. v2 MAY ship per
  instrument (e.g. guitar first), with v1 kept for the others.
- **FR-021**: v1 (markers) MUST remain selectable whenever v2 exists.

**Setup and feedback**

- **FR-022**: A guided camera setup wizard (US0) MUST show a live preview, check camera angle,
  lighting, neck visibility and fretting-hand visibility with a verdict and fix hint for each, show
  the recommended placement (a stand facing the neck at about 30°) without requiring it, support
  right- and left-handed players, let the user choose marker or markerless mode (markerless only
  once v2 passes FR-020/SC-008 for that instrument; **until then, vision needs markers**), and then
  calibrate. Check bands (owner to confirm): angle from frontal accept ≤ 35°, warn 35–50°, above 50°
  "continue anyway"; lighting accept when mean frame luminance is in the middle 70% of the range and
  hand-landmark confidence ≥ the validation default; neck visibility accept when all markers (or
  neck keypoints in v2) are detected for ≥ 1 s. Before US5 results exist, warnings are generic.
  Placement notes are saved to the user's My Gear camera entry (016 FR-008); handedness comes from
  001's profile settings (001 FR-067).
- **FR-023**: An in-app performance overlay MUST show camera fps, tracker time per frame, mapping
  time, and end-to-end latency (p50/p95 over the last 10 s).
- **FR-024**: Users MUST be able to choose the camera. "Camera in use by another app" and
  "camera disconnected" MUST show a clear message and fall back (FR-003). Tracker and model
  artefacts MUST be cached for offline use after first enable, with their download size shown
  before enabling.
- **FR-025**: At 390 px portrait, the camera view MUST show a compact overlay and the on-screen
  fretboard mirror, with no page-level horizontal scroll.
- **FR-026**: Users MUST be able to adjust sensitivity per local profile (Constitution XIII), with
  "reset to default": the answer hold time (300–1,500 ms, default 500 ms), and the press/hover,
  drill-answer and live-highlighting confidence thresholds, each within ±0.15 of its validation
  default. The drill-answer threshold can't go below the value where validation precision is ≥ 95%,
  so drills never mis-score silently. Changing sensitivity never changes the evaluation thresholds
  used for SCs (which use the defaults).
- **FR-027**: Live fretboard highlighting: with vision on, the on-screen fretboard MUST highlight
  each stable fretted position (FR-012) in real time, in the explorer and in lessons' See stage,
  only while the user has switched "live highlighting" on for that screen (off each time the app
  starts).
- **FR-027a**: The camera MUST be live only in: the setup wizard and calibration, drills answering
  by fretting, live highlighting (FR-027), and 010/011 coaching stages. It MUST stop (all tracks
  ended) within 1 s of leaving those contexts, with the "camera on" indicator shown whenever it is
  live (Constitution IX; privacy-auditor gate).
- **FR-028**: Vision MUST read the quality tier (016 FR-017) and adapt camera resolution, tracker
  variant and frame rate to it, with per-tier targets in SC-004/SC-005. This feature also owns the
  **tier benchmark**: ≤ 10 s, progress shown, cancellable, running the vision workloads (tracker +
  mapping on a fixture clip) and mapping results to a tier by thresholds derived from SC-004; the
  same machine must get the same tier in ≥ 9 of 10 runs. Each tier's tracker variant is a separate
  model under FR-009 and MUST pass SC-001 and SC-002 on its own.
- **FR-029**: **Ownership** (owner decision, 2026-11-21): the homography and pixel → (string, fret)
  mapping are human-owned (Constitution IV). Agents MAY build the press/hover, finger-id, barre and
  stabilisation heuristics, but each one needs tests first, a written explanation of how it works
  that the owner approves before implementation, and a passing code-reviewer gate.

### Key Entities

- **Marker layout**: family, marker ids, sizes, placement points.
- **Neck pose**: per-frame plane mapping, reprojection error, marker set used, timestamp.
- **Fret/string grid**: derived from profile + pose.
- **Hand observation**: 21 landmarks, handedness, timestamp, confidence.
- **Fretted position event**: (string, fret, finger, pressed), confidence, timestamp, source (v1/v2).
- **Condition cell**: lighting, angle, handedness, instrument.
- **Vision evaluation record**: dataset version, metrics per cell with CIs, baseline comparison.

## Success Criteria *(mandatory)*

### Measurable Outcomes

All criteria are on the reference setup recorded in Clarifications (laptop, browser, webcam
resolution) and the frozen held-out set, reported per instrument (guitar, 4-string bass, 5-string
bass) where data exists.

- **SC-001**: In the "normal light, frontal" cell, per instrument with data:
  - raw per-frame (string, fret) accuracy on confidently reported pressed fingers ≥ 90%;
  - stabilised event-level accuracy ≥ 95%;
  - coverage (pressed frames that get a confident report; a press shown as hover counts as
    uncovered) ≥ 80%.

  Each point estimate MUST meet its target, with a lower 95% session-bootstrap bound ≥ target − 3 pp.
- **SC-002**: Finger-id accuracy for pressed fingers is ≥ 90%. Press/hover F1 is ≥ 0.85.
- **SC-003**: Calibration locks within 10 s in ≥ 95% of ≥ 40 setup trials across the angle cells.
- **SC-004**: Tracking + mapping sustains, as the 5th percentile over 5-minute sessions, for every
  instrument family (owner to confirm the numbers): **high** tier ≥ 24 fps on the reference laptop
  (GPU path); **medium** ≥ 20 fps; **low** ≥ 15 fps on the minimum target (a laptop with integrated
  graphics, named in 001 Clarifications alongside the reference laptop).
- **SC-005**: Camera frame → candidate event ≤ 120 ms p95 (high), ≤ 150 ms (medium), ≤ 180 ms (low).
  Frame → stable event ≤ 250 ms p95 (high), ≤ 290 ms (medium), ≤ 330 ms (low). Measured on the same
  devices as SC-004.
- **SC-006**: Over ≥ 300 replayed silent-fretting drill answers (US4), judgements match the labels in
  ≥ 95%, and the fallback-to-tap rate in the gating cell is ≤ 10%.
- **SC-007**: Every robustness cell is reported (or marked insufficient data). Gate for **offering**
  the vision assistant for an instrument (the feature flag on; the camera still starts only when the
  user turns the assistant on, Constitution XI): SC-001, SC-002, SC-004 and SC-005 pass in the gating cell
  for the instrument, no covered cell is below 70% stabilised accuracy, and ≥ 12 of the 18 cells for
  that instrument (lighting 3 × angle 3 × handedness 2) are covered. Cells below 85% show a setup
  warning.
- **SC-008**: v2 ships only if FR-020 holds, per instrument.
- **SC-009**: 0 frames, landmarks or positions leave the device or reach storage without an opt-in
  (privacy-auditor check plus an automated network/storage test).

## Assumptions

- Users may be right- or left-handed. The owner is right-handed, so left-handed support is
  evaluated with mirrored clips and any left-handed volunteer clips obtained with consent.
- One player in frame. Multi-player is out of scope.
- Camera on a stand or fixed surface at any reasonable angle (US0). Handheld cameras are out of
  scope.
- Bass evaluation data depends on the bass data strategy in 007's Clarifications. Until real bass
  clips exist, bass cells are reported as "insufficient data".
- Picking-hand, posture and technique events are feature 011.

## Clarifications

### Session 2026-11-21 (owner answers, constitution v2.2.0)

- Q: Camera placement? → A: No fixed placement. A guided setup wizard (preview; angle, lighting and
  neck checks; calibration). Recommend a stand facing the neck at about 30°, but support any
  reasonable angle and left-handed players (US0, FR-022).
- Q: Marker stickers for v1? → A: Optional. Marker mode is the most accurate; markerless is the v2
  goal; users choose (US1, US6, FR-021, FR-022).
- Q: Ownership of press/hover, finger-id, barre and stabilisation? → A: The owner owns the geometry
  (homography, fret mapping). Agents may build the heuristics with tests, an owner-approved
  explanation and code-reviewer; sensitivity is user-adjustable (FR-026, FR-029).
- Q: Hardware? → A: Adaptive quality tiers from a device benchmark (016 FR-017), user-overridable;
  minimum target is a laptop with integrated graphics; the owner's laptop is the development
  benchmark machine (FR-028).
- Spec re-review 2026-11-21 (BLOCK: 1 blocker + 10 others) folded in: per-tier fps and latency
  targets with the minimum target in SC-004/005 (Constitution V), the tier benchmark moved here
  from 016 (FR-028), per-variant evaluation, camera-live contexts (FR-027a), handedness from 001,
  wizard check bands (FR-022), "markers until v2", sensitivity bounds with a precision floor
  (FR-026), the SC-007 gate meaning "offered, not auto-on", the FR-026 hold time in FR-015, and
  press/hover ownership (FR-011). **OPEN (owner):** confirm the tier numbers and wizard bands; add a
  wizard SC once fixture clips exist.
