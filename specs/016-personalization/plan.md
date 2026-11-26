# Implementation Plan: Personalisation (v0.1 slice)

**Branch**: `016-personalization` (to be created by the owner) | **Date**: 2026-11-25 |
**Spec**: [spec.md](spec.md) (owner-approved 2026-11-25; product-owner loop C r2 APPROVE)

## Summary

v0.1 delivers several **local profiles** per device (create, rename, switch, delete, erase
permanently, export/import with restore, create and copy), the **onboarding answer record** and
the owner-approved goal list, **learning paths** (generated from answers, a default "Start here"
path, manual paths; reorder by drag and keyboard; next step; conflict-free merge), **user
curriculum packs** (editor, file import/export) and the in-lesson stage-preference save. The gear
record schema for interfaces, cameras and outputs is defined now so v0.1 exports are
forward-compatible; their UI and presets come with 015 (v0.2) and 008 (v0.4). The quality tier is
v0.4 (008). 018 owns the onboarding screens; 016 provides the data and the path generator.
Everything stays offline and on the device.

## Technical Context

**Language/Version**: TypeScript 5.x strict (as 001)
**Primary Dependencies**: none new. React, React Router, `idb`, Zod, Vite/Workbox (ADR-0007);
content pipeline (ADR-0009) compiles `content/goals.yaml`
**Storage**: IndexedDB `fretsense` **v2**, additive migration (research R2; data-model §2)
**Testing**: Vitest + fast-check (domain: order keys, merge laws, path generation), fake-indexeddb
repository tests, Testing Library + jest-axe (screens), Playwright E2E when the 001 E2E harness lands
**Target Platform**: the 001 PWA targets
**Project Type**: web application (existing `apps/web`)
**Performance Goals**: profile switch < 1 s p95; reorder, path/pack switch and save < 100 ms p95;
path generation < 500 ms, at the FR-015 scale (10 profiles, 50 paths, 1,000 items, 50 packs)
**Constraints**: offline; no network; 390 px; WCAG 2.2 AA; keyboard alternative to drag; atomic
writes per user action (FR-020)
**Scale/Scope**: FR-015 envelope; ≤ 300 lessons (001)
**Reference devices**: OPEN (001 O1): the reference-laptop benchmark waits for the owner to name
the laptop; the fake-indexeddb harness runs meanwhile

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I Spec before code | Spec approved (owner + product-owner r2); tasks will trace every FR | ✅ |
| II Pure theory engine | No theory changes; new pure domain module `domain/personal` | ✅ |
| III Test-first, 90% | Domain coverage ≥ 90%; property tests for order keys and merge | ✅ |
| IV AI-authored, owner-directed | Fractional indexing has a published reference (research R3) and brute-force-reference property tests; goal list owner-approved | ✅ |
| V Real-time budget | SC-004 harness; reference run blocked on O1 | ⚠️ devices OPEN |
| VI Built for real practice / releases | Release slice stated in spec; offline; no account | ✅ |
| VII Transparent AI use | ADR-0014 Proposed; no agent commits | ✅ |
| VIII Instrument-agnostic | Paths filter by instrument family from `InstrumentProfile`; no device model outside preset data (presets deferred to v0.2) | ✅ |
| IX On-device privacy | No network; exports are explicit user actions; export screen lists contents and warns the file is unencrypted and readable on a shared device; delete dialog says data is hidden, not erased; erase dialog says exported files remain; profile list says profiles are not a lock; device ids never exported (allow-list builder) | ✅ (privacy-auditor gate) |
| X ML rigor | No ML | n/a |
| XI Graceful degradation | Storage errors → clear message, nothing partial | ✅ |
| XII Skills where needed | Fractional keys → FR-012/FR-015; no CRDT library; tier store deferred to its consumer | ✅ |
| XIII Personalised, never locked | Paths recommend only; every lesson reachable; packs and paths user-owned | ✅ |

**Technique → requirement trace (XII)**

| Technique | Requirement |
|-----------|-------------|
| Fractional order keys | FR-012 deterministic merge, FR-015/SC-004 one write per move |
| Additive IDB v2 migration | FR-019, FR-020 |
| Per-profile loading | FR-002, SC-001 |
| Pure `generatePath` | FR-011, SC-003 determinism |
| Strict Zod pack/profile schemas | FR-004, FR-014, SC-006 |

**Post-design re-check**: no new violations; open gate V (devices) blocks only the reference
benchmark.

## Project Structure

### Documentation
```
specs/016-personalization/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/ profile-export-v2.md  pack-file.md  personalisation-api.md
└── reviews/
```

### Source code (created by tasks)
```
content/goals.yaml                                   # owner-approved goal list (R5)
apps/web/content-plugin/                             # + goals compile/validate
apps/web/src/domain/personal/{orderKey,pathMerge,generatePath,nextStep,pathProgress,pathPacing,packFile}.ts (+ tests)
apps/web/src/domain/content/schemas.ts               # + lesson estimatedMinutes (optional)
apps/web/src/domain/records.ts                       # + v2 record schemas (gear, onboarding, paths, pathItems, packs)
apps/web/src/domain/exportFormat.ts, merge.ts, migrate.ts   # v2 envelope, merges, v1→v2
apps/web/src/infrastructure/idb.ts                   # DB v2, loadProfile, erase
apps/web/src/application/session.ts                  # shared state, HLC, commit queue (R13)
apps/web/src/application/{ProfileService,PathService,PackService,OnboardingService}.ts
apps/web/src/application/ports.ts                    # v2 stores, purgeProfile, findForeignIds
.dependency-cruiser.cjs                              # restored layer rules
apps/web/src/ui/screens/{ProfilesScreen,PathsScreen,PathScreen,PacksScreen,PackEditor}.tsx
apps/web/bench/personal.bench.ts                     # SC-004 harness
```
ADR: `docs/adr/0014-path-order-keys-and-multi-profile-storage.md` (Proposed).

## Phase 0: Research
[research.md](research.md) R1–R13. No NEEDS CLARIFICATION remains.

## Phase 1: Design
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Gates for this plan
architecture-reviewer (new domain module, DB v2, services); privacy-auditor (storage, export,
erase); security-reviewer (profile and pack file parsing). Owner approval recorded under the
standing approval (2026-11-25).

## Gate rounds
r1 (2026-11-25): architecture BLOCK (1 BLOCKER, 4 MAJOR), privacy CHANGES REQUESTED (1 MAJOR),
security CHANGES REQUESTED (3 MAJOR); all addressed in research R2, R3, R6, R7, R8, R13,
data-model, contracts and spec Clarifications (plan gate r1). See reviews/.

## Complexity Tracking
None.
