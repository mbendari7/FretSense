# FretSense

**The guitar and bass teacher, handbook and transcriber in one app.** FretSense gives you the
structured lessons of a theory book or online course, interactive fretboard visuals for your own
instrument and tuning, a complete reference handbook, and a Studio that hears (any audio interface,
USB amp or the laptop mic) and optionally sees (camera + ML) you play, then writes it out as tab and
notation. It's **personalised for every player**: your gear, goals, learning paths, lesson
structure and curriculum. Nothing is locked. Everything runs on your own device, with no account.

**Product vision, pillars, release plan and non-goals: [docs/PRODUCT.md](docs/PRODUCT.md).**

> **Status (2026-11-22): specification phase, no application code yet.** This repo is built
> strictly spec-first: constitution → spec → clarify → plan → tasks → analyze → implement. See
> [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) for the process and
> [docs/SKILLS-MATRIX.md](docs/SKILLS-MATRIX.md) for the engineering skills each feature demonstrates.

## Why I'm building it

1. **To practise better, and to help any player practise better.** I open it before every session.
   My rig (a Squier Strat into a Focusrite Scarlett, plus a Katana:GO) is just one example setup.
   It suggests what to practise, never forces it, and checks what I actually play.
2. **To build a serious ML and vision system**, with real datasets, held-out evaluation, model cards,
   on-device inference, and models that ship only if they beat their DSP baselines.
3. **To show disciplined, spec-driven engineering with AI agents.** AI agents write the code and
   the lessons, including the core algorithms (YIN pitch detection, the chromagram, the camera
   homography, Viterbi fingering, knowledge tracing, latency estimation), from specs I approve.
   Reviewer agents gate every step, each algorithm is checked against independent references, and
   I decide what gets built, what ships and every commit.
4. **To ship a real product**, not a demo: a landing page, onboarding, one design system,
   accessibility, a performance budget, a demo mode for people without a guitar, and versioned
   releases.

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
| Reference handbook: scales, chords, voicings, arpeggios, progressions, keys, glossary | 017 | 015 + 003 | |
| Adaptive suggestions, spaced review, practice plans | 006 | | |
| Studio: playing → tab and notation | 012 | 015 + 012 | 010 (positions) |

## Roadmap: product releases

Specs are numbered in the order they were written, not the order they ship. Each release is
usable on its own and has a 2-minute demo script. Goals, exit criteria and demo scripts are in
[docs/PRODUCT.md](docs/PRODUCT.md#release-plan).

| Release | Goal | Specs |
|---------|------|-------|
| **v0.1 "Fretboard"** | Usable with no gear: lessons, tap drills, handbook, personal paths, offline | [001](specs/001-theory-fretboard-lessons/spec.md) theory engine, fretboard and lessons · [016](specs/016-personalization/spec.md) profiles, My Gear, onboarding, paths, packs · [017](specs/017-reference-handbook/spec.md) handbook (core) · [018](specs/018-product-shell-launch/spec.md) product shell and onboarding |
| **v0.2 "It hears you"** | Listens to your real instrument through any gear and scores play-along drills | [015](specs/015-audio-io-device-management/spec.md) audio I/O and devices · 002 YIN pitch detection *(planned)* · 003 play-along drills and onsets *(planned)* |
| **v0.3 "It teaches you"** | Plans your practice, recognises chords, finds fingerings; complete handbook | [006](specs/006-adaptive-curriculum/spec.md) adaptive curriculum · 004 chord recognition baseline *(planned)* · 005 chord sheets and fingering optimizer *(planned)* · [017](specs/017-reference-handbook/spec.md) handbook (complete: voicing finder, progression explorer, cheat sheets) |
| **v0.4 "It sees you"** | Camera knows which string and fret you're on, fused with audio for coaching | [007](specs/007-ml-data-platform/spec.md) ML data platform · [008](specs/008-vision-hand-neck-tracking/spec.md) hand and neck tracking · [010](specs/010-av-fusion-coaching/spec.md) audio-visual fusion and coaching |
| **v1.0 "It writes it down"** | Studio: playing → editable, playable, exportable tab and notation; demo mode with no gear | [009](specs/009-ml-audio-models/spec.md) ML audio models · [011](specs/011-vision-picking-posture-technique/spec.md) picking, posture, technique · [012](specs/012-transcription-tab-notation/spec.md) Studio transcription · [018](specs/018-product-shell-launch/spec.md) launch polish and demo mode |
| **Later** | Opt-in extras | [013](specs/013-sync-backend/spec.md) sync backend · 014 ESP32 LED fretboard *(planned)* |

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

## Dev tooling

Optional developer tools that cut AI-agent token use (ADR-0013, `docs/adr/0013-token-budget.md`). None of them is a dependency of FretSense, and none ships with the app; nothing is added to any `package.json`.

- **RTK** (github.com/rtk-ai/rtk), the "Rust Token Killer": compresses shell command output (git, vitest, tsc, lint) before the agent reads it. Install: `winget install rtk-ai.rtk`. Check: `rtk gain` shows the savings dashboard (a different crates.io project is also called rtk). Hook: the project `.claude/settings.json` has a `PreToolUse` hook for the Bash tool (`rtk hook claude`); it only covers the Bash tool, not PowerShell. `git status/diff/log` are rewritten; bare `pnpm test` is not, so use `cd packages/theory && pnpm vitest run` for compressed test output. Restart Claude Code after installing so `rtk` is on PATH.
- **Serena** (github.com/oraios/serena): MCP server for symbol-level code lookup via the TypeScript language server. Install (per its README Quick Start, not a marketplace): install uv, then `uv tool install -p 3.13 serena-agent` and `serena init`. Project config: `.mcp.json` (`serena start-mcp-server --context claude-code --project-from-cwd`) and `.serena/project.yml`. Only code-reviewer, test-writer, theory-checker and architecture-reviewer get its tools.
- **Context7** (github.com/upstash/context7): MCP server that fetches current library docs on demand. No install; configured in `.mcp.json` as an HTTP server. Optional API key: set the environment variable `CONTEXT7_API_KEY` (never commit a key). Only test-writer and architecture-reviewer get its tools.
- **ccusage** (ccusage.com): reads local Claude Code logs and reports tokens and cost. Run `npx ccusage@latest daily` or `session`; the project status line runs `npx -y ccusage@20.1.2 statusline`. Telemetry is disabled through `CCUSAGE_TELEMETRY_DISABLED=1` in `.claude/settings.json`.

Claude Code asks you to approve the project MCP servers on first start (`/mcp` shows their status). Baseline and results: `docs/token-budget/`.

## Project rules

- [Constitution v2.3.0](.specify/memory/constitution.md): the highest authority
- [Product](docs/PRODUCT.md): vision, pillars, release plan, non-goals
- [CLAUDE.md](CLAUDE.md): agent rules, gates, git rules
- [ADRs](docs/adr/README.md), [Threat model](docs/THREAT-MODEL.md)
