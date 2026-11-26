# Tasks: Personalisation (v0.1 slice)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) R1–R13,
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).
**Release**: v0.1 only. FR-007 (presets, v0.2), FR-008 UI (v0.2/v0.4) and FR-017 / US6 (v0.4) are
**not** in this file. SC-002 (timed onboarding runs) is verified in 018, which owns the onboarding
screens; SC-007 and SC-008 come with v0.4 / v0.2 (analyze 2026-11-25).
**Tests**: required (Constitution III). In each task, test-writer writes the failing tests first
(red), then the code is written (green), then the gates named in `→` run. Paths are relative to
`apps/web/` unless they start with `content/`, `docs/` or `.`.
**Format**: `- [ ] Txxx [P?] [USn?] Description [FR-xxx] → gates`. `[P]` = different files and no
dependency on an unfinished task.

## Phase 1: Setup

- [x] T001 *(Deviation 2026-11-25: dependency-cruiser is not installed and adding it is a dependency change; the rules are enforced by the no-dependency test `src/architecture.test.ts` instead. The root `depcruise` script still fails; owner to decide whether to add the tool.)* Restore `.dependency-cruiser.cjs` at the repo root with the layer rules (domain imports only domain; `domain/personal` imports only domain; application ↛ infrastructure/ui; infrastructure ↛ ui) and make `pnpm depcruise` pass on the current tree (research R13) [FR-018] → architecture-reviewer
- [x] T002 [P] Add `content/goals.yaml` with the owner-approved 6 goals (spec Clarifications 2026-11-25 table; data-model.md `Goal`), and compile/validate it in `content-plugin/` with the YAML core schema, no aliases, unique ids, tags present in `content/tags.yaml`, `tags` ≥ 1 unless `genreMapped` (research R5) [FR-010] → security-reviewer, code-reviewer
- [x] T003 [P] Add optional `estimatedMinutes` (data-model.md §4 "Lesson `estimatedMinutes`") to the lesson schema in `src/domain/content/schemas.ts` and the content pipeline; no lesson gets a value in this task (no invented numbers) [FR-010] → code-reviewer

## Phase 2: Foundational (blocks every story)

- [ ] T004 [P] Shared `safeText(max)` Zod helper (NFC; control, bidi and zero-width rejected) in `src/domain/safeText.ts`; property test that every string field of the v2 record schemas uses it (research R6) [FR-004, FR-014] → security-reviewer
- [ ] T005 v2 record schemas in `src/domain/records.ts`: `deletedBy` on new stores; `gear` (data-model.md `gear.kind`, `gear.name`, `gear.presetOrigin`, `gear.namePattern`, `gear.notes`, `gear.channels`, `gear.directMonitoring`, `gear.placement`), `onboarding` (data-model.md `onboarding.goals`, `onboarding.instrumentIds`, `onboarding.level`, `onboarding.genres`, `onboarding.practiceHoursPerWeek`), `paths` (`paths.name`, `paths.origin`), `pathItems` (`pathItems.ref`, `pathItems.reason`, `pathItems.orderKey`), `packs` (`packs.packId`, `packs.sections`); `profileSettings` schemaVersion 2 (data-model.md `profileSettings.activePathId`, `profileSettings.defaultInterfaceId`, `profileSettings.defaultCameraId`, `profileSettings.defaultOutputId`) [FR-005, FR-006, FR-008, FR-010, FR-012, FR-014, FR-019] → code-reviewer
- [ ] T006 `migrateSettings` v1 → v2 and `SETTINGS_FIELDS` extended in `src/domain/migrate.ts` (research R2) [FR-019] → code-reviewer
- [x] T007 [P] `keyBetween`, `moveItem`, `rebalance` in `src/domain/personal/orderKey.ts`: code-unit `<`; never > 24 chars; ties via nearest distinct-key neighbours; rebalance key length ceil(log62(n+1)) + 1, no trailing `0`. Tests from a brute-force reference (sorted insertion of random keys), the `OrderKey` regex (data-model.md `OrderKey`), duplicate-key runs and 50,000 equal keys; derivation cited in research R3 (Wallace 2017; Greenspan 2020) [FR-012, FR-015] → code-reviewer, architecture-reviewer
- [x] T008 [P] `syncMerge` (max-by-rank `(deletedBy === 'user', updated, writerId)`, whole record) and `restoreApply` (one-way; re-stamp on un-delete; never applies an incoming `profile` tombstone over a live local record) in `src/domain/personal/pathMerge.ts`. Property tests: the three laws for `syncMerge` with the `(id, updated, writerId)` invariant in the generator; idempotence and un-delete for `restoreApply`; a restored record later synced with the old cascade tombstone stays live (research R3) [FR-012, FR-003] → code-reviewer, architecture-reviewer
- [ ] T009 Repository port v2 in `src/application/ports.ts`: v2 store names from one constant, `purgeProfile(id, meta)`, `findForeignIds(store, ids, profileId)`, `loadProfile` per-store index reads; `memoryRepository` updated to match [FR-001, FR-003, FR-020] → architecture-reviewer
- [ ] T010 IndexedDB v2 in `src/infrastructure/idb.ts`: `oldVersion`-gated upgrade (new stores and indexes, including `localProfileId` on `instruments` and `lessonCompletion`, `[localProfileId, packId]` on `packs`); `blocking` → close + "FretSense was updated. Reload to continue."; `blocked` → "Close other FretSense tabs to finish updating."; VersionError → reload prompt, no silent memory fallback in `src/main.tsx`. fake-indexeddb tests: v1 data → v2 (records intact), v2 DB + v1 code (research R2) [FR-019, FR-020] → architecture-reviewer, privacy-auditor
- [ ] T011 Extract `src/application/session.ts` (observable state, meta/HLC with `stamp(profileId)`, `common()`, serialising `commit()`, drain-before-switch) from `src/application/app.ts`; `FretSenseApp` delegates to it with no behaviour change (the full existing suite stays green) (research R13) [FR-020] → architecture-reviewer, code-reviewer

**Checkpoint F**: foundations green; `pnpm test`, `pnpm typecheck`, `pnpm depcruise`, `pnpm build` pass.

## Phase 3: US1 Local profiles (P1) 🎯 MVP

Independent test: three profiles with different instruments and attempts; every view shows only the active profile's data; delete one, the others are untouched (SC-001).

- [ ] T012 [US1] `ProfileService` create / rename (data-model.md `localProfiles.displayName`) / switch (`meta.activeLocalProfileId`; startup fallback per data-model.md lifecycle) in `src/application/ProfileService.ts`; SC-001 isolation test over ≥ 3 profiles (state, export, stats) [FR-001, FR-002] → code-reviewer
- [ ] T013 [US1] Delete profile (tombstones with `deletedBy: 'profile'`, one transaction, switch or create) and Erase permanently (`purgeProfile`; reset `activeLocalProfileId`; SC-009 scan of every store **and** `meta` for id, writer id and name) in `src/application/ProfileService.ts` [FR-003] → privacy-auditor, code-reviewer
- [ ] T014 [US1] Profile export v2 (allow-list builder; `contracts/profile-export-v2.md`; test of the exact top-level key set and no device id) in `src/domain/exportFormat.ts` and `src/application/ProfileService.ts` [FR-004] → privacy-auditor, security-reviewer
- [ ] T015 [US1] Profile import v2: validation per data-model.md §4 "Profile file" (caps, unique ids, `localProfileId` match, reference resolution, `OrderKey` regex, clash check in create **and** restore); modes restore (`restoreApply`) / create / copy (all ids and writer ids regenerated, id map first; test that no file id or writer id survives); v1 files migrate; SC-005 round trip; SC-006 hostile fixtures in `src/domain/exportFormat.ts`, `src/application/ProfileService.ts` [FR-004, FR-019, FR-020] → security-reviewer, privacy-auditor, code-reviewer
- [ ] T016 [US1] `/profiles` screen in `src/ui/screens/ProfilesScreen.tsx`: list, add, rename, switch, delete (dialog: "hidden, not erased; use Erase permanently"), erase (double confirm; "files you exported are not removed"), export (contents listed, unencrypted, shared-device warning), import (mode choice, preview counts in plain words); "Profiles are not a lock" note; new profile asks for one instrument first (US1 scenario 1); jest-axe, 390 px, keyboard [FR-001–FR-004, FR-018] → code-reviewer, privacy-auditor
- [ ] T017 [US1] User-tester Mode B on US1, then product-owner triage (loop D)

## Phase 4: US2 My Gear, v0.1 slice (P1)

Independent test: several instruments; mark one default; the app opens with it; lessons and drills can still switch.

- [ ] T018 [P] [US2] Gear repository round trip for the `gear` schema only (no UI, no presets; data-model.md `gear`), included in export/import (T014/T015 fixtures) in `src/application/GearRepository.test.ts` [FR-005, FR-006, FR-008, FR-019] → code-reviewer
- [ ] T019 [US2] Default instrument per profile (FR-009 using `profileSettings.activeInstrumentId`), marked in My Gear and shown in Settings, applied on open; every lesson and drill can still switch (US2 scenario 4) in `src/ui/screens/GearScreen.tsx`, `src/ui/screens/SettingsScreen.tsx` [FR-009] → code-reviewer

## Phase 5: US3 Onboarding data (P1)

Independent test: fixture answers are stored; the generated path matches; skipping leaves the default path.

- [ ] T020 [P] [US3] `OnboardingService` save-per-field / read (per-field LWW by natural key; data-model.md `onboarding`) in `src/application/OnboardingService.ts` [FR-010] → code-reviewer
- [ ] T021 [P] [US3] `generatePath` in `src/domain/personal/generatePath.ts` per research R4 (eligibility, order, reasons, fallback; no clock or randomness); SC-003 fixture of ≥ 30 answer sets with hand-written expected paths; US3 scenario 2 [FR-011] → code-reviewer, theory-checker (reason texts)
- [ ] T022 [P] [US3] `defaultPath` in `src/domain/personal/generatePath.ts` (origin `default`, "Start here", reason "part of <pack name>") per research R12 [FR-011a] → code-reviewer
- [ ] T023 [P] [US3] `pathPacing` in `src/domain/personal/pathPacing.ts` (data-model.md "Pacing"; undefined when any lesson lacks `estimatedMinutes` or hours = 0) [FR-010] → code-reviewer

## Phase 6: US4 Learning paths (P1)

Independent test: create, edit, reorder and delete items; three paths; switch; every lesson reachable outside the path.

- [ ] T025 [P] [US4] `nextStep` and `pathProgress` in `src/domain/personal/nextStep.ts` (completion rules in data-model.md lifecycle; shared across paths) [FR-013] → code-reviewer
- [ ] T026 [US4] `PathService` create/rename/add/remove (`deletedBy: 'user'`)/move (one commit; tie and rebalance cases)/delete/set active in `src/application/PathService.ts` [FR-012, FR-013, FR-020] → code-reviewer
- [ ] T024 [US3][US4] Wire: skip onboarding (or Home on a profile with no live path) creates the default path and sets `activePathId`; Redo creates a new generated path alongside the others (US3 scenarios 3–4) in `src/application/PathService.ts` [FR-011, FR-011a] → code-reviewer
- [ ] T027 [US4] `/paths` and `/paths/:pathId` screens in `src/ui/screens/PathsScreen.tsx`, `src/ui/screens/PathScreen.tsx`: next step, progress, pacing line (when defined), reorder by drag **and** keyboard (move up/down buttons and an accessible listbox), add from library, remove, unavailable items (US4 scenario 4), no gating; no `dangerouslySetInnerHTML`; jest-axe, 390 px [FR-012, FR-013, FR-018] → code-reviewer
- [ ] T028 [US4] Home shows the active path's next step and a "build my path" action in `src/ui/screens/HomeScreen.tsx` [FR-011a, FR-013] → code-reviewer
- [ ] T029 [US4] Stage preference editable inside a lesson (`updateSettings({ stagePreference })` from the lesson screen's stage control) in `src/ui/screens/LessonScreens.tsx` [FR-016] → code-reviewer
- [ ] T030 [US4] User-tester Mode B on US3 + US4, then product-owner triage (loop D)

## Phase 7: US5 Curriculum packs (P2)

Independent test: a pack with 3 sections; reorder; export; import into another profile; the library groups by it.

- [ ] T031 [P] [US5] `validatePackFile` in `src/domain/personal/packFile.ts` per `contracts/pack-file.md` (File.size before read, depth/prototype pre-scan, strict Zod, data-model.md `packs.packId` ≤ 64, copy suffix capped at 99); SC-006 fixtures (1 MB + 1, depth 17, `__proto__`, id at 64, `<img onerror>`, bidi) [FR-014] → security-reviewer
- [ ] T032 [US5] `PackService` create/edit/duplicate/delete/export/import/set active, duplicate-`packId` resolution (lowest id keeps it) in `src/application/PackService.ts`; test that the exported bytes contain no UUID or `localProfileId` [FR-014] → security-reviewer, privacy-auditor, code-reviewer
- [ ] T033 [US5] `/packs` and `/packs/:packId` editor in `src/ui/screens/PacksScreen.tsx`, `src/ui/screens/PackEditor.tsx` (sections, lesson picker, length limits shown, "don't paste text from your source" reminder, missing lessons listed); library grouping by the active pack; grep test: no `dangerouslySetInnerHTML` or text-built `href` in pack/path screens [FR-014, FR-018] → code-reviewer
- [ ] T034 [US5] User-tester Mode B on US5, then product-owner triage (loop D)

## Phase 8: Polish and cross-cutting

- [ ] T035 [P] SC-004 benchmark harness `bench/personal.bench.ts` (fake-indexeddb, FR-015 scale, p95 of switch/reorder/save over ≥ 200 runs); reference-laptop run blocked on owner O1 [FR-002, FR-015] → perf-auditor
- [ ] T036 [P] docs-keeper: THREAT-MODEL lines (profiles are not a lock; export file flow; erase residue; onboarding answers; copy-import writer ids), SKILLS-MATRIX rows, ADR index (ADR-0014 Proposed) in `docs/` → privacy-auditor (gate before 016 merges)
- [ ] T037 Quickstart V1–V11 run and recorded in `specs/016-personalization/quickstart.md`; full gates on the combined diff (code-reviewer, architecture-reviewer, security-reviewer, privacy-auditor)

## Dependencies

Setup (T001–T003) → Foundational (T004–T011) → US1 (T012–T017) → US2 / US3 / US4 / US5.
T024 (US3 wiring) sits in Phase 6 after T026 (`PathService`). US5 is independent of US3/US4.
018 (onboarding screens) consumes T020–T024.

## Parallel examples

- Foundational: T004, T007, T008 together (separate pure modules).
- US3: T020, T021, T022, T023 together.
- US5: T031 alongside US4 work.

## Implementation strategy

MVP = Phases 1–3 (profiles, with export/import). Then US4 + US3 (the "what do I do today" path),
then US5 packs, then polish. One task group (phase) at a time under the standing approval,
reporting after each.
