# Feature Specification: Adaptive Curriculum (Concept DAG, Knowledge Tracing, Spaced Repetition, Practice Planner)

**Feature Branch**: `006-adaptive-curriculum`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Adaptive curriculum: a concept prerequisite graph (a DAG built from the book's chapters) plus a knowledge-tracing model decides what I practise next, using topological ordering with mastery-driven unlocking. Knowledge tracing: Bayesian Knowledge Tracing, then a small sequence model, predicting which concepts I've mastered. Spaced repetition (SM-2 or FSRS) for facts and drills. Practice sessions: warm-up, weak spots, a song section and a review, generated from my mastery data. Progress dashboard: mastery per concept, accuracy and timing trends, technique scores over time."

**Practice-session value**: the owner opens the app, picks "20 minutes, bass", and gets a ready
plan (warm-up → weak spots → song section → review) built from what they actually know. They no
longer have to decide what to practise.

**Depends on**: 001 (concepts in lessons, drill attempts). It optionally uses 003 (timed
play-along) and 011 (technique scores) when they exist, and 007 for the sequence-model variant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Concept Graph and "What's Next" (Priority: P1)

Concepts (e.g. "notes on string 6", "major scale formula", "root–fifth–octave") have prerequisites
taken from the book's chapter order and the owner's concept file. The app shows which concepts
are unlocked, in progress, mastered or locked, and recommends what to learn next.

**Why this priority**: Without the graph, adaptation has nothing to adapt over.

**Independent Test**: Load a fixture concept graph, mark some concepts as mastered, and verify the
unlocked set and the recommended order.

**Acceptance Scenarios**:

1. **Given** a concept graph with no mastery, **Then** only concepts with no prerequisites are
   unlocked, and the recommendation follows topological order with book order as the tie-breaker.
2. **Given** concept A's mastery crosses the unlock threshold, **Then** every concept whose
   prerequisites are all mastered becomes unlocked, and the change is visible immediately.
3. **Given** a concept file that introduces a cycle, **When** content is validated, **Then**
   validation fails and names the concepts in the cycle.
4. **Given** concepts that apply only to bass, **When** the active family is guitar, **Then**
   they are hidden from recommendations but kept in the graph.

---

### User Story 2 - Knowledge Tracing (Priority: P1)

Every drill attempt that is tagged with concepts updates a per-concept mastery estimate. The
estimate predicts whether the next attempt will be correct, and its quality is measured.

**Why this priority**: This is what makes the curriculum adaptive rather than linear.

**Independent Test**: Feed a recorded or synthetic attempt sequence, and verify the mastery
trajectory against fixture values and the prediction metrics against the evaluation harness.

**Acceptance Scenarios**:

1. **Given** valid BKT parameters (guess + slip < 1), **Then** the posterior *before* the learn
   transition never decreases after a correct attempt and never increases after a miss, and a long
   run of correct attempts drives P(mastered) above the unlock threshold.
2. **Given** synthetic learners generated from known parameters, **When** parameters are fitted,
   **Then** they recover the true values within the tolerance in SC-002.
3. **Given** a frozen snapshot with a session-aligned split, **When** next-attempt correctness is
   predicted, **Then** AUC (with CI) and calibration are reported per family and gated against the
   simpler estimator (FR-010).
4. **Given** attempts on a fretboard-location concept in Standard and in Drop D, **Then** they
   update separate per-profile estimates. Theory concepts update one shared estimate (FR-006).

---

### User Story 3 - Spaced Repetition (Priority: P1)

Facts and drill items (e.g. "A on string 4", "M3 interval shape", "V7 in Eb") get review
schedules. Due items are surfaced first, and an answer reschedules its item.

**Why this priority**: Retention is the main way practice falls short. Reviews keep knowledge
from decaying.

**Independent Test**: With a fixed clock, simulate 30 days of reviews and verify the due dates
against scheduler fixtures.

**Acceptance Scenarios**:

1. **Given** items with due dates, **When** a session is generated, **Then** overdue items come
   first, ordered by overdue-ness and priority.
2. **Given** an item answered correctly and quickly, **Then** its next interval grows. If it is
   answered wrong, its interval resets according to the scheduler rules.
3. **Given** the FR-014 scale, **Then** fetching the next 20 due items and rescheduling one item each
   meet the bounds in FR-014.

---

### User Story 4 - Practice Session Planner (Priority: P2)

The owner chooses a duration (and instrument). The app generates a plan of warm-up, weak spots,
a song section and review, with drills and lesson links. The owner can run it step by step,
with a timer.

**Why this priority**: This is what the owner opens every session. It ties US1–US3 together.

**Independent Test**: With fixture mastery and schedules, generate plans for 10, 20 and 45 minutes,
and verify their structure, timing and targeted items.

**Acceptance Scenarios**:

1. **Given** a 20-minute bass session, **Then** the plan has the four sections in order. Their
   allotted durations add up to 20 min ± 10%, and the weak-spot section targets the lowest-mastery unlocked
   concepts.
2. **Given** a song is linked to an unlocked concept, **Then** the song section suggests it with
   its lesson. If there are no songs, the section is replaced by extra weak-spot practice.
3. **Given** the owner skips or ends a section early, **Then** the remaining plan adapts and the
   attempts made so far are recorded.
4. **Given** the same mastery, schedule, clock and seed, **Then** the generated plan is identical.

---

### User Story 5 - Progress Dashboard (Priority: P2)

The dashboard shows mastery per concept (graph and list views), accuracy and response-time
trends, review load, and, once feature 011 exists, technique scores over time. It is filterable
by instrument family.

**Why this priority**: Motivation and self-assessment. It is also the visible proof that adaptation
works.

**Independent Test**: With fixture data, verify each chart's values against the computed
aggregates, and run the accessibility checks.

**Acceptance Scenarios**:

1. **Given** 30 days of history, **Then** the trends show daily accuracy and median response time
   per instrument family.
2. **Given** a chart, **Then** an equivalent data table is available to screen readers and the
   keyboard.
3. **Given** technique scores are unavailable, **Then** that panel is hidden; it is never shown
   empty or fake.

---

### User Story 6 - Sequence-Model Knowledge Tracing (Priority: P3)

A small sequence model (trained offline via 007) is evaluated against BKT on the same held-out
data. It replaces BKT only if it beats BKT by the margin in SC-004. BKT always remains available.

**Why this priority**: BKT treats concepts independently. A sequence model can capture transfer
(e.g. learning string 6 speeds up string 5), which could pick better weak spots. It is worth
shipping only if it measurably predicts better on the owner's data.

**Independent Test**: Run the evaluation harness on the fixed held-out set, then compare AUC,
calibration and inference cost against BKT.

**Acceptance Scenarios**:

1. **Given** a trained model and BKT, **When** evaluated on the held-out set, **Then** both
   metrics and the comparison are committed together with the model card.
2. **Given** the model fails the margin, **Then** it is not enabled, and BKT remains the default.

---

### Edge Cases

- **Cold start**: with no attempts, mastery starts at global default parameters and priors.
  Recommendations follow book order.
- **Concept added or removed** in content: estimates are kept for surviving concepts. New concepts
  start at the defaults. Orphaned attempts are kept but ignored.
- **Attempt tagged with several concepts**: each tagged concept is updated independently. This is
  a known evidence double-count, documented in the model card. Evaluation scores each
  (attempt, concept) pair.
- **Long absence**: overdue spaced-repetition items flag their concepts "needs review" but don't
  re-lock anything. BKT has no forgetting term unless a later ADR adds one.
- **Clock changes and merged histories**: attempts are ordered by (timestamp, attempt id).
  Timestamps from the future are clamped to the import time.
- **Imported progress** (001 FR-043): estimates and schedules are recomputed from the merged
  attempt history.
- **Corrupted or evicted derived cache**: recomputed from attempts (FR-025).
- **Mic permission denied / no audio device**: the planner picks only tap-based drills (001).
- **Empty history**: the dashboard shows an empty state with a "start a 10-minute plan" action. No
  empty charts are shown.
- **Large graph at 390 px**: the list view is the default on phones. The graph view pans and zooms
  and can be reached by keyboard.
- **Everything mastered and nothing due**: the planner offers review, a preview of the next locked
  concept, or a free-play song section.

## Requirements *(mandatory)*

### Functional Requirements

**Concept graph**

- **FR-001**: System MUST build a concept graph from the owner-authored concept definitions (id,
  title, track/chapter, instrument families, scope: theory | fretboard-location, prerequisites) and
  the lesson `concepts` fields (001 FR-022).
- **FR-002**: Content validation MUST reject cycles (naming them), unknown prerequisite ids, and
  lessons that reference undefined concepts.
- **FR-003**: System MUST compute a topological order with track/chapter order as the tie-breaker,
  in O(V + E), with the complexity documented.
- **FR-004**: Lock state is kept per instrument family. A concept becomes unlocked for a family
  when every prerequisite that applies to that family is mastered (mastery ≥ the unlock
  threshold) [NEEDS CLARIFICATION: threshold value and whether the owner may manually unlock].
  Unlocking is sticky: a later drop in mastery never re-locks a concept.
- **FR-005**: "What's next" MUST return the first k (default 3) unlocked, unmastered concepts in
  topological order for the active family.

**Mastery estimation**

- **FR-006**: Theory-scope concepts MUST keep one estimate shared across instruments.
  Fretboard-location concepts MUST keep one estimate per InstrumentProfile (tuning-specific,
  matching 001's item keys), so Drop D practice never changes the Standard estimate.
- **FR-007**: Mastery estimation MUST sit behind an interchangeable estimator interface with these
  candidates:
  - (a) the baseline: per-concept running accuracy with a Laplace prior;
  - (b) Bayesian Knowledge Tracing, with per-concept prior, learn, slip and guess parameters. Its
    update equations are human-owned (Constitution IV);
  - (c) a sequence model (US6).

  The active estimator is the best one that has passed the gate (FR-010). If BKT doesn't beat the
  baseline, the baseline drives mastery and unlocking.
- **FR-008**: BKT parameters MUST be obtained for the single-learner regime as follows:
  - global defaults until a concept has ≥ 30 training attempts;
  - after that, per-concept estimates shrunk toward the pooled estimate across concepts;
  - bounds guess < 0.3, slip < 0.3, guess + slip < 1.

  Parameters are fitted **only** on the training portion of the frozen evaluation snapshot when
  evaluating (FR-010), and on all history only for live use. Fit and evaluation code paths are
  separate. Refitting runs after every 50 new attempts or on request. Past mastery trajectories are
  recomputed and labelled with the parameter version.
- **FR-009**: Each estimator MUST output P(correct on next attempt) and P(mastered) per concept, and
  update in < 10 ms at p95 per attempt on the reference phone.
- **FR-010**: Evaluation MUST use a frozen, versioned snapshot of the attempt history with a dataset
  card (feature 007 rules). It is split by one global time cutoff aligned to session boundaries
  (training: sessions before the cutoff; held-out: the last 20% of sessions). The same split is
  shared by every estimator. Metrics, per instrument family and overall:
  - AUC with a 95% bootstrap CI (1,000 resamples);
  - log-loss;
  - expected calibration error (10 equal-width bins);
  - a calibration curve.

  An estimator passes the gate only if the lower bound of the 95% CI of its ΔAUC over the
  next-simpler estimator is > 0, its ECE is no worse by more than 0.01, and every reported family
  has ≥ 300 held-out attempts. Otherwise the result is "insufficient evidence" and the simpler
  estimator stays active.
- **FR-011**: A synthetic-learner generator with known parameters MUST exist. It serves **only** to
  verify the fitter and the harness, never as evidence that one estimator beats another.
- **FR-012**: The sequence model (US6) MUST:
  - train only on training portions of frozen snapshots of the owner's history;
  - meet Constitution X (card, held-out evaluation, the FR-010 gate over BKT or the baseline);
  - sit behind a feature flag, off by default;
  - update in < 10 ms at p95;
  - fall back to the next estimator with a visible, non-blocking notice if loading fails.

**Spaced repetition**

- **FR-013**: System MUST schedule review items with [NEEDS CLARIFICATION: SM-2 or FSRS?]. Each
  answer's outcome and response time map to the scheduler's grade by a documented rule.
- **FR-014**: At the expected scale (≤ 5,000 review items, ≤ 300 concepts, ≤ 50,000 attempts),
  fetching the next 20 due items and rescheduling one item MUST each take < 5 ms at p95 on the
  reference phone, and a full recompute from attempts MUST take < 2 s. The data structure is
  chosen in plan.md and justified against these numbers (Constitution XII).
- **FR-015**: Review items MUST be derived from 001 drill items (with 001's item keys) and from
  per-concept fact prompts. Fact prompts inherit 001's spelling rules (FR-004, FR-060), cover the
  30 keys of 001 FR-007, and accept only the context-correct spelling.
- **FR-016**: Scheduling MUST be deterministic given the history, clock and seed (FR-020a).

**Practice planner**

- **FR-017**: Users MUST be able to request a plan by duration (10–90 min; presets 10, 20, 30, 45)
  and instrument family.
- **FR-018**: A plan MUST have these sections, each deep-linking to the named stage:
  - warm-up (15%): mastered items, quick drills → Drill;
  - weak spots (40%): the lowest-mastery unlocked concepts → Drill;
  - song section (25%): songs tied to unlocked concepts → the lesson's "Songs to practice" in Read;
  - review (20%): due items, run directly.

  Steps are at least 2 minutes long. The total *allotted* time MUST be within ±10% of the request.
  Each step states why it was chosen.
- **FR-019**: During a plan, a large, screen-reader-announced step timer MUST run. Skipping or
  ending a section MUST re-plan the remainder. Every attempt MUST update the estimators and the
  scheduler.
- **FR-020**: Plan generation MUST complete in < 200 ms at p95 at the FR-014 scale.
- **FR-020a**: Determinism: for identical inputs, results MUST be bit-identical on the same browser
  engine and within 1e-9 for probabilities across engines. Plan seeds are derived from (request
  date, duration, family) and stored with the plan.

**Dashboard**

- **FR-021**: The dashboard MUST show mastery per concept (list view, default on phones; graph view
  with lock state), accuracy and median response-time trends (daily, 7/30/all-time), and review
  load (due today and over the next 7 days), filterable by family and profile. It shows the active
  estimator and its parameter version.
- **FR-022**: Every chart MUST have an accessible data-table equivalent and colour-blind-safe
  encoding.
- **FR-023**: Technique-score panels MUST appear only when feature 011 provides data.

**Cross-cutting**

- **FR-024**: All of this feature MUST run on the device and offline. Nothing leaves the device
  unless the owner opts into sync (feature 013).
- **FR-025**: Mastery and schedules MUST be recomputable from the attempt history alone. Plan
  records (including skips) are stored separately and are exempt.

### Key Entities

- **Concept**: id, title, track/chapter, families, scope (theory | fretboard-location), prerequisites.
- **Concept graph**: DAG; topological order; per-family lock state (sticky unlocks).
- **Mastery estimate**: concept + (profile, for fretboard-location concepts), P(mastered),
  P(next correct), estimator id, parameter version.
- **Estimator**: type (baseline / BKT / sequence), version, parameters/artefact, gate record.
- **Evaluation snapshot**: frozen attempt history, version, card, session-aligned cutoff, splits.
- **Review item**: id, source item/concept, profile/family, scheduler state, history.
- **Practice plan**: request, seed, sections → steps (target, reason, allotted time, deep link),
  status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of concept-graph fixtures pass: unlock sets per family, sticky unlocks,
  topological order, and cycle detection on graphs of up to 500 concepts.
- **SC-002**: **Fitter check, single-learner regime**: on synthetic single learners (1 learner,
  30–150 attempts per concept, 50 concepts, known parameters), the "mastered" classification at
  the unlock threshold agrees with the generating state in ≥ 85% of concept-instants. On the
  multi-learner regime (200 × 50), fitted parameters are within ±0.05 of the true values for
  ≥ 90% of concepts. These checks verify the code; they are not comparative evidence.
- **SC-003**: **Estimator gate** (FR-010), on the frozen owner snapshot: BKT is active only if it
  passes the gate over the baseline. The result (pass, fail or insufficient evidence) is committed
  with per-family metrics and CIs. The first evaluation is due once every family in use has ≥ 300
  held-out attempts.
- **SC-004**: The sequence model is enabled only if it passes the same gate over the active
  estimator, per family.
- **SC-005**: 100% of planner fixtures have allotted totals within ±10% of the request, with steps
  of at least 2 minutes. Generation takes < 200 ms at p95 at the FR-014 scale.
- **SC-006**: Scheduler and recompute performance meets FR-014 on the reference phone.
- **SC-007**: Over the first 4 weeks, with ≥ 20 post-session check-ins, the owner rates "the plan
  picked the right things" ≥ 4/5 in at least 75% of them.
- **SC-008**: Every dashboard chart passes automated accessibility checks and has a data-table
  equivalent.

## Assumptions

- Concepts and prerequisites are authored by the owner (a concept file plus lesson tags). The
  agent proposes structure only.
- Learning evidence comes from 001 (and later 003) attempts. Technique scores (011) feed the
  dashboard, not mastery.
- One learner per device. The reference phone is the one recorded in 001's Clarifications.
- Before the owner's snapshot reaches the FR-010 minimums, the baseline estimator is active, and
  BKT runs in shadow mode (computed and logged, not used for unlocking).
