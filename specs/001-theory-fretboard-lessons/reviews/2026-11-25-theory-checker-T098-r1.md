# theory-checker r1: T098, 2026-11-25

**Verdict:** PASS WITH NOTES (no BLOCKER, no MAJOR)

Confirmed: 13 semitones above C in C major is Db / "a minor 9th" by FR-060 (test-writer's C# refuted).

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | MINOR (ambiguous) | FR-060 context root for walking bass: key tonic vs chord root | **Deferred to owner**: key tonic kept (recorded provisional in spec-clarifications.md, 2026-11-25) |
| 2 | MINOR | 15–24 semitone R4 names untested ("a perfect double octave") | **Deferred**: backlog test; behaviour follows FR-002 |
| 3 | MINOR | 25 semitones as augmented 15th left unnamed | **Deferred**: spec says beyond a double octave is unnamed |
| 4 | MINOR | Minor/theoretical key with no chords gave a misleading reason or out-of-key progression | **Applied**: buildLine rejects with "The built-in progression needs one of the 15 major keys."; tests added |
| 5 | MINOR | Untested: d = 7 below, Cb/C# keys, BEADG R4 | **Deferred**: backlog tests |

**Owner sign-off:** ______
