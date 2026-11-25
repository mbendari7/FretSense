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

- Read `.claude/rules/workflow.md` first and follow its **Team loop A** and **Review rules**, plus
  CLAUDE.md **Git rules**. Never commit.
- Only spec text changes (`spec.md`, its `spec-*.md` parts and `checklists/`), plus the ledger and `docs/feedback/`.
  No code, no plan, no tasks.
- **Calling reviewers.** Use the project agent type (`spec-reviewer`, `product-owner`,
  `user-tester`). If that type isn't registered, use a `general-purpose` agent instead. Its
  prompt must say: "Read `.claude/agents/<name>.md` and act exactly as that role, including its
  tool and write limits."
- Tell every reviewer to label each finding BLOCKER, MAJOR or MINOR.
- Copy each verdict into the ledger **exactly**. Never paraphrase a verdict into a better one.

## Steps

0. **Size the loop (ADR-0013; owner decision 2026-11-25).** Count the FR-IDs the change
   touches, by grep, not by judgment:

   ```bash
   { git diff -U0 HEAD -- specs/NNN-*/ | grep -vE '^(\+\+\+|---) ' | grep -E '^[+-]';
     git ls-files --others --exclude-standard -- specs/NNN-*/ | xargs -r cat; } \
     | grep -oE 'FR-[0-9]+[a-z]?' | sort -u | wc -l
   ```

   - **Full loop** (steps 1–8): a new spec (its `spec.md` is untracked or new in this diff), or
     the count is **more than 5**.
   - **Small edit** (count ≤ 5): run steps 1–3 and 6–8 (spec-reviewer and product-owner). Skip
     steps 4–5 (user-tester Mode A and its triage), and say so in the ledger with the count.
1. **Set up the ledger.** Create `specs/NNN-*/reviews/` and its `README.md` index if they're
   missing. Use the next free round number for each agent on today's date.
2. **spec-reviewer, round 1.** Review the spec against the constitution, `docs/PRODUCT.md` and
   the spec template.
   - Write `reviews/YYYY-MM-DD-spec-reviewer-r1.md`.
   - Apply the fixes it names (spec text only). Fill in **Applied** and **Deferred**.
   - If BLOCKER or MAJOR findings remain, re-run it as round 2, then round 3 if needed.
   - **Re-review rounds (r2, r3; ADR-0013).** Never start a full re-read.
     1. **Resume first.** Continue the same reviewer with SendMessage (its agent ID from round
        r{n-1}). Send the path of its `reviews/…-r{n-1}.md` findings file and `git diff -- specs/NNN-*/`. Ask it
        to check only whether each finding is fixed and whether a fix introduced a new problem.
     2. **Fallback** (the reviewer can't be resumed): start a fresh reviewer whose prompt contains
        **only** the previous findings file and that diff, and says: "Don't re-read the whole
        artefact. Check only whether each finding is fixed and whether the fix introduced a new
        problem. Open other files only to confirm a specific finding."
     3. The round limit, escalation and ledger rules are unchanged.
   - If they're still open after round 3, **stop and escalate** to the owner (`.claude/rules/workflow.md` Review
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
8. **Report** in the format from `.claude/rules/workflow.md`'s "After every loop" (Decisions / Feedback / Needs
   your approval). End with the ledger file list and suggested conventional commits. Then stop.
