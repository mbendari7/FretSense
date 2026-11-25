# Token budget: baseline (before ADR-0013)

- **Captured**: 2026-11-25, before any ADR-0013 change.
- **Window**: 2026-11-18 → 2026-11-25 (last 7 days; ccusage reports only days with activity).
- **Source**: local Claude Code logs, read by ccusage. Every number below is copied from its output;
  nothing is estimated.
- **Commands** (Git Bash, telemetry off for the second and later runs):

  ```bash
  npx -y ccusage@latest daily --since 20261118 --breakdown
  CCUSAGE_TELEMETRY_DISABLED=1 npx -y ccusage@latest session --since 20261118 --order desc
  CCUSAGE_TELEMETRY_DISABLED=1 npx -y ccusage@latest session --since 20261118 --json
  ```

  Note: ccusage sends an anonymous daily usage ping unless `CCUSAGE_TELEMETRY_DISABLED=1` is set or
  `ccusage telemetry disable` is run (its own notice says no log content is sent). Later runs should set the variable.

## 7-day totals

| Input | Output | Cache create | Cache read | Total tokens | Cost (USD) |
|------:|-------:|-------------:|-----------:|-------------:|-----------:|
| 4,866 | 3,284,690 | 11,588,514 | 290,614,851 | 305,492,921 | $192.43 |

Cache reads are 290.6 M of the 305.5 M total tokens (95.1%). The context that gets re-read on every
turn (CLAUDE.md, the agent and skill listings, and large spec files once they are in context) is what
drives volume.

## By day

| Date | Models | Input | Output | Cache create | Cache read | Total | Cost |
|------|--------|------:|-------:|-------------:|-----------:|------:|-----:|
| 2026-11-18 | opus-5-5 | 34 | 8,514 | 281,281 | 1,379,051 | 1,668,880 | $2.70 |
| 2026-11-21 | opus-5-5 | 482 | 620,384 | 1,474,327 | 35,600,799 | 37,695,992 | $30.05 |
| 2026-11-22 | opus-5-5, sonnet-5-5 | 4,342 | 2,652,941 | 9,801,122 | 253,484,758 | 265,943,163 | $159.34 |
| 2026-11-25 | opus-5-5 | 8 | 2,851 | 31,784 | 150,243 | 184,886 | $0.34 |

## Cost by model (7 days)

| Model | Total tokens | Cost | Share of cost |
|-------|-------------:|-----:|--------------:|
| claude-opus-5-5 | 301,860,375 | $190.76 | 99.1% |
| claude-sonnet-5-5 | 3,632,546 | $1.67 | 0.9% |
| claude-haiku-5-5 | 0 | $0.00 | 0% |

Opus totals are the daily Opus rows added together (1,668,880 + 37,695,992 + 262,310,617 + 184,886); the cost is
$192.43 − $1.67. At baseline, 8 of the 13 subagents had no `model:` line and product-owner was
`inherit`, so they ran on the main session's model (Opus).

## Most expensive sessions

| Session | Last activity (UTC) | Models | Output | Cache read | Total tokens | Cost | Likely work (from git log dates) |
|---------|---------------------|--------|-------:|-----------:|-------------:|-----:|------------------|
| f4abc594 | 2026-11-23 03:45 | opus (142.14), sonnet (1.67) | 2,413,621 | 231,550,587 | 242,658,147 | $143.81 | Build v0.1 theory + web app; gate reviews (commits 4695363, 48b0ea0) |
| c01ac9a4 | 2026-11-21 13:33 | opus | 541,923 | 33,066,046 | 34,884,430 | $26.39 | Project foundation, Spec Kit setup |
| d1f2e984 | 2026-11-22 06:22 | opus | 317,781 | 24,468,924 | 26,096,578 | $19.19 | Product releases, spec gates, review feedback |
| 7a9d69ed | 2026-11-18 05:16 | opus | 3,683 | 837,290 | 1,089,043 | $2.23 | — |
| 6147a483 | 2026-11-18 14:32 | opus | 4,831 | 541,761 | 579,837 | $0.47 | — |

The "likely work" column matches session times to commit times. It is an inference, not something
ccusage measured. One session (f4abc594) accounts for 74.7% of the week's cost.

## `/context` breakdown

**Pending.** `/context` is an interactive Claude Code command that only the owner can run. The owner
runs it in a fresh session in this repo and pastes the output, and the categories are recorded here as shown:

| Category | Tokens | Notes |
|----------|-------:|-------|
| System prompt | _pending_ | |
| System tools | _pending_ | |
| MCP tools | _pending_ | |
| Custom agents | _pending_ | |
| Memory files (CLAUDE.md, MEMORY.md) | _pending_ | |
| Skills | _pending_ | |
| Messages | _pending_ | |

For reference only (file size, not tokens): `CLAUDE.md` is 18,772 bytes and
`specs/001-theory-fretboard-lessons/spec.md` is 106,220 bytes.
