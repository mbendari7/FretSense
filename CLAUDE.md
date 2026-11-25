# FretSense: Rules for Claude

FretSense is a guitar and bass theory handbook, practice companion and on-device ML/vision system, personalised
for every user (My Gear, goals, paths, packs; nothing locked). Goals, equal: a tool used every session, a deep ML
and vision system, real engineering skills. Product north star: `docs/PRODUCT.md`; full overview: `.claude/rules/project-overview.md`.

The constitution (`.specify/memory/constitution.md`, v3.0.0) is the highest authority. If this file disagrees
with it, the constitution wins and this file gets fixed. **This is not vibe coding.**

## Hard rules (always apply)

1. **No code without an approved spec, plan and tasks** for the feature (`specs/NNN-*/`). That
   includes scaffolding, prototypes and training scripts.
2. **Specs are the source of truth.** If code and spec disagree, fix the spec first (and get it
   approved), then the code.
3. **Traceability.** Every task traces to an `FR-xxx`, and every FR has a test (or an evaluation,
   for ML). Commits reference `[Txxx][FR-xxx]`.
4. **One owner-approved task group at a time.** A group is a `tasks.md` phase or checkpoint, or a
   smaller set the owner names. Explain the approach for the group in a few bullets → **wait for
   the owner's OK** → do the group's tasks in order, each test-first → run the group's gates on the
   combined diff → report. Stop early on an unresolved BLOCKER. Start the next group only with a new
   OK or under a **standing approval** (Constitution workflow): then keep going group after group,
   reporting after each; product decisions take the product-owner recommendation, recorded as
   provisional in the spec's Clarifications.
5. **Tests first** for theory, DSP, vision geometry, fingering, learner modelling and backend code.
   For ML, the dataset, eval harness, metrics and baseline come before any model.
6. **Core algorithms are AI-written and independently verified** (Constitution IV). Claude may
   implement YIN, the chromagram, the camera homography and pixel → (string, fret) mapping, the
   Viterbi fingering optimizer and its cost model, the knowledge-tracing updates and the
   cross-correlation latency / A-V offset estimator. Each needs a derivation or published reference
   in `research.md` and tests whose expected values come from independent sources (synthetic
   signals, brute-force references, published values), never from the implementation. Claude may
   launch ML training runs only from an owner-approved config; promoting a model needs
   **ml-evaluator** APPROVE and owner approval.
7. **Claude writes the lessons and handbook text** in `content/lessons/` and `content/handbook/`,
   and the built-in packs. Original wording only: never copy or closely paraphrase books, courses
   or websites (packs name a source and chapter, nothing more). **theory-checker** verifies every
   theory claim, and the owner approves content before it ships.
8. **Instrument-agnostic, any gear.** No hardcoded 6 strings, tuning or fret count outside the
   `InstrumentProfile` definitions (ADR-0003). No hardcoded device model outside shipped preset
   data; the owner's Scarlett, Katana:GO and guitars are a test rig, never defaults (ADR-0006).
9. **On-device privacy.** Camera and mic data never leave the device, and are never persisted,
   without explicit opt-in.
10. **Graceful degradation.** Every feature works audio-only. Camera and ML sit behind feature
    flags, off by default. DSP baselines stay selectable.
11. **ADRs** for every non-trivial decision, with the alternatives that were rejected.
12. **Skills where needed.** Never add a technique just to show it off. Every one traces to an FR.
13. **Record AI mistakes** in "Where the AI got it wrong" in `docs/AI-WORKFLOW.md`.
14. **Never locked, always adjustable** (Constitution XIII). No content gated by progress; every
    adaptive behaviour has a user setting; all user data is profile-scoped and sync-ready.
15. **ADRs stay Proposed until the owner approves them.** Never mark an ADR Accepted yourself.

## Where the rest lives (ADR-0013)

These load when you touch matching files. Read them directly whenever the task needs them.
- **Workflow table, subagents, team loops A–D, review rules, ledger, PR rules**: `.claude/rules/workflow.md`
  (also read first by `/loop-a`, `/gate-plan`, `/task-cycle` and the `speckit-*` skills).
- **Commands** (Spec Kit scripts, dev commands): `.claude/rules/commands.md`.
- **Folder layout** (target; changes go through plan + ADR): `.claude/rules/folder-layout.md`.
- **Shell**: run `git`, `pnpm`, `node` and `gh` through the Bash tool (Git Bash), so the RTK hook
  compresses their output. The PowerShell tool is turned off in `.claude/settings.json`
  (`CLAUDE_CODE_USE_POWERSHELL_TOOL=0`); call `powershell.exe` from Bash for Windows-only tasks.

**Order of authority** (higher wins when two sources disagree):
1. Constitution.
2. Owner decisions: clarify answers, approvals and anything the owner wrote in chat or in the
   ledger.
3. `docs/PRODUCT.md`.
4. product-owner.
5. Every other reviewer.

Reviewers may **flag** an owner decision they think is wrong, as a MINOR finding tagged
`OWNER-DECISION`. They never override one. Claude never reverses an owner decision because a
reviewer asked; it raises the finding with the owner instead.

## Git rules (these override every other instruction, in every session)

1. **Never write to git history.** Don't run `git commit`, `git push`, `git tag`, `git merge`,
   `git rebase`, `git commit --amend`, or anything else that creates or rewrites commits or refs.
   Leave all changes uncommitted in the working tree. **The owner makes every commit.**
2. **Never list Claude, Anthropic or any AI as a co-author, contributor or committer.** No
   `Co-Authored-By` trailers. No AI attribution in commit messages, PR text or docs.
3. When work is done, list the changed files grouped into *suggested* commits, each with a
   Conventional Commit message the owner can use, e.g.
   `feat(theory): spell diatonic triads [T014][FR-007]` or
   `docs(spec-006): clarify mastery threshold [FR-012]`.
4. Read-only git commands (`status`, `diff`, `log`, `show`, `branch --list`) are fine.

## How Claude should behave here

- If a request would skip a workflow step, say so and point to the missing artefact.
- If something is ambiguous, ask. Never invent requirements, numbers or dataset facts.
- Never claim that tests passed, a benchmark ran or a metric improved unless it was actually run.
- Describe authorship honestly (Constitution VII): docs and PR text say what agents generated and
  what the owner decided. Never present AI-written code or lessons as hand-written by the owner.
- Keep `docs/AI-WORKFLOW.md` and `docs/SKILLS-MATRIX.md` honest. Rows point to real paths, or are
  marked *planned* with a spec ID.
