# security-reviewer: T093 / T093a import, round 3

**Verdict (copied exactly):** PASS WITH NOTES (0 BLOCKER, 0 MAJOR, 4 MINOR)

r2 status:
- Fixed: N1 (the only MAJOR) and N2–N5.
- Deferred: N6, to 016.
- Copy import dropping tombstones keeps integrity.

| # | Sev | Finding |
|---|---|---|
| M1 | MINOR | itemKey has no length cap, so the N4 bound can be bypassed. It is not checked against prompt.qualityId. No ReDoS. |
| M2 | MINOR | No test covers a live attempt that references a dropped (tombstoned) instrument (instrumentId → null), or activeInstrumentId pointing at a dropped instrument. |
| M3 | MINOR | restoreIdClash misses orphan records; it is O(profiles × records); it is not re-checked in apply (TOCTOU). Unreachable in v0.1 (single profile). |
| M4 | MINOR | UNSAFE_CHARS misses U+00AD, U+180E, U+2028/9, U+2060–2064 and tag characters; safeReason can split a surrogate pair. |

**Applied:** M1, M2 and M4 are queued as red tests (test-writer) in the next fix batch.
**Deferred:** M3 goes to 013/016 (multi-profile and sync); v0.1 has one profile and no profile-creation UI. pnpm audit shows 2 moderate advisories; they need checking in T007 (CI audit at high).
**Owner sign-off:** ____________________
