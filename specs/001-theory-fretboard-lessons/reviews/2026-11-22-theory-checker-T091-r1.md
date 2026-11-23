# theory-checker: T091, round 1

**Verdict (copied exactly):** FAIL (1 BLOCKER, 2 MAJOR, several MINOR)

## Findings
| # | Severity | Finding |
|---|---|---|
| 1 | BLOCKER | DrillRunner never calls `feedbackText`. An interval answer shows "Correct: G#3" instead of "Correct, Ab3 on string 3 fret 1", which breaks FR-032 and FR-049. Same as code-reviewer r1 #1. |
| 2 | MAJOR | feedback.ts takes the octave from MIDI, not the spelling: Cb4 shows as "Cb3" and Cbb4 as "Cbb3", and B# has the same bug the other way. Use `withOctaveForMidi`. Same as code-reviewer r1 #3a. |
| 3 | MAJOR | FR-031 note sets don't exist. Notes are stored as pitch classes and spelled with the major-key default, so C#, D#, G#, A# and Gb can never be prompted; the default is 12 notes, not the 7 naturals. (FR-031 is outside T091's FR list.) |
| 4 | MINOR | No Cb, Cbb or B# octave fixture. |
| 5 | MINOR | `steps[0]` is used for multi-step drills; the incorrect text for the other drills has no octave. Same as code-reviewer r1 #3b/c. |
| 6 | MINOR, ambiguous | References on black keys use major-key default spelling, which gives heavy answers (Fb, Cb, Bbb). They are correct, but the spec doesn't say how the reference is spelled. Owner or spec decision. |
| 7 | MINOR, ambiguous | The FR-036 default functions for dim/aug/sus should be stated outright. |
| 8 | MINOR | The `rfo|pc` group label spelling varies with the drawn quality (Ab vs G#). |
| 9 | MINOR, outside T091 | DrillsScreen UI defaults: intervals {m3,M3,P4,P5} instead of FR-035's six; roots are missing B; no d5 chip. |
| 10 | MINOR, ambiguous | A custom tuning with two equal lowest strings labels both "low". |

**Verified correct:**
- the quality-word table and the ordinals;
- chord-tone spellings: Cb, Cbb, Fb, E#, Abb and the rest;
- interval spellings in both directions;
- note-finding string labels on every preset;
- root–fifth–octave pitches and keys.

**Applied:** #1, #2, #4 and #5 are being fixed with code-reviewer r1 #1/#3; test-writer's red tests come first. #3, #8 and #9 are done in T091a, with red tests first (noteSets.test.ts, DrillsScreen.defaults.test.tsx; 112 tests): the four FR-031 note sets (17 spellings, never Cb/Fb/E#/B#), the default of 7 naturals, the FR-035/036 UI defaults with a d5 chip, and a stable `Root <note>` label per rfo item.
**Deferred:** #6, #7 and #10 go to product-owner as spec questions; 

**Owner sign-off:** ____________________
