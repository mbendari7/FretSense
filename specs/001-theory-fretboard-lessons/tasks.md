---
description: "Task list for 001: theory engine, interactive fretboard and lesson system"
---

# Tasks: Theory Engine, Interactive Fretboard and Lesson System

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Process (CLAUDE.md rule 4)**: one owner-approved task group at a time (a phase or checkpoint
below, or a smaller set the owner names). After the owner OKs the group's approach, each task runs
in order: the paired **test-writer** task (red) first, then the implementation turns the tests
green, then the listed gates run. Commits reference `[Txxx][FR-xxx]` and are made by the owner.

**Notation**
- `[P]`: can run in parallel with other `[P]` tasks in the same phase (different files, no pending
  dependency). This parallelism applies to planning only; execution is sequential within a group.
- `[USn]`: user story from spec.md (the index; story N is in `spec-usN-*.md`, ADR-0013).
- `→ gates:` the agents that must pass before the task is done. `code-reviewer` applies to every
  implementation task, even where it isn't repeated.
- **blocked-on-owner (Ox)**: can't finish until the owner resolves the open item in research.md.
- **owner**: an owner decision or manual action (approvals, open items, the manual screen-reader
  pass). Claude doesn't do these.
- Data constraints are cited as `data-model.md Entity.field` and are not repeated here.

---

## Phase 1: Setup (shared infrastructure)

- [ ] T001 Create workspace root `package.json` (pinned `packageManager`, scripts `lint`, `typecheck`, `test`, `test:coverage`, `lessons:validate` alias to `pnpm --filter web lessons:validate`), `pnpm-workspace.yaml`, `tsconfig.base.json` (strict, project references) and `.npmrc` (`onlyBuiltDependencies` allowlist) per research R1, R12 [Plan; ADR-0007] → gates: architecture-reviewer, security-reviewer, code-reviewer
- [ ] T002 [P] Scaffold `packages/theory/` (`package.json` with zero runtime deps, `tsconfig.json`, `vitest.config.ts` with ≥ 90% line/branch thresholds, fast-check dev dep) [SC-010; Constitution II] → gates: architecture-reviewer, code-reviewer
- [ ] T003 [P] Scaffold `apps/web/` (Vite + React + React Router, current stable majors recorded in ADR-0007; `tsconfig.json` references; `vitest.config.ts` with ≥ 90% thresholds on `src/domain/**`; folders `src/{domain,application,infrastructure,ui}`, `content-plugin/`, `scripts/`, `e2e/`, `bench/`) [Plan; SC-010] → gates: architecture-reviewer, code-reviewer
- [ ] T004 [P] Add `eslint.config.js` (typescript-eslint strict) including the pitch-literal `no-restricted-syntax` rule with its allowed paths per research R11 [FR-051; ADR-0003] → gates: code-reviewer
- [ ] T005 [P] Add `.dependency-cruiser.cjs` with the per-layer allow-lists from research R11 [Constitution II; Plan] → gates: architecture-reviewer
- [ ] T006 [P] Add `apps/web/playwright.config.ts` (Chromium and WebKit projects, a 390 × 844 project, runs against `vite preview`) [FR-046, FR-047] → gates: code-reviewer
- [ ] T007 Add `.github/workflows/ci.yml` (frozen install, lint, typecheck, depcruise, tests + coverage, lessons:validate, build, Playwright, `pnpm audit --audit-level high`; `permissions: contents: read`; SHA-pinned actions; `persist-credentials: false`) and `.github/dependabot.yml` (npm + github-actions) per research R12 [THREAT-MODEL T7, T8] → gates: security-reviewer, code-reviewer
- [ ] T008 [P] Add the licence allowlist check `scripts/check-licences.mjs`, `.gitleaks.toml`, and an action-pin lint step in `.github/workflows/ci.yml` per research R12 [THREAT-MODEL T7, T8] → gates: security-reviewer

**Checkpoint**: `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` run (with no tests yet) locally and in CI.

---

## Phase 2: Foundational (blocks every user story)

### Theory engine core (`packages/theory`)

- [ ] T009 [P] test-writer: create fixtures `fixtures/theory/notes.json` and `fixtures/theory/intervals.json` (21 spelled roots, Cb/B# octave rule, simple and compound intervals in both directions, doubly-altered rejects); placeholder until the owner + theory-checker sign off [FR-001, FR-002, FR-010, SC-001] → gates: theory-checker
- [ ] T010 test-writer: red tests `packages/theory/test/note.test.ts`, `packages/theory/test/interval.test.ts`, `packages/theory/test/result.test.ts` against T009 fixtures and contracts/theory-api.md (parseNote, formatNote, midi, pitchClass, intervalBetween, transpose, parseInterval) [FR-001, FR-002, FR-010] → gates: theory-checker
- [ ] T011 Implement `packages/theory/src/result.ts`, `note.ts`, `interval.ts` (data-model.md `Letter`, `Accidental`, `Note.letter`, `Note.accidental`, `Note.octave`, `Interval.quality`, `Interval.number`, `Interval.direction`, `TheoryError`) to pass T010 [FR-001, FR-002, FR-010] → gates: theory-checker, code-reviewer
- [ ] T012 [P] test-writer: fixtures `fixtures/theory/scales.json`, `fixtures/theory/chords.json`, `fixtures/theory/spelling.json`, plus red tests `packages/theory/test/scale.test.ts`, `chord.test.ts`, `spelling.test.ts` (12 scales × 21 roots, one-letter-each rule, 12 chord qualities with symbols and functions, degree labels, black-key spelling toggle, chromatic labels) [FR-003, FR-004, FR-005, FR-006, FR-019, FR-060, SC-001] → gates: theory-checker
- [ ] T013 Implement `packages/theory/src/scale.ts`, `chord.ts`, `spelling.ts` (data-model.md `ScaleType.id`, `ScaleType.name`, `ScaleType.formula`, `ScaleType.heptatonic`, `ChordQuality.id`, `ChordQuality.symbolSuffix`, `ChordQuality.formula`, `ChordQuality.functions`, `PitchClassNote.letter`, `PitchClassNote.accidental`) to pass T012 [FR-003–FR-006, FR-019, FR-060] → gates: theory-checker, code-reviewer
- [ ] T014 test-writer: fixtures `fixtures/theory/instruments.json` (7 presets, position → note tables) and red tests `packages/theory/test/instrument.test.ts`, `fretboard.test.ts`, plus `packages/theory/test/arbitraries.ts` (fast-check instruments: guitar 6–8 strings, bass 4–6, frets 12–24, ascending tunings within family ranges) and property tests over ≥ 100 generated instruments (noteAt/positionsOf round trip, geometryId determinism and enharmonic distinctness, fretX monotonic in [0, 1]) [FR-008, FR-009, FR-051, FR-052, FR-053, FR-062, SC-011] → gates: theory-checker
- [ ] T015 Implement `packages/theory/src/instrument.ts` (validateProfile, geometryId), `presets.ts` (7 presets, default scale lengths), `fretboard.ts` (noteAt, positionsOf, fretX) for data-model.md `InstrumentProfile.family`, `InstrumentProfile.stringCount`, `InstrumentProfile.tuning`, `InstrumentProfile.fretCount`, `InstrumentProfile.scaleLengthMm`, `InstrumentProfile.pitchRange`, `InstrumentProfile.geometryId`, `InstrumentFamily`, `GeometryId`, `Preset.presetId`, `FretPosition.string`, `FretPosition.fret`. Family pitch ranges are provisional constants in `presets.ts` until T016 [FR-008, FR-009, FR-051, FR-052, FR-053, FR-062] → gates: theory-checker, code-reviewer
- [ ] T016 **owner** (blocked-on-owner O3): confirm the family pitch ranges in spec Clarifications; then update the constants in `packages/theory/src/presets.ts` and the T014 arbitraries [FR-053, SC-011] → gates: theory-checker
- [ ] T017 test-writer: contract test `packages/theory/test/api.contract.test.ts` asserting that the public exports and signatures match contracts/theory-api.md, and that no export takes raw string counts, tunings or fret counts [Constitution II, VIII] → gates: architecture-reviewer
- [ ] T018 Implement `packages/theory/src/index.ts` public API to pass T017 [Constitution II] → gates: architecture-reviewer, code-reviewer

### Domain foundations (`apps/web/src/domain`)

- [ ] T019 [P] test-writer: red tests `apps/web/src/domain/hlc.test.ts` (format, send, receive, counter overflow, 24 h future bound, ordering with writer-id tie-break) per research R5 [FR-066, FR-066a] → gates: code-reviewer
- [ ] T020 Implement `apps/web/src/domain/hlc.ts` for data-model.md `Hlc` to pass T019 [FR-066, FR-066a] → gates: code-reviewer
- [ ] T021 [P] test-writer: red tests `apps/web/src/domain/records/records.test.ts` (strict Zod schemas for every store, common fields, `itemKey` grammar, `prompt` union per drill type, canonical JSON for `payloadHash`, id formats) per data-model.md §3, §3.1 [FR-040, FR-066, FR-067, SC-013] → gates: code-reviewer
- [ ] T022 Implement `apps/web/src/domain/records/` (`common.ts`, `localProfile.ts`, `profileSettings.ts`, `instrument.ts`, `attempt.ts`, `lessonCompletion.ts`, `itemKey.ts`, `canonicalJson.ts`) for data-model.md common fields `Common.id`, `Common.localProfileId`, `Common.created`, `Common.updated`, `Common.schemaVersion`, `Common.deleted` (§3), `LocalProfile.displayName`, `ProfileSettings.fieldUpdated`, `ProfileSettings.activeInstrumentId`, `ProfileSettings.octaveMode`, `ProfileSettings.adaptiveWeighting`, `ProfileSettings.stagePreference`, `ProfileSettings.activePackId`, `ProfileSettings.display`, `Instrument.name`, `Instrument.profile`, `Instrument.presetOrigin`, `Attempt.*` (all fields), `LessonCompletion.lessonId`, `LessonCompletion.stages` to pass T021 [FR-040, FR-066, FR-067] → gates: architecture-reviewer, code-reviewer
- [ ] T023 [P] test-writer: red tests `apps/web/src/domain/prng.test.ts` (seeded determinism, weighted sampling distribution within a derived binomial bound) [FR-041] → gates: code-reviewer
- [ ] T024 Implement `apps/web/src/domain/prng.ts` to pass T023 [FR-041] → gates: code-reviewer

### Application ports and persistence

- [ ] T025 Define ports in `apps/web/src/application/ports.ts` (repositories per store, `Clock`, `IdGenerator`, `Hasher`, `StoragePersistence`) and the in-memory adapters in `apps/web/src/application/testing/inMemory.ts` [FR-066; Plan] → gates: architecture-reviewer, code-reviewer
- [ ] T026 test-writer: red repository contract tests `apps/web/src/infrastructure/idb/repositories.test.ts` (fake-indexeddb; the same suite also runs against the in-memory adapters; one transaction per action; HLC advanced in the same readwrite transaction; natural-key uniqueness; quota error aborts cleanly) per data-model.md §3 [FR-066, SC-013; THREAT-MODEL T17] → gates: code-reviewer
- [ ] T027 Implement `apps/web/src/infrastructure/idb/db.ts` (database `fretsense` v1, stores and indexes per data-model.md §3), `repositories.ts`, `apps/web/src/infrastructure/hasher.ts` (SubtleCrypto SHA-256) and `deviceMeta.ts` (data-model.md `meta.deviceId`, `meta.writerIds`, `meta.hlcState`) to pass T026 [FR-066] → gates: architecture-reviewer, privacy-auditor, code-reviewer
- [ ] T028 test-writer: red tests `apps/web/src/application/bootstrap.test.ts` (first run creates one local profile and its settings with the data-model.md §3 defaults, no instrument; requests persistent storage; storage unavailable → usable with a notice) [FR-045, FR-066, FR-067; Constitution XI] → gates: code-reviewer
- [ ] T029 Implement `apps/web/src/application/bootstrap.ts` and `apps/web/src/application/SettingsService.ts` (per-field `fieldUpdated` bumps) to pass T028 [FR-045, FR-066, FR-067] → gates: code-reviewer

### App shell, routing and the fretboard component

- [ ] T030 test-writer: red tests `apps/web/src/domain/routeParams.test.ts` and `apps/web/src/ui/routes.test.tsx` (allowed query keys per route, bounds against the active instrument, unknown keys dropped, `Map` lookups so `/lessons/__proto__` shows not-found, instrument picker before routes that need one) per contracts/ui-routes.md [FR-053, FR-065] → gates: security-reviewer
- [ ] T031 Implement `apps/web/src/domain/routeParams.ts`, `apps/web/src/ui/routes.tsx`, `apps/web/src/ui/NotFound.tsx` and the composition root `apps/web/src/main.tsx` to pass T030 [FR-065; Plan] → gates: architecture-reviewer, security-reviewer, code-reviewer
- [ ] T032 test-writer: red tests `apps/web/src/ui/fretboard/Fretboard.test.tsx` (strings and frets from any profile; inlays 3/5/7/9/12 (double)/15/17/19/21/24 within the fret count; root shape + outline; accessible names; one tab stop with arrow-key movement that follows the left-handed direction; mirrored layout with upright text; uniform vs proportional spacing; inner horizontal scroll with ≥ 44 px targets for 8 strings × 24 frets; jest-axe) [FR-013, FR-014, FR-017, FR-018, FR-047, FR-049, FR-062] → gates: code-reviewer
- [ ] T033 Implement `apps/web/src/ui/fretboard/Fretboard.tsx` and `apps/web/src/ui/fretboard/geometry.ts` (SVG per ADR-0010) to pass T032 [FR-013, FR-014, FR-017, FR-018, FR-047, FR-049, FR-062] → gates: perf-auditor (render path review), code-reviewer

### My Gear instruments (every story needs an instrument)

- [ ] T034 test-writer: red tests `apps/web/src/application/InstrumentService.test.ts` and `apps/web/src/ui/gear/InstrumentsScreen.test.tsx` (add from preset or custom; validation errors; edit name/tuning/string count/fret count/scale length but not family; recompute geometryId; can't delete the last instrument; deleting the active one falls back to the most recently used; picker on first run) [FR-014, FR-016, FR-051, FR-053] → gates: code-reviewer
- [ ] T035 Implement `apps/web/src/application/InstrumentService.ts`, `apps/web/src/ui/gear/InstrumentsScreen.tsx` and `apps/web/src/ui/gear/InstrumentPicker.tsx` for data-model.md `Instrument.name`, `Instrument.profile`, `ProfileSettings.activeInstrumentId` to pass T034 [FR-014, FR-016, FR-051, FR-053] → gates: code-reviewer

**Checkpoint**: the theory engine passes fixtures and property tests with ≥ 90% coverage; the app shell boots offline-capable with one local profile; instruments can be managed.

---

## Phase 3: User Story 1: Fretboard Explorer (P1) 🎯 MVP

**Goal**: show any of 12 scales or 12 chords on any root, on the user's instrument, with labels.
**Independent test**: quickstart V3, V4; US1 acceptance scenarios on a fresh profile.

- [ ] T036 [US1] test-writer: red tests `apps/web/src/application/ExplorerService.test.ts` (root × scale/chord selection; label modes; fret window within the fret count; black-key spelling toggle; tap info with octave and degree; display settings persisted per field) [FR-011, FR-012, FR-015, FR-019, FR-020, FR-021] → gates: theory-checker
- [ ] T037 [US1] Implement `apps/web/src/application/ExplorerService.ts` to pass T036 [FR-011, FR-012, FR-015, FR-019, FR-020, FR-021] → gates: theory-checker, code-reviewer
- [ ] T038 [US1] test-writer: red tests `apps/web/src/ui/explorer/ExplorerScreen.test.tsx` and `apps/web/e2e/explorer.spec.ts` (US1 scenarios; shareable query parameters; switching instrument and handedness; SC-004 cold start to any scale within the stated taps/time) [FR-011–FR-021, SC-004] → gates: code-reviewer
- [ ] T039 [US1] Implement `apps/web/src/ui/explorer/ExplorerScreen.tsx` and `apps/web/src/ui/explorer/Controls.tsx` to pass T038 [FR-011–FR-021] → gates: theory-checker, code-reviewer

**Checkpoint**: MVP: the explorer works on every preset and custom instrument.

---

## Phase 4: User Story 2: Lessons: Any Lesson, Stages of Your Choice (P1)

**Goal**: original lessons, grouped by packs, with user-chosen stages and nothing locked.
**Independent test**: quickstart V5, V6, V13, V15 with fixture lessons.

- [ ] T040 [P] [US2] test-writer: fixtures `fixtures/content/valid/*.md`, `fixtures/content/invalid/*.md`, `fixtures/content/packs/*.yaml`, `fixtures/content/hostile/*.md` (placeholder prose only) and red tests `apps/web/src/domain/content/schemas.test.ts` (lesson, pack, tag vocabulary schemas; tag namespaces; unique drill ids; `needs` rules; progression keys; pack lesson references) per contracts/content-formats.md [FR-022, FR-023, FR-054, FR-063, FR-068, SC-008] → gates: security-reviewer
- [ ] T041 [US2] Implement `apps/web/src/domain/content/schemas.ts` for data-model.md `Lesson.*`, `DrillDefinition.id`, `DrillDefinition.type`, `DrillDefinition.instruments`, `DrillDefinition.params`, `CurriculumPack.*`, `TagVocabulary` to pass T040 [FR-022, FR-023, FR-054, FR-063, FR-068] → gates: security-reviewer, code-reviewer
- [ ] T042 [US2] test-writer: red tests `apps/web/content-plugin/compile.test.ts` and `apps/web/scripts/lessons-validate.test.ts` (any html node fails with file:line; GFM tables only; custom sanitize allowlist; img confined to `content/`; link schemes; rel/target step after sanitise; YAML options and 256 kB cap; errors name file + field path; hostile corpus fails or is allowlisted) per research R7 [FR-023, FR-025, SC-008; THREAT-MODEL T3, T13] → gates: security-reviewer
- [ ] T043 [US2] Implement `apps/web/content-plugin/compile.ts`, `apps/web/content-plugin/index.ts` (Vite plugin emitting precached JSON) and `apps/web/scripts/lessons-validate.ts` to pass T042 [FR-023, FR-025, SC-008] → gates: security-reviewer, architecture-reviewer, code-reviewer
- [ ] T044 [P] [US2] Create `content/tags.yaml` with placeholder values and the structural `content/packs/general-theory.yaml` (sections with empty lesson lists) that pass validation [FR-063, FR-068] → gates: code-reviewer
- [ ] T045 [US2] **owner** (blocked-on-owner O4): curate the real tag vocabulary in `content/tags.yaml` [FR-068]
- [ ] T046 [US2] Write the General Theory lessons in `content/lessons/*.md` from `_template.md` (original wording, CLAUDE.md rule 7) and list them in `content/packs/general-theory.yaml`; run `pnpm lessons:validate`; owner approves the lessons before release [FR-022, FR-063; Constitution IV] → gates: theory-checker, code-reviewer
- [ ] T047 [US2] test-writer: red tests `apps/web/src/application/LessonService.test.ts` (library grouped by the active pack with "all lessons"; family filter; stage preference and order with missing-stage and empty-set fallback; "show all stages"; preset applies the whole geometry temporarily and restores on leaving; "Reset to lesson"; completion is informational and never gates; drill list and launch) [FR-024, FR-026, FR-027, FR-028, FR-054, FR-063, FR-064, FR-065] → gates: code-reviewer
- [ ] T048 [US2] Implement `apps/web/src/application/LessonService.ts` for data-model.md `LessonCompletion.stages`, `ProfileSettings.stagePreference`, `ProfileSettings.activePackId` to pass T047 [FR-024, FR-026–FR-028, FR-054, FR-063–FR-065] → gates: code-reviewer
- [ ] T049 [US2] test-writer: red tests `apps/web/src/ui/lessons/*.test.tsx` and `apps/web/e2e/lessons.spec.ts` (US2 scenarios 1–10; Play/Camera-coach controls absent; preset banner text; direct links to every stage and drill) [FR-024–FR-029, FR-064, FR-065, SC-012] → gates: code-reviewer
- [ ] T050 [US2] Implement `apps/web/src/ui/lessons/LibraryScreen.tsx`, `LessonScreen.tsx`, `ReadStage.tsx`, `SeeStage.tsx`, `DrillStage.tsx` and the stage/pack controls in `apps/web/src/ui/settings/SettingsScreen.tsx` to pass T049 [FR-024–FR-029, FR-064, FR-065] → gates: code-reviewer

---

## Phase 5: User Story 3: Note-Finding Drill (P1)

**Goal**: tap-based note finding with per-string accuracy and response time.
**Independent test**: quickstart V7; US3 scenarios including exact octave.

- [ ] T051 [US3] test-writer: red tests `apps/web/src/domain/drills/noteFinding.test.ts` and `apps/web/src/domain/drills/session.test.ts` (settings validation; every question answerable as a property over generated instruments; any vs exact octave; judge accepts only the prompted string; pause/resume restarts the timer; summary per string with median time) [FR-030, FR-031, FR-033, FR-034, FR-061, SC-011] → gates: theory-checker
- [ ] T052 [US3] Implement `apps/web/src/domain/drills/noteFinding.ts`, `apps/web/src/domain/drills/session.ts`, `apps/web/src/domain/drills/summary.ts` for data-model.md `DrillSettings.*`, `Question.validAnswers`, `ItemKey`, `DrillSession` state machine to pass T051 [FR-030, FR-031, FR-033, FR-034, FR-061] → gates: theory-checker, code-reviewer
- [ ] T053 [US3] test-writer: red tests `apps/web/src/application/DrillService.test.ts` (each answer stored as an immutable attempt with geometryId, null instrumentId under a lesson preset, itemKey and payloadHash through the `Hasher` port; one transaction per answer) [FR-033, FR-040, FR-066] → gates: privacy-auditor
- [ ] T054 [US3] Implement `apps/web/src/application/DrillService.ts` for data-model.md `Attempt.*` to pass T053 [FR-033, FR-040] → gates: code-reviewer
- [ ] T055 [US3] test-writer: red tests `apps/web/src/ui/drills/NoteFindingScreen.test.tsx` and `apps/web/e2e/note-finding.spec.ts` (icon + text feedback; screen-reader announcement wording; 600 ms auto-advance; reduce-motion behaviour; SC-007 20-question session under 3 minutes) [FR-032, FR-049, SC-007] → gates: code-reviewer
- [ ] T056 [US3] Implement `apps/web/src/ui/drills/DrillSetup.tsx`, `NoteFindingScreen.tsx`, `Feedback.tsx`, `Summary.tsx` and route `/drills/:type` to pass T055 [FR-030–FR-034] → gates: perf-auditor, code-reviewer
- [ ] T057 [US3] test-writer: latency harness `apps/web/bench/latency.spec.ts` (tap → feedback paint and explorer update with `performance.mark` + rAF, ≥ 200 taps, p95 report per preset and for the 8-string 24-fret worst case) [SC-002, SC-003] → gates: perf-auditor
- [ ] T058 [US3] Run `pnpm --filter web bench:latency` on the reference laptop and phone and store baselines in `bench/baselines/001-latency.json` (**blocked-on-owner O1/O2**: devices must be named in spec Clarifications first; perf-auditor runs it) [SC-002, SC-003; Constitution V] → gates: perf-auditor

---

## Phase 6: User Story 4: Interval and Chord-Tone Drills (P2)

**Goal**: interval and chord-tone drills with per-interval and per-function stats.
**Independent test**: US4 scenarios.

- [ ] T059 [P] [US4] test-writer: red tests `apps/web/src/domain/drills/interval.test.ts` and `apps/web/src/domain/drills/chordTone.test.ts` (reference position, interval sets and direction, all valid answers within the window, chord/function prompts, answerable property) [FR-035, FR-036, FR-037, FR-061] → gates: theory-checker
- [ ] T060 [US4] Implement `apps/web/src/domain/drills/interval.ts` and `apps/web/src/domain/drills/chordTone.ts` to pass T059 [FR-035–FR-037, FR-061] → gates: theory-checker, code-reviewer
- [ ] T061 [US4] test-writer: red tests `apps/web/src/ui/drills/IntervalScreen.test.tsx`, `ChordToneScreen.test.tsx` and `apps/web/e2e/interval-chord-tone.spec.ts` (US4 scenarios; grouped stats) [FR-035–FR-037] → gates: code-reviewer
- [ ] T062 [US4] Implement `apps/web/src/ui/drills/IntervalScreen.tsx` and `apps/web/src/ui/drills/ChordToneScreen.tsx` to pass T061 [FR-035–FR-037] → gates: code-reviewer

---

## Phase 7: User Story 5: Key Helper (P2)

**Goal**: the 30 keys with diatonic triads and sevenths and their neck positions.
**Independent test**: US5 scenarios; key fixtures.

- [ ] T063 [P] [US5] test-writer: fixtures `fixtures/theory/keys.json` and red tests `packages/theory/test/key.test.ts` (30 keys; triads and sevenths; Roman numerals; harmonic-minor V/V7) [FR-007, FR-038, SC-001] → gates: theory-checker
- [ ] T064 [US5] Implement `packages/theory/src/key.ts` (data-model.md `Key.tonic`, `Key.mode`, `DiatonicChord.*`) and export it from `index.ts` to pass T063 [FR-007, FR-038] → gates: theory-checker, code-reviewer
- [ ] T065 [US5] test-writer: red tests `apps/web/src/ui/keys/KeyHelperScreen.test.tsx` and `apps/web/e2e/key-helper.spec.ts` (choose key; select chord → tones on the active instrument with function labels) [FR-038, FR-039] → gates: code-reviewer
- [ ] T066 [US5] Implement `apps/web/src/ui/keys/KeyHelperScreen.tsx` to pass T065 [FR-038, FR-039] → gates: theory-checker, code-reviewer

---

## Phase 8: User Story 6: Bass Patterns and Lines (P2)

**Goal**: four bass drills, available on any instrument family they declare.
**Independent test**: US6 scenarios on 4- and 5-string bass presets.

- [ ] T067 [P] [US6] test-writer: red tests `apps/web/src/domain/drills/bass.test.ts` (root–fifth–octave, arpeggio, walking bass with beat rules, chord-tone lock; progression keys; family applicability; per-family stats grouping; answerable property) [FR-054, FR-055, FR-056, FR-057, FR-058, FR-059, FR-061] → gates: theory-checker
- [ ] T068 [US6] Implement `apps/web/src/domain/drills/bass.ts` to pass T067 [FR-054–FR-059, FR-061] → gates: theory-checker, code-reviewer
- [ ] T069 [US6] test-writer: red tests `apps/web/src/ui/drills/BassScreens.test.tsx` and `apps/web/e2e/bass.spec.ts` (US6 scenarios) [FR-056–FR-059] → gates: code-reviewer
- [ ] T070 [US6] Implement `apps/web/src/ui/drills/BassDrillScreen.tsx` (one screen with per-type prompts) to pass T069 [FR-056–FR-059] → gates: code-reviewer

---

## Phase 9: User Story 7: Local Progress and Weak-Spot Weighting (P3)

**Goal**: weighted prompts (switchable), progress views, export/import with merge, reset.
**Independent test**: quickstart V8, V9, V10.

- [ ] T071 [P] [US7] test-writer: red tests `apps/web/src/domain/weighting.test.ts` (research R9 formula; US7-1 share ≥ 1.5× with a fixed seed over 200 prompts; uniform when off, US7-5; identical sequence for the same history and seed) [FR-041] → gates: code-reviewer
- [ ] T072 [US7] Implement `apps/web/src/domain/weighting.ts` and wire it into the drill generators in `apps/web/src/domain/drills/` behind `ProfileSettings.adaptiveWeighting` (data-model.md) to pass T071 [FR-041] → gates: code-reviewer
- [ ] T073 [P] [US7] test-writer: red property tests `apps/web/src/domain/merge.test.ts` (attempt immutability and conflict; un-delete with a fresh `updated`; incoming tombstones by LWW; natural-key matching for settings and completion; per-field settings merge; completion union; sync mode commutative, associative and idempotent; copy mode re-keys and leaves no id in two profiles) [FR-066a, SC-013] → gates: architecture-reviewer
- [ ] T074 [US7] Implement `apps/web/src/domain/merge.ts` to pass T073 [FR-066a, SC-013] → gates: architecture-reviewer, code-reviewer
- [ ] T075 [P] [US7] test-writer: red tests `apps/web/src/domain/import/validate.test.ts` and `apps/web/src/application/ExportImportService.test.ts` (fast-check hostile JSON; size checked before read; depth pre-scan; array caps; prototype keys; bidi/zero-width/NFC; HLC regex + Date.parse + 24 h bound; payloadHash recomputation; migration-failure and missing-instrument rejection; preview counts; one transaction; export contains exactly the documented keys and never `deviceId`) per contracts/profile-export.md [FR-043, FR-066a, SC-009; THREAT-MODEL T13, T14] → gates: security-reviewer, privacy-auditor
- [ ] T076 [US7] Implement `apps/web/src/domain/import/depthScan.ts`, `apps/web/src/domain/import/validate.ts`, `apps/web/src/domain/import/migrate.ts` and `apps/web/src/application/ExportImportService.ts` to pass T075 [FR-043, FR-066a] → gates: security-reviewer, privacy-auditor, code-reviewer
- [ ] T077 [US7] test-writer: red tests `apps/web/src/application/ProgressService.test.ts` (accuracy and median time per item group, per family and per instrument, rolling 7 days in device local time and all time; deleted-instrument grouping; reset tombstones attempts and completion in one transaction and keeps settings) [FR-042, FR-044, FR-055] → gates: code-reviewer
- [ ] T078 [US7] Implement `apps/web/src/application/ProgressService.ts` to pass T077 [FR-042, FR-044, FR-055] → gates: code-reviewer
- [ ] T079 [US7] test-writer: red tests `apps/web/src/ui/progress/*.test.tsx` and `apps/web/e2e/progress.spec.ts` (US7 scenarios; export disclosure text; restore/copy choice; preview + confirm; reset confirmation wording; export → reset → import restores 100% with 0 duplicates; reset and import hidden when framed; weighting toggle in settings) [FR-041–FR-044, SC-009; THREAT-MODEL T12, T15] → gates: privacy-auditor
- [ ] T080 [US7] Implement `apps/web/src/ui/progress/ProgressScreen.tsx`, `ExportDialog.tsx`, `ImportDialog.tsx`, `ResetDialog.tsx`, the framing guard `apps/web/src/ui/framingGuard.ts`, and the weighting/octave toggles in `apps/web/src/ui/settings/SettingsScreen.tsx` to pass T079 [FR-030, FR-041–FR-044] → gates: privacy-auditor, security-reviewer, code-reviewer

---

## Phase 10: Polish and cross-cutting concerns

- [ ] T081 test-writer: red E2E `apps/web/e2e/offline.spec.ts` (all US1–US7 scenarios offline after first load; install manifest present; update prompt on a new service worker) [FR-045, FR-046, SC-005; THREAT-MODEL T16] → gates: code-reviewer
- [ ] T082 Configure the PWA in `apps/web/vite.config.ts` and `apps/web/public/manifest.webmanifest` (precache shell + compiled content, `injectRegister: 'script'`, bundled Workbox, `navigateFallbackDenylist`, prompt-to-reload in `apps/web/src/ui/UpdatePrompt.tsx`; persistent-storage denial → 7-day export reminder) to pass T081 [FR-045, FR-046] → gates: security-reviewer, privacy-auditor, code-reviewer
- [ ] T083 test-writer: red E2E `apps/web/e2e/no-lock.spec.ts` (every route in contracts/ui-routes.md on a fresh profile; no control disabled for progress), `apps/web/e2e/csp.spec.ts` (0 CSP violations, 0 non-self requests across the crawl), `apps/web/e2e/layout-390.spec.ts` (no page-level horizontal scroll, 100% targets ≥ 44 × 44, portrait and landscape) and `apps/web/e2e/a11y.spec.ts` (axe on every screen at all 3 text sizes and both themes) [FR-047, FR-048, FR-049, FR-050, FR-065, SC-006, SC-012; Constitution IX] → gates: privacy-auditor, security-reviewer
- [ ] T084 Implement the CSP meta in `apps/web/index.html`, text sizes and themes in `apps/web/src/ui/theme/` and any layout fixes, to pass T083 [FR-047, FR-048, FR-050, FR-065] → gates: security-reviewer, privacy-auditor, code-reviewer
- [ ] T085 [P] test-writer: schema-coverage test `apps/web/src/infrastructure/idb/schemaCoverage.test.ts` enumerating every store in `db.ts` and asserting FR-066 fields and a merge rule for each [SC-013] → gates: architecture-reviewer
- [ ] T086 [P] Enforce the coverage thresholds from T002/T003 as a required CI step in `.github/workflows/ci.yml` (`pnpm test:coverage` fails below 90% for `packages/theory` and `apps/web/src/domain`) [SC-010; Constitution III] → gates: security-reviewer, code-reviewer
- [ ] T087 **owner**: manual screen-reader pass with NVDA (Windows) and VoiceOver (iOS) on explorer, drill, lesson and progress screens; record results in `specs/001-theory-fretboard-lessons/checklists/accessibility.md` notes [FR-049]
- [ ] T088 docs-keeper: sync `README.md`, `docs/SKILLS-MATRIX.md` (rows point at real paths), the ADR index and `docs/AI-WORKFLOW.md` roadmap; add `docs/ARCHITECTURE.md` context and container views for theory, web and the content pipeline [Constitution VII; CLAUDE.md step 8] → gates: docs-keeper
- [ ] T089 Run quickstart validation V1–V16 and the full gate set (code-reviewer on the full diff; theory-checker, perf-auditor, privacy-auditor, security-reviewer, architecture-reviewer) and record results in `specs/001-theory-fretboard-lessons/checklists/plan-gates.md` (V14 stays **blocked-on-owner O1/O2** until T058) [all SCs] → gates: code-reviewer + area gates

---

## Phase 11: v0.1 feedback round (loop D → loop A, 2026-11-22)

Spec changes FN-2..FN-11, R2-*, R3-*, A2-* (spec.md, provisional or owner-approved; ledger in `reviews/`). Test-first: each test task runs red before its implementation task.

- [ ] T090 test-writer: red unit tests `apps/web/src/domain/drills/generate.test.ts` + `apps/web/src/domain/drills/prompts.test.ts` for prompt wording (FR-030 open-string spelling, FR-036 chord words + ordinal function + quality-name table), spelling consistency within a question (FR-032), any-octave feedback without octave numbers (FR-049), drill-type ids and itemKeys per spec Key Entities / FR-041 (spec-reviewer r1 #18) [FR-030, FR-032, FR-036, FR-041, FR-049] → gates: theory-checker
- [ ] T091 Implement T090 in `apps/web/src/domain/drills/` and `apps/web/src/ui/screens/DrillRunner.tsx`; align `data-model.md` §3.1 drill-type ids and itemKeys to the spec [FR-030, FR-032, FR-036, FR-041, FR-049] → gates: theory-checker, code-reviewer
- [ ] T092 test-writer: red unit tests `apps/web/src/domain/merge.test.ts` + `apps/web/src/application/app.test.ts` for restore precedence (1)–(5), completion revive-after-reset with only the new stage, copy-import tombstone rules, preview counts and the "nothing new to import" case [FR-043, FR-044, FR-066a, SC-009, SC-013] → gates: code-reviewer
- [ ] T093 Implement T092 in `apps/web/src/domain/merge.ts`, `apps/web/src/application/app.ts` and `apps/web/src/ui/screens/ProgressScreen.tsx` (copy-mode warning, mode heading); align data-model §4 [FR-043, FR-044, FR-066a] → gates: privacy-auditor, security-reviewer, code-reviewer
- [ ] T094 test-writer: red component/E2E tests for the fretboard: fret-0 full targets (FR-032a), nut labels in instrument spelling while unanswered, scroll cue + range indicator + "Jump to frets" group (FR-047), focus rules (route change, drill start, Home key + hint, Continue returns focus), "Question N of M" live region (FR-049) [FR-032a, FR-047, FR-049] → gates: code-reviewer
- [ ] T095 Implement T094 in `apps/web/src/ui/fretboard/Fretboard.tsx`, `apps/web/src/ui/Layout.tsx`, `apps/web/src/ui/screens/DrillRunner.tsx` [FR-032a, FR-047, FR-049] → gates: perf-auditor, code-reviewer
- [ ] T096 test-writer: red tests for the drill summary (missed list in question order, first 10 + "Show all (N)", "See progress"/"Back to drills" targets, focus to heading, 0-answered state, Drill stage recorded at the last judged question) and the empty-library / Home wording (FR-034, Edge Cases) [FR-028, FR-034] → gates: code-reviewer
- [ ] T097 Implement T096 in `apps/web/src/ui/screens/DrillRunner.tsx`, `LessonScreens.tsx`, `HomeScreen.tsx` [FR-028, FR-034] → gates: code-reviewer
- [ ] T091a FR-031 note sets and FR-035/FR-036 UI defaults (theory-checker T091 r1 #3, #8, #9): test-writer red tests for the 4 note sets (letters only, the default of 7 naturals; letters and sharps; letters and flats; all 17 spellings), with prompts spelled by the chosen set; DrillsScreen defaults (intervals {M2,m3,M3,P4,P5,P8}, all 7 natural roots, a d5 chip); one stable spelling per rfo group label; then implement [FR-031, FR-035, FR-036, FR-041] → gates: theory-checker, code-reviewer
- [ ] T093a Legacy drill-id migration (code-reviewer T091 r1 #4; product-owner decision, provisional): test-writer red tests (a v0.1-shaped export with `bass-*` ids imports with zero rejections; stored legacy attempts load; re-export writes the migrated ids; old rfo keys and octave-shapes attempts land under the legacy id, count toward totals and are never offered or used for mastery; unmapped unknown ids still reject the file); then implement one versioned migration step on load and import; data-model §3.1 [FR-043, FR-041, SC-013] → gates: code-reviewer, privacy-auditor
- [x] T099a FR-036 window-width setting (code-reviewer r1 #10; backlog, needed before the v0.1 release): test-writer red tests for the setting, its default 4 and its clamp to the fret range; then implement [FR-036] → gates: theory-checker, code-reviewer
- [ ] T100 Mode B2 fix group (product-owner triage, provisional CRs): test-writer red tests, then implement:
  - step indicator states and missed-step summary (FR-057, FR-056; CR-B2-2);
  - string chips with low/high naming and the active instrument named in setup (FR-031; CR-B2-5, CR-B2-8);
  - My Gear status in view and focused (FR-053; CR-B2-7);
  - empty-library text (FR-022; CR-B2-9);
  - one h1 per route (FR-048; CR-B2-11);
  - interval prompt states its fret range (FR-035; CR-B2-13);
  - plain record kinds and Close-only for nothing-new (FR-066a; CR-B2-14);
  - Tab order from the board (FR-048 bug).
  [FR-022, FR-031, FR-035, FR-048, FR-053, FR-056, FR-057, FR-066a] → gates: code-reviewer, theory-checker
- [ ] T100a Arpeggio root played as Step 1 (FR-057 and US6 scenario 2, product-owner 2026-11-22). Today the generator gives the root as a reference. Also FR-056 fixed steps R/5/8, labels "root"/"octave", and a fixed seed for the DrillRunner.nut property test. test-writer red first. [FR-056, FR-057] → gates: code-reviewer, theory-checker
- [ ] T100b FR-056 valid-shape judging and FR-056a wrong-tap charging; FR-057 window fit, the "up from its lowest A" prompt and wrong-step reasons; "root" in missed lists; add9 R-3-5-9 (pending owner). test-writer red first; theory-checker writes the US6 1b fixtures. [FR-056, FR-056a, FR-057] → gates: code-reviewer, theory-checker
- [ ] T100c Arpeggio one attempt per question (FR-040, FR-057); multi-step resume at the next pending step, excluding paused time; End-drill "Your unfinished question wasn't saved."; Progress units (FR-034, FR-042); weighting counts FR-040 attempts (FR-041). test-writer red first. [FR-034, FR-040, FR-041, FR-042, FR-057] → gates: code-reviewer
- [x] T098 Walking bass and chord-tone lock (FR-058, FR-059; deferred group, needed before the v0.1 release): test-writer red tests for the looping line, slots, Undo, Check line, R1–R4 messages, revealed-note captions, stand-alone I–vi–ii–V in a chosen major key, strings + fret-range settings; feedback names each valid position by its own note when a step accepts several pitch classes (theory-checker r2 #1); then implement [FR-058, FR-059, FR-065, SC-012] → gates: theory-checker, code-reviewer
- [x] T098a Mode B3 fix group (product-owner triage 2026-11-25, provisional): bugs (Undo with nothing to undo announces nothing; Check line records once in one transaction; current slot announced, scenario 17; verify 390 px / largest text / contrast) and CR-B3-1…9 (FR-058, FR-059). test-writer red first. [FR-040, FR-048, FR-049, FR-058, FR-059] → gates: code-reviewer, theory-checker (CR-B3-5, -6, -7)
- [x] T099 user-tester Mode B on the result, then product-owner triage (team loop D) [CLAUDE.md loop D]

## Dependencies and execution order

```text
Phase 1 Setup ─► Phase 2 Foundational ─┬─► US1 (P1, MVP)
                                        ├─► US2 (P1)  (T046 owner content any time after T043)
                                        ├─► US3 (P1) ─► US4 (P2), US6 (P2)  (share drill session/DrillService)
                                        ├─► US5 (P2)  (theory key.ts; independent of drills)
                                        └─► US7 (P3)  (needs US3's attempts; T072 touches the US3/4/6 generators)
All stories ─► Phase 10 Polish
```

- Within each pair, the test-writer task comes before its implementation task.
- T015 is provisional until T016 (O3); T045 (O4) and T058 (O1/O2) are owner-blocked and don't block other tasks.
- US4 and US6 reuse `session.ts`, `summary.ts` and `DrillService` from US3.
- US7's weighting (T072) edits the generators from US3, US4 and US6, so it runs after them.

## Parallel opportunities (for planning; execution is sequential within a task group)

- Setup: T002–T006 and T008.
- Foundational: T009/T012 fixtures; T019, T021, T023 domain test suites.
- After Foundational: US1, US2, US3 and US5 are independent. T040, T059, T063 and T067 test suites can be written in any order.
- US7: T071, T073 and T075 are independent test suites.

## Implementation strategy

1. **MVP**: Phases 1–3 (setup, foundations, explorer). Stop and validate with quickstart V1–V4.
2. Add US2 (lessons) with fixture content, then the real lessons (T046).
3. Add US3 (note-finding), then US4 and US6 (more drills), US5 (key helper).
4. Add US7 (weighting, progress, export/import).
5. Polish: offline, CSP, no-lock crawl, 390 px, a11y, docs, full gate run.

## FR / SC coverage

| IDs | Tasks |
|-----|-------|
| FR-001–FR-010 | T009–T018, T063–T064 |
| FR-011–FR-021 | T032–T039 |
| FR-022–FR-029 | T040–T050 |
| FR-030–FR-034 | T051–T056, T080 |
| FR-035–FR-037 | T059–T062 |
| FR-038–FR-039 | T063–T066 |
| FR-040–FR-044 | T021–T022, T053–T054, T071–T080 |
| FR-045–FR-050 | T028–T029, T032–T033, T055, T081–T084, T087 |
| FR-051–FR-053 | T004, T014–T016, T034–T035 |
| FR-054–FR-059 | T040–T041, T047, T067–T070, T077 |
| FR-060–FR-062 | T012–T015, T032–T033, T051–T052, T059–T060, T067–T068 |
| FR-063–FR-065 | T030–T031, T040–T050, T083–T084 |
| FR-066, FR-066a, FR-067 | T019–T029, T053, T073–T076, T085 |
| FR-068 | T040–T041, T044–T045 |
| SC-001 | T009, T012, T014, T063 · SC-002/003: T057–T058 (O1/O2) · SC-004: T038 · SC-005: T081 · SC-006: T083 · SC-007: T055 · SC-008: T040–T043 · SC-009: T075, T079 · SC-010: T002, T003, T086 · SC-011: T014, T051 · SC-012: T049, T083 · SC-013: T021, T026, T073, T085 |
