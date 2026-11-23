# Review ledger: 001 theory, fretboard and lessons

One row per review round (CLAUDE.md "Review rules"). Sign-off is filled in by the owner only.

| Date | Agent | Round | Verdict | Open BLOCKER/MAJOR | Owner sign-off |
|------|-------|-------|---------|--------------------|----------------|
| 2026-11-22 | code-reviewer (v0.1 build) | r1 | BLOCK | 1 / 18 at review; see file for what was fixed | |
| 2026-11-22 | user-tester Mode B | r1 | 3.5/5 | 0 / 8 (report: docs/feedback/001-theory-fretboard-lessons-2026-11-22-B.md) | |
| 2026-11-22 | product-owner triage (loop D) | r1 | 12 fix now, 7 backlog, 1 won't do (provisional) | 2 NEEDS MAHMOUD | |
| 2026-11-22 | code-reviewer (v0.1 fixes) | r2 | CHANGES REQUESTED | 0 / 2 at review; both applied, r3 pending | |
| 2026-11-22 | code-reviewer (v0.1 fixes) | r3 | APPROVE | 0 / 0 (7 MINOR deferred) | |

## Owner approvals (copied word for word from chat)

- 2026-11-22: "And now you have all my full approval, so keep going." Context: a standing approval to continue the 001 work through the agent loops (spec → test → review → fix, back and forth). It does not mark ADRs Accepted (CLAUDE.md rule 15) or change `.claude/settings.json`; the owner does those.
| 2026-11-22 | spec-reviewer (FN changes) | r1 | BLOCK | 1 / 9 at review; all spec-side applied, #18 transferred to plan gate | |
| 2026-11-22 | spec-reviewer (FN changes) | r2 | BLOCK | 0 / 5 at review; all applied | |
| 2026-11-22 | spec-reviewer (FN changes) | r3 | BLOCK | 0 / 3 open → escalated; owner chose "Apply all 7 fixes"; applied | |
- 2026-11-22: "Apply all 7 fixes (Recommended)" (spec gate escalation, spec-reviewer r3).
| 2026-11-22 | product-owner (FN changes) | r1 | APPROVE | 0 / 0 (3 MINOR: 2 applied, 1 NEEDS MAHMOUD) | |
| 2026-11-22 | user-tester Mode A2 + product-owner triage | r1 | 4/5; 11 fix-now applied | 0 / 0 open (3 NEEDS MAHMOUD) | |
| 2026-11-22 | spec-reviewer (A2 edits) | A2-r1 | BLOCK | 0 / 3 at review; all applied | |
| 2026-11-22 | spec-reviewer (A2 edits) | A2-r2 | BLOCK | 0 / 1 at review; all applied | |
| 2026-11-22 | spec-reviewer (A2 edits) | A2-r3 | BLOCK | 0 / 1 open → escalated; owner decided; applied | |
| 2026-11-22 | code-reviewer (T091 + T093) | r1 | CHANGES REQUESTED | 0 / 5 open (fixes test-first in progress) | |
| 2026-11-22 | theory-checker (T091) | r1 | FAIL | 1 / 2 open (BLOCKER = code-reviewer #1; MAJOR #3 → T091a) | |
| 2026-11-22 | privacy-auditor (T093) | r1 | CHANGES REQUESTED | 0 / 3 at review; all applied | |
| 2026-11-22 | privacy-auditor (T093) | r2 | PASS | 0 / 0 | |
| 2026-11-22 | theory-checker (T091 + T091a + T093a) | r2 | PASS WITH NOTES | 0 / 0 | |
| 2026-11-22 | code-reviewer (T091 + T091a + T093 + T093a + T095) | r2 | CHANGES REQUESTED | 0 / 3 open | |
| 2026-11-22 | user-tester Mode B2 | r1 | 3/5 | 5 MAJOR (2 overlap code-reviewer r2); triage pending | |
| 2026-11-22 | security-reviewer (T093 + T093a) | r1 | CHANGES REQUESTED | 0 / 2 open | |
| 2026-11-22 | perf-auditor (T095 + T093a) | r1 | REGRESSION | 0 / 1 at review; applied | |
| 2026-11-22 | product-owner B2 triage | r1 | 7 fix now, 5 owner, 2 backlog, 2 won't do | owner answered the 4 NEEDS MAHMOUD | |
- 2026-11-22: "Same as other drills (Recommended)" and "Apply both (Recommended)" (A2 spec gate escalation, spec-reviewer A2-r3).
- 2026-11-22 (owner, AskUserQuestion, copied word for word):
  - Lessons: "I'll lift the deny rule (Recommended)"
  - Nut names: "Keep instrument names (Recommended)" (CR-B2-3; reverses R3-2 and resolves held A2-7)
  - Old data: "Keep migration, drop drill (Recommended)" (T093a NEEDS MAHMOUD (1) and (2))
  - Wording: "Name the tapped note, Fuller keyboard hint, Reference note in name" (CR-B2-15, CR-B2-12, code-reviewer r2 #7)
- 2026-11-22 (owner, chat, word for word): "lify ant denys or rules get gis thing going". Applied: removed `Edit(content/lessons/**)` and `Edit(content/handbook/**)` from .claude/settings.json. The git denies were kept (CLAUDE.md Git rules). T046 lesson writing started.
| 2026-11-22 | theory-checker (T046 lessons) | r1 | CHANGES REQUESTED | 0 / 2 open (applied) | |
| 2026-11-22 | theory-checker (T046 lessons) | r2 | PASS WITH NOTES | 0 / 0 | |
| 2026-11-22 | security-reviewer (T093 + lessons) | r2 | CHANGES REQUESTED | 0 / 1 open (N1) | |
| 2026-11-22 | code-reviewer (T091–T100b) | r3 (final) | CHANGES REQUESTED | 0 / 2 open, escalated to owner | |
- 2026-11-22 (owner, AskUserQuestion, copied word for word):
  - Escalation: "Fix both, run round 4 (Recommended)" (code-reviewer r3 MAJOR #1, #2; one extra round authorised)
  - Lessons: "Approve all 10" (T046 content sign-off for the 10 General Theory lessons)
  - add9: "R-3-5-9, 9th above (Recommended)"
  - Small calls: "Copy import drops deleted, Avoid F♭-style references"
| 2026-11-22 | security-reviewer (T093) | r3 | PASS WITH NOTES | 0 / 0 | |
