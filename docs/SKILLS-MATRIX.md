# FretSense Skills Matrix

> **For recruiters.** Each engineering skill is listed with where it is demonstrated (paths and spec
> requirement IDs) and how it is tested. Constitution XII means every row traces to a real
> requirement. Nothing is added just for show. **Status** is honest: *Specified* means the
> requirement exists in an approved or draft spec. Paths are the target layout from `CLAUDE.md` and
> don't exist until their tasks land. Kept in sync by the `docs-keeper` subagent.

Status as of 2026-11-21: **no code yet**. Specs exist for 001, 006, 007, 008 and 015 (reviewed;
clarify pending) and 009–013 (specify-only drafts).

## Data structures and algorithms

| Skill | Where (planned path → spec/FR) | Why it's needed | How it's tested | Status |
|-------|-------------------------------|-----------------|-----------------|--------|
| Interval arithmetic and enharmonic spelling | `packages/theory` → 001 FR-001–FR-007, FR-060 | Correct note names in every key | Fixture tables (21 roots × 12 scales/chords, 30 keys) + fast-check properties | Specified |
| Fretboard as a position graph | `packages/theory` → 001 FR-008, FR-051; 005 | Position lookup now; fingering search later | Property tests over all profiles (001 SC-011) | Specified |
| DP / Viterbi fingering optimizer (human-owned) | `packages/theory/fingering` → 005 | Most playable fingering for melodies and progressions | Golden fingerings, optimality checks vs brute force on small inputs | Planned (005) |
| Concept DAG + topological sort, O(V+E) | `packages/learner` → 006 FR-001–FR-005 | Prerequisite-driven curriculum | Fixture graphs up to 500 nodes, cycle detection (006 SC-001) | Specified |
| Review-queue structure (priority queue if justified) | `packages/learner` → 006 FR-014 | Due-item retrieval in < 5 ms at 5k items | Benchmarks at the FR-014 scale; the choice is justified in the plan | Specified (data structure open) |
| Lock-free SPSC ring buffer | `packages/audio-io` → 015 FR-020 | Audio thread → analysis worker without locks or allocation | Concurrency stress tests, no-allocation checks | Specified |
| Chord-symbol parsing (trie or hash map) | `packages/theory/parse` → 005 | Chord sheets and labels | Property/fuzz tests, round-trip with canonical symbols | Planned (005) |
| HMM / Bayesian likelihood fusion | `packages/fusion` → 010 FR-003 | Exact (string, fret) from audio + vision | Held-out accuracy vs rules baseline (010 SC-002) | Specified (draft) |

## Systems and concurrency

| Skill | Where | Why | How tested | Status |
|-------|-------|-----|------------|--------|
| AudioWorklet + SharedArrayBuffer transport | `packages/audio-io` → 015 FR-020, FR-025 | Real-time capture off the main thread | Golden recordings, dropout counters, latency benchmarks | Specified |
| Rust → WebAssembly DSP | `packages/dsp` → 002 | Fast, allocation-free pitch detection | Golden audio, benchmarks per instrument (ADR-0002) | Planned (002) |
| Native Rust/cpal backend in Tauri (WASAPI/ASIO) | `apps/desktop` → 015 US8, FR-020; ADR-0005 | Lower latency and buffer control | Same contract and golden tests as the browser backend; ADR-0005 table | Specified (scope in clarify) |
| Web Workers for vision and ML inference | `packages/vision`, `packages/ml-runtime` → 008 FR-010, 009 FR-007 | Keep the UI at 60 fps | fps/latency benchmarks (008 SC-004/005) | Specified |
| Zero-allocation hot paths | → Constitution V; 008 FR-010, 009 FR-010, 015 FR-020 | Real-time budgets | Allocation-tracking tests, perf-auditor | Specified |
| Sample-rate conversion with anti-aliasing | `packages/audio-io` → 015 FR-019 | Device rate ≠ model rate | Golden tones: < 0.1 cent error, aliasing < −80 dB (015 SC-009) | Specified |

## OOP, design patterns and architecture

| Skill | Where | Why | How tested | Status |
|-------|-------|-----|------------|--------|
| Clean architecture (domain / application / infrastructure / UI) | all packages → Constitution "Technology & Quality Constraints" | Testable domain, swappable adapters | architecture-reviewer gate, dependency lint | Specified |
| Strategy: interchangeable detectors and backends | 015 FR-020 (AudioBackend); 006 FR-007 (estimators); 008 FR-009 (trackers); 009 FR-007; 010 FR-003 | DSP vs ML, browser vs native, rules vs probabilistic | Shared contract tests per port | Specified |
| Explicit state machine, exhaustively tested | `packages/audio-io` → 015 FR-009 | Hot-plug without crashes | 100% (state, event) coverage (015 SC-010), hot-plug simulation (SC-003) | Specified |
| Observer / event stream for the real-time pipeline | 008 FR-013, 010 FR-002 | Decoupled producers (audio, vision) and consumers (drills, fusion) | Contract tests on events, latency benchmarks | Specified |
| Dependency injection at a composition root | `apps/web` → architecture rules | Mock devices, fixed clocks, seeded RNG in tests | Mock device layer (015 FR-021) | Specified |

## Machine learning and MLOps

| Skill | Where | Why | How tested | Status |
|-------|-------|-----|------------|--------|
| Versioned datasets with cards and leakage-checked splits | `data/`, `ml/` → 007 FR-010–FR-015 | Honest evaluation | Leakage fixtures (007 SC-002), stable group assignment (SC-011) | Specified |
| Reproducible config-driven pipelines | `ml/` → 007 FR-016–FR-019 | Re-runnable results | Exact-match re-run (007 SC-003) | Specified |
| Experiment tracking + model registry + promotion gate | `ml/` → 007 FR-020–FR-023 | "Ships only if it beats its baseline" | Gate fixtures, positive and negative (007 SC-005) | Specified |
| ONNX export + int8 quantisation, benchmarked | `ml/export` → 007 FR-024–FR-025 | Small, fast on-device models | Before/after tables (007 SC-008) | Specified |
| CI model evaluation | `.github/workflows` → 007 FR-026 | Catch regressions | Injected-regression fixtures (007 SC-007) | Specified |
| Active learning with per-clip consent | → 007 FR-027–FR-028 | Improve on the owner's real playing | Consent fixtures (007 SC-010) | Specified |
| Knowledge tracing (BKT; sequence model gated) | `packages/learner` → 006 FR-006–FR-012 | Adaptive curriculum | Single-learner fitter check, session-aligned held-out AUC gate (006 SC-002–SC-004) | Specified |
| Audio CNNs (chords, polyphonic transcription) | `ml/`, `packages/ml-runtime` → 009 | Beat DSP baselines | Held-out F1/accuracy vs baselines (009 SC-001/002) | Specified (draft) |
| Clean vs effected signal classifier | `packages/audio-io` → 015 FR-012 | Warn when effects will hurt detection | Labelled Katana/Scarlett set, ≥ 90% (015 SC-006) | Specified |

## Machine vision

| Skill | Where | Why | How tested | Status |
|-------|-------|-----|------------|--------|
| Hand landmarks → (string, fret, finger) | `packages/vision` → 008 FR-008–FR-015 | Silent fretting answers; fusion | Session-bootstrap accuracy, coverage (008 SC-001/002) | Specified |
| Fiducial-marker homography (human-owned) | → 008 FR-004–FR-007 | Neck geometry | Projection-error targets (008 FR-005) | Specified |
| Markerless keypoint model | → 008 FR-019–FR-021 | No stickers | Markerless held-out set vs classical baseline and v1 (008 FR-020) | Specified |
| Picking hand, posture, technique events | → 011 | Technique feedback | Event F1 vs rules baseline (011 SC-002) | Specified (draft) |
| A/V clock-offset calibration (human-owned estimator) | `packages/audio-io` → 015 FR-015 | Align audio and video events for fusion | Synthetic ±5 ms, hardware ±10 ms (015 SC-008) | Specified |

## Backend and databases

| Skill | Where | Why | How tested | Status |
|-------|-------|-----|------------|--------|
| IndexedDB local-first storage + migrations | `apps/web/infrastructure` → 001 FR-040–FR-044, 015 FR-003 | Offline progress and preferences | Export/import round trip (001 SC-009) | Specified |
| FastAPI + PostgreSQL, migrations, indexes | `services/sync` → 013 FR-003–FR-005 | Opt-in multi-device sync | Contract tests, convergence fuzzing (013 SC-002) | Specified (draft) |
| OAuth/OIDC + JWT, rate limiting, OpenAPI | → 013 FR-002, FR-006 | Secure sync | security-reviewer, contract tests | Specified (draft) |

## Testing

| Skill | Where | How |
|-------|-------|-----|
| Unit + property-based | `packages/theory` (001), `packages/learner` (006) | Vitest + fast-check across all InstrumentProfiles |
| Golden-file audio and video | `fixtures/golden/` → 008, 009, 015 FR-021 | Recorded clips through every backend and detector |
| Mock hardware + hot-plug simulation | → 015 FR-021, SC-003 | Simulated devices, randomised plug schedules |
| E2E + visual regression (fretboard) | `apps/web/e2e` → 001 SC-005, SC-006 | Playwright, screenshot diffs at 390 px |
| Contract tests | → 013 FR-003, 015 FR-020 | OpenAPI, AudioBackend contract |
| ML evaluation tests | → 007 FR-026 | Fixed validation set in CI |

## DevOps, performance, security, accessibility, documentation

| Skill | Where | Status |
|-------|-------|--------|
| GitHub Actions CI/CD: lint, typecheck, tests, coverage gate (≥ 90%), ML eval, benchmarks, preview deploys | `.github/workflows` → Constitution III; 001 plan | Planned (001 plan) |
| Docker / docker-compose | `services/sync` → 013 FR-010 | Specified (draft) |
| Benchmarks + in-app performance overlay | `bench/` → 008 FR-023, 015 FR-025; ADR-0002, ADR-0005 | Specified |
| Threat model, on-device privacy, mic/camera indicators, COOP/COEP | `docs/THREAT-MODEL.md` → Constitution IX; 015 FR-022 | Drafted |
| Dependency scanning, secrets handling | CI → security-reviewer | Planned |
| WCAG 2.2 AA, keyboard, screen readers, colour-blind-safe fretboard | → 001 FR-013, FR-047–FR-049 | Specified |
| ADRs, C4 architecture doc, API reference, contributing guide | `docs/adr/` (0001–0005), `docs/ARCHITECTURE.md` (planned at 001 plan) | ADRs drafted |
