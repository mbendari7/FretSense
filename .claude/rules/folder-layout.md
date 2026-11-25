---
paths:
  - "packages/**"
  - "apps/**"
  - "services/**"
  - "ml/**"
  - "data/**"
  - "bench/**"
  - "fixtures/**"
  - "content/**"
  - "scripts/**"
  - "specs/**/plan.md"
  - "docs/ARCHITECTURE.md"
---

# Folder layout (target; changes go through plan + ADR)

> Moved verbatim from CLAUDE.md on 2026-11-25 (ADR-0013). 


```
FretSense/
├── CLAUDE.md
├── .claude/{agents,skills}/          # committed; settings.local.json is gitignored
├── .specify/                         # constitution, templates, scripts
├── specs/NNN-<feature>/              # spec, plan, research, data-model, contracts, quickstart, tasks, checklists
├── content/lessons/                  # lessons (original text, theory-checked, owner-approved)
├── content/handbook/                 # handbook explanations and glossary (same rules) [017]
├── content/packs/                    # curriculum packs (built-in General Theory; _template.yaml)
├── packages/
│   ├── theory/                       # pure TS domain: notes, intervals, InstrumentProfile, fretboard graph
│   ├── dsp/                          # Rust → wasm: YIN, chromagram, onset [002+]
│   ├── vision/                       # hand/neck tracking adapters, geometry [008+]
│   ├── learner/                      # concept DAG, knowledge tracing, scheduler [006]
│   ├── audio-io/                     # AudioBackend port, device state machine, calibration [015]
│   └── ml-runtime/                   # onnxruntime-web adapters, model registry client [009+]
├── apps/web/                         # React + Vite PWA (domain/application/infrastructure/ui)
├── apps/desktop/                     # optional Tauri + Rust/cpal native audio backend [015]
├── services/sync/                    # optional FastAPI + PostgreSQL backend [013]
├── ml/                               # Python training/eval pipelines, configs, model cards [007+]
├── data/                             # dataset manifests, splits and cards (media by reference) [007+]
├── fixtures/                         # theory JSON, golden audio/video clips
├── bench/                            # latency/accuracy/fps harnesses + baselines
├── docs/{adr/,feedback/,PRODUCT.md,AI-WORKFLOW.md,SKILLS-MATRIX.md,THREAT-MODEL.md,ARCHITECTURE.md}
└── .github/workflows/
```
