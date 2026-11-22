# How FretSense Is Built: Spec-Driven Development With AI Agents

> **For reviewers and recruiters.** FretSense is built with AI agents, but not by "vibe coding".
> Every line of code traces back to an approved requirement. AI subagents act as **reviewers and
> gatekeepers** with narrow permissions, not as free code generators. I hand-write the core
> algorithms (YIN, chromagram, camera homography, Viterbi fingering, knowledge-tracing updates),
> run every ML training experiment, and write every lesson myself. This page explains the
> process, shows the measured results, and keeps an honest log of where the AI got things wrong.
> The skills these features demonstrate are listed in [SKILLS-MATRIX.md](SKILLS-MATRIX.md).

## 1. Principles

These are summarised from [the constitution](../.specify/memory/constitution.md), v2.0.0.

- **Specs are the source of truth.** Code that disagrees with the spec is a bug, or a spec change
  that must be approved *first*.
- **Traceability:** `FR-xxx` → task `Txxx` → test or eval → commit `[Txxx][FR-xxx]` → PR.
- **Tests first.** For ML, the dataset card, split, eval harness and baseline come before any model.
- **ML rigor.** Held-out test sets, confusion matrices, per-instrument metrics, model cards, and
  reproducible runs. A model ships only if it beats its baseline.
- **Instrument-agnostic, private, degradable.** Guitar and bass are equal citizens. Camera and mic
  data stay on the device. Everything works audio-only, and the DSP baselines remain available.
- **One task at a time,** each approved by me, with every decision recorded as an [ADR](adr/).

## 2. Subagent gate diagram

```mermaid
flowchart LR
    C[constitution] --> S[specify]
    S --> SR{{spec-reviewer}}
    SR --> CL[clarify]
    CL --> SR2{{spec-reviewer<br/>no BLOCKERs}}
    SR2 --> P[plan]
    P --> AR{{architecture-reviewer}}
    P -.camera/mic/network.-> PA{{privacy-auditor}}
    P -.auth/input/backend.-> SE{{security-reviewer}}
    AR --> CK[checklist] --> T[tasks] --> AN[analyze<br/>no CRITICAL/HIGH]
    AN --> IMPL

    subgraph IMPL [implement: one task at a time]
      direction LR
      TW{{test-writer<br/>red}} --> OK[owner OK] --> I[implement] --> G[green] --> CR{{code-reviewer}}
      CR -.theory/fingering.-> TC{{theory-checker}}
      CR -.DSP/vision/inference.-> PF{{perf-auditor}}
      CR -.models/exports.-> ME{{ml-evaluator}}
      CR -.data/.-> DC{{dataset-curator}}
      CR -.media/network.-> PA2{{privacy-auditor}}
      CR -.auth/deps/CI.-> SE2{{security-reviewer}}
    end

    IMPL --> CV[converge] --> DK{{docs-keeper}} --> PR[PR + AI involvement]
```

| Step | Skill | Gated by | What gets checked |
|------|-------|----------|-------------------|
| Principles | `/speckit-constitution` | Owner + ADR | Non-negotiable rules, version bump |
| Requirements | `/speckit-specify`, `/speckit-clarify` | **spec-reviewer** + owner | Testable, measurable, per instrument, no conflicts |
| Design | `/speckit-plan` | **architecture-reviewer**, **privacy-auditor**, **security-reviewer**, ADRs | Layering, alternatives, data flows, threat model |
| Requirement quality | `/speckit-checklist` | Owner | Domain checklists (theory, UX/a11y, performance, ML, privacy) |
| Work breakdown | `/speckit-tasks`, `/speckit-analyze` | Owner | Every task → FR, every FR → test or eval, no CRITICAL/HIGH findings |
| Build | `/speckit-implement` | **test-writer** → **code-reviewer** + area gates | Red/green, spec drift, ownership, correctness, regressions |
| Close-out | `/speckit-converge` | **code-reviewer**, area gates, **docs-keeper** | Nothing unbuilt; docs and skills matrix in sync |

### Subagent roles

| Agent | Permissions | Job |
|-------|-------------|-----|
| [`spec-reviewer`](../.claude/agents/spec-reviewer.md) | Read-only | Finds vague, untestable or missing requirements before planning |
| [`architecture-reviewer`](../.claude/agents/architecture-reviewer.md) | Read-only | Enforces clean-architecture layers and dependency direction |
| [`test-writer`](../.claude/agents/test-writer.md) | Test, fixture, bench and eval-harness files only | Turns FRs into failing tests before implementation |
| [`code-reviewer`](../.claude/agents/code-reviewer.md) | Read-only | Checks diffs against the constitution, spec and tasks, ranked by severity |
| [`theory-checker`](../.claude/agents/theory-checker.md) | Read-only | Spelling, modes, Roman numerals, fretboard math for every instrument, bass patterns |
| [`perf-auditor`](../.claude/agents/perf-auditor.md) | Read-only + runs benchmarks | Per-instrument latency (ADR-0002), fps, inference time |
| [`ml-evaluator`](../.claude/agents/ml-evaluator.md) | Read-only + runs evals | Blocks models without metrics, a confusion matrix, a baseline win or a model card |
| [`dataset-curator`](../.claude/agents/dataset-curator.md) | `data/` and dataset cards only | Label validity, split leakage, card accuracy, consent |
| [`privacy-auditor`](../.claude/agents/privacy-auditor.md) | Read-only | No camera or mic data leaves the device without opt-in |
| [`security-reviewer`](../.claude/agents/security-reviewer.md) | Read-only | Auth, input validation, secrets, supply chain |
| [`docs-keeper`](../.claude/agents/docs-keeper.md) | `README.md` and `docs/` only | Keeps the README, skills matrix, ADR index and diagrams in sync |

## 3. Roadmap: one spec per feature

| # | Feature | Instruments | Status |
|---|---------|-------------|--------|
| 001 | Theory engine, fretboard and lessons; profile-scoped sync-ready data, My Gear instruments, packs format, stage choice | guitar + bass | Clarified; amended for v2.2.0; plan in progress |
| 016 | Personalisation: local profiles, My Gear, onboarding, learning paths, curriculum packs, quality tiers (built right after 001) | guitar + bass | Specified; under review |
| 015 | Audio I/O and device management (built after 016) | guitar + bass | Clarified; amended for v2.2.0 |
| 002 | DSP pitch detection (YIN) | guitar + bass | Planned |
| 003 | Play-along drills + timing/onset detection | guitar + bass | Planned |
| 004 | Chord recognition baseline (chromagram templates) | guitar | Planned |
| 005 | Chord sheet analyzer + Viterbi fingering optimizer | guitar + bass | Planned |
| 006 | Adaptive curriculum: concept DAG, knowledge tracing, spaced repetition, planner (recommends, never locks) | both | Clarified; amended for v2.2.0 |
| 007 | ML data platform: labelling tool, dataset versioning, training pipeline, tracking, registry | both | Clarified |
| 008 | Vision I: guided camera setup, hand + neck tracking → (string, fret), live highlighting | both | Clarified; amended for v2.2.0 |
| 009 | ML audio models: chord CNN + polyphonic transcription (ONNX, int8, browser) | both | Specified (draft) |
| 010 | Audio-visual fusion + camera coaching | both | Specified (draft) |
| 011 | Vision II: picking hand, posture, technique events | both | Specified (draft) |
| 012 | Transcription to tab and notation | both | Specified (draft) |
| 013 | Optional sync backend: FastAPI, PostgreSQL, auth | — | Specified (draft); out of scope this term |
| 014 | ESP32 LED fretboard (stretch goal) | guitar | Planned |

Development test tooling (not a feature): an ESP32 LED-flash + piezo-click A/V sync reference (015 FR-027), under `bench/`.

### Dependency graph

```mermaid
flowchart TD
    F001[001 Theory + fretboard + lessons] --> F016[016 Personalisation]
    F016 --> F015[015 Audio I/O + devices]
    F016 --> F006
    F016 --> F008
    F016 -.sync-ready records.-> F013
    F015 --> F002[002 YIN pitch]
    F015 --> F003
    F015 --> F009
    F015 --> F010
    F001 --> F002
    F001 --> F005[005 Chord sheets + fingering]
    F001 --> F006[006 Adaptive curriculum]
    F001 --> F014[014 ESP32 LED fretboard]
    F002 --> F003[003 Play-along + onsets]
    F002 --> F004[004 Chord baseline]
    F003 -.optional.-> F006
    F001 --> F007[007 ML data platform]
    F007 --> F008[008 Vision I]
    F007 --> F009[009 Audio ML models]
    F002 --> F009
    F004 --> F009
    F008 --> F010[010 AV fusion + coaching]
    F009 --> F010
    F008 --> F011[011 Vision II]
    F007 --> F011
    F003 --> F012[012 Transcription]
    F009 --> F012
    F005 --> F012
    F006 --> F013[013 Sync backend]
    F007 --> F013
    F015 -.A/V offset.-> F008
```

Build order: 001 → 016 → 015 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014.

### Where each employer skill shows up

✔ = a primary demonstration, · = also used. Details and tests are in [SKILLS-MATRIX.md](SKILLS-MATRIX.md).

| Skill | 001 | 016 | 015 | 002 | 003 | 004 | 005 | 006 | 007 | 008 | 009 | 010 | 011 | 012 | 013 | 014 |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Data structures & algorithms | ✔ graph | · order keys | · ring buffer | · | · ring buf | · | ✔ DP/Viterbi, trie | ✔ DAG, heap | | · | | ✔ HMM | · | ✔ | · | |
| Systems & concurrency |  |  | ✔ worklet, SAB ring | ✔ Rust/WASM | · |  |  |  | ✔ workers | ✔ WebGPU | ✔ | · | · |  |  | ✔ embedded |
| OOP & design patterns | ✔ clean arch, DI | ✔ configurable architecture | ✔ strategy, state machine | ✔ strategy | ✔ event bus | ✔ strategy | · | · | · | ✔ strategy | ✔ strategy | ✔ observer | · | · | · | |
| Backend & databases | · IndexedDB | ✔ schema design, sync-ready records | · IndexedDB prefs | | | | | · IndexedDB | · | | | | | | ✔ | |
| Testing | ✔ unit, property, E2E, visual | ✔ property, isolation | ✔ mock devices, hot-plug sim, golden audio | ✔ golden audio | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ golden video | ✔ ML eval | ✔ | ✔ | ✔ | ✔ contract | · |
| DevOps / CI/CD | ✔ CI, preview deploys |  | · bench CI | · bench CI | | | | | ✔ Docker, ML pipeline | | ✔ ML eval CI | | | | ✔ docker-compose | |
| Performance & observability | · | · tier benchmark | ✔ latency bench, overlay | ✔ benchmarks | ✔ | · | | | | ✔ perf overlay | ✔ | ✔ | · | | · | |
| ML / MLOps |  |  | · resampling to model rate |  | · baseline |  |  | ✔ KT | ✔ | ✔ | ✔ | ✔ | ✔ | · |  |  |
| Machine vision |  |  | · A/V sync |  |  |  |  |  | · labelling | ✔ |  | ✔ | ✔ |  |  |  |
| Security & privacy | · CSP, input validation | ✔ import validation | ✔ mic indicator, COOP/COEP | | | | · parser fuzzing | | ✔ consent | ✔ on-device | | ✔ | · | | ✔ auth, rate limits | |
| Accessibility | ✔ | ✔ keyboard reorder | · | | · | | · | · | · | · | | · | | · | | |
| Documentation | ✔ C4, ADRs | · | · ADR-0005 | · | · | · | · | · | ✔ cards | · | ✔ model cards | · | · | · | ✔ OpenAPI | · |
| Signal processing & hardware |  |  | ✔ hum, level, clean/effected, resampler | ✔ | ✔ onsets | ✔ chroma |  |  |  |  | ✔ |  |  |  |  | ✔ ESP32 |

## 4. Metrics

These come from **measured runs only**, from CI, perf-auditor or ml-evaluator reports linked by
commit, and are reported **per instrument** where it applies. A dash means "not measured yet".
Targets come from the specs and ADR-0002.

| Metric | Instrument | Target | Current | Measured on | Commit / report |
|--------|------------|--------|---------|-------------|-----------------|
| Theory fixtures passing | all | 100% (001 SC-001) | — | — | — |
| Theory engine line / branch coverage | — | ≥ 90% | — | — | — |
| Drill tap → feedback (p95) | — | < 100 ms (001) | — | — | — |
| Onset acknowledgement (p95) | each | ≤ 30 ms (ADR-0002) | — | — | — |
| Pitch-confirmed feedback (p95) | guitar / 4-string bass / 5-string bass | ≤ 50 / 80 / 90 ms (ADR-0002, proposed) | — | — | — |
| Pitch accuracy (± cents, labelled set) | each | spec 002 | — | — | — |
| Chord accuracy: templates vs CNN | each | spec 004 / 009 | — | — | — |
| Fingertip → (string, fret) accuracy | each | spec 008 | — | — | — |
| Vision pipeline fps / latency | each | spec 008 | — | — | — |
| Mastery prediction AUC (KT vs baseline) | — | spec 006 | — | — | — |
| Model size and latency, fp32 vs int8 | — | spec 009 | — | — | — |
| FRs with ≥1 test or eval | — | 100% | — | — | — |
| Tasks traced to an FR | — | 100% | — | — | — |

## 5. Where the AI got it wrong

This is an honest log of AI output that was rejected, corrected, or caught by a gate. Catching
these mistakes is the point of the process.

| Date | Step / task | Agent | What it produced | What was wrong | How it was caught | What I did |
|------|-------------|-------|------------------|----------------|-------------------|------------|
| 2026-11-21 | 001 specify | AI agent (main session) | First draft of spec 001 | Didn't name a book part (it conflicted with constitution v1). FR-032 said "within 100 ms" on every tap but SC-002 said p95. No octave rule for Cb/B#. No canonical chord-symbol format. Drill questions could be unanswerable. 23 findings in total | **spec-reviewer** returned BLOCK | Findings folded into the amended spec; the book-mapping conflict was resolved in constitution v2.0.0 (ADR-0001) |
| 2026-11-21 | constitution v1 | AI agent (main session) | Wrote "< 30 ms note → screen" as a single budget, from the owner's brief | Never checked it against physics: two periods of a 5-string bass's low B ≈ 69 ms before any processing | Caught while writing the bass amendment | ADR-0002 splits the budget (onset ≤ 30 ms; per-instrument pitch budget); waiting on owner confirmation |
| 2026-11-21 | 006 / 007 / 008 specify | AI agent (main session) | First drafts of the curriculum, data-platform and vision specs | 006: BKT fit could see held-out data, and the split cut sessions in two. 007: no leakage unit for a single performer, owner media could reach CI, the baseline needed the human-owned chromagram. 008: stabilisation alone exceeded the latency budget, v2 was scored against v1's own labels, and press/hover had no ground truth | **spec-reviewer** returned BLOCK on all three (12 blockers) | All findings folded in; the single-performer rule went into constitution v2.1.0 (ADR-0004) |
| 2026-11-21 | repo setup | AI agent (main session) | Made 10 local git commits carrying an AI co-author trailer | The owner commits everything and doesn't want AI credited as a contributor | Owner review | Commits undone with the content kept as uncommitted changes (nothing was pushed); "Git rules" added to CLAUDE.md and the constitution (VII) |
| 2026-11-21 | summary to owner | AI agent (main session) | Reported "9 commits" while listing 10 hashes | Miscounted (two 006 commits) | Owner review | Corrected to 10 |
| 2026-11-21 | all specs | AI agent (main session) | Specs built around the owner's gear and book (Scarlett/Katana defaults, book-part tracks, mastery locks) | Didn't question whether a single-owner design was what the product needed | Owner direction change | Constitution v2.2.0 (ADR-0006), new feature 016, and every spec amended |
| 2026-11-21 | 001 plan | AI agent (main session) | Plan, data model and contracts for 001 | Claimed "the device id is never exported" while every HLC embedded it. Settings were one LWW record although 013 merges per field. Natural-key records (settings, completion) could be duplicated by copy-import or sync. No HLC receive rule. Payload hash and itemKey encodings weren't frozen. "Raw HTML is a build error" had no mechanism. CSP was incomplete, and there was no framing defence | **privacy-auditor**, **architecture-reviewer** and **security-reviewer** all returned CHANGES REQUESTED | All fixed (per-profile writer id, per-field HLC, natural keys, frozen encodings, explicit sanitiser, full CSP, T14–T17); 013 amended to match |
| 2026-11-21 | 001 tasks | AI agent (main session) | tasks.md | A test-writer task edited CI config (outside test-writer scope); several data-model fields lacked explicit citations; FR-043 copy rule contradicted the new natural-key rule | `/speckit-analyze` | Fixed in tasks.md and spec FR-043/FR-066a |

## 6. AI involvement per PR

Every PR description has an **AI involvement** section listing what the agents generated, what I
changed, what I rejected, and the gate verdicts. The PR history is the full audit trail.
