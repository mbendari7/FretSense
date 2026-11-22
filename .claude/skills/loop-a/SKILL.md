---
name: "loop-a"
description: "Run the spec gate and team loop A on one spec: spec-reviewer, product-owner review, user-tester Mode A, product-owner triage. Writes every round to the spec's review ledger."
argument-hint: "Spec number, e.g. 017"
user-invocable: true
disable-model-invocation: false
---

## Input

```text
$ARGUMENTS
```

The argument is a spec number (`NNN`). Resolve it to the one folder `specs/NNN-*/`. If no folder
matches, or more than one does, stop and say so.

## Rules

- Follow CLAUDE.md: **Team loop A**, **Review rules** and **Git rules**. Never commit.
- Only spec text changes (`spec.md` and `checklists/`), plus the ledger and `docs/feedback/`.
  No code, no plan, no tasks.
- **Calling reviewers.** Use the project agent type (`spec-reviewer`, `product-owner`,
  `user-tester`). If that type isn't registered, use a `general-purpose` agent instead. Its
  prompt must say: "Read `.claude/agents/<name>.md` and act exactly as that role, including its
  tool and write limits."
- Tell every reviewer to label each finding BLOCKER, MAJOR or MINOR.
- Copy each verdict into the ledger **exactly**. Never paraphrase a verdict into a better one.

## Steps

1. **Set up the ledger.** Create `specs/NNN-*/reviews/` and its `README.md` index if they're
   missing. Use the next free round number for each agent on today's date.
2. **spec-reviewer, round 1.** Review the spec against the constitution, `docs/PRODUCT.md` and
   the spec template.
   - Write `reviews/YYYY-MM-DD-spec-reviewer-r1.md`.
   - Apply the fixes it names (spec text only). Fill in **Applied** and **Deferred**.
   - If BLOCKER or MAJOR findings remain, re-run it as round 2, then round 3 if needed.
   - If they're still open after round 3, **stop and escalate** to the owner (CLAUDE.md Review
     rules).
3. **product-owner review.** Ask for its verdict (APPROVE / REVISE / REJECT), exact edits and
   any NEEDS MAHMOUD items. Write `reviews/YYYY-MM-DD-product-owner-r<n>.md`. Apply only its
   exact edits. **Don't apply NEEDS MAHMOUD items.**
4. **user-tester Mode A.** It writes `docs/feedback/NNN-<slug>-YYYY-MM-DD.md`. Record the report
   path and star rating in a ledger file named for user-tester.
5. **product-owner triage.** It sorts the report into fix now / backlog / won't do. Apply the fix
   now items to the spec text. Record the triage in the ledger.
6. **Re-check.** If steps 3–5 changed requirements, run spec-reviewer once more as the next
   round. The round limit still applies.
7. **Update the index.** Add one row to `reviews/README.md` per round: date, agent, round,
   verdict, open BLOCKER/MAJOR count, and a blank sign-off.
8. **Report** in the format from CLAUDE.md's "After every loop" (Decisions / Feedback / Needs
   your approval). End with the ledger file list and suggested conventional commits. Then stop.
