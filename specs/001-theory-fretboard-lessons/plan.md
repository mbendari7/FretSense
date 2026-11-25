# Implementation Plan: Theory Engine, Interactive Fretboard and Lesson System

**Branch**: `001-theory-fretboard-lessons` (to be created by the owner) | **Date**: 2026-11-21 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-theory-fretboard-lessons/spec.md` (amended for
constitution v2.2.0)

## Summary

001 delivers a pure TypeScript theory engine (notes, intervals, 12 scales, 12 chords, 30 keys,
instrument geometry for any guitar of 6–8 strings and bass of 4–6), an SVG fretboard explorer, a key
helper, seven tap-based drills (note-finding, interval, chord-tone and four bass drills) with
miss-count weighting that the user can turn off, and a lesson system (original, theory-checked lessons) grouped by
curriculum packs (built-in **General Theory**) with user-chosen stages and nothing locked. All user
data lives in one auto-created local profile in IndexedDB, with sync-ready records (UUIDs, HLC
timestamps, schema versions, tombstones) and a profile export format with restore and copy import.
Everything works offline as an installable PWA. No audio, camera, ML or network.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict`), Node 22 LTS for tooling

**Primary Dependencies**: `packages/theory`: none at runtime. `apps/web`: React, React Router,
Vite, vite-plugin-pwa (Workbox), `idb`, Zod, each at its current stable major when the setup task
runs, recorded in the lockfile and ADR-0007. Build only: remark/rehype + rehype-sanitize, `yaml`.
Dev: Vitest, fast-check, Testing Library, jest-axe, Playwright + @axe-core/playwright,
fake-indexeddb, ESLint + typescript-eslint, dependency-cruiser (research R1–R11)

**Storage**: IndexedDB (database `fretsense` v1; stores in [data-model.md](data-model.md) §3)

**Testing**: Vitest + fast-check (theory, domain), Testing Library + jest-axe (components),
Playwright (E2E, offline, 390 px, a11y, visual regression, latency benchmark)

**Target Platform**: installable PWA on Chrome/Edge desktop, Chrome for Android, Safari on iOS
(FR-046); laptops first

**Project Type**: web application (offline PWA) + a pure library package, in a pnpm monorepo

**Performance Goals**: tap → feedback < 100 ms p95 (SC-002); explorer update < 100 ms p95
(SC-003), each for 6-string Standard, 5-string BEADG and the 8-string, 24-fret worst case; next
prompt generation is part of the 100 ms budget

**Constraints**: offline after first load; no network calls at all (CSP `connect-src 'self'`); 390 px
with 44 × 44 px targets; WCAG 2.2 AA; no hidden instrument assumptions; ≥ 90% coverage on
`packages/theory` and `apps/web/src/domain`

**Scale/Scope**: ≤ 50,000 attempts and ≤ 300 lessons per profile (the 006 scale); 7 presets; one
local profile in 001 (the model supports many)

**Reference devices**: **OPEN (owner, O1/O2)**: the reference laptop (model, CPU, GPU, RAM, OS,
browser) and the reference phone (model, OS, browser) must be recorded in the spec before the
SC-002/SC-003 benchmark tasks run. No device is assumed here (Constitution V).

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1 (bottom of this section).*

| Principle | Check | Status |
|-----------|-------|--------|
| I Spec before code | Spec approved path: reviewed (BLOCK → fixed), clarified; tasks will trace every FR | ✅ (pending owner approval of the amended spec) |
| II Pure theory engine | `packages/theory` has zero runtime deps, no DOM/I/O, formulas from intervals, `Result` errors; enforced by dependency-cruiser | ✅ |
| III Test-first, 90% | Fixtures + property tests first; coverage gates on theory and domain; CI blocks | ✅ |
| IV AI-authored, owner-directed (v3.0.0) | No core algorithm is in 001 (miss-count weighting isn't knowledge tracing). Agents write the General Theory lessons (T046) in original wording; theory-checker and owner approval gate them | ✅ |
| V Real-time budget | SC-002/SC-003 benchmarked by perf-auditor on named devices | ⚠️ **devices OPEN (O1, O2)**: benchmark tasks blocked until named |
| VI Built for real practice | Offline PWA, no account, 390 px, music-stand text sizes; multiple local profiles supported by the model | ✅ |
| VII Transparent AI use | ADRs 0007–0010 Proposed; no agent commits | ✅ |
| VIII Instrument-agnostic | `InstrumentProfile` everywhere; geometry ids; property tests over generated 6–8 / 4–6-string instruments; pitch-literal lint rule | ✅ (ranges O3 pending confirmation) |
| IX On-device privacy | No mic, camera or network; data stays in IndexedDB; export is an explicit user action | ✅ |
| X ML rigor | No ML in 001 | n/a |
| XI Graceful degradation | Works with no audio or camera (none used); storage unavailable → usable with a notice | ✅ |
| XII Skills where needed | Every dependency and technique traces to an FR (table below); no task runner, no state library, no CRDT library | ✅ |
| XIII Personalised, never locked | No gating (FR-065, SC-012); weighting toggle (FR-041); user stages (FR-064); packs (FR-063); sync-ready profile-scoped records (FR-066, FR-066a) | ✅ |

**Technique → requirement trace (XII)**

| Technique / dependency | Requirement |
|------------------------|-------------|
| fast-check property tests | SC-011 (any instrument), FR-061 (always answerable), SC-013 (merge laws), FR-043 (import fuzz) |
| Hostile-markdown corpus | FR-025 (no scripts or raw HTML) |
| `Hasher` port (SubtleCrypto adapter) | FR-066a payload comparison, with a pure domain |
| HLC timestamps | FR-066a tie rule, 013 sync without migration |
| Zod (shared schemas) | FR-023 build validation + FR-043 runtime import validation |
| Build-time markdown + sanitiser | FR-025 (no scripts, no raw HTML), FR-045 offline |
| Workbox precache | FR-045, SC-005 |
| SVG fretboard | FR-013, FR-049 (accessible markers), FR-062 |
| dependency-cruiser | Constitution II and the clean-architecture rule |
| Seeded PRNG + weighted sampling | FR-041 determinism |

**Post-design re-check (after Phase 1)**: no new violations. The only open gate is V (reference
devices), which blocks the benchmark tasks, not the design. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/001-theory-fretboard-lessons/
├── spec.md
├── spec-*.md           # spec parts: user stories, shared requirements, clarifications (ADR-0013)
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── theory-api.md
│   ├── content-formats.md
│   ├── profile-export.md
│   └── ui-routes.md
├── checklists/
└── tasks.md             # /speckit-tasks
```

### Source code (repository root; created by tasks, not by this plan)

```text
package.json  pnpm-workspace.yaml  tsconfig.base.json  .dependency-cruiser.cjs  eslint.config.js
packages/
└── theory/                         # @fretsense/theory: pure TS, zero runtime deps
    ├── src/
    │   ├── note.ts  interval.ts  scale.ts  chord.ts  key.ts  spelling.ts
    │   ├── instrument.ts  presets.ts  fretboard.ts  result.ts  index.ts
    └── test/                       # unit + property tests (fixtures from /fixtures/theory)
apps/
└── web/
    ├── src/
    │   ├── domain/                 # pure: drills (generators, judges), weighting, prng, hlc,
    │   │                           #   merge, records, content schemas (Zod), stage rules
    │   ├── application/            # use cases + ports: ExplorerService, LessonService,
    │   │                           #   DrillService, ProgressService, InstrumentService,
    │   │                           #   SettingsService, ExportImportService; repository ports
    │   ├── infrastructure/         # IndexedDB repositories (idb), content loader, clock, device id
    │   ├── ui/                     # React components: Fretboard (SVG), screens, a11y helpers
    │   └── main.tsx                # composition root (DI)
    ├── content-plugin/             # Vite plugin: compile + validate lessons, packs, tags
    ├── scripts/lessons-validate.ts # `pnpm --filter web lessons:validate` (root alias)
    ├── e2e/                        # Playwright: offline, 390 px, a11y, no-lock crawl, visual
    └── bench/                      # latency benchmark (SC-002/003), owned by perf-auditor
content/
├── lessons/  (_template.md + owner lessons)  packs/ (_template.yaml, general-theory.yaml)  tags.yaml
fixtures/
├── theory/                         # spelling, scale, chord, key, mapping tables (signed off)
└── content/                        # valid + invalid lesson/pack fixtures (placeholder text)
.github/workflows/ci.yml
```

**Structure Decision**: a pnpm workspace with `packages/theory` (pure library) and `apps/web`
(PWA with domain / application / infrastructure / ui layers). Drill, weighting, merge and HLC logic is
pure but app-specific, so it lives in `apps/web/src/domain` with its own 90% coverage gate, rather
than in a new package (XII). `packages/learner` arrives with 006.

## Phase 0: Research

Done: [research.md](research.md). All technical unknowns are resolved. Owner open items O1–O4
remain (devices, family ranges, tag vocabulary); they block only the benchmark and real-content
validation tasks.

## Phase 1: Design

Done: [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

ADRs written (all **Proposed**):
- [ADR-0007](../../docs/adr/0007-web-stack-and-workspace.md): workspace, React + Vite PWA, no state
  library, test toolchain.
- [ADR-0008](../../docs/adr/0008-local-persistence-and-sync-ready-records.md): IndexedDB via idb,
  UUIDv4 + HLC + tombstones, merge rules, geometry ids.
- [ADR-0009](../../docs/adr/0009-content-pipeline.md): lessons/packs/tags, shared Zod schemas,
  build-time sanitised markdown.
- [ADR-0010](../../docs/adr/0010-svg-fretboard.md): SVG fretboard rendering.

## Gates for this plan (CLAUDE.md step 3)

| Gate | Needed? | Result |
|------|---------|--------|
| architecture-reviewer | yes (new packages, dependencies, layers) | CHANGES REQUESTED → fixed; see [checklists/plan-gates.md](checklists/plan-gates.md) |
| security-reviewer | yes (lesson, pack and profile-import parsing; CSP; dependencies) | CHANGES REQUESTED → fixed; same file |
| privacy-auditor | no camera, mic or network; export files and shared devices | CHANGES REQUESTED → fixed; same file |
| docs-keeper | after plan and tasks | same file |

## Complexity Tracking

No constitution violations to justify.
