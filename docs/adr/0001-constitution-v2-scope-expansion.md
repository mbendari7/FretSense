# 0001. Constitution v2.0.0: Scope Expansion to Bass, Vision, ML and Engineering Showcase

- Status: Proposed (pending owner approval). Its "book part → lesson track" mapping is replaced by
  curriculum packs in ADR-0006.
- Date: 2026-11-21
- Deciders: owner
- Related: `.specify/memory/constitution.md`, ADR-0002, ADR-0003, specs 001, 006–013

## Context
Constitution v1.0.0 covered a guitar-only theory/DSP app. The owner expanded the goals to
(a) guitar **and** bass, (b) a deep on-device machine-vision and ML system with real MLOps, and
(c) a showcase of fundamental engineering skills. Several v1 rules conflict with that:

- "Each book part becomes one feature": the new 14-feature roadmap is capability-oriented
  (DSP, vision, ML, backend), and the 001 spec-reviewer flagged (BLOCKER #1) that 001 already
  spans several book parts.
- A single "< 30 ms note → screen" budget can't physically be met for bass (ADR-0002).
- "No account" conflicts with an optional sync backend (feature 013).
- The human-owned list didn't cover the new core algorithms.

## Decision
Bump to **2.0.0 (MAJOR)**. Changes:
- Book part → **lesson track** (not feature).
- Principle V redefined: onset acknowledgement ≤ 30 ms for every instrument, plus a pitch-confirmed
  budget per instrument (ADR-0002).
- Principle VI: "no account required"; sync allowed only as an opt-in.
- Principle IV expanded (homography/fret mapping, Viterbi fingering, KT equations, training runs).
- New principles: VIII Instrument-Agnostic, IX On-Device Privacy, X ML Rigor,
  XI Graceful Degradation, XII Skills Where Needed.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| MINOR bump (only add principles) | Smaller change | v1 principles V and VI and the book mapping would contradict the new roadmap | Contradictions would make every analyze run report CRITICAL |
| Keep "book part = feature" and squeeze vision/ML into book parts | Literal fit to the book | The book has no chapters on CNNs or homographies, so features would be artificial | Violates XII (skills forced in) |
| Separate constitution per area (app vs ml/) | Each area can evolve on its own | Two sources of truth, cross-cutting rules duplicated | Governance becomes ambiguous |
| Keep 30 ms for all instruments | Simple, strong claim | Physically unattainable for bass with period-based pitch detection | Would force a false claim (violates V's "measured claims only") |

## Consequences
- Feature 001 must be amended for InstrumentProfile (ADR-0003) and re-run through clarify → analyze.
- New subagents: ml-evaluator, dataset-curator, privacy-auditor, architecture-reviewer,
  security-reviewer, docs-keeper.
- New living docs: `docs/SKILLS-MATRIX.md`, `docs/THREAT-MODEL.md`.
- The README maps book parts → lesson tracks → enabling features.

## AI involvement
_To be written by the owner._
