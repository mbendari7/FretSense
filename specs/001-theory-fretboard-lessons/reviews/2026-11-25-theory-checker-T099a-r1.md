# theory-checker, T099a (FR-036 window width), r1

- **Date**: 2026-11-25. Model tier: sonnet (ADR-0013). Gate added by the main agent (tasks.md tags it; select-gates missed it).

## Verdict (copied exactly)

Verdict: PASS WITH NOTES

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | generate.ts:235: `windowWidth: NaN` gives NaN width and empty `starts`, so the drill shows a misleading "No chosen chord tone…" message. It should fall back to 4. |
| 2 | MINOR (UNTESTED) | No fixture for NaN, negative or fractional widths. The implementation handles negative and fractional widths correctly. |

Checked: inclusive window maths; FR-061 (every question has a valid answer) for w = 1, 2 on all presets; prompt frets match the accepted positions; the clamp. Ran generate.test.ts: 94/94 passed. No WRONG theory output.

## Applied

- #1: generate.ts uses `Number.isFinite`, so NaN falls back to 4. A red-then-green test runs over all 7 presets.
- #2: tests added for NaN and fractional widths (2.7 → 2). Negative widths were already covered by the width 0 → 1 clamp test.

## Deferred

- none

## Owner sign-off

- 2026-11-25, owner in chat (copied word for word): "for waiting on me i approve everything start and makt it all"
