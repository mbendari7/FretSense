# architecture-reviewer r2: 016 plan gate, 2026-11-25

**Verdict:** CHANGES REQUESTED (1 MAJOR, 7 MINOR); r1 BLOCKER resolved

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | MAJOR | Merge laws claimed for restore mode; "updated = max" breaks associativity | Applied: R3 split into `syncMerge` (max-by-rank) and `restoreApply` (one-way); contracts |
| 2 | MINOR | Un-deleted records keep old `updated` | Applied: re-stamp on restore |
| 3 | MINOR | One rule for paths/gear/packs | Applied: R3, Clarifications (plan gate r2) |
| 4 | MINOR | Rebalance key length | Applied: R3 |
| 5 | MINOR | Concurrent rebalance (013) | Applied: ADR-0014 Consequences |
| 6 | MINOR | ADR hygiene | Applied |
| 7 | MINOR | Garbled Clarification | Applied |
| 8 | MINOR | Ledger files missing | Applied: these files |

**Deferred:** none.

**Owner sign-off:** ______ (provisional under the standing approval of 2026-11-25)
