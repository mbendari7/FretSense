# Token budget: after (ADR-0013, Phase 5)

- **Captured**: 2026-11-25. Session `bf6e45b6` (the session that made the ADR-0013 changes).
- **Measured cycle**: `/task-cycle T099a` (FR-036 window width). Between 18:59:28Z and 19:06:17Z it ran:
  - test-writer red, then implementation and green;
  - code-reviewer and theory-checker r1;
  - test-writer resumed by SendMessage for the MINOR follow-up tests, then the fixes.
- **Method**: `ccusage@20.1.2 session --json` snapshots just before and just after the cycle, with the
  difference taken for this session (`ccusage-before-task-cycle.json`, `ccusage-after-task-cycle.json`). Subagent
  usage is included in the parent session in ccusage's totals. Per-gate numbers come from the
  `subagent_tokens` field Claude Code reports when each subagent finishes. That field is a different metric
  from ccusage's (it is not split into cache read and write), so the two are never added together.

## What was active during the measurement

| ADR-0013 change | Active in this cycle? |
|---|---|
| Model tiering (sonnet for test-writer, code-reviewer, theory-checker) | **Yes**: ccusage shows sonnet usage for the cycle and haiku usage earlier (docs-keeper) |
| Scoped reads in agent prompts and task briefs | **Yes** |
| `select-gates.mjs` | **Yes**: it printed code-reviewer; theory-checker was added by hand (see "misfires") |
| Re-review resume with SendMessage | **Yes**: test-writer was resumed (no gate needed an r2) |
| Trimmed CLAUDE.md and path-scoped rules | **Partly**: this session started with the old 18.5 KB CLAUDE.md in context; the subagents loaded the new one |
| RTK hook | **No**: Claude Code must be restarted before the hook and `rtk` on PATH take effect |
| Serena, Context7 | **No**: project MCP servers are pending owner approval in `/mcp` |

## Tokens per task cycle (measured)

| | Tokens | Cost (USD) |
|---|---:|---:|
| Whole T099a cycle (main + subagents) | 5,763,664 | $2.0025 |

### Per model (same cycle)

| Model | Input | Output | Cache write | Cache read | Total | Cost | Share of cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| claude-opus-5-5 (main session) | 50 | 14,401 | 36,647 | 5,260,785 | 5,311,883 | $1.6336 | 81.6% |
| claude-sonnet-5-5 (test-writer, code-reviewer, theory-checker) | 32 | 11,101 | 89,103 | 351,545 | 451,781 | $0.3690 | 18.4% |
| claude-haiku-5-5 | 0 | 0 | 0 | 0 | 0 | $0 | 0% |

### Per gate (Claude Code `subagent_tokens`, as reported at completion)

| Agent (tier) | Run | subagent_tokens | Tool uses |
|---|---|---:|---:|
| test-writer (sonnet) | red tests | 40,392 | 11 |
| test-writer (sonnet) | resumed: MINOR follow-up tests | 43,491 | 1 |
| code-reviewer (sonnet) | r1, scoped | 24,416 | 2 |
| theory-checker (sonnet) | r1, scoped | 23,689 | 3 |

Other subagents earlier in this session, outside the cycle, for reference: spec-reviewer (opus, split
structure review) 43,226; docs-keeper (haiku, README) 27,091; claude-code-guide (docs lookup) 78,300.

## Comparison with the baseline

| Measure | Baseline (`baseline.md`) | After | Note |
|---|---|---|---|
| Opus share of cost | 99.1% (7 days) | 81.6% (T099a cycle) | Different windows. The cycle shows gates moved off Opus. |
| Tokens per task cycle | **not measured** | 5.76 M / $2.00 | The baseline sessions ran many tasks per session, and ccusage can't split them per task. |
| Tokens per gate | **not measured** | 23.7 k – 24.4 k per sonnet gate (r1) | No per-gate numbers were captured before ADR-0013. |
| CLAUDE.md size | 2,583 words / 18,514 bytes | 981 words / 6,826 bytes | Measured with `wc`. Token counts from `/context` are **not measured** (owner action). |
| Spec 001 loaded by a scoped reviewer | whole `spec.md`, 106,220 bytes | index 16.5 KB plus one part (2.2 KB – 30.9 KB) | File sizes measured. Tokens actually read per reviewer are **not measured**. |

## What the numbers say

- **Main-session context is now the dominant cost.** 91% of the cycle's tokens (5.26 M) were Opus cache
  reads: the main session re-reads its own very long context (all of Phases 0–4) on every turn. The gates
  themselves cost about $0.37 together on sonnet.
- **Implication (recommendation, not measured):** run each `/task-cycle` in a fresh session (or after
  `/clear`), so the main context starts small. That is where the next large saving is. Re-measure then with RTK
  and the MCP servers active.

## Not measured (and why)

- `/context` breakdown before and after (system, CLAUDE.md, MCP, skills, agents): interactive command, owner action.
- RTK savings (`rtk gain`): the hook isn't active until restart. `rtk gain` currently reports "No tracking data yet".
- Serena and Context7 effect: servers are pending approval.
- A like-for-like baseline task cycle before ADR-0013: none was captured separately.
