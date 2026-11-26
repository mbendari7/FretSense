# code-reviewer r1: T098a (Mode B3 fixes), 2026-11-25

**Verdict:** CHANGES REQUESTED (1 MAJOR, 4 MINOR)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | MAJOR | Chord-tone lock link passed router state nobody reads | Applied: `?key=` query, validated against the 15 major keys in DrillsScreen; test |
| 2 | MINOR | Chord-tone-lock wrong-tap text no longer lists positions | Deferred: matches the CR-B3-6 example; the board still reveals positions as markers (DrillRunner unchanged). Raised to the owner |
| 3 | MINOR | Arrow keys changed the fill target | Applied: separate `focusIdx`; test |
| 4 | MINOR | Dialog had no focus trap / focus return | Applied: Tab cycles inside, focus returns to End drill; test |
| 5 | MINOR | Check line enabled during the save | Applied: `saving` state disables it |

**Owner sign-off:** ______
