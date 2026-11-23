# privacy-auditor: round 2 (T093)

**Verdict (copied exactly):** PASS. No BLOCKER, no MAJOR and no CRITICAL findings. All three round-1 MAJORs are fixed. I found no new leak: no network sink, nothing is persisted outside the active profile, and no source id or source writer id ends up in stored records.

Round 1 #1, #2 and #3: fixed and covered by tests (app.test.ts:407, 421, 440; ProgressScreen.test.tsx:137, 164, 185). 22/22 tests pass.

## Findings
| # | Severity | Finding |
|---|---|---|
| 1 | MINOR, extends r1 #5, OWNER-DECISION | Copy import also stores tombstoned completions (with stage times) and tombstoned instruments, none of which the UI shows. |
| 2 | MINOR | Copy apply doesn't run `hlcReceive` on the HLCs it carries over, so a file whose clock runs ahead can break one-writer monotonicity. Same as code-reviewer r1 #8. |
| 3 | MINOR | Import isn't disabled while `apply()` runs, so a double click on a copy import writes the records twice. |
| 4 | MINOR | Duplicate completion records for one lesson in a file aren't rejected or deduplicated. |

**Applied:** none yet. #2, #3 and #4 go in with the code-reviewer r1 fix group (test-first).
**Deferred:**
- #1 joins the r1 #5 owner decision.
- r1 #6 goes to the spec 016 backlog.
- r1 #7 goes to docs-keeper.

**Owner sign-off:** ____________________
