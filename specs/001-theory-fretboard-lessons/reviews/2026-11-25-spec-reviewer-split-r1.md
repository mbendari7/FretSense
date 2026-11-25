# spec-reviewer, spec 001 split (structure only), r1

- **Date**: 2026-11-25
- **Scope**: structure-only review of the verbatim split of `spec.md` into an index plus parts
  (ADR-0013; owner-approved, one round only). Requirement content was not reviewed.

## Verdict (copied exactly)

Verdict: PASS WITH NOTES

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | MINOR | FR-031a appears in the ID sets but is never defined. It is only mentioned in `spec-clarifications.md` (a held owner item), and the FR → file map leaves it out without saying why. |
| 2 | MINOR | FR-062 (fret spacing, a general fretboard setting) sits in `spec-us6-bass-patterns.md` because it was inside the bass amendment block. The map covers it. |
| 3 | MINOR | `speckit-clarify/SKILL.md` had two overlapping "Split specs (ADR-0013)" notes. |
| 4 | MINOR | `spec.md`: no blank line before "## How this spec is organised". |
| — | not done by reviewer | Verbatim spot-check (item 3). The reviewer has no shell, so it could not run `git show HEAD:…`. |

## Applied

- #1: the index says, above the FR → file map, why FR-031a has no row.
- #3: the two notes are merged into one in `.claude/skills/speckit-clarify/SKILL.md`.
- #4: blank line added in `spec.md`.
- Verbatim check, run by the main agent instead: every one of the 928 non-blank lines of
  `git show HEAD:specs/001-theory-fretboard-lessons/spec.md` appears unchanged in the new files
  (0 missing or altered). The FR/SC ID sets are identical before and after (85 IDs;
  `docs/token-budget/spec-split/ids-before.txt`, `ids-after.txt`).

## Deferred

- #2: applied later, on owner approval 2026-11-25. FR-062 was moved verbatim (3 lines) to
  `spec-us1-fretboard-explorer.md` and the index map was updated. The FR/SC set is unchanged
  (check-fr-ids). No other wording changed.

## Owner sign-off

- 2026-11-25, owner in chat (copied word for word): "for waiting on me i approve everything start and makt it all"
