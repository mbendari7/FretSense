# spec-reviewer r3 (final round): FN-2..FN-11 provisional spec changes (2026-11-22)

**Verdict (copied):** BLOCK (0 BLOCKER, 3 MAJOR, 4 MINOR)

R2-1..R2-11 verified; R2-4, 5, 6, 8, 9, 10, 11 closed. The R2-1, R2-2 and R2-3 texts introduced the MAJORs below.

| # | Sev | Finding | Proposed fix (reviewer) | Status |
|---|-----|---------|-------------------------|--------|
| R3-1 | MAJOR | Restore precedence "(4) otherwise, no-op" overrides per-type merges when both copies are live; breaks SC-009 | (4) both live ⇒ the type's own rule; (5) both tombstoned ⇒ no-op | **Applied (owner decision)** |
| R3-2 | MAJOR | Nut-label respelling exception reveals answers | Instrument spelling while unanswered; question spelling after answering | **Applied (owner decision)** |
| R3-3 | MAJOR | Focus stays put vs FR-047 scroll-to-start; Continue focus undefined | Later questions keep focus and nut in view; Enter/Space on board = Continue; Continue returns focus to board | **Applied (owner decision)** |
| R3-4 | MINOR | US3-8 accessible name vs FR-032a | Reference FR-032a | **Applied (owner decision)** |
| R3-5 | MINOR | "unchanged" only for copy import | Both modes show unchanged | **Applied (owner decision)** |
| R3-6 | MINOR | Explorer open-string spelling edge case too broad | Only in-context open strings respell | **Applied (owner decision)** |
| R3-7 | MINOR | Route-change focus vs drill-start focus | Drill start overrides | **Applied (owner decision)** |

Round limit reached (CLAUDE.md Review rules). Escalated; owner answered 2026-11-22: "Apply all 7 fixes (Recommended)". All 7 applied word for word.

**Owner sign-off:** ______________________
