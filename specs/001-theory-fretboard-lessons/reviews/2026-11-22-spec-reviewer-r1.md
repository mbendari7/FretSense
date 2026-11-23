# spec-reviewer r1: FN-2..FN-11 provisional spec changes (2026-11-22)

**Verdict (copied):** **BLOCK**. Finding 1 is the BLOCKER; findings 2, 3, 4, 7, 8, 9, 13, 14 and 18 are MAJOR.

| # | Sev | Finding (short) | Status |
|---|-----|-----------------|--------|
| 1 | BLOCKER | Copy-import idempotence needs deterministic ids; FR-066 says random UUIDs | **Resolved by removal**: FN-10c taken out of FR-043. It was an owner-held item (privacy trade-off) → NEEDS MAHMOUD in Clarifications |
| 2 | MAJOR | FN-10c was held for the owner; "Continue this file's profile" undefined | **Applied**: mode list is "Restore or Copy"; held status recorded |
| 3 | MAJOR | Copy-import tombstone cases undefined | **Applied** (3b rule in FR-043 copy bullet); 3a moot with FN-10c removed |
| 4 | MAJOR | Completing a stage after reset | **Applied** (FR-066a completion bullet) |
| 5 | MINOR | data-model/contract drift for FN-10b | **Deferred to plan gate**: plan artefacts are outside loop A |
| 6 | MINOR | SC-009 oracle | **Applied** |
| 7 | MAJOR | FR-049 focus move interrupts FR-032 announcement | **Applied**: focus waits for the announcement; visual advance follows the setting (reviewer's question answered with this default, provisional) |
| 8 | MAJOR | Focus start vs "first fret of its range" | **Applied** (FR-049 + FR-047) |
| 9 | MAJOR | Jump-control segmentation undefined | **Applied** (FR-047) |
| 10 | MINOR | Nut-label spelling | **Applied** (FR-032a) |
| 11 | MINOR | "Prompt's spelling" for other drills | **Applied** (FR-032) |
| 12 | MINOR | Position-name grammar | **Applied** (FR-049) |
| 13 | MAJOR | "Saved lesson position" isn't a record type | **Applied**: "live lesson-completion record" |
| 14 | MAJOR | Empty state hides other families' lessons | **Applied** |
| 15 | MINOR | Greeting / lesson-first wording | **Applied** |
| 16 | MINOR | FR-034 timing, targets, 0 answers | **Applied** |
| 17 | MINOR | Quality-name table, US4-3, FR-058 messages, US6-3, hidden walking bass vs FR-065 | **Applied**; hide-vs-preview stays NEEDS MAHMOUD |
| 18 | MAJOR | data-model §3.1 drill-type ids and itemKey differ from the spec's frozen encodings | **Deferred to plan gate + next implement group** (data-model.md and code; must land before any persisted data matters). Outside loop A's spec-only scope |

**Owner sign-off:** ______________________
