# security-reviewer: T093 / T093a import parsing and the lesson pipeline, round 2

**Verdict (copied exactly):** CHANGES REQUESTED (0 BLOCKER, 1 MAJOR, 6 MINOR)

r1 status:
- Fixed: #1 MAJOR, #2 MAJOR, #3, #4 and #5.
- Accepted: #6.
- Open: #7 (docs), fixed in this round, see Applied.
- With the owner: #8.

## New findings
| # | Sev | Finding |
|---|---|---|
| N1 | MAJOR | `planRestore` looks for local copies only in the active profile, and the repo `put`s by id. An incoming id that matches a record in another profile (or a completion for a different lessonId) silently overwrites it. Duplicate lessonCompletion ids in a file are not rejected. |
| N2 | MINOR | Copy import shares one idMap across stores; an attempt id equal to an instrument id remaps it. |
| N3 | MINOR | A v0.1 payloadHash given as an object makes `String()` throw. parseExport throws, and loadPreview has no try/catch, so the UI is stuck in pending. |
| N4 | MINOR | qualityId, function, chord quality and responseMs are unbounded (a 5 MB qualityId is accepted). |
| N5 | MINOR | safeName and safeReason use different character classes (U+061C, U+FEFF, C1). |
| N6 | MINOR | Lesson frontmatter arrays have no max; packs and tags.yaml have no byte cap (build-time input, repo-authored). |

**Applied:**
- N1–N5: red tests requested from test-writer.
- r1 #7: data-model §5 import order corrected, and THREAT-MODEL T17 set to 50 MB.

**Deferred:**
- N6 goes to 016 (user-authored packs); today the lessons are repo-authored and capped at 256 kB.
- The theory-checker referral (lesson `notes` regex allows E#, Cb and doubles) is noted for the theory-checker gate.

**Owner sign-off:** ____________________
