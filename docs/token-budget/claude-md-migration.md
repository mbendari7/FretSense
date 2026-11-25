# CLAUDE.md migration (ADR-0013, Phase 3)

- **Date**: 2026-11-25
- **Why**: CLAUDE.md loads on every turn of every session and every subagent. Rules that are only
  needed for spec work now live in path-scoped `.claude/rules/*.md` files. Claude Code loads those only
  when it works with matching files (docs: code.claude.com/docs/en/memory.md, "Path-specific rules").
  The skills that run the workflow also read them explicitly.

## Size

| | Words | Bytes | Tokens (estimate: bytes ÷ 4) |
|---|------:|------:|-----------------------------:|
| CLAUDE.md before | 2,583 | 18,514 | ≈ 4,600 |
| CLAUDE.md after | 981 | 6,826 | ≈ 1,700 |
| `.claude/rules/*.md` (path-scoped, loaded on demand) | 1,980 | — | — |

The token figures are an estimate (bytes ÷ 4), not a measurement. The real number will come from
`/context`, which the owner runs (see `baseline.md`). The trimmed file is slightly over the ~1.5 k
target because the 15 hard rules, git rules and authority order were kept verbatim.

Path-scoped rules still cost tokens when they load: `workflow.md` loads in any session that touches
`specs/**`. The saving is in sessions and subagents that never touch those paths, and in the fact that a
rule file is no longer re-sent on turns before it is needed.

## Moved-rules map

| Rule / section (old CLAUDE.md) | New location | Loads when |
|---|---|---|
| Project summary, three goals, "not vibe coding" (full text) | `.claude/rules/project-overview.md` (verbatim); a 3-line summary stays in CLAUDE.md | `docs/**`, `specs/**`, `content/**`, `README.md` |
| Constitution is the highest authority | CLAUDE.md | always |
| Hard rules 1–15 | CLAUDE.md (verbatim) | always |
| Workflow table (Spec Kit steps 0–8 and gates) | `.claude/rules/workflow.md` | `specs/**`, `.specify/**`, `docs/feedback/**`, `docs/adr/**`, `.claude/agents/**`, `.claude/skills/**`; read first by `loop-a`, `gate-plan`, `task-cycle` and every `speckit-*` skill |
| Subagents table and "Subagents report findings…" | `.claude/rules/workflow.md` | as above |
| Team loops A–D and "After every loop" summary | `.claude/rules/workflow.md`; loop A gains the 2.5 sizing rule (below) | as above |
| Review rules: severity, round limit | `.claude/rules/workflow.md` | as above |
| Order of authority, and reviewers flag but never override owner decisions | CLAUDE.md (verbatim) | always |
| "Approval is recorded" and review-ledger format | `.claude/rules/workflow.md` | as above |
| Commands: Spec Kit scripts, dev commands | `.claude/rules/commands.md` | `specs/**`, `.specify/**`, `package.json`, `pnpm-workspace.yaml`, `apps/**`, `packages/**`, `scripts/**` |
| Git rules 1–4 | CLAUDE.md (verbatim) | always |
| Pull requests (written by the owner) | `.claude/rules/workflow.md` | as above |
| Folder layout | `.claude/rules/folder-layout.md`; a one-line pointer stays in CLAUDE.md | `packages/**`, `apps/**`, `services/**`, `ml/**`, `data/**`, `bench/**`, `fixtures/**`, `content/**`, `scripts/**`, `specs/**/plan.md`, `docs/ARCHITECTURE.md` |
| How Claude should behave here | CLAUDE.md (verbatim) | always |
| *New:* shell rule (git/pnpm/node/gh through Git Bash so RTK sees them) | CLAUDE.md | always |

## Intentional changes (not verbatim)

1. **Loop A sizing** (owner decision 2026-11-25). `.claude/rules/workflow.md`, under "A. After every
   `/speckit-specify` or spec change", gains a "Size first" bullet. A new spec, or a change touching more than 5
   distinct FR-IDs, runs the full loop. Smaller edits run spec-reviewer and product-owner and skip
   user-tester Mode A and its triage. The constitution's wording is not changed.
2. The 3-line summary at the top of CLAUDE.md is new wording. The original text is kept verbatim in
   `project-overview.md`.
3. Skill references moved from "CLAUDE.md: Team loop A / Review rules / Workflow table" to
   `.claude/rules/workflow.md` in `loop-a`, `gate-plan` and `task-cycle`. Every `speckit-*` skill got
   a note to read it.

## No-loss check

Each non-blank line of the old CLAUDE.md (218 lines, with whitespace and heading markers normalised) was
searched for in the new CLAUDE.md plus `.claude/rules/*.md`. **0 missing.** The old file is in git at
`HEAD:CLAUDE.md`.

## Noticed, not changed

- The moved "Dev commands don't exist yet" paragraph (`commands.md`) is out of date: `pnpm install`,
  `pnpm test` and others exist since v0.1 landed. It is left verbatim. Updating it is a separate edit
  for the owner.
- `.claude/skills/task-cycle/SKILL.md` "Hard stops → Human-owned code" still says that the core
  algorithms and ML training belong to the owner. That predates constitution v3.0.0 (Principle IV:
  agents may implement them with independent verification). It is unchanged, because the skill's
  hard stops are the owner's to revise.
