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

## Hard stops (check these before anything else)

- **Human-owned code.** If the task asks you to implement any of the following, stop: YIN, the
  chromagram, homography, the Viterbi fingering optimizer or its cost model, knowledge-tracing
  updates, the cross-correlation latency estimator, or ML training. Say the task belongs to the
  owner. test-writer may still write its tests if the owner asks.
- **Owner-written content.** If the task asks for lesson or handbook prose (`content/lessons/`,
  `content/handbook/`), stop.
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
   only after the owner says OK. Copy that OK into the ledger with the date.
3. **Implement** the smallest change that turns the tests green. Stay within the task's files.
   Run the full test suite and the type check.
4. **Gates.** Run code-reviewer, plus each area gate the task touches. Run them in parallel:

   | Gate | Runs when the task touches |
   |------|----------------------------|
   | theory-checker | theory or fingering |
   | perf-auditor | DSP, vision, inference or hot paths |
   | ml-evaluator | models or exports |
   | dataset-curator | `data/` |
   | privacy-auditor | media or network |
   | security-reviewer | auth, input, dependencies or CI |
   | architecture-reviewer | new modules or dependencies |

   Write `specs/NNN-*/reviews/YYYY-MM-DD-<agent>-<TNNN>-r<n>.md` for each gate.
5. **Fix and re-run.** Fix BLOCKER and MAJOR findings, then re-run those gates. The gate gets at
   most 2 re-review rounds. If findings are still open after that, **stop and escalate**.
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
