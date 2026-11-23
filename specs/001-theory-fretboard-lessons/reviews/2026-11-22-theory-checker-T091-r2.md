# theory-checker: T091 (+ T091a, T093a), round 2

**Verdict (copied exactly):** PASS WITH NOTES. No BLOCKER or MAJOR findings. All three round-1 BLOCKER/MAJOR findings are fixed, and the four notes below are MINOR.

Round 1 #1, #2, #3, #4, #5, #8 and #9 are fixed. Probes:
- 700 interval questions: 0 bad;
- 1,600 note-finding questions: exactly 17 spellings, 0 prompt/feedback mismatches;
- every dim7 bb7 and aug #5 correct.

T093a migrate.ts changes no theory content.

**Process note:** the reviewer briefly wrote a probe file at `apps/web/src/domain/zz_probe_tmp.test.ts`, breaking its read-only rule. It deleted the file in the next command; no test run picked it up and nothing is left behind.

## Findings
| # | Severity | Finding |
|---|---|---|
| 1 | MINOR (latent) | Walking-bass steps that accept several pitch classes name every position after `accepts[0]` in feedback. Walking bass is hidden, so this isn't reachable today. |
| 2 | MINOR, ambiguous | An add9 arpeggio asks the 9 (+14) before the octave (+12); FR-057 doesn't define the order. |
| 3 | MINOR | The note-finding prompt octave used `floor(m/12)-1` instead of `letterOctave`. |
| 4 | MINOR (note) | The rfo prompt shows (Ab) or (G#) depending on the drawn quality, under one stable group label. Consistent within each question. |

**Applied:** #3: generate.ts uses `letterOctave` (refactor, no behaviour change; 610 domain tests still pass).
**Deferred:**
- #1 is added to T098's task text and must be fixed before walking bass is unhidden.
- #2 is an owner question on FR-057.
- #4 is informational.

**Owner sign-off:** ____________________
