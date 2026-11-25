---
name: "task-cycle"
description: "Run one implementation task from the active feature's tasks.md: test-writer (red), owner OK, implement, green, code-reviewer and the area gates. One task only, then stop."
argument-hint: "Task id, e.g. T001"
user-invocable: true
disable-model-invocation: false
---

## Input

```text
$ARGUMENTS
```

The argument is a task id (`TNNN`). Find the feature in `.specify/feature.json`. Find the task in
that feature's `tasks.md`. Stop if the task is missing, already done (`[x]`), or blocked by an
unfinished dependency.

Read `.claude/rules/workflow.md` first (workflow row 7, review rules and the ledger format).

## Hard stops (check these before anything else)

- **Core algorithms (Constitution IV, v3.0.0; owner-approved update 2026-11-25).** YIN, the
  chromagram, the homography and pixel → (string, fret) mapping, the Viterbi fingering optimizer
  and its cost model, knowledge-tracing updates and the cross-correlation latency / A-V offset
  estimator may be implemented. Stop if the feature's `research.md` has no derivation or published
  reference for it, or if the tests' expected values don't come from independent sources (synthetic
  signals, brute-force references, published values).
- **ML training.** Launch a training run only from an owner-approved config. Stop if there is none.
  Promoting a model needs ml-evaluator APPROVE and owner approval.
- **Lesson and handbook text** (`content/lessons/`, `content/handbook/`, built-in packs) may be
  written. It must be original (never copied or closely paraphrased), pass theory-checker, and is
  not shipped until the owner approves it.
- **Task tagged owner.** If tasks.md marks the task `**owner**` or blocked-on-owner, stop.
- **One task only.** Never start a second task in the same run.
- Never commit (CLAUDE.md Git rules).

## Calling reviewers

Use the project agent type. If it isn't registered, use a `general-purpose` agent. Its prompt
must say: "Read `.claude/agents/<name>.md` and act exactly as that role, including its tool and
write limits."

Tell every reviewer to label each finding BLOCKER, MAJOR or MINOR. Copy verdicts into the ledger
exactly.

## Steps

1. **Red.** test-writer writes the failing tests for this task's FRs and acceptance criteria.
   Run them and show that they fail for the right reason.
2. **Owner OK.** Show the owner the tests and the red output, then **stop and wait**. Continue
   only after the owner says OK. Copy that OK into the ledger with the date. If a standing
   approval recorded in the ledger covers this task (Constitution workflow), cite it in the
   ledger instead and continue.
3. **Implement** the smallest change that turns the tests green. Stay within the task's files.
   Run the full test suite and the type check.
4. **Gates.** Run `node scripts/select-gates.mjs --why` (through the Bash tool) on the task's
   diff. It prints one gate per line; code-reviewer is always first. **Run every gate it prints**,
   in parallel. You may add a gate the script missed (say why in the ledger); you may never drop
   one it printed. What each gate covers, for reference:

   | Gate | Runs when the task touches |
   |------|----------------------------|
   | theory-checker | theory or fingering |
   | perf-auditor | DSP, vision, inference or hot paths |
   | ml-evaluator | models or exports |
   | dataset-curator | `data/` |
   | privacy-auditor | media or network |
   | security-reviewer | auth, input, dependencies or CI |
   | architecture-reviewer | new modules or dependencies |

   Give each gate the task ID and its FR-IDs, so it can do scoped reads (ADR-0013).

   Write `specs/NNN-*/reviews/YYYY-MM-DD-<agent>-<TNNN>-r<n>.md` for each gate.
5. **Fix and re-run.** Fix BLOCKER and MAJOR findings, then re-run those gates. The gate gets at
   most 2 re-review rounds. If findings are still open after that, **stop and escalate**.
   **Re-review rounds (r2, r3; ADR-0013).** Never start a full re-read.
   1. **Resume first.** Continue the same reviewer with SendMessage (its agent ID from round
      r{n-1}). Send the path of its `reviews/…-r{n-1}.md` findings file and `git diff -- <the files the fixes touched>`. Ask it
      to check only whether each finding is fixed and whether a fix introduced a new problem.
   2. **Fallback** (the reviewer can't be resumed): start a fresh reviewer whose prompt contains
      **only** the previous findings file and that diff, and says: "Don't re-read the whole
      artefact. Check only whether each finding is fixed and whether the fix introduced a new
      problem. Open other files only to confirm a specific finding."
   3. The round limit, escalation and ledger rules are unchanged.
6. **Mark the task done.** Tick it `[x]` in `tasks.md` only once every gate passes. Update the
   ledger index.
7. **Report**:
   - the task;
   - the files changed;
   - the test results;
   - each gate's verdict;
   - the deferred MINOR findings;
   - a suggested conventional commit.

   Then stop. If this task ends a user-facing task group, say that team loop B (user-tester
   Mode B) is due next.
