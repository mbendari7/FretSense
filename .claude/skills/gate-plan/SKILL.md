---
name: "gate-plan"
description: "Run the plan gates on one spec after /speckit-plan: architecture-reviewer always, privacy-auditor and security-reviewer when they apply. Writes every round to the spec's review ledger."
argument-hint: "Spec number, e.g. 001"
user-invocable: true
disable-model-invocation: false
---

## Input

```text
$ARGUMENTS
```

The argument is a spec number (`NNN`). Resolve it to the one folder `specs/NNN-*/`. Stop if
`plan.md` is missing.

**Precondition.** The spec's ledger must show a product-owner **APPROVE** and an owner sign-off.
If either is missing, stop and say which one. Don't run the gates.

## Rules

- Read `.claude/rules/workflow.md` first and follow its **Workflow** table row 3 and **Review
  rules**, plus CLAUDE.md **Git rules**. Never commit.
- Never mark an ADR Accepted. New ADRs are written as **Proposed**.
- **Calling reviewers.** Use the project agent type. If it isn't registered, use a
  `general-purpose` agent. Its prompt must say: "Read `.claude/agents/<name>.md` and act exactly
  as that role, including its tool and write limits."
- Tell every reviewer to label each finding BLOCKER, MAJOR or MINOR.
- Copy each verdict into the ledger exactly.

## Which gates run

| Gate | Runs when |
|------|-----------|
| architecture-reviewer | Always |
| privacy-auditor | The plan touches the camera, mic, recording, storage, telemetry, network or sync |
| security-reviewer | The plan touches auth, input parsing, secrets, dependencies, CI/CD or Docker |
| theory-checker | The plan defines theory, fingering or voicing rules |
| perf-auditor | The plan sets or changes a latency budget, or adds a DSP, vision or inference path |

Decide which gates apply by reading `plan.md`, `research.md` and `contracts/`. List the gates
you chose and the reason for each before you run them.

## Steps

1. **Run the gates.** The gates are independent, so run them in parallel. Each reviews the plan
   artefacts against the spec, the constitution and the existing ADRs. Write
   `reviews/YYYY-MM-DD-<agent>-r1.md` for each one.
2. **Apply the fixes.** Apply them to the plan artefacts only, not code. Write any ADR a gate
   asks for as Proposed and add it to the `docs/adr/README.md` index.
3. **Re-run.** Re-run each gate that still has BLOCKER or MAJOR findings open, up to 2 more
   rounds. If findings are still open after that, **stop and escalate**.
   **Re-review rounds (r2, r3; ADR-0013).** Never start a full re-read.
   1. **Resume first.** Continue the same reviewer with SendMessage (its agent ID from round
      r{n-1}). Send the path of its `reviews/…-r{n-1}.md` findings file and `git diff -- specs/NNN-*/ docs/adr/`. Ask it
      to check only whether each finding is fixed and whether a fix introduced a new problem.
   2. **Fallback** (the reviewer can't be resumed): start a fresh reviewer whose prompt contains
      **only** the previous findings file and that diff, and says: "Don't re-read the whole
      artefact. Check only whether each finding is fixed and whether the fix introduced a new
      problem. Open other files only to confirm a specific finding."
   3. The round limit, escalation and ledger rules are unchanged.
4. **Update the index** in `reviews/README.md`.
5. **Report**:
   - each gate's verdict;
   - the open MINOR findings and deferrals;
   - the new Proposed ADRs;
   - a line that says: **Needs your approval: plan sign-off** in the ledger.

   Then give the suggested commits and stop. Don't start `/speckit-tasks`.
