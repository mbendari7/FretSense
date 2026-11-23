# theory-checker: T046 lessons, round 1

**Verdict (copied exactly):** CHANGES REQUESTED. There are 2 MAJOR findings and 11 MINOR. There are no BLOCKERs.

## Findings
| # | Sev | Finding |
|---|---|---|
| 1 | MAJOR | sharps-and-flats: "a prompt may use either name" is false; lesson `notes` are respelled by defaultSpelling, and the all-twelve list was silently respelled. |
| 2 | MAJOR | sharps-and-flats: "A scale uses each letter once" is false in general (pentatonic, blues). |
| 3–13 | MINOR | Western-music overclaim; Eb-tuning gap; neighbouring frets "of the same string"; "low E" fret 5; subjective claims (most players, most important, best tool, darker, dreamier, bassist's first job); octave shape "everywhere"; "almost every chord"; "every chord shape"; the "next section" reference; the key definition. |

**Applied:** all 13, using the reviewer's exact wording. For #1, option B (text) was applied: the all-twelve drill list now matches what is prompted (C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B). The code defect (lesson `notes` ignored because of noteSet 'naturals', FR-027) has a red test pending with test-writer. `lessons:validate` passes: OK: 10 lessons, 1 packs.
**Deferred:** none.

**Owner sign-off (lessons need owner approval before release):** ____________________
