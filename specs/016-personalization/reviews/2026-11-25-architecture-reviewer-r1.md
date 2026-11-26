# architecture-reviewer r1: 016 plan gate, 2026-11-25

**Verdict:** BLOCK (1 BLOCKER, 4 MAJOR, 8 MINOR)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | BLOCKER | Tombstone-wins vs 001 FR-066a restore | Applied: `deletedBy` field, R3, Clarifications (plan gate r1) |
| 2 | MAJOR | Services need a shared core | Applied: R13 `session.ts` |
| 3 | MAJOR | DB v2 upgrade safety | Applied: R2 upgrade safety |
| 4 | MAJOR | Tied order keys crash moveItem | Applied: R3 ties, rebalance |
| 5 | MAJOR | FR-010 pacing has no home | Applied: `pathPacing`, `estimatedMinutes`, Clarifications |
| 6–13 | MINOR | ports, per-profile index loading, origin `default`, settings migration, packId index, orderKey import rule, progress/FR-016 homes, depcruise | Applied (R2, R6, R7, R13, data-model, spec FR-011a) |

**Deferred:** none.

**Owner sign-off:** ______ (provisional under the standing approval of 2026-11-25)
