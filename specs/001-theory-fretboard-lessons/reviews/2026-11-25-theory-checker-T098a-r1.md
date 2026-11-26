# theory-checker r1: T098a, 2026-11-25

**Verdict:** PASS WITH NOTES (no WRONG)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | MINOR | "or its 5th" → "a perfect 5th above or below" | Applied |
| 2 | MINOR | frets vs semitones across strings | Applied: "1–2 semitones"; "one fret on the same string" |
| 3 | MINOR | Chord-tone-lock feedback untested | Applied: F-major test (hand-written triads) in feedback.test.ts |

**Owner sign-off:** ______
