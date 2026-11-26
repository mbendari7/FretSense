# Quickstart validation: 016 Personalisation (v0.1)

Prerequisites: `pnpm install`. Commands from the repo root.

| # | Check | How | Expected |
|---|-------|-----|----------|
| V1 | Domain tests | `cd apps/web && pnpm vitest run --configLoader runner src/domain/personal` | all pass; property tests for keyBetween and mergePathItem laws |
| V2 | Profile isolation (SC-001) | `… src/application/ProfileService.test.ts` | 0 records of one profile in another's state, export or stats over 3 profiles |
| V3 | Switch (US1-2) | `pnpm dev` → /profiles → add "Sam" → switch | Sam's empty gear and progress; switch back restores the first profile |
| V4 | Erase (SC-009) | ProfileService erase test | scan of every store finds 0 records of the erased profile |
| V5 | Export → delete → import (SC-005) | ProfileService round-trip test | 100% records restored with identical ids |
| V6 | Path generation (SC-003) | `generatePath` fixture test (≥ 30 answer sets) | deterministic; valid instruments; every item has a reason; ≥ 90% tag-matched |
| V7 | Default path (FR-011a) | skip onboarding (018) or open Home on a fresh profile | "Start here" path active with a next step |
| V8 | Paths UI (US4) | /paths/:id → reorder by drag and by keyboard, add, remove | order saved immediately; every lesson still reachable |
| V9 | Packs (US5, SC-006) | /packs → create, export, import into another profile; hostile pack fixtures | grouping in library; hostile files rejected with reasons, no change |
| V10 | Scale (SC-004) | `pnpm --filter web bench:personal` (fake-indexeddb harness) | p95 report; reference-laptop run blocked on owner O1 |
| V11 | 390 px, keyboard, axe (FR-018) | component tests with jest-axe; manual NVDA pass (owner) | 0 axe violations |
