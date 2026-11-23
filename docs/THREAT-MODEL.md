# FretSense Threat Model

Status: draft (constitution v3.0.0, Principles IX and XIII). Owner: project owner. Reviewed by:
`privacy-auditor` and `security-reviewer`. Update this file whenever a feature adds a network
call, stored media, a new permission or a new trust boundary.

## Assets

| Asset | Sensitivity | Where it lives |
|-------|-------------|----------------|
| Live camera frames | High (images of the owner and their home) | Memory only (workers) [008+] |
| Live microphone audio | High | Memory only (AudioWorklet / native callback) [015+] |
| Device preferences and calibration values | Low | IndexedDB [015] |
| Derived signals (hand landmarks, pitch tracks, technique events) | Medium (behavioural/biometric) | Memory; persisted only as aggregate scores unless the owner opts in |
| Opt-in recordings and labels | High | IndexedDB/OPFS on the device; `data/` by reference [007] |
| Progress, mastery and settings | Low–medium | IndexedDB, per local profile [001, 006, 016] |
| Local profiles, My Gear, onboarding answers, paths, packs | Low–medium (goals and gear are personal) | IndexedDB, per local profile [001, 016] |
| Active-learning corrections | Medium | On the device, per profile; shared only by explicit export [007] |
| Sync account and tokens | High | Backend + secure storage on the client [013] |
| Profile export files | Low–medium (unencrypted; leave the browser sandbox) | User's filesystem, user-controlled [001, 016] |
| HLC writer ids | Low (random per profile per device; not a device identifier) | Inside every record's timestamps [001] |
| Model artefacts | Low (integrity matters) | Static assets, checksummed [009+] |

## Trust boundaries

1. Browser sandbox ↔ device sensors (permission prompts).
2. Main thread ↔ workers/worklets (same origin; SharedArrayBuffer needs COOP/COEP).
3. Client ↔ static host (host chosen in a later ADR): code and model integrity.
4. Client ↔ sync backend (opt-in only) [013].
5. Owner's machine ↔ `ml/` training environment (local; datasets by reference).
6. Browser sandbox ↔ local filesystem (profile export/import, user-supplied files) [001, 016].
7. Build toolchain ↔ content (agent-written, owner-approved markdown and YAML processed in CI) [001].

## Threats (STRIDE) and controls

| # | Threat | Category | Control | Feature |
|---|--------|----------|---------|---------|
| T1 | Camera or mic data leaves the device through telemetry, error reports or third-party scripts | Info disclosure | No third-party scripts; strict CSP `connect-src` allowlist; error tracking scrubs payloads and is opt-in; privacy-auditor gate | all |
| T2 | Recording without the owner knowing | Info disclosure | Permission requested only when a feature is used; visible recording indicator; per-recording opt-in | 007, 008+ |
| T3 | A malicious lesson, chord sheet or progress import (XSS, prototype pollution, DoS) | Tampering / EoP | Schema validation with size limits; markdown rendered without raw HTML; parser fuzz/property tests | 001, 005 |
| T4 | A tampered model or WASM artefact | Tampering | Hash-pinned artefacts in the registry manifest; SRI where possible; served same-origin | 002, 009 |
| T5 | Leakage of dataset contributions or withdrawn consent | Info disclosure | Revocable consent record; deletion propagates; metadata stripped | 007, 013 |
| T6 | Account takeover or IDOR on the sync API | Spoofing / EoP | OAuth/OIDC + short-lived JWT; per-user authorization on every route; rate limiting | 013 |
| T7 | Supply-chain compromise | Tampering | Lockfiles, Dependabot/audit in CI, Actions pinned by SHA, minimal Docker images | all |
| T8 | Secrets committed | Info disclosure | `.env` gitignored; secret scanning in CI; scoped CI secrets | all |
| T9 | Mic left live in the background or without the user knowing | Info disclosure | Streams opened only by features that need them and stopped when they're done; always-visible "listening" indicator; privacy-auditor stream-lifetime tests | 015 |
| T10 | Cross-origin isolation (COOP/COEP) misconfigured, which breaks isolation or blocks shared memory | Tampering / DoS | Headers set on the deploy target and tested in CI; message-passing fallback | 015 |
| T11 | Native desktop app (Tauri) supply chain or IPC abuse | Tampering / EoP | Signed installers; minimal IPC allowlist; pinned Rust crates; `cargo audit`; security-reviewer gate | 015 (stretch) |
| T12 | One local profile reads another's data on a shared device, or an export file is left on a shared device | Info disclosure | Accepted risk: profiles are not a security boundary, and the UI says so; the export screen lists the contents and says the file is unencrypted (001 FR-043); reset says it hides rather than erases (001 FR-044); strict profile scoping prevents accidental mixing (016 SC-001) | 001, 016 |
| T13 | A malicious curriculum pack or profile import (XSS, oversize, prototype pollution) | Tampering / DoS | Strict schema validation, size checked before reading, depth pre-scan, array caps, prototype-key rejection, Map lookups, plain-text rendering, fuzz tests | 001, 016 |
| T14 | A crafted or corrupt import causes data loss or HLC poisoning (far-future timestamps) | Tampering | HLC future bound (24 h); local clock never advances past it; preview + confirm with "hidden" counts; whole-file rejection; one transaction | 001 |
| T15 | Clickjacking or framing of reset/import | Tampering | `frame-ancestors 'none'` header; destructive actions hidden when framed | 001 |
| T16 | A compromised or stale service worker keeps a bad build alive | Tampering | Prompt-to-reload updates; `navigateFallbackDenylist`; bundled Workbox; same-origin only | 001 |
| T17 | Storage-quota exhaustion from repeated large imports | DoS | 50 MB file cap (FR-043); array caps; quota errors abort the transaction with a readable message | 001 |

## Not yet modelled (added when each feature is planned)

These specs add assets, flows or permissions that this model doesn't cover yet. Each one must be
added, and pass `privacy-auditor`, at that feature's `/speckit-plan` (Constitution IX).

| Feature | What needs modelling |
|---------|----------------------|
| 012 Studio | Opt-in recordings, MusicXML / tab imports and exports, the transcription library |
| 017 Handbook | Cheat-sheet PDF export, favourites and sheets in IndexedDB |
| 018 Shell and launch | Opt-in analytics and error tracking (a new network flow and its consent scope), the deploy host, the bundled demo clip |

## Out of scope (for now)
Physical access to an unlocked device, and compromise of the browser itself.
