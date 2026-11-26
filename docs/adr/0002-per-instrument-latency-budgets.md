# 0002. Per-Instrument Latency Budgets

- **Status**: Accepted (owner approval 2026-11-25, recorded in "Owner approvals recorded" below; earlier status: Proposed (owner to confirm the numbers in the clarify batch))
- Date: 2026-11-21
- Deciders: owner
- Related: Constitution V, VIII; features 002, 003, 004; ADR-0003

## Context
Constitution v1 required < 30 ms from note to screen. Period-based pitch detectors (YIN and its
relatives) need about **two periods of the lowest detectable pitch** in the buffer: one integration
window plus the maximum lag. The lowest notes are:

| Instrument (all profiles) | Lowest open note | f₀ | −1 semitone margin (detuning) | Period at margin | 2 periods |
|---|---|---|---|---|---|
| 6-string guitar (Drop D / DADGAD) | D2 | 73.42 Hz | 69.30 Hz | 14.43 ms | 28.9 ms |
| 4-string bass (Drop D) | D1 | 36.71 Hz | 34.65 Hz | 28.86 ms | 57.7 ms |
| 5-string bass (BEADG) | B0 | 30.87 Hz | 29.14 Hz | 34.32 ms | 68.6 ms |

Add the audio I/O quantum (128 frames at 48 kHz = 2.7 ms) and one display frame at 60 Hz
(16.7 ms). Before any DSP cost, pitch-confirmed latency is then about 48 ms (guitar), 77 ms
(4-string bass) and 88 ms (5-string bass). Even guitar can't meet 30 ms on its lowest string
with a full two-period window.

## Decision
Two-stage feedback, both stages p95 on the reference setup:

1. **Onset acknowledgement ≤ 30 ms for every instrument.** This is "a note was struck" feedback
   from an energy/flux onset detector that doesn't need a full period.
2. **Pitch-confirmed feedback**, per instrument:
   - 6-string guitar: **≤ 50 ms**
   - 4-string bass: **≤ 80 ms**
   - 5-string bass: **≤ 90 ms**
   - Custom tunings: `2 × period(lowest open note − 1 semitone) + I/O quantum + 1 display frame +
     2 ms DSP headroom`, rounded up to the next 10 ms.

The detection window is sized per InstrumentProfile (ADR-0003). It is never one global constant.
Higher notes may confirm sooner. The budget is the worst case for the profile.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Single 30 ms budget for all | Simple, impressive | Physically impossible for bass and for the lowest guitar strings | It would be a false claim |
| Single 90 ms budget for all | One number | Guitar feedback would feel sluggish for no reason | Wastes ~40 ms on guitar |
| One-period window (shorter) | Halves the window | Much higher octave-error and miss rates on low notes | Accuracy matters more than a few ms (to be measured in 002) |
| Detect the 2nd/3rd harmonic of low notes, then infer f₀ | Shorter window | Octave ambiguity, a fragile heuristic | Could be a 002 experiment, not a baseline guarantee |
| Per-string budgets | Tightest per-string numbers | Complex UX and tests | The per-instrument worst case is enough; per-string can be reported, not enforced |

## Consequences
- Feature 002's spec must use these budgets and benchmark them per instrument.
- The UI must show onset feedback immediately and the pitch verdict when it is confirmed.
- Changing a budget needs a new ADR (Constitution V).

## AI involvement
_To be written by the owner._

## Owner approvals recorded

- Accepted 2026-11-25, owner in chat (copied word for word): "approve anything else left and actually build and create the program". Ledger: `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-blanket-approval-build.md`.
