# code-reviewer r1: T098 (FR-058 walking bass, FR-059 chord-tone lock), 2026-11-25

**Verdict:** CHANGES REQUESTED (2 BLOCKERs: failing tests and a typecheck error)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | BLOCKER | generate.test.ts old walking-bass generator tests red | **Applied**: ported to buildLine/judgeLine (generate.test.ts "FR-058 walking bass rules (line API)"); unknown quality now rejected per FR-061 |
| 2 | BLOCKER | schemas.ts refine blocks walking-bass/chord-tone-lock lesson drills; LessonScreens branch dead (TS2367) | **Applied**: refine removed; key required for both types; `schemas.drills.test.ts` |
| 3 | MAJOR | Slots disabled after Check line; broken rules not reviewable | **Applied**: slots stay selectable; WalkingBassRunner.test.tsx case |
| 4 | MINOR | Per-note timing used slot-index predecessor; undo didn't clear | **Applied**: elapsed since previous entry stored at entry; undo clears |
| 5 | MINOR | lineAttempts missed holes in sparse arrays | **Applied**: Array.from check; sparse test; loose test tightened |
| 6 | MINOR | .wb-bars minmax 170px can squeeze 44px targets | **Applied**: 210px |
| 7 | MINOR | aria-pressed + ", selected" double announcement | **Applied**: aria-pressed removed |
| 8 | MINOR | No drill-start focus; focus lost on Check line | **Applied**: focus to fretboard start on mount; focus to result after check. FR-047 range indicator is drawn by the Fretboard itself (unchanged) |
| 9 | MINOR | candidatesFor walking/lock paths "dead" | **Deferred**: not dead; validateSettings uses them for FR-061 reasons |
| 10 | MINOR | Hidden count still validated for walking bass | **Applied**: count check skipped for walking-bass. Adaptive-weighting setting is global (Settings), not shown in the lock setup; no change |

**Owner sign-off:** ______
