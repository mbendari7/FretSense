# FretSense

An interactive **guitar and bass** theory handbook that teaches on the fretboard, listens to your
real instrument through an audio interface, and (later) watches your hands on camera to coach
technique. Everything runs on your own device.

> **Status (2026-11-21): specification phase, no application code yet.** This repo is built
> strictly spec-first: constitution → spec → clarify → plan → tasks → analyze → implement. See
> [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) for the process and
> [docs/SKILLS-MATRIX.md](docs/SKILLS-MATRIX.md) for the engineering skills each feature demonstrates.

## Why I'm building it

1. **To practise better.** I open it before every session, on guitar (Squier Strat → Focusrite
   Scarlett) and bass. It tells me what to practise and checks what I actually play.
2. **To build a serious ML and vision system**, with real datasets, held-out evaluation, model cards,
   on-device inference, and models that ship only if they beat their DSP baselines.
3. **To show disciplined, spec-driven engineering with AI agents.** Subagents review and gate the
   work. They don't write it freely. I hand-write the core algorithms: YIN, the chromagram, the
   camera homography, the Viterbi fingering optimizer, the knowledge-tracing updates, and the
   latency/A-V cross-correlation estimator. I also run every training experiment and write every
   lesson.

## Book → lesson tracks → features

The curriculum follows *Guitar Theory for Dummies*. Each book part is a **lesson track** and each
chapter a lesson (Read → See → Drill → Play → Camera-coach). Features are capabilities, and a
stage becomes available when its enabling feature ships. *Part titles below are to be filled in by
the owner from the book.*

| Lesson track | Topics (examples) | Read / See / Drill | Play | Camera-coach |
|--------------|-------------------|--------------------|------|--------------|
| Book part 1 | Notes on the neck, intervals | 001 | 015 + 002 + 003 | 008 + 010 |
| Book part 2 | Scales and modes | 001 | 015 + 002 + 003 | 010 |
| Book part 3 | Chords and arpeggios | 001 | 015 + 004 / 009 | 010 |
| Book part 4 | Keys, progressions, harmony | 001 + 005 | 015 + 004 / 009 | 010 |
| Remaining parts | (owner to map) | 001 | — | — |
| `bass` (owner-defined) | Root–fifth–octave, arpeggios, walking lines, chord-tone lock | 001 | 015 + 002 + 003 | 010 |
| All tracks | Adaptive ordering, spaced review, practice plans | 006 | | |

## Roadmap

| # | Feature | Spec |
|---|---------|------|
| 001 | Theory engine, fretboard and lessons (guitar + bass) | [spec](specs/001-theory-fretboard-lessons/spec.md) |
| 015 | Audio I/O and device management (built right after 001) | [spec](specs/015-audio-io-device-management/spec.md) |
| 002 | DSP pitch detection (YIN), guitar + bass | planned |
| 003 | Play-along drills + timing/onset detection | planned |
| 004 | Chord recognition baseline (chromagram templates) | planned |
| 005 | Chord sheet analyzer + Viterbi fingering optimizer | planned |
| 006 | Adaptive curriculum: concept DAG, knowledge tracing, spaced repetition, planner | [spec](specs/006-adaptive-curriculum/spec.md) |
| 007 | ML data platform: labelling, datasets, pipelines, tracking, registry | [spec](specs/007-ml-data-platform/spec.md) |
| 008 | Vision I: hand + neck tracking → (string, fret) | [spec](specs/008-vision-hand-neck-tracking/spec.md) |
| 009 | ML audio models: chord CNN + polyphonic transcription | [draft](specs/009-ml-audio-models/spec.md) |
| 010 | Audio-visual fusion + camera coaching | [draft](specs/010-av-fusion-coaching/spec.md) |
| 011 | Vision II: picking hand, posture, technique events | [draft](specs/011-vision-picking-posture-technique/spec.md) |
| 012 | Transcription to tab and notation | [draft](specs/012-transcription-tab-notation/spec.md) |
| 013 | Optional sync backend (FastAPI, PostgreSQL, auth) | [draft](specs/013-sync-backend/spec.md) |
| 014 | ESP32 LED fretboard (stretch goal) | planned |

The dependency graph and the per-feature skill map are in [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md#3-roadmap-one-spec-per-feature).

## Tech stack (planned; each choice is confirmed by an ADR at plan time)

- **App:** pnpm monorepo, TypeScript strict, React + Vite installable PWA, SVG fretboard, IndexedDB
- **Theory engine:** pure TypeScript, zero runtime dependencies, Vitest + fast-check
- **Audio:** WebAudio AudioWorklet + SharedArrayBuffer ring buffer; Rust → WebAssembly DSP; optional
  Tauri desktop backend with Rust/cpal (WASAPI/ASIO) ([ADR-0005](docs/adr/0005-audio-backend-webaudio-vs-native.md))
- **ML/vision:** Python training in `ml/`, versioned datasets with cards, experiment tracking and a
  model registry, ONNX + int8, onnxruntime-web (WebGPU with WASM fallback)
- **Optional backend:** FastAPI + PostgreSQL, OAuth/OIDC, OpenAPI
- **CI/CD:** GitHub Actions: lint, typecheck, tests, ≥ 90% coverage gate, ML eval, benchmarks, deploy

## How to run

Nothing runs yet. The commands will be defined in each feature's `quickstart.md` once its plan is
approved, and will work when the setup tasks land. Planned for 001:

```bash
pnpm install
pnpm test               # unit + property tests
pnpm --filter web dev   # local PWA
```

## Project rules

- [Constitution v2.1.0](.specify/memory/constitution.md): the highest authority
- [CLAUDE.md](CLAUDE.md): agent rules, gates, git rules
- [ADRs](docs/adr/README.md), [Threat model](docs/THREAT-MODEL.md)
