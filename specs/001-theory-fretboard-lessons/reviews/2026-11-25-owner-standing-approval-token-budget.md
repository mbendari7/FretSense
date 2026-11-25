# Owner standing approval: token-budget work (ADR-0013)

- **Date**: 2026-11-25
- **Scope**: the token-budget work in ADR-0013 (Phases 0–5), including the spec 001 split and one
  `/task-cycle` run in Phase 5. It does not mark ADR-0013 Accepted (CLAUDE.md rule 15).
- **Recorded by**: the main AI agent, copied from chat word for word (the approval paragraph and the
  "Decisions already made" list; the phase-by-phase instructions that followed are in the chat).

## Approval (word for word)

> STANDING APPROVAL for the whole token-budget work below (CLAUDE.md hard rule 4 / Constitution standing-approval workflow). Copy this approval into the reviews ledger word for word with today's date. Run every phase in order without waiting for me between phases, and report after each phase in 3–5 lines. Stop ONLY on: an unresolved BLOCKER, anything that would change the constitution, deleting or removing anything I already have configured, or a tool install that fails twice. Never commit; no AI attribution or Co-Authored-By anywhere (CLAUDE.md git rules). Leave everything uncommitted.

## Decisions already made (word for word)

> - Phase 1 model tiers as you set them: opus = spec-reviewer, architecture-reviewer, product-owner; sonnet = code-reviewer, test-writer, user-tester, theory-checker, ml-evaluator, privacy-auditor, security-reviewer; haiku = docs-keeper, dataset-curator, perf-auditor.
> - 2.1: scoped reads for all gate agents. Exceptions: spec-reviewer at its own gate and architecture-reviewer at the plan gate read the full document; user-tester Mode A stays a full walkthrough. Re-rounds and per-task reviews are always scoped.
> - 2.4 additions approved (audio-io → perf-auditor; package.json/lockfiles/.github → security-reviewer; the model may add a gate but never drop one).
> - 2.5: small spec edits (not a new spec, and the diff touches ≤5 distinct FR-IDs, counted by grep) → spec-reviewer + product-owner; drop only user-tester Mode A. New specs or >5 FR-IDs → full loop A. Do NOT change the constitution's loop-A wording.
> - Spec split approved with your layout and this change: the index stays named spec.md (specs/001-theory-fretboard-lessons/spec.md) so Spec Kit keeps working, and the parts sit next to it: spec-us1-….md … spec-us7-….md, spec-shared-requirements.md, spec-clarifications.md. Every FR moves verbatim.
> - Record all of these decisions in ADR-0013 (Status stays Proposed).

## Owner sign-off

- 2026-11-25, owner in chat (copied word for word): "for waiting on me i approve everything start and makt it all"
