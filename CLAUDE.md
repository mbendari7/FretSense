# FretSense: Rules for Claude

FretSense is a guitar **and bass** theory handbook, real-time practice companion, and on-device
machine-vision and ML system, **personalised for every user**: their own gear (My Gear), goals,
learning paths, lesson stages and curriculum packs. The built-in curriculum is general theory,
delivered as a curriculum pack; users create packs mapping lessons to any book or course (the
owner's *Guitar Theory for Dummies* pack is one example, not a dependency). **Nothing is locked**:
the curriculum recommends, never forces. Lessons have stages Read → See → Drill → Play →
Camera-coach. Features are capability-oriented and ship in product releases v0.1–v1.0. The vision,
pillars, release plan and non-goals are in `docs/PRODUCT.md` (the product north star, below the
constitution); every spec names its release.

The three goals matter equally:
1. **A teaching tool any guitarist or bassist (the owner included) uses every session**, that adapts
   to them. If a feature wouldn't help a real practice session, it doesn't ship.
2. **A deep ML and vision system**: real models, datasets, evaluation and MLOps.
3. **Fundamental engineering skills**, each used where it's genuinely needed (`docs/SKILLS-MATRIX.md`).

**This is not vibe coding.** The constitution (`.specify/memory/constitution.md`, v2.3.0) is the
highest authority. If this file disagrees with it, the constitution wins and this file gets fixed.

---

## Hard rules (always apply)

1. **No code without an approved spec, plan and tasks** for the feature (`specs/NNN-*/`). That
   includes scaffolding, prototypes and training scripts.
2. **Specs are the source of truth.** If code and spec disagree, fix the spec first (and get it
   approved), then the code.
3. **Traceability.** Every task traces to an `FR-xxx`, and every FR has a test (or an evaluation,
   for ML). Commits reference `[Txxx][FR-xxx]`.
4. **One task at a time.** Explain the approach in a few bullets → **wait for the owner's OK** →
   do that single task → run its gates → report → stop. **Never batch tasks.**
5. **Tests first** for theory, DSP, vision geometry, fingering, learner modelling and backend code.
   For ML, the dataset, eval harness, metrics and baseline come before any model.
6. **Human-owned code**, which Claude must not implement (not even as a "starter" or as
   pseudocode that is really the implementation):
   - YIN pitch detection
   - the chromagram
   - the camera homography and pixel → (string, fret) mapping math
      - the Viterbi fingering optimizer and its fingering cost model (005; 017 ranks voicings with it)
   - the knowledge-tracing update equations
   - the cross-correlation estimator for round-trip latency and audio–video offset (015)
   - **running** the ML training experiments

   Claude may test, benchmark, explain and review these, and build tooling around them.
7. **The owner writes all lesson prose** in `content/lessons/`, and all handbook explanation and
   glossary text in `content/handbook/` (017). Claude may propose schemas and
   check the theory, but never writes the prose or copies book text.
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

## Workflow: which subagent gates which Spec Kit step

| # | Step | Output | Gate before the next step |
|---|------|--------|---------------------------|
| 0 | `/speckit-constitution` | `.specify/memory/constitution.md` | Owner approval + ADR + version bump |
| 1 | `/speckit-specify` | `specs/NNN-*/spec.md`, `checklists/requirements.md` | **spec-reviewer**; team loop A (**product-owner** review → **user-tester** Mode A → **product-owner** triage) |
| 2 | `/speckit-clarify` | `## Clarifications` in the spec | **product-owner** proposes answers, the owner answers every NEEDS MAHMOUD item; **spec-reviewer** has no BLOCKERs; **product-owner** verdict APPROVE + owner approves the spec |
| 3 | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | **architecture-reviewer**; ADRs written; **privacy-auditor** if camera/mic/network is involved; **security-reviewer** if auth/input/backend is involved; owner approves |
| 4 | `/speckit-checklist` | `checklists/*.md` | Items resolved or explicitly deferred |
| 5 | `/speckit-tasks` | `tasks.md` (test-first, `[P]`, FR tags, gate tags) | — |
| 6 | `/speckit-analyze` | Consistency report | No CRITICAL or HIGH findings; owner approves |
| 7 | `/speckit-implement` | One task at a time | Per task: **test-writer** (red) → owner OK → implement → green → **code-reviewer**, plus by area: **theory-checker** (theory/fingering), **perf-auditor** (DSP/vision/inference/hot paths), **ml-evaluator** (models/exports), **dataset-curator** (data/), **privacy-auditor** (media/network), **security-reviewer** (auth/input/deps/CI), **architecture-reviewer** (new modules or deps). After each user-facing task group: team loop B (**user-tester** Mode B → **product-owner** triage) |
| 8 | `/speckit-converge` | Remaining work added to `tasks.md` | **code-reviewer** on the full diff + the relevant area gates; **docs-keeper** syncs the docs; team loop B before a release |

### Subagents (`.claude/agents/`)

| Agent | Access | Gates |
|-------|--------|-------|
| `spec-reviewer` | read-only | specify/clarify → plan |
| `architecture-reviewer` | read-only | plan; diffs that add modules, packages or dependencies |
| `test-writer` | **test, fixture, bench and eval-harness files only** | start of every implementation task |
| `code-reviewer` | read-only | end of every task and PR |
| `theory-checker` | read-only | theory output, bass patterns, fingerings, lesson theory claims |
| `perf-auditor` | read-only + runs benchmarks | **Owns all latency benchmarks**: audio round trip, device detection, DSP, vision, inference; per-instrument budgets (ADR-0002) |
| `ml-evaluator` | read-only + runs evals | any model, training config or exported artefact |
| `dataset-curator` | **`data/` and dataset cards only** | any dataset version, label or split change |
| `privacy-auditor` | read-only | camera, mic, recording, storage, telemetry, network, sync; confirms the mic and camera are active only when needed, with a visible "listening" / "camera on" indicator |
| `security-reviewer` | read-only | auth, input parsing, secrets, dependencies, CI/CD, Docker |
| `docs-keeper` | **`README.md` and `docs/` only** | after plan, tasks and converge; keeps SKILLS-MATRIX, roadmap and ADR index in sync |
| `product-owner` | read-only | the owner's stand-in on WHAT and WHY: reviews every new or changed spec (APPROVE / REVISE / REJECT), proposes `/speckit-clarify` answers, triages user-tester feedback; APPROVE required before `/speckit-plan`; never writes code |
| `user-tester` | read-only + **`docs/feedback/` only** | simulated personas: Mode A (spec walkthrough) after every specify or spec change; Mode B (hands-on) after each user-facing task group or release |

Subagents report findings. Only the four writers (test-writer, dataset-curator, docs-keeper,
user-tester) change files, and only inside their scope. The owner decides what to act on.
**product-owner decisions are proposals**: the owner has final approval on all of them.

## Team loop (product-owner + user-tester; always follow)

Claude runs these loops itself and applies only what the loop allows. Nothing here replaces an
owner approval in the workflow table.

**A. After every `/speckit-specify` or spec change**
1. **product-owner** reviews the spec.
2. **user-tester** runs Mode A (spec walkthrough) and writes its report to `docs/feedback/`.
3. **product-owner** triages that report into fix now / backlog / won't do.
4. Claude applies product-owner's exact edits and "fix now" items to the spec (spec text only),
   then reports them to the owner. Anything marked NEEDS MAHMOUD is not applied; it waits.

**B. At `/speckit-clarify`**
1. **product-owner** proposes an answer to every question (Decision / Why / Confidence).
2. Claude shows the owner **all** proposed answers and **waits**. Nothing is written into the
   spec until the owner responds.
3. The owner answers every **NEEDS MAHMOUD** item personally. Claude never fills one in, never
   picks a default for one, and never lets product-owner's proposal stand in for it.

**C. At spec approval**
- **product-owner** must return **APPROVE** before `/speckit-plan`. REVISE or REJECT sends the
  spec back through loop A. The owner's own approval is still required as well.

**D. After each user-facing task group or release**
1. **user-tester** runs Mode B (hands-on test) and writes its report to `docs/feedback/`.
2. **product-owner** sorts the feedback into **fix now / backlog / won't do**.
3. Each "fix now" item becomes a **spec change request** (FR wording + acceptance criteria) for
   the owner. **No code changes** until the owner approves it; an approved change then goes
   through the normal spec → tasks → implement flow. Backlog items are listed with their
   suggested spec number; won't-do items keep their reason.

**After every loop**, give the owner a short summary:
- **Decisions:** what product-owner decided or proposed, and what was applied.
- **Feedback:** the user-tester report path, star rating and top findings by severity.
- **Needs your approval:** every NEEDS MAHMOUD item, change request and unapproved verdict.

## Commands

**Spec Kit** (skills in `.claude/skills/`, scripts in `.specify/scripts/powershell/`):

| Purpose | Command |
|---------|---------|
| New feature folder (+ `feature.json`) | `.specify/scripts/powershell/create-new-feature.ps1 -Json -ShortName <name> -Number <N> "<description>"`, then `git checkout -b <BRANCH_NAME>` (this Spec Kit version doesn't create the branch) |
| Plan setup | `.specify/scripts/powershell/setup-plan.ps1 -Json` |
| Prerequisite check | `.specify/scripts/powershell/check-prerequisites.ps1 -Json [-RequireTasks -IncludeTasks]` |
| Resolve a template | `.specify/scripts/powershell/resolve-template.ps1 <name> -Json` |
| Switch active feature | edit `.specify/feature.json` → `{"feature_directory": "specs/NNN-name"}` |

**Dev commands** don't exist yet. They are defined in each feature's `quickstart.md` and become
real when that feature's setup tasks land. Don't run or cite them before then. Planned for 001:
`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`,
`pnpm --filter @fretsense/theory test`, `pnpm --filter web dev`, `pnpm --filter web e2e`,
`pnpm lessons:validate`.

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

## Pull requests (written by the owner)

Every PR has: **Summary** (tasks and FRs covered), **Gate results** (every subagent verdict), and
**AI involvement** (what agents generated, and what the owner changed or rejected). The owner
writes the AI-involvement section. Each feature gets its own branch `NNN-short-name`, which the
owner creates.

## Folder layout (target; changes go through plan + ADR)

```
FretSense/
├── CLAUDE.md
├── .claude/{agents,skills}/          # committed; settings.local.json is gitignored
├── .specify/                         # constitution, templates, scripts
├── specs/NNN-<feature>/              # spec, plan, research, data-model, contracts, quickstart, tasks, checklists
├── content/lessons/                  # owner-written lessons (_template.md is the only AI-made file)
├── content/handbook/                 # owner-written handbook explanations and glossary [017]
├── content/packs/                    # curriculum packs (built-in General Theory; _template.yaml)
├── packages/
│   ├── theory/                       # pure TS domain: notes, intervals, InstrumentProfile, fretboard graph
│   ├── dsp/                          # Rust → wasm: YIN, chromagram, onset (owner-written cores) [002+]
│   ├── vision/                       # hand/neck tracking adapters, geometry [008+]
│   ├── learner/                      # concept DAG, knowledge tracing, scheduler [006]
│   ├── audio-io/                     # AudioBackend port, device state machine, calibration [015]
│   └── ml-runtime/                   # onnxruntime-web adapters, model registry client [009+]
├── apps/web/                         # React + Vite PWA (domain/application/infrastructure/ui)
├── apps/desktop/                     # optional Tauri + Rust/cpal native audio backend [015]
├── services/sync/                    # optional FastAPI + PostgreSQL backend [013]
├── ml/                               # Python training/eval pipelines, configs, model cards [007+]
├── data/                             # dataset manifests, splits and cards (media by reference) [007+]
├── fixtures/                         # theory JSON, golden audio/video clips
├── bench/                            # latency/accuracy/fps harnesses + baselines
├── docs/{adr/,feedback/,AI-WORKFLOW.md,SKILLS-MATRIX.md,THREAT-MODEL.md,ARCHITECTURE.md}
└── .github/workflows/
```

## How Claude should behave here

- If a request would skip a workflow step, say so and point to the missing artefact.
- If something is ambiguous, ask. Never invent requirements, numbers or dataset facts.
- Never claim that tests passed, a benchmark ran or a metric improved unless it was actually run.
- Keep `docs/AI-WORKFLOW.md` and `docs/SKILLS-MATRIX.md` honest. Rows point to real paths, or are
  marked *planned* with a spec ID.
