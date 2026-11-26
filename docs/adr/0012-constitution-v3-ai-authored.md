# ADR-0012: Constitution v3.0.0, AI-authored and owner-directed

- **Status**: Accepted (owner approval 2026-11-25, recorded in "Owner approvals recorded" below; earlier status: Proposed (the owner accepts or rejects it; it is not Accepted until the owner says so))
- **Date**: 2026-11-22
- **Deciders**: the owner (Mahmoud); drafted by the main AI agent at the owner's request

## Context

Constitution v2.x reserved the core algorithms (YIN, chromagram, homography, Viterbi fingering,
knowledge tracing, the latency/A-V estimator), all ML training runs and all lesson and handbook
prose for the owner, and approved one implementation task at a time. The owner asked for the AI to
write all of the software and all of the lessons, and to stop being asked for approval at every
step, so that a usable product exists to test and give feedback on.

## Decision

Constitution v3.0.0 (MAJOR: Principle IV is redefined):

- **IV "AI-Authored, Owner-Directed"**: agents may write all code, including the core algorithms,
  and all lesson, handbook and pack text. Each core algorithm needs a derivation or published
  reference in `research.md` and tests whose expected values come from independent sources.
  Lesson text must be original, theory-checked and owner-approved before it ships. Agents may launch
  training only from an owner-approved config; model promotion needs ml-evaluator APPROVE and owner
  approval.
- **VII**: authorship must be described honestly (docs and PRs say what agents generated); AI is still
  never credited as an author or co-author, and the owner still makes every commit.
- **Workflow**: owner-approved **task groups** instead of single tasks, gates run on each group's
  combined diff, and a **standing approval** lets work continue group after group with a report after
  each; product decisions then take the product-owner recommendation, recorded as provisional.

Specs, tests-first, reviewer gates, ADRs and the release order (v0.1 → v0.4 vision) are unchanged.

## Alternatives rejected

- **Keep one task at a time with owner OK per task**: rejected by the owner; too slow to get a
  testable product.
- **Drop specs and gates and just build**: rejected by the owner ("keep specs + gates"); the gates
  and traceability are what make the work credible to an employer.
- **AI writes code but the owner keeps lesson prose**: rejected by the owner; lessons are needed for
  the product to be usable.

## Consequences

- Specs written under v2.x that reserve work for the owner are amended at their next loop; until
  then the constitution governs.
- The project's `.claude/settings.json` still denies edits to `content/lessons/**` and
  `content/handbook/**` (a v2.x guard). Only the owner changes permission settings; until they do,
  agents cannot write lessons.
- Reviewers check for independent verification of core algorithms and for copied text in lessons
  instead of checking who wrote them.

## Owner approvals recorded

- Accepted 2026-11-25, owner in chat (copied word for word): "approve anything else left and actually build and create the program". Ledger: `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-blanket-approval-build.md`.
