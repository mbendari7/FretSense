---
paths:
  - "specs/**"
  - ".specify/**"
  - "docs/feedback/**"
  - "docs/adr/**"
  - ".claude/agents/**"
  - ".claude/skills/**"
---

# Workflow, gates, team loops and review rules

> Moved verbatim from CLAUDE.md on 2026-11-25 (ADR-0013). The order of authority stayed in CLAUDE.md. The skills `loop-a`, `gate-plan`, `task-cycle` and `speckit-*` read this file first.

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
| 7 | `/speckit-implement` | One owner-approved task group at a time | Group approach → owner OK, then per task: **test-writer** (red) → implement → green → **code-reviewer**, plus by area: **theory-checker** (theory/fingering), **perf-auditor** (DSP/vision/inference/hot paths), **ml-evaluator** (models/exports), **dataset-curator** (data/), **privacy-auditor** (media/network), **security-reviewer** (auth/input/deps/CI), **architecture-reviewer** (new modules or deps). After each user-facing task group: team loop B (**user-tester** Mode B → **product-owner** triage) |
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
- **Size first** (ADR-0013, owner decision 2026-11-25): a new spec, or a change whose diff touches
  more than 5 distinct FR-IDs (counted by grep in `/loop-a` step 0), runs steps 1–4 below. A smaller
  edit runs spec-reviewer, then steps 1 and 4 only: user-tester Mode A and its triage are skipped.
  The constitution's loop-A wording is unchanged.
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

## Review rules (how gates pass, stop and get recorded)

**Severity.** Every reviewer labels each finding BLOCKER, MAJOR or MINOR.
- A gate **passes** when the latest round has no BLOCKER or MAJOR findings.
- Each MINOR finding is either applied or logged as deferred in the ledger, with a reason.
- PASS WITH NOTES counts as a pass only if none of its notes is BLOCKER or MAJOR.

**Round limit.** A gate gets at most **2 re-review rounds** after the first review. If BLOCKER or
MAJOR findings are still open after round 3, Claude stops and escalates to the owner. The
escalation lists the open findings, what was tried and a recommendation. Claude never loops
further on its own.

**Order of authority**: see CLAUDE.md (it stays there and always loads).

**Approval is recorded.** "Approved" means a dated owner sign-off line in the ledger. A chat
message counts only after Claude has copied it into the ledger, word for word, with the date.

**Review ledger.** Every gate result is saved under `specs/NNN-*/reviews/`.
- One file per review round: `YYYY-MM-DD-<agent>-r<round>.md` (e.g.
  `2026-11-22-spec-reviewer-r1.md`).
- Claude writes these files from the main session, because most reviewers are read-only.
- Each file holds:
  - the verdict, copied exactly;
  - every finding, with its severity;
  - **Applied:** what was changed, and where;
  - **Deferred:** what was left, and why;
  - **Owner sign-off:** a blank line that only the owner fills in.
- `reviews/README.md` is the index: one row per round, giving the date, agent, round, verdict,
  open BLOCKER/MAJOR count and sign-off.
- Project skills run these loops and write the ledger as they go:
  - `/loop-a NNN` runs spec-reviewer, then team loop A.
  - `/gate-plan NNN` runs the plan gates.
  - `/task-cycle TNNN` runs one implementation task.

## Pull requests (written by the owner)

Every PR has: **Summary** (tasks and FRs covered), **Gate results** (every subagent verdict), and
**AI involvement** (what agents generated, and what the owner changed or rejected). The owner
writes the AI-involvement section. Each feature gets its own branch `NNN-short-name`, which the
owner creates.
