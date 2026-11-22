# FretSense

An interactive **guitar and bass** theory handbook that teaches on the fretboard, listens to your
real instrument through whatever audio interface or USB amp you own, and (optionally) watches your
hands on camera to coach technique. It's **personalised for every player**: your gear, goals,
learning paths, lesson structure and curriculum. Nothing is locked. Everything runs on your own
device, with no account.

> **Status (2026-11-21): specification phase, no application code yet.** This repo is built
> strictly spec-first: constitution → spec → clarify → plan → tasks → analyze → implement. See
> [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) for the process and
> [docs/SKILLS-MATRIX.md](docs/SKILLS-MATRIX.md) for the engineering skills each feature demonstrates.

## Why I'm building it

1. **To practise better, and to help any player practise better.** I open it before every session.
   My rig (a Squier Strat into a Focusrite Scarlett, plus a Katana:GO) is just one example setup.
   It suggests what to practise, never forces it, and checks what I actually play.
2. **To build a serious ML and vision system**, with real datasets, held-out evaluation, model cards,
   on-device inference, and models that ship only if they beat their DSP baselines.
3. **To show disciplined, spec-driven engineering with AI agents.** Subagents review and gate the
   work. They don't write it freely. I hand-write the core algorithms: YIN, the chromagram, the
   camera homography, the Viterbi fingering optimizer, the knowledge-tracing updates, and the
   latency/A-V cross-correlation estimator. I also run every training experiment and write every
   lesson.

## How it's personalised

- **My Gear**: your instruments (type, strings, tuning, fret count, name), interface or amp, camera
  and output. Shipped presets (e.g. Scarlett Solo/2i2 4th Gen, Katana:GO, generic interface) are
  editable starting points, never assumptions.
- **Learning paths**: a short onboarding (goals, instrument, level, genres, practice time) suggests a
  path you can edit, reorder, extend or trim. Keep several and switch between them.
- **Lessons your way**: pick which stages you want (Read, See, Drill, Play, Camera-coach) and their
  order. Jump to any lesson, track or drill at any time; nothing is locked.
- **Curriculum packs**: the built-in pack is general theory. Make your own pack that maps lessons to
  the book or course you follow. Mine follows *Guitar Theory for Dummies*.
- **Local profiles**: several players can share one device, each with their own gear, settings,
  paths and progress. Offline-first, no account.
- **Camera assistant**: optional. A guided setup, live fretboard highlighting and technique coaching.
  Everything works without it.

## Topics → features

Lesson stages become available when their enabling feature ships.

| Topic (General Theory pack) | Read / See / Drill | Play | Camera-coach |
|-----------------------------|--------------------|------|--------------|
| Notes on the neck, intervals | 001 | 015 + 002 + 003 | 008 + 010 |
| Scales and modes | 001 | 015 + 002 + 003 | 010 |
| Chords and arpeggios | 001 | 015 + 004 / 009 | 010 |
| Keys, progressions, harmony | 001 + 005 | 015 + 004 / 009 | 010 |
| Bass: root–fifth–octave, arpeggios, walking lines, chord-tone lock | 001 | 015 + 002 + 003 | 010 |
| Paths, packs, profiles, My Gear | 001 + 016 | | |
| Adaptive suggestions, spaced review, practice plans | 006 | | |

## Roadmap

| # | Feature | Spec |
|---|---------|------|
| 001 | Theory engine, fretboard and lessons (guitar + bass) | [spec](specs/001-theory-fretboard-lessons/spec.md) |
| 016 | Personalisation: profiles, My Gear, onboarding, paths, packs (right after 001) | [spec](specs/016-personalization/spec.md) |
| 015 | Audio I/O and device management (after 016) | [spec](specs/015-audio-io-device-management/spec.md) |
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
| 013 | Optional sync backend (FastAPI, PostgreSQL, auth); not this term | [draft](specs/013-sync-backend/spec.md) |
| 014 | ESP32 LED fretboard (stretch goal) | planned |

The dependency graph and the per-feature skill map are in [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md#3-roadmap-one-spec-per-feature).

## Tech stack (planned; each choice is confirmed by an ADR at plan time)

- **App:** pnpm monorepo, TypeScript strict, React + Vite installable PWA, SVG fretboard, IndexedDB
- **Theory engine:** pure TypeScript, zero runtime dependencies, Vitest + fast-check
- **Audio:** WebAudio AudioWorklet + SharedArrayBuffer ring buffer; Rust → WebAssembly DSP; a native
  Tauri/Rust/cpal backend is a stretch goal ([ADR-0005](docs/adr/0005-audio-backend-webaudio-vs-native.md))
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

- [Constitution v2.2.0](.specify/memory/constitution.md): the highest authority
- [CLAUDE.md](CLAUDE.md): agent rules, gates, git rules
- [ADRs](docs/adr/README.md), [Threat model](docs/THREAT-MODEL.md)
