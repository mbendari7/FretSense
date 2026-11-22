# Feature Specification: ML Data Platform (Recording, Labelling, Dataset Versioning, Training Pipeline, Experiment Tracking, Model Registry)

**Feature Branch**: `007-ml-data-platform`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "ML data platform: labelling tool, dataset versioning, training pipeline, experiment tracking, model registry. A Python training area (ml/) with reproducible pipelines, config files, fixed seeds and pinned dependencies. Versioned datasets with dataset cards; sources GuitarSet, other public datasets, and my own recordings labelled with a labelling tool we build; plan how to get bass data. Experiment tracking (MLflow or W&B), and a model registry with model cards. Held-out test sets, confusion matrices, per-instrument metrics, baseline comparisons, all committed; a model ships only if it beats its baseline. Export to ONNX, quantize to int8, and benchmark size, speed and accuracy before vs after. Active learning: the app flags low-confidence predictions, I correct them, and they feed the next dataset version. Model evaluation runs in CI on a small fixed test set."

**Practice-session value**: indirect, but essential. Every ML-powered feedback users later
gets in practice (chord recognition, note transcription, finger tracking) is trained and checked
here, on recordings of *their* instruments, and is proven better than the DSP baseline before it
is switched on.

**Depends on**: 001 (theory engine for label validation, InstrumentProfile), 015 (audio device
selection and capture for recording). The chromagram-template comparison waits for 004. Used by
006 (US6), 008, 009, 010, 011 and 012. **Lesson track**: none (infrastructure).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consented On-Device Recording (Priority: P1)

The owner starts a recording session (audio, optionally video) with an explicit opt-in. They pick
the instrument profile and the take's metadata (exercise, song, tempo, lighting/camera
conditions), record, review, keep or discard, and export kept takes as a dataset-intake bundle.

**Why this priority**: The owner's own recordings are the only data for their instrument, room and
camera. No consent means no data.

**Independent Test**: Record 3 takes with consent, discard 1, export, and verify the bundle's
manifest, hashes and consent records. Then revoke consent for 1 take and verify it is deleted
locally and excluded from later bundles.

**Acceptance Scenarios**:

1. **Given** consent hasn't been given, **When** the owner opens recording, **Then** nothing is
   captured until they explicitly opt in for this session, and a visible recording indicator is
   shown while capturing.
2. **Given** kept takes, **When** exported, **Then** the bundle contains media, a manifest (take
   id, profile, metadata, duration, content hash) and a consent record per take.
3. **Given** consent is revoked for a take, **Then** the take is deleted from the device, and the
   next dataset version build excludes it and records the exclusion.

---

### User Story 2 - Labelling Tool (Priority: P1)

The owner labels takes: note events (onset, offset, pitch, string, fret), chord segments,
technique events, and, for video, fretting-hand fingertip → (string, fret, finger) on sampled
frames. Labels are validated against the theory engine and the take's InstrumentProfile.

**Why this priority**: You can't train or evaluate without trusted labels, and no off-the-shelf
tool understands string/fret/finger semantics.

**Independent Test**: Label a 30-second fixture take, introduce invalid labels (fret beyond the
profile, a pitch that doesn't match string+fret+tuning, overlapping notes on one string), and
verify each is rejected with a reason. Export and re-import labels losslessly.

**Acceptance Scenarios**:

1. **Given** a take with a waveform/spectrogram view (and video frames), **When** the owner adds a
   note at an onset with string 3 fret 2 on 6-string Standard, **Then** its pitch is filled in as
   A3 automatically.
2. **Given** a label whose pitch contradicts its string, fret and tuning, **Then** it is flagged
   and can't be saved until it is fixed or explicitly marked "detuned/bend".
3. **Given** model pre-labels (when a model exists), **Then** they appear as suggestions with
   confidence scores, accepted or corrected one by one. The final labels record who or what
   produced each (provenance).
4. **Given** labelling sessions, **Then** active labelling time per minute of media is recorded,
   to measure throughput (SC-006).

---

### User Story 3 - Versioned Datasets with Cards (Priority: P1)

Public datasets and owner takes are assembled into immutable dataset versions. Each has a manifest
of content hashes, deterministic leakage-free splits, and a dataset card.

**Why this priority**: Constitution X. Reproducible evaluation is impossible without frozen,
documented data.

**Independent Test**: Build a dataset version twice from the same inputs and verify identical
manifests and splits. Inject a leakage case (the same session in train and test) and verify the
build fails.

**Acceptance Scenarios**:

1. **Given** source definitions (public datasets + owner bundles), **When** a version is built,
   **Then** it gets a version id, a manifest with per-item hashes, train/val/test splits by
   performer/session/song, and a generated dataset-card skeleton with counts per instrument,
   string and class.
2. **Given** a released version, **When** anyone tries to modify it, **Then** the operation is
   refused. Changes produce a new version, with a changelog entry.
3. **Given** a test split, **Then** no item from the same recording session, performer+song pair,
   or augmentation source appears in train or val (checked automatically).
4. **Given** a public dataset with a licence that forbids the intended use, **Then** the build
   refuses to include it and names the licence.

---

### User Story 4 - Reproducible Training Pipeline (Priority: P1)

The owner runs config-driven pipelines (data → features → train → evaluate → export) with fixed
seeds and pinned dependencies. The same config, data version and code commit reproduce the metrics.

**Why this priority**: Reproducibility is non-negotiable (Constitution X), and every later model
feature depends on it.

**Independent Test**: Run the reference baseline pipeline twice on the CI fixed subset and verify
the metrics match within tolerance (SC-003).

**Acceptance Scenarios**:

1. **Given** a config file, **When** a pipeline runs, **Then** it records the config, seed, dataset
   version, code commit, dependency lock hash and hardware, and writes metrics and artefacts.
2. **Given** a config that references an unknown or unreleased dataset version, **Then** the run
   refuses to start.
3. **Given** evaluation, **Then** outputs include held-out-test metrics, a confusion matrix (or
   task equivalent), per-instrument breakdowns with sample counts, and the baseline comparison.

---

### User Story 5 - Experiment Tracking and Model Registry (Priority: P2)

Every run is tracked and comparable. Models are registered with a model card and promoted
(candidate → production) only when the promotion gate passes.

**Why this priority**: Makes the history of experiments auditable, and turns "ships only if it
beats its baseline" into an automated, enforced rule.

**Independent Test**: Register two candidate models, one beating and one failing the baseline
margin, and verify that only the first can be promoted and both decisions are recorded.

**Acceptance Scenarios**:

1. **Given** runs, **Then** they can be listed and compared by metric, config, data version and
   commit.
2. **Given** a candidate, **When** promotion is requested, **Then** the gate checks: held-out
   metrics present, baseline beaten by the spec margin, per-instrument metrics present, model card
   complete, export benchmarks present (if exported). Any failure blocks promotion and lists the
   reasons.
3. **Given** a production model, **Then** the app consumes it only through a versioned registry
   manifest (id, version, hash, input/output contract, metrics summary).

---

### User Story 6 - Export, Quantisation and Benchmarks (Priority: P2)

Promoted-candidate models are exported to a portable inference format and quantised to int8.
Size, speed (GPU-accelerated and CPU fallback in the browser) and accuracy are benchmarked before
vs after.

**Why this priority**: On-device, real-time inference (Constitution V, IX) depends on small, fast
models, and quantisation must be proven not to break accuracy.

**Independent Test**: Export a fixture model and verify the exported outputs match the original
within tolerance on fixed inputs, then verify the before/after table is produced.

**Acceptance Scenarios**:

1. **Given** a model, **When** exported, **Then** the exported and original outputs agree within
   the stated tolerance on the fixed test inputs.
2. **Given** int8 quantisation, **Then** a table of size, p50/p95 latency (GPU path and CPU
   fallback) and accuracy for fp32 vs int8 is committed. The int8 artefact is rejected if its
   accuracy drop exceeds the spec tolerance.

---

### User Story 7 - CI Evaluation (Priority: P2)

On every PR touching ml/, data definitions or model artefacts, CI evaluates the registered models
on a small fixed test set and fails on regression.

**Why this priority**: Catches silent regressions from code, data or dependency changes.

**Independent Test**: Introduce a deliberate regression in a fixture model and verify CI fails
with a readable diff of metrics.

**Acceptance Scenarios**:

1. **Given** a PR, **Then** the CI eval runs in under 10 minutes on a standard CI runner (CPU) and
   posts metrics compared with the production model.
2. **Given** a metric drop beyond the noise band, **Then** the job fails and names the metric.

---

### User Story 8 - Active Learning Loop (Priority: P3)

When a production model's prediction has low confidence during practice, the app can (with the
user's opt-in) keep that short clip and its prediction for review. Any user can correct it in a
simple in-app correction view. Corrections stay on that user's device unless they explicitly choose
to share them (Constitution IX). The owner's own corrections, and any explicitly shared ones, can
enter the **next** dataset version.

**Why this priority**: It improves the models on real playing, with minimal labelling effort.

**Independent Test**: With a fixture model and threshold, run a clip through, verify it is queued
only with opt-in, correct it, build a new version, and verify the test split of the previous
version is untouched.

**Acceptance Scenarios**:

1. **Given** opt-in is off, **Then** nothing is kept, whatever the confidence.
2. **Given** opt-in is on, **When** confidence < the threshold, **Then** a clip of at most 10 s is
   queued locally, with a daily cap.
3. **Given** corrected items, **When** the next version is built, **Then** they go to train/val
   only (never into an existing test split), with provenance "active-learning correction".

---

### Edge Cases

- Public dataset unavailable or its checksum changed: the build fails with the source named; no
  silent substitution.
- A take recorded on a custom tuning: labels use that profile; the dataset card reports per-profile
  counts.
- Very short takes (< 2 s) or clipped audio (true peak ≥ 0 dBFS): flagged in the review step and
  excluded by default.
- Labels created on an older label schema: migrated by a versioned migration, or rejected.
- Large media: stored by reference with hashes (never in git), and verified on use.
- GPU unavailable for training: pipelines run on CPU (slower), with the same results within
  tolerance.
- No bass owned yet: bass data comes from public and synthesised sources (see Clarifications), and
  the card states that real owner bass takes are absent.

## Requirements *(mandatory)*

### Functional Requirements

**Recording and consent**

- **FR-001**: Recording MUST require an explicit per-session opt-in and show a visible indicator
  while capturing. Each kept take MUST store a consent record (scope: training/evaluation; date;
  revocable).
- **FR-002**: The owner MUST be able to review, discard, keep and export takes. Exports are
  bundles of media, manifest and consent records.
- **FR-003**: Revoking consent MUST delete the take locally, purge its media from every dataset
  version (released versions that contained it are marked "tombstoned: not reproducible" in their
  changelog), exclude it from every later version, and flag models trained on a tombstoned
  version in their cards. The consent screen MUST explain this behaviour before consent is given.
- **FR-004**: Recordings MUST be stored on the device only (Constitution IX) until the owner
  exports them; export is a manual file save. Exports MUST strip metadata not needed for training
  (device ids, absolute timestamps beyond the date, location, file-system paths, EXIF/container
  tags). This is verified by an automated check. Storing media on the device MUST be covered in
  `docs/THREAT-MODEL.md` and pass `privacy-auditor`.
- **FR-004a**: Recording MUST handle: permission denied (explains, offers retry), device
  disconnect mid-take (via 015; the partial take is kept, marked "incomplete" and excluded by
  default), storage quota exceeded (stops cleanly, warns), and the tab backgrounded or closed (the
  partial take is kept as incomplete).

**Labelling**

- **FR-005**: The labelling tool MUST support note events (onset, offset, pitch, string, fret,
  optional finger), chord segments (start, end, chord symbol per 001 FR-005), technique events
  (type, span, string), and per-frame fretting-hand annotations (fingertip points, string, fret,
  finger) on sampled video frames.
- **FR-006**: Labels MUST be validated against the take's InstrumentProfile (string 1 = highest
  pitch) and the theory engine, which stays the single source of truth (the Python build calls it
  or its exported fixtures; no re-implementation):
  - string and fret in range;
  - pitch consistent with string + fret + tuning, unless marked bend, detuned, harmonic, slide or
    capo (with the capo fret recorded);
  - no overlapping notes on one string;
  - chord labels given as structured root + quality (001 FR-005). Free-text chord symbols wait
    for 005's parser.
- **FR-007**: The tool MUST provide synchronised audio waveform/spectrogram and video views,
  playback at 0.25×–1×, and keyboard shortcuts for all labelling actions.
- **FR-008**: Every label MUST carry provenance (owner, model-suggested + model id, or
  active-learning correction) and a timestamp.
- **FR-009**: The tool MUST record active labelling time per media minute.

**Datasets**

- **FR-010**: A dataset version MUST be built from declarative source definitions and be
  immutable once released. It MUST have a version id, a manifest of item content hashes, splits,
  a dataset card, and a changelog.
- **FR-011**: Splits MUST be assigned per group (recording session; performer where more than one
  performer exists; song; augmentation source). Assignment is a deterministic hash of the group
  id, so it is stable across versions: once a group is in test it stays in test in every future
  version. Owner data (one performer) MUST be evaluated as a separate "same-performer,
  session-disjoint" test set, reported separately from the performer-disjoint public test set,
  which is the primary held-out metric for generalisation. A leakage check MUST fail the build on
  any violation, including mirrored or augmented copies placed in a different split from their
  source.
- **FR-012**: The test split of a released version MUST never change. New data enters new versions only.
- **FR-013**: The dataset card MUST include: sources and licences, collection method, consent,
  label schema and provenance mix, per-instrument/profile/string/class counts, split sizes, known
  biases and gaps, and the intended and prohibited uses.
- **FR-014**: The build MUST verify each public source's checksum and licence compatibility, and
  refuse incompatible ones.
- **FR-015**: The platform MUST support these source types: GuitarSet; other public guitar/bass
  datasets selected in research.md; owner bundles; and synthesised or augmented data (labelled as
  such in the card). Bass data strategy (Clarifications): public bass datasets, synthesised bass
  audio, and pitch-shifted guitar recordings (each pitch-shifted clip stays in its source clip's
  split group, FR-011). Every bass result is marked **"unvalidated"** until real bass recordings
  exist.

**Training pipeline**

- **FR-016**: Pipelines MUST be config-driven (data version, features, model, training, evaluation,
  export), with fixed seeds and pinned dependencies (lockfile). Every run records config, seed,
  data version, code commit, lock hash and hardware.
- **FR-017**: A run MUST refuse to start on uncommitted code changes (unless explicitly marked
  exploratory, which can't be promoted) or on an unreleased dataset version.
- **FR-018**: Evaluation MUST produce, on the held-out test split: task metrics, a confusion matrix
  or task equivalent, per-instrument (and per-profile) breakdowns with sample counts, 95%
  confidence intervals from a **group-level** bootstrap (resampling sessions, 1,000 resamples), and
  the comparison against the named baseline. Thresholds, calibration and noise bands MUST be set on
  the validation split, never on test.
- **FR-018a**: A test-label self-agreement check MUST re-label ≥ 10% of each new test split after at
  least 7 days. The split is released only if note-level agreement is ≥ 95% (chords ≥ 95%,
  per-frame (string, fret) ≥ 95%).
- **FR-019**: The pipeline MUST include one reference task (chord classification on public data)
  to prove end-to-end reproducibility. Its baseline is a majority-class predictor and a logistic
  regression on standard public spectral features, so no agent-written chromagram is needed. The
  owner's chromagram-template baseline (004) is added through the owner's own binding once 004
  lands. Training runs are executed by the owner (Constitution IV).

**Tracking and registry**

- **FR-020**: Every run MUST be logged to an experiment tracker with params, metrics, artefacts and
  links to the data version and commit. The tracker MUST work locally and offline [tool choice in
  research.md/ADR].
- **FR-021**: A model registry MUST store versions with states candidate / production / archived,
  each with a model card (intended use, data, metrics per instrument, baseline comparison,
  limitations, licence, export benchmarks).
- **FR-022**: Promotion to production MUST pass an automated gate:
  - held-out metrics are present;
  - the lower 95% group-bootstrap bound of (model − baseline) is ≥ the task spec's margin, for each
    instrument with real (non-synthetic) test data;
  - per-instrument metrics are present;
  - the card is complete with no placeholder values;
  - export benchmarks are present (if exported).

  An instrument with only synthetic test data is reported but not gated. The model is marked
  "unvalidated for <instrument>", and the app keeps the baseline for that instrument. Each
  decision is recorded. Model states are candidate / production / archived (archived keeps
  rollback targets).
- **FR-023**: The app MUST consume models only through a versioned registry manifest (id, version,
  content hash, input/output contract, expected sample rate, metrics summary, minimum runtime
  capabilities). On a hash mismatch or unmet capabilities, the app MUST refuse the model and fall
  back to the DSP baseline with a visible notice (Constitution XI).

**Export and quantisation**

- **FR-024**: Export MUST produce a portable inference artefact whose outputs match the original
  model within a stated tolerance (default max abs diff ≤ 1e-3 on logits) on the fixed inputs.
- **FR-025**: int8 quantisation MUST be benchmarked on the reference laptop and phone (Clarifications;
  10 warm-up calls, ≥ 200 timed calls): size, p50/p95 latency on the GPU path and the CPU fallback in
  the browser, and the primary task metric per instrument, fp32 vs int8. The artefact is rejected if
  the drop in its primary metric exceeds the task spec's tolerance (default 1.0 percentage point)
  for any instrument.

**CI evaluation**

- **FR-026**: CI MUST evaluate the production and candidate models on a small fixed set (≤ 200 MB,
  versioned), drawn from the **validation** split of redistributable public and synthetic data only
  (never owner media, never the test split). It runs in < 10 min on a standard GitHub-hosted Linux
  runner. It MUST fail when the lower 95% group-bootstrap bound of (candidate − production) is below
  −δ for any gated metric (δ per metric, default 1 pp).

**Active learning**

- **FR-027**: With the user's active-learning opt-in on (per local profile, default off), the app
  MUST temporarily hold clips (≤ 10 s,
  daily cap configurable, default 20) whose prediction confidence is below a per-model threshold
  (set on validation data). At the end of the session it MUST ask, per clip, whether to keep it.
  Only confirmed clips are stored, each with a consent record. Unconfirmed clips are discarded, and
  uncorrected stored clips expire after 14 days. Capture MUST NOT affect the real-time budgets
  (Constitution V): no allocation or locking in the audio or vision hot path.
- **FR-028**: Users MUST be able to correct queued items in an in-app correction view (a simplified
  labelling view at 390 px). Corrections stay on the device, profile-scoped, unless the user
  explicitly chooses to share a specific correction (a separate, revocable consent per item; no
  sharing channel is built this term, so sharing means an explicit export file). Only the owner's
  own corrections and explicitly shared ones MAY enter the next dataset version's train/val
  splits, with provenance; never an existing version or a test split.

**Cross-cutting**

- **FR-029**: All tooling MUST run on the owner's machine without cloud services. Cloud trackers or
  storage are optional and require an ADR and a threat-model update.
- **FR-030**: `dataset-curator` and `ml-evaluator` gates MUST pass for every dataset release and
  model promotion respectively.

### Key Entities

- **Take**: id, profile, media refs, metadata (exercise, tempo, conditions), consent record, hash.
- **Label set**: take id, schema version, events (note, chord, technique, hand-frame), provenance.
- **Source definition**: type (public/owner/synthetic), location, checksum, licence, filters.
- **Dataset version**: id, sources, manifest, splits, card, changelog, released flag.
- **Pipeline config**: data version, feature, model, training, evaluation, export sections; seed.
- **Run**: config, seed, commit, lock hash, hardware, metrics, artefacts, tracker id.
- **Model version**: registry id, state, card, metrics, baseline comparison, artefacts (fp32/int8).
- **Registry manifest**: what the app loads: model id/version, hash, I/O contract, capabilities.
- **Active-learning item**: clip ref, prediction, confidence, model id, correction, status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Rebuilding a dataset version from identical inputs yields a byte-identical manifest
  and splits in 100% of runs on the same OS, and content-identical results across OSes after
  normalisation (LF line endings, POSIX paths, canonical JSON).
- **SC-002**: The leakage check catches 100% of the injected leakage fixtures (same session,
  performer+song, augmentation source) and gives 0 false positives on the clean fixtures.
- **SC-003**: Re-running the reference pipeline with the same config, data, commit and seed gives an
  exact match of every quality metric on the CPU deterministic reference, and within ±0.5 percentage
  points on the owner's GPU. Timing metrics are excluded.
- **SC-004**: 100% of label-validation fixtures (invalid string/fret, pitch mismatch, overlap,
  unparseable chord) are rejected with a reason, and 100% of valid fixtures are accepted.
- **SC-005**: The promotion gate blocks 100% of fixture candidates missing any required item, having
  placeholder card values, or failing the baseline margin, and promotes 100% of the valid fixture
  candidates.
- **SC-006**: Labelling throughput is measured and reported (minutes of labelling per minute of
  media, per label type). The owner's labelling budget is about 2 hours a week (Clarifications);
  dataset-size plans in research.md MUST fit that budget, stating the expected labelled minutes
  per month.
- **SC-007**: CI ML evaluation finishes in < 10 min on a CPU runner and fails on 100% of the
  injected-regression fixtures.
- **SC-008**: For the reference model, exported-vs-original outputs agree within tolerance on 100%
  of fixed inputs, and the fp32-vs-int8 table is committed.
- **SC-009**: Dataset cards and model cards have 100% of their required fields filled with
  non-placeholder values (automated check).
- **SC-010**: Consent fixtures: 100% of revoked takes are purged from every version and their
  versions tombstoned. With the opt-in off, 0 clips or takes are stored. 100% of exports pass the
  metadata-stripping check. 100% of licence-incompatible sources are refused.
- **SC-011**: Test splits meet the FR-018a self-agreement threshold before release. Group split
  assignment is stable across 3 successive version builds (0 test groups moved).

## Assumptions

- The owner runs training on their own machine (GPU per Clarifications). CI never trains.
- Public datasets are downloaded by the owner under their licences; the repo stores only
  manifests and checksums.
- The owner does not own a bass yet. Until then, bass data comes from public datasets, synthesised
  audio and pitch-shifted guitar recordings, and bass metrics are flagged "unvalidated".
- The labelling tool is part of the web app (behind a developer/owner flag), reusing the
  fretboard and theory engine. It is a desktop, owner-only tool: exempt from the 390 px rule, but
  fully keyboard-operable.
- Frame-level hand labelling lives here (not in 008) because the same labelling tool and dataset
  machinery serve 008, 010 and 011.

## Clarifications

### Session 2026-11-21 (owner answers, constitution v2.2.0)

- Q: Bass data without owning a bass? → A: Public datasets + synthetic data + pitch-shifted guitar
  recordings; bass is marked "unvalidated" until real recordings exist (FR-015).
- Q: Labelling time budget? → A: About 2 hours a week from the owner. Users can opt in to correct
  low-confidence predictions; corrections stay local unless explicitly shared (FR-027, FR-028,
  SC-006).
- Q: Training hardware? → A: The owner's laptop is the development machine (details recorded in
  plan.md); CI never trains.
