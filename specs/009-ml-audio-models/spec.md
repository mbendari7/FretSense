# Feature Specification: ML Audio Models: Chord Classification and Polyphonic Note Transcription

**Feature Branch**: `009-ml-audio-models`

**Created**: 2026-11-21

**Status**: Draft (specify only; clarify/plan pending)

**Input**: User description: "Audio models: polyphonic note transcription and chord classification (a small CNN on CQT or log-mel features), compared against the DSP baselines (YIN, chromagram templates). Export to ONNX, quantize to int8, benchmark size, speed and accuracy before vs after. Run in the browser with onnxruntime-web (WebGPU with a WASM fallback)."

**Practice-session value**: the owner strums a chord or plays a double-stop, and the app recognises
*what* sounded more reliably than the DSP baselines, including on bass and in a noisy room. Chord
drills, play-along (003) and transcription (012) all get more trustworthy feedback.

**Depends on**: 015 (device input, resampling to the model rate), 002 (YIN baseline), 004 (chromagram-template baseline), 007 (datasets, pipeline,
registry, export). Feeds 010 and 012.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chord Classifier Beats the Template Baseline (Priority: P1)

A small convolutional model classifies the chord sounding in a short audio window (root + quality
from 001's 12 qualities, plus "no chord"). It is evaluated against the chromagram-template
baseline on the same held-out set.

**Why this priority**: Chord recognition is the most common audio feedback in practice, and
templates struggle with voicings, bass notes and noise.

**Independent Test**: Run the evaluation harness on the frozen held-out set and compare the metrics
and confusion matrices of both systems, per instrument.

**Acceptance Scenarios**:

1. **Given** the held-out set, **Then** accuracy (root + quality), a 25-class confusion matrix,
   per-instrument and per-noise-level breakdowns, and the baseline comparison with CIs are committed.
2. **Given** the model doesn't beat the baseline by the margin, **Then** it is not promoted, and
   the template detector remains the default.

---

### User Story 2 - Polyphonic Note Transcription (Priority: P1)

A model outputs per-frame note activations (pitch, onset) for up to 6 simultaneous notes. It is
compared against a YIN-based monophonic baseline on monophonic material, and against a
non-ML spectral-peak baseline on polyphonic material.

**Why this priority**: Double-stops, chords and bass+melody need polyphony, which YIN can't detect.

**Independent Test**: Note-level onset F1 and frame-level F1 on the held-out set, per instrument
and polyphony level.

**Acceptance Scenarios**:

1. **Given** held-out clips, **Then** note-onset F1 (±50 ms tolerance), frame F1 and per-polyphony
   results are committed, with baseline comparisons.
2. **Given** 5-string bass material, **Then** B0–E1 notes are evaluated separately, and their window
   or latency trade-off is reported (ADR-0002).

---

### User Story 3 - In-Browser Inference (Priority: P1)

Promoted models run in the app with GPU acceleration where available and a CPU fallback. They are
quantised to int8, with before/after benchmarks committed.

**Why this priority**: On-device, real-time inference is what makes ML usable in practice
(Constitution V, IX).

**Independent Test**: Run the in-browser benchmark page on the reference laptop and phone, and
compare against the committed numbers.

**Acceptance Scenarios**:

1. **Given** WebGPU is available, **Then** inference uses it. Otherwise it falls back to CPU with a
   notice, and to the DSP baseline if latency exceeds the budget.
2. **Given** fp32 and int8 artefacts, **Then** a table of size, p50/p95 latency (per backend and
   device) and accuracy is committed, and int8 is used only if within the accuracy tolerance.

---

### User Story 4 - Detector Selection (Priority: P2)

The owner can switch between the DSP and ML detectors per task in settings, and see each
detector's measured accuracy and latency from the latest evaluation.

**Why this priority**: Graceful degradation, and honest comparison in the product itself.

**Independent Test**: Switch detectors during a play-along fixture replay and verify the outputs
change source, with no errors or dropped frames.

**Acceptance Scenarios**:

1. **Given** an ML model loaded, **When** the owner selects the DSP detector, **Then** it switches
   within 1 s without interrupting the session.

---

### Edge Cases

- Model fails to load or a backend is unsupported: fall back to DSP with a notice.
- Out-of-vocabulary chords (e.g. 13ths): mapped to "other" or the nearest in-vocabulary class,
  as the model card documents. Never silently mislabelled.
- Detuned instruments (±50 cents): evaluated as a robustness cell.
- Clipping or very low input level: an input-level warning; predictions flagged low-confidence.
- Low-confidence outputs feed active learning (007 FR-027) only with opt-in.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The evaluation sets, harness, metrics and baselines (the template chord detector from
  004; YIN from 002; a spectral-peak polyphonic baseline) MUST be committed before any model is
  trained (Constitution III, X).
- **FR-002**: The chord classifier MUST predict root (12) × quality (001's 12) plus "no chord" from a
  window of ≤ 500 ms, using a time–frequency input representation chosen in research.md.
- **FR-003**: The transcription model MUST output per-frame pitch activations covering B0–E6 and
  onset probabilities, for up to 6 simultaneous notes.
- **FR-004**: Evaluation MUST report, per instrument (guitar, 4-string bass, 5-string bass) and per
  condition (clean DI, amp/room mic, noise SNR 20/10 dB), with 95% bootstrap CIs:
  - for chords: accuracy, a confusion matrix, and per-class F1;
  - for transcription: note-onset F1 at ±50 ms, frame F1, and octave-error rate.
- **FR-005**: A model ships only if it beats its baseline on the held-out set by the margin in SC-001
  or SC-002 (lower CI bound of Δ > 0), per instrument where data exists (Constitution X).
- **FR-006**: Models MUST be exported and quantised per 007 (FR-024, FR-025), with size, speed and
  accuracy benchmarks before vs after.
- **FR-007**: Inference MUST run off the main thread, use GPU acceleration where available with a
  CPU fallback, and sit behind the same detector interface as the DSP baselines (strategy), switchable
  at runtime.
- **FR-008**: ML detectors MUST be behind a feature flag, off by default until promoted. DSP
  detectors remain selectable (Constitution XI).
- **FR-009**: End-to-end ML detection latency MUST meet the per-instrument pitch-confirmed budgets
  of ADR-0002 at p95 on the reference setup. Otherwise the app falls back to DSP for that instrument.
- **FR-010**: Per-call audio preprocessing for inference MUST NOT allocate in the hot path
  (Constitution V).
- **FR-011**: Model cards MUST document vocabulary, training data, per-instrument metrics, known
  failure modes and licence.

### Key Entities

- **Detector**: task (chord / notes), kind (DSP / ML), version, metrics summary, latency.
- **Model version**: from the 007 registry, with fp32/int8 artefacts and benchmarks.
- **Evaluation record**: dataset version, condition cells, metrics with CIs, baseline deltas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chord classifier accuracy ≥ template-baseline accuracy + 10 percentage points on the
  held-out set (lower CI bound > +5 pp), per instrument where data exists.
- **SC-002**: Transcription note-onset F1 ≥ baseline + 0.10 on polyphonic material. On monophonic
  material it is no worse than YIN by more than 0.02.
- **SC-003**: The int8 model is ≤ 5 MB per task, with an accuracy drop ≤ 1.0 pp versus fp32.
- **SC-004**: Inference p95 ≤ 10 ms per window on the reference laptop with GPU, and ≤ 25 ms with
  CPU fallback.
- **SC-005**: Detector switching takes < 1 s with 0 dropped audio frames in fixture replays.

## Assumptions

- Training is run by the owner (Constitution IV). Agents build pipelines, harnesses and benchmarks.
- The training data mix and the bass strategy follow 007's dataset cards.
- Architecture comparisons (CNN variants, input representations) are decided in this feature's
  research.md and ADRs at plan time.
