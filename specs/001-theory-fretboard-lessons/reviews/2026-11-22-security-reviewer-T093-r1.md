# security-reviewer: T093 / T093a import parsing, round 1

**Verdict (copied exactly):** CHANGES REQUESTED (2 MAJOR, 6 MINOR, 0 BLOCKER)

## Findings
| # | Severity | Finding |
|---|---|---|
| 1 | MAJOR | Duplicate record ids in a file are never rejected; migration bookkeeping is keyed by id, so a current-format attempt sharing an id with a v0.1 attempt skips its checksum check. Copy import's `idMap` is also overwritten by duplicate instrument ids. |
| 2 | MAJOR | `drillType`, `prompt.drillType` and the itemKey prefix aren't tied together, so an imported 'legacy' record (or a mismatched one) can feed adaptive weighting, contradicting data-model §3.1. Same as code-reviewer r2 #11. |
| 3 | MINOR | Migration runs before the format, schemaVersion and 200k cap checks (linear but unbounded work before the cap). |
| 4 | MINOR | Error text echoes raw ids and zod messages (no XSS; bidi or huge strings are possible). |
| 5 | MINOR | `old in OLD_PROMPT_KEYS` walks the prototype chain; use `Object.hasOwn`. |
| 6 | MINOR | `parseExport` returns placeholder hashes; its safety depends on every caller re-hashing. |
| 7 | MINOR | Docs: data-model step order; THREAT-MODEL T17 says 20 MB. |
| 8 | MINOR | A stored v0.1 record with a bad original hash stays unmigrated, so later exports are rejected (spec decision). |

**Applied:**
- #1 and #2: red tests requested from test-writer (with code-reviewer r2 #11).
- #5: `Object.hasOwn` in migrate.ts (hardening, no behaviour change; the 70 migration tests still pass).
- #3, #4 and #6: in the same fix group.

**Deferred:**
- #7 goes to docs-keeper and a data-model edit.
- #8 goes to product-owner and the owner (same as code-reviewer r2 #10).

**Owner sign-off:** ____________________
