# FretSense Constitution

FretSense is an interactive guitar and bass theory handbook, real-time practice companion, and
on-device machine-vision / machine-learning system. It follows *Guitar Theory for Dummies*: each
book part becomes one **lesson track**, and each chapter one lesson
(Read → See → Drill → Play → Camera-coach). Features are capability-oriented (see the roadmap);
a track's lessons ship once the features they need exist. FretSense has three goals of equal
weight: (a) a teaching tool the owner uses every practice session, on guitar and bass, that adapts
to them; (b) a deep, rigorously evaluated ML and machine-vision system; (c) a showcase of
fundamental engineering skills, each used where it is genuinely needed. A feature that would not
help a real practice session does not ship.

## Core Principles

### I. Spec Before Code (NON-NEGOTIABLE)

- No code (feature, scaffolding, prototype, training script) MUST be written without an approved
  `spec.md`, `plan.md`, and `tasks.md` for the feature under `specs/NNN-*/`.
- Every task MUST cite at least one `FR-xxx`; every `FR-xxx` MUST be covered by at least one test
  (or, for ML, an evaluation) before the feature is done.
- Specs are the source of truth. When code and spec disagree, the spec MUST be corrected and
  re-approved first, then the code changed.

Rationale: traceability from requirement → task → test → commit is the project's core claim.

### II. Pure, Correct Theory Engine

- `packages/theory` MUST be pure TypeScript (strict) with zero runtime dependencies, no DOM, no
  audio, no I/O, no global mutable state, and deterministic outputs.
- Scales, chords, and keys MUST be derived from interval formulas applied to a spelled root —
  never from hardcoded per-key tables (test fixtures are exempt).
- Spelling MUST be enharmonically correct in context: each heptatonic scale uses each letter
  exactly once (F# in D major, F## in G# major, Cb in Gb major); chord tones are spelled by
  interval.
- Fretboard functions MUST take an instrument profile (Principle VIII); none may assume a string
  count, tuning, or fret count.

Rationale: a correct, isolated engine makes every UI, drill, and model label trustworthy.

### III. Test-First (NON-NEGOTIABLE)

- For theory, DSP, vision geometry, fingering, learner-model, and backend code, tests MUST be
  written first and observed failing for the right reason.
- For ML, the dataset split, evaluation harness, metrics, and baseline MUST exist and be committed
  before any model is trained or integrated.
- CI MUST block merges on failing tests, lint, typecheck, or ML-eval regressions, and on line or
  branch coverage below **90%** in `packages/theory`, `packages/dsp`, and other packages that hold
  the human-owned algorithms.

Rationale: tests and evaluations written afterwards mirror the implementation, not the requirement.

### IV. Human-Owned Core

The owner hand-writes, and agents MUST NOT implement (including as "starter" code or
implementation-equivalent pseudocode):

- YIN pitch detection; the chromagram;
- the camera homography and pixel → (string, fret) mapping math;
- the Viterbi / dynamic-programming fingering optimizer;
- the knowledge-tracing update equations;
- the cross-correlation estimator for round-trip audio latency and audio–video offset;
- running ML training experiments (launching runs, choosing hyperparameters, accepting results).

Agents MAY write tests, fixtures, benchmarks, evaluation harnesses, data tooling and pipelines
around these, explain them, and review them. The owner writes all lesson prose in
`content/lessons/`; agents MUST NOT write lesson prose or copy book text.

Rationale: the portfolio must honestly demonstrate the owner's own algorithmic and ML skill.

### V. Real-Time Budget

- Audio features MUST acknowledge a note onset on screen in **≤ 30 ms** (p95) for every
  instrument.
- Pitch-confirmed feedback MUST meet the per-instrument budget recorded in ADR-0002 (derived from
  the period of the instrument's lowest note); changing a budget requires a new ADR.
- Vision features MUST state fps and end-to-end latency targets per instrument in their spec.
- Audio and vision hot paths (audio callback, per-frame DSP, per-frame inference pre/post
  processing) MUST NOT allocate, lock, or log.
- Every performance or accuracy claim MUST be backed by a committed, reproducible benchmark and its
  recorded result, on a reference setup named in the spec.

Rationale: feedback that lags the hand is useless; unbacked numbers are not credible.

### VI. Built for Real Practice

- All core features (theory, lessons, drills, audio, local progress) MUST work offline as an
  installable PWA, with progress stored on the device.
- No account is required for any feature. Optional cloud sync MAY exist only as an explicit opt-in.
- Every screen MUST be usable at a 390 px phone viewport and readable from a music stand.
- Each feature spec MUST state how it helps a real practice session.

Rationale: the owner practises with an instrument in hand, often away from a desk or network.

### VII. Transparent AI Use

- Subagents have defined roles and gate the work (see `CLAUDE.md`); they MUST NOT generate feature
  code freely.
- Every non-trivial decision MUST be recorded as an ADR with rejected alternatives.
- Commits MUST reference task and FR IDs; every PR MUST include an "AI involvement" section.
- Rejected or corrected AI output MUST be logged in `docs/AI-WORKFLOW.md`.
- AI agents MUST NOT write git history (commit, push, tag, rewrite) and MUST NOT be credited as an
  author, co-author or contributor anywhere. The owner makes every commit and writes every PR's
  "AI involvement" section.

Rationale: the workflow itself is a deliverable and must be auditable.

### VIII. Instrument-Agnostic

- Every instrument-dependent behaviour MUST be driven by an `InstrumentProfile` (string count,
  tuning, fret count, pitch range, scale length). Hardcoding six strings, a tuning, or a fret count
  outside a profile definition is a violation.
- Supported profiles: 6-string guitar (Standard, Drop D, Eb, DADGAD), 4-string bass (EADG, Drop
  D), 5-string bass (BEADG), and owner-defined custom tunings.
- Lessons, drills, models and metrics MUST declare the instruments they apply to; accuracy and
  latency MUST be reported per instrument.

Rationale: the owner plays guitar and bass; bass is not a special case of guitar.

### IX. On-Device Privacy

- Camera and microphone data MUST be processed on the device. Raw audio/video MUST NOT leave the
  device, and MUST NOT be stored, unless the owner explicitly opts in per recording.
- The microphone and camera MUST be active only while a feature that needs them is in use, with a
  clear on-screen "listening" / "camera on" indicator whenever they are active.
- Recordings contributed to datasets require explicit, revocable consent and are stripped of
  metadata not needed for training.
- A threat model (`docs/THREAT-MODEL.md`) MUST be kept current; any feature adding a network call,
  storage of media, or new permission MUST update it and pass `privacy-auditor`.

Rationale: a practice tool watching and listening to the owner must be trustworthy by design.

### X. ML Rigor (NON-NEGOTIABLE)

- Every dataset MUST have a versioned dataset card (sources, licence, collection, labelling,
  splits, known biases, per-instrument coverage); splits MUST be leakage-checked: no recording
  session, song, or augmentation source spans train and test, and no performer does where more
  than one performer exists. Single-performer (owner) data MUST be evaluated as a separate
  session-disjoint test set, reported separately from performer-disjoint evaluation. Test-split
  group assignment MUST stay stable across dataset versions.
- Every model MUST have a model card, a held-out test set that is never used for tuning, a
  confusion matrix or equivalent, per-instrument metrics, and a comparison against its baseline
  (DSP or simpler model). A model ships only if it beats its baseline on the held-out set by the
  margin stated in its spec.
- Training MUST be reproducible: config files, fixed seeds, pinned dependencies, recorded data
  version and code commit, and a tracked experiment run.
- Optimised artefacts (ONNX, int8) MUST be re-evaluated after conversion; size, speed and accuracy
  before vs after MUST be committed.

Rationale: a model without honest evaluation is a demo, not engineering.

### XI. Graceful Degradation

- Every feature MUST work audio-only. Camera and ML are enhancements behind feature flags, off by
  default until they pass their gates.
- DSP baselines (e.g. YIN, chromagram templates) MUST remain available and selectable whenever an
  ML model exists for the same task.
- Missing permissions, unsupported hardware (no WebGPU, no camera), or failed model loads MUST
  fall back to the next capability level with a visible, non-blocking notice.

Rationale: practice must never be blocked by the fanciest component failing.

### XII. Skills Where Needed

- Each engineering technique (data structure, algorithm, pattern, service, test type) MUST be
  justified by a real requirement in a spec; adding one only to showcase it is a violation.
- `docs/SKILLS-MATRIX.md` MUST map each demonstrated skill to its location (paths, spec IDs) and
  how it is tested; complexity MUST be documented for every non-trivial algorithm.

Rationale: employers value judgement about when to use a tool, not a checklist of tools.

## Technology & Quality Constraints

- pnpm monorepo; TypeScript `strict`; `any`, non-null assertions, `@ts-ignore` need inline
  justification. Layers follow clean architecture (domain → application → infrastructure); inner
  layers MUST NOT import outer layers.
- `packages/theory`: Vitest + fast-check. `apps/web`: React + Vite PWA.
- `packages/dsp`: Rust → WebAssembly in an AudioWorklet; inter-thread audio transport via a
  lock-free ring buffer.
- Optional backend (feature 013): service with a relational database, migrations, auth, rate
  limiting, and an OpenAPI contract; never required by the client.
- GitHub Actions on every PR: lint, typecheck, tests, coverage gate, small fixed-set ML eval,
  benchmarks for DSP/vision/ML-touching changes, dependency scanning.
- Reference setups (named in each spec): Squier Stratocaster → Focusrite Scarlett; bass setup TBD.

## Machine Learning & Data Constraints

- ML code lives in `ml/` (Python) with pinned dependencies, config-driven pipelines and fixed seeds.
- Datasets live under `data/` (versioned, with cards); large binaries are stored by reference, not
  in git.
- Experiments are tracked and models registered with model cards; browser inference uses exported,
  evaluated artefacts only.
- Active learning MAY feed owner-corrected low-confidence predictions into a *new* dataset version;
  it MUST NOT alter an existing version or a test split.

## Development Workflow & Quality Gates

- Every feature MUST pass, in order: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
  `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` →
  `/speckit-converge`. No step may be skipped.
- Gates are defined in `CLAUDE.md` (subagent → step). At minimum: `spec-reviewer` before planning;
  `architecture-reviewer` on plans; `/speckit-analyze` with no CRITICAL issues before
  implementation; per task `test-writer` (red) → owner-approved implementation → green →
  `code-reviewer` (+ specialised reviewers by area).
- Implementation proceeds one task at a time: approach → owner OK → single task → gates → stop.

## Governance

- This constitution supersedes `CLAUDE.md`, specs, plans, tasks and all other guidance; conflicts
  are resolved by amending the lower document.
- Amendments require an ADR, owner approval, and a semantic version bump (MAJOR: principle removed
  or redefined; MINOR: principle/section added or materially expanded; PATCH: wording).
- `/speckit-analyze` and every reviewing subagent MUST treat any constitution violation as
  CRITICAL. CRITICAL findings block implementation and merge.

**Version**: 2.1.0 | **Ratified**: 2026-11-21 | **Last Amended**: 2026-11-21
