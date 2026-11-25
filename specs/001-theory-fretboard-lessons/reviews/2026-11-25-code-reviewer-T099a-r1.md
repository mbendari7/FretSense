# code-reviewer, T099a (FR-036 window width), r1

- **Date**: 2026-11-25. Model tier: sonnet (ADR-0013). Scoped reads: FR-036 and T099a only.
- **Owner OK (task-cycle step 2)**: covered by the standing approval of 2026-11-25
  ([2026-11-25-owner-standing-approval-token-budget.md](2026-11-25-owner-standing-approval-token-budget.md)).
- **Gates**: `scripts/select-gates.mjs` printed code-reviewer only. theory-checker was **added** because tasks.md
  tags T099a with it, and drill generation is theory output. The script missed it; that gap is now fixed
  test-first (`apps/web/src/domain/drills/**` and `apps/web/src/ui/fretboard/**` → theory-checker).

## Verdict (copied exactly)

Verdict: APPROVE

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | DrillsScreen.tsx:154: the literal `4` duplicates `WINDOW` in generate.ts. |
| 2 | MINOR | DrillsScreen.tsx:154: the `\|\| 1` fallback jumps an emptied field to 1 while the user types (UX nit). |
| 3 | MINOR | generate.test.ts: `as Partial<DrillSettings>` casts left over from the red phase. |
| 4 | MINOR | No test for a non-integer width (3.7 → 3) or a one-fret range. |
| 5 | MINOR | DrillsScreen.tsx:110: after a fret-range edit, the input can show a stale width above its own `max`. The generator clamps it, so there is no bug. |

Lint: the missing root `eslint` is pre-existing and unrelated to this diff. The reviewer says it doesn't block T099a but should be fixed before the v0.1 release gate.

## Applied

- Test-first, through the same test-writer resumed with SendMessage (ADR-0013). It added red tests for NaN → 4, 2.7 → 2, a one-fret range, and the input after a range edit, and dropped the casts.
- #1: `CHORD_TONE_WINDOW_DEFAULT` is exported from generate.ts and used by DrillsScreen.
- #3: casts removed. #4: 2.7 → 2 and one-fret-range tests added.
- #5: the input's value and max follow the current fret range.
- Result: the two task files pass 124/124. Full suite 3,358/3,358 (theory 1,263, web 2,095). `tsc` is clean.
- No re-review round: r1 had no BLOCKER or MAJOR, so the gate passed (review rules). The MINOR fixes are covered by tests.

## Deferred

- #2: UX nit, optional. Left as is.

## Owner sign-off

- 2026-11-25, owner in chat (copied word for word): "for waiting on me i approve everything start and makt it all"
