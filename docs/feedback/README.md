# User-tester feedback reports

This folder holds the reports written by the [`user-tester`](../../.claude/agents/user-tester.md)
subagent. They are part of the team loop described in [`CLAUDE.md`](../../CLAUDE.md) and
[`docs/AI-WORKFLOW.md`](../AI-WORKFLOW.md) §2. It is empty until the first loop runs.

Reports come from **simulated personas**, not real users. They're a cheap first pass that catches
usability problems early. They don't replace testing with real people.

## When a report is written

| Mode | When | Input |
|------|------|-------|
| **A: spec walkthrough** | After every `/speckit-specify` or spec change | `specs/NNN-*/spec.md` |
| **B: hands-on test** | After each user-facing task group or release | The running app, E2E tests, or the UI code |

## File name

`NNN-<feature>-<YYYY-MM-DD>.md`, for example `001-theory-engine-2026-11-21.md`.
If there are two reports for the same feature on the same day, add the mode:
`001-theory-engine-2026-11-21-B.md`.

## Personas

| Persona | Who | Tests mainly |
|---------|-----|--------------|
| Maya | Beginner guitarist, 16, laptop mic only, no theory vocabulary | First two minutes, jargon, gear-free use |
| Dev | Intermediate bassist, 5-string BEADG, audio interface | Bass parity, anything guitar-only |
| Sam | Self-taught electric player following a theory book | Curriculum packs, jumping between lessons freely |
| Priya | Tech recruiter, no guitar, 60 seconds | First impression, demo mode |
| Alex | Colour-blind, often keyboard-only | Contrast, focus order, screen-reader labels |

Only the affected personas take part, but Priya is in every user-facing report and Alex is in
every report on something visual.

## Report format

```markdown
# Feedback: <feature>, <mode A or B>, <date>

## Summary
- Overall: <1–5 stars> — <one sentence>
- Top 3 problems:
- What worked well:

## Findings
| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|

## Persona quotes
> Maya: "..."
> Priya: "..."

## Metrics (Mode B)
| Task | Persona | Time | Completed? |
```

### Severity

| Level | Meaning | Acceptance criterion required? |
|-------|---------|--------------------------------|
| **BLOCKER** | The persona can't complete the task | Yes |
| **MAJOR** | Completes it, but frustrated | Yes |
| **MINOR** | Polish | Optional |
| **IDEA** | New feature request | Optional |

Every finding names a specific story, screen, button or FR. "The UX could be better" is not a
finding.

## What happens to a report

1. **product-owner** triages every finding into **fix now**, **backlog** (with a suggested spec
   number) or **won't do** (with the reason).
2. In loop A, the "fix now" edits are applied to the spec text. In loop B, each "fix now" item
   becomes a **spec change request**, and no code changes until the owner approves it.
3. The owner gets a short summary listing the decisions, the feedback and what needs approval.

Reports are never edited after triage. A new loop writes a new report.

## Privacy

Reports describe flows and screens only. They never include camera frames, audio, recordings or
personal data.
