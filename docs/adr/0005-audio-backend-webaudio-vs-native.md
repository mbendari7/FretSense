# 0005. AudioBackend: WebAudio (Browser, Default) vs Native Tauri + Rust/cpal

- Status: Proposed. **Native backend is a stretch goal, out of scope this term** (owner, 2026-11-21).
  The browser backend ships first; the native numbers are measured only if the stretch goal is taken up.
- Date: 2026-11-21
- Deciders: owner
- Related: spec 015 (FR-001–FR-004, SC-002, SC-008), ADR-0002, Constitution V, XI, XII

## Context
FretSense needs low, stable input latency and a clean, raw signal from class-compliant USB
interfaces (Focusrite Scarlett 4th Gen, Boss Katana:GO, others). Browsers add buffering, hide the
buffer size, may resample, and apply voice processing unless it is disabled. A native desktop app
can choose the host API (WASAPI exclusive/shared, ASIO on Windows), the buffer size and the sample
rate.

## Decision
Define an `AudioBackend` port (strategy) with two adapters:
1. **WebAudio (default)**: `getUserMedia` with echo cancellation, noise suppression and auto gain
   off, an AudioWorklet for capture, and a SharedArrayBuffer lock-free ring buffer to the analysis
   worker.
2. **Native (optional)**: a Tauri desktop shell with a Rust backend using cpal (WASAPI; ASIO where
   the owner installs the SDK/driver), streaming into the same ring-buffer contract.

The browser stays the default, because it needs no install, works on the phone, and is enough if
it meets the ADR-0002 budgets. Native is kept only if measurements show a material gain.

## Measurements (to be filled in by perf-auditor runs on the reference setup)
| Backend / host API | Buffer | Sample rate | Round-trip p50 | Round-trip p95 | Jitter (p95 − p50) | Dropouts / 10 min |
|---|---|---|---|---|---|---|
| WebAudio (Chrome, Windows) | browser-chosen | 48 kHz | — | — | — | — |
| Native WASAPI shared | 128 | 48 kHz | — | — | — | — |
| Native WASAPI exclusive | 64 | 48 kHz | — | — | — | — |
| Native ASIO (Focusrite driver) | 64 | 48 kHz | — | — | — | — |

Rule: keep native as a supported backend only if its p95 round trip is ≥ 10 ms lower than WebAudio's
on the reference setup, or WebAudio fails an ADR-0002 budget that native meets.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| WebAudio only | Simplest; works everywhere | Little control over buffer and rate; browser variance | Kept as the default, but measurement may justify native |
| Native only (Tauri) | Lowest latency, full control | No phone or web, install friction, breaks the PWA goal (VI) | Contradicts offline PWA / phone use |
| Electron + native addon | Mature ecosystem | Heavy, larger attack surface, Node native-addon maintenance | Tauri + Rust reuses the DSP language (002) and is lighter |
| WebMIDI/WebUSB direct to the interface | Lower-level access | Class-compliant audio isn't exposed over WebUSB; fragile | Not viable for audio streams |

## Consequences
- Both adapters must pass the same contract tests and golden recordings (015 FR-021).
- Native requires a security review (installer signing, update channel, IPC surface).
- If native shows no material gain, it is deleted, and SKILLS-MATRIX stops claiming it (XII).

## AI involvement
_To be written by the owner._
