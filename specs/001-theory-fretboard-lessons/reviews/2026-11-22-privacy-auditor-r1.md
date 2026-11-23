# privacy-auditor: round 1 (T093 profile export/import, FR-043 / FR-066a)

**Verdict (copied exactly):** CHANGES REQUESTED. There are 3 MAJOR findings, no BLOCKER and no CRITICAL. Nothing leaves the device. The problems are source-profile identifiers persisting in copied records, and the settings opt-in not holding under a race.

**Confirmed (pass):**
- No network sink exists outside tests.
- Copy writes only into the active profile.
- Copied ids are random, with no deterministic ids (FN-10c is respected).
- "Apply settings" defaults off and resets for each new file.
- The copy warning matches FR-043.
- `nothingNew` is checked before any write.

## Findings
| # | Severity | Finding |
|---|---|---|
| 1 | MAJOR | Copy plus "Apply settings": `activeInstrumentId` keeps the source instrument's uuid. It is never remapped through the copy `idMap`, so it dangles and links back to the source. |
| 2 | MAJOR | Copy carries the source HLCs into the target: completion `stages.*`, settings `fieldUpdated.*` and `updated`. Their writer suffix is the source writer id, so this links back to the source and breaks FR-043's rule that copies are re-stamped with the target writer. |
| 3 | MAJOR | The "Apply settings" toggle re-preview is async. If results resolve out of order, settings can apply while the checkbox is off, and Import stays enabled while a re-preview is pending. |
| 4 | MINOR | No tests cover findings 1–3, copy with settings on, or the checkbox being off for each new file. |
| 5 | MINOR, OWNER-DECISION | Copy import writes the source's tombstoned (reset) attempts with their full payload. This follows the spec, but it persists data with no visible effect, which works against data minimisation. |
| 6 | MINOR, existed before this diff | A crafted restore file can overwrite records of another local profile that share an id (accepted risk T12). |
| 7 | MINOR | THREAT-MODEL T17 still says 20 MB, but the cap is 50 MB. No row says that copy import strips source ids and writer ids. |

**Applied:** findings 1–3 are fixed in `apps/web/src/application/app.ts` and `apps/web/src/ui/screens/ProgressScreen.tsx`. test-writer added the finding 4 tests in `app.test.ts` and `ProgressScreen.test.tsx`. **Process deviation:** the main session wrote the fixes before the tests landed, so the tests were never seen red against live code. test-writer mutation-tested them instead: reverting each fix makes its test fail (6 mutants, 6 killed; one survivor is correct by design). Logged in AI-WORKFLOW.
**Deferred:**
- 5 waits for the owner's decision (OWNER-DECISION); the spec currently says to copy tombstones.
- 6 goes to the spec 016 backlog (accepted risk T12; existed before this diff).
- 7 goes to docs-keeper at converge.

**Owner sign-off:** ____________________
