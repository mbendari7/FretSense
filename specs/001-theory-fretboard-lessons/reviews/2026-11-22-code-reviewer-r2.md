# code-reviewer r2: v0.1 build fixes (2026-11-22)

**Verdict (copied):** CHANGES REQUESTED. There are no BLOCKERs. Two MAJOR findings are open, and the gate does not pass until both are fixed.

r1 items marked Applied were verified (1, 3, 4, 5, 6 mostly, 8, 10 part, 11, 12, 13, 17, 19, 21, 22). #20 is now applied (code-point sort). #2 and #16 are partly closed by the test-driven fixes (completion tombstones; FR-056 span).

## Findings
| # | Sev | Finding | Status |
|---|-----|---------|--------|
| M1 | MAJOR | mergeCompletion tombstone rules in code before the spec recorded them | **Applied**: recorded as a provisional Clarification (spec.md, Session 2026-11-22 v0.1) and in data-model §4; logged in docs/AI-WORKFLOW.md |
| M2 | MAJOR | Starting tunings hardcoded in GearScreen (ADR-0003, rule 8) | **Applied**: `SUGGESTED_TUNINGS` / `suggestedTuning()` in packages/theory/src/instrument.ts; the form reads from there. Theory test for it still to be written by test-writer |
| m1 | MINOR | Receive rule skips settings fieldUpdated | Deferred (with r1 #7 HLC task) |
| m2 | MINOR | Dead code | **Applied** |
| m3 | MINOR | Lesson drill stage marked only on "Practise again" | **Applied**: marked when the session completes in full |
| m4 | MINOR | bass-walking reachable through lesson drills | **Applied**: rejected in the lesson schema |
| m5 | MINOR | localProfile.localProfileId not checked | **Applied** |
| m6 | MINOR | Optimistic state not rolled back on failed write | Deferred |
| m7 | MINOR | No span hint in feedback | Deferred |
| m8 | MINOR | apply() drops a late conflict | Deferred |
| m9 | MINOR | Duplicate lessonId in a file aborts with a generic error | Deferred |

Not run: `pnpm lint` and `pnpm depcruise` (eslint and dependency-cruiser are not installed yet).

**Owner sign-off:** ______________________
