# ADR-0013: Token budget for the agent workflow

- **Status**: Accepted (owner approval 2026-11-25, recorded below)
- **Date**: 2026-11-25
- **Deciders**: the owner (Mahmoud); drafted by the main AI agent at the owner's request
- **Related**: `docs/token-budget/baseline.md`, `docs/token-budget/after.md` (Phase 5), `CLAUDE.md`,
  `.claude/agents/*`, `.claude/skills/{task-cycle,loop-a,gate-plan}`

## Context

The spec-driven workflow (constitution v3.0.0, CLAUDE.md) runs up to 13 subagents per gate. Most of
them read whole artefacts: `specs/001-*/spec.md` is about 106 KB, and CLAUDE.md is about 18.8 KB and
loads on every turn. In the 7-day baseline (`docs/token-budget/baseline.md`) the agent used 305.5 M
tokens and $192.43. 99.1% of the cost was on Opus and 95.1% of the tokens were cache reads. Eight
subagents had no `model:` line and so ran on the main model. Re-review rounds started fresh agents
that re-read everything.

The goal is to cut that cost **without weakening** any gate, approval or traceability rule.

## Decision

1. **Model tiering.** Each agent's frontmatter pins `model:`:
   - **opus**: spec-reviewer, architecture-reviewer, product-owner.
   - **sonnet**: code-reviewer, test-writer, user-tester, theory-checker, ml-evaluator,
     privacy-auditor, security-reviewer. The last two are sonnet rather than haiku because they
     enforce constitution hard rule 9 and the threat model; the owner approved this on 2026-11-25.
   - **haiku**: docs-keeper, dataset-curator, perf-auditor.
2. **Scoped reads.** Every gate agent gets: "Grep for the FR-IDs and the task ID you were given. Read
   only those sections, their acceptance criteria and any linked Clarifications. Read the
   constitution only when you need to cite a principle (Grep for it)." Exceptions (owner decision
   2026-11-25): spec-reviewer at its own gate and architecture-reviewer at the plan gate read the
   full document, and user-tester Mode A stays a full walkthrough. Re-rounds and per-task reviews are
   always scoped.
   - **Spec split** (owner-approved 2026-11-25): `specs/001-theory-fretboard-lessons/spec.md` stays
     the index (so Spec Kit keeps working), with parts next to it: `spec-us1-….md` … `spec-us7-….md`,
     `spec-shared-requirements.md` and `spec-clarifications.md`. Every FR moves verbatim.
     `scripts/check-fr-ids.mjs` showed the FR/SC sets are identical before and after
     (`docs/token-budget/spec-split/`). spec-reviewer reviews the structure for one round.
3. **Diff-only re-reviews.** Rounds r2 and r3 either resume the same reviewer (SendMessage), or start a
   fresh reviewer that gets only the previous findings file and the `git diff` of the fixes. The
   round limit and the ledger rules are unchanged.
4. **Deterministic gate selection.** `scripts/select-gates.mjs` maps `git diff --name-only` to the
   gates that apply, and code-reviewer always runs. The owner approved these additions on 2026-11-25:
   `packages/audio-io/**` → perf-auditor; `package.json`, lockfiles and `.github/**` → security-reviewer.
   ml/ and model artefacts → ml-evaluator, and `data/` → dataset-curator, keep the old table's gates. The mapping can only add gates beyond what CLAUDE.md
   requires, never remove them. The model may add a gate the script missed, but may not drop one the
   script printed.
   - **Rule-1 exception (owner-approved 2026-11-25):** this is developer tooling for the workflow, not a
     product feature, so it is covered by this ADR instead of a `specs/NNN-*` folder. It still gets
     tests and code-reviewer.
5. **Proportional loop A** (owner decision 2026-11-25). A small spec edit is one that is not a new
   spec and whose diff touches ≤ 5 distinct FR-IDs, counted by grep in `/loop-a` step 0. It runs
   spec-reviewer and product-owner, and drops only user-tester Mode A and its triage. New specs, or
   edits touching more than 5 FR-IDs, run the full loop A. The constitution's loop-A wording is not
   changed.
6. **Lean always-loaded context.** CLAUDE.md is trimmed to about 1.5 k tokens. The workflow table, team
   loops and ledger rules move into the skills that run them, or into path-scoped `.claude/rules/`
   files, so each rule still loads whenever it is needed. Nothing is deleted.
7. **Tooling.**
   - **RTK** (rtk-ai/rtk, the Token Killer) compresses command output through a Bash-tool hook. It
     hooks only the Bash tool, so `pnpm`, `git` and `gh` run through Bash, not PowerShell.
   - **Serena** (oraios/serena) does symbol-level code lookup through MCP with the TypeScript
     language server. Only code-reviewer, test-writer, theory-checker and architecture-reviewer get it.
   - **Context7** (upstash/context7) fetches library docs on demand. Only test-writer and
     architecture-reviewer get it.
   - **No GitHub MCP server**: use the `gh` CLI through Bash, so its output goes through RTK.
   - **ccusage statusline** in the project `.claude/settings.json` shows the cost of the current
     block, with telemetry disabled.
   - Each MCP server is kept only if its tool-list cost (from `/context`) is justified. Any removal
     needs owner OK.
8. **Measured, not estimated.** Savings are reported in `docs/token-budget/after.md` only from real
   ccusage runs.

## Consequences

- Cost per gate should fall, mainly from tiering and scoped reads. This is a hypothesis until
  `after.md` measures it.
- Weaker models on some gates risk missing findings. Mitigations: the security and privacy gates stay on
  sonnet, opus keeps the spec, architecture and product gates, and any misfire is logged in
  "Where the AI got it wrong" (`docs/AI-WORKFLOW.md`) and may move a tier.
- Scoped reads risk missing cross-cutting conflicts. Mitigation: spec-reviewer and
  architecture-reviewer still read the whole spec and plan at their own gates. Scoping applies to
  per-task reviews and re-rounds.
- New external tools (RTK, Serena, Context7, ccusage) are dependencies of the developer environment, not
  of the product. They are installed only from their upstream instructions and are never shipped.
- Context7 sends library-name queries to an external service. It never sends project code, user
  data or media (constitution: on-device privacy).

## Alternatives rejected

- **Switch to OpenSpec now.** It would be a lighter spec format, but migrating 001 and the gate
  skills mid-v0.1 costs more than it saves, and it throws away the Spec Kit ledger and traceability already
  in place. This can be revisited after v0.1 ships, with its own ADR.
- **Let every gate run on every task.** It is the simplest rule and catches the most, but most gates
  find nothing on unrelated diffs (privacy on a theory change, for example), so it is the main source of
  wasted Opus spend. Deterministic selection keeps the required gates and drops the irrelevant ones.
- **No limits at all.** It costs nothing to set up, but spend is unbounded: one build session cost
  $143.81 (baseline), and nothing gives a signal before the cost lands. Rejected.
- **Haiku for privacy-auditor and security-reviewer** (the first proposal). Rejected by the owner on
  2026-11-25 in favour of sonnet, because these gates enforce constitution hard rules.

## Owner approvals recorded

- 2026-11-25, owner in chat, in reply to the Phase 0 proposal (which asked to approve Phase 0, move
  privacy-auditor and security-reviewer to sonnet, and cover select-gates.mjs by an ADR exception):
  "yes i approve  all"

- 2026-11-25, standing approval and decisions for the whole token-budget work, copied word for word
  in `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-standing-approval-token-budget.md`.

## Owner sign-off

- Accepted 2026-11-25, owner in chat (copied word for word): "for waiting on me i approve everything start and makt it all"
