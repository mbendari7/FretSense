# Architecture Decision Records

Every non-trivial decision is recorded here. "Non-trivial" means it's hard to reverse, it affects
more than one package, it adds a dependency, or it trades off accuracy, latency or usability.

- File name: `NNNN-short-title.md` (for example `0002-pnpm-monorepo.md`), numbered sequentially and never reused.
- Status: `Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`). Accepted ADRs are never
  edited in substance. Write a new ADR that supersedes the old one instead.
- Each ADR links to the spec or plan that prompted it, and specs and plans link back.
- **Rejected alternatives are required.** An ADR without them is incomplete.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-constitution-v2-scope-expansion.md) | Constitution v2.0.0: scope expansion (bass, vision, ML, skills) | Proposed | 2026-11-21 |
| [0002](0002-per-instrument-latency-budgets.md) | Per-instrument latency budgets (onset ≤ 30 ms; pitch 50/80/90 ms) | Proposed | 2026-11-21 |
| [0003](0003-instrument-profile-abstraction.md) | InstrumentProfile as the single source of instrument geometry | Proposed | 2026-11-21 |
| [0004](0004-constitution-v2-1-audio-io-and-git-governance.md) | Constitution v2.1.0: audio I/O ownership, single-performer leakage rule, device indicators, no AI authorship | Proposed | 2026-11-21 |
| [0005](0005-audio-backend-webaudio-vs-native.md) | AudioBackend: WebAudio (default) vs native Tauri + Rust/cpal | Proposed (measurements pending) | 2026-11-21 |

## Template

```markdown
# NNNN. <Title>

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: <owner>
- Related: specs/NNN-feature/plan.md, FR-xxx

## Context
What problem or force makes a decision necessary? Include constraints such as practice-session
value, latency or accuracy targets, and the portfolio goals.

## Decision
What we chose, stated in one or two sentences.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|

## Consequences
What gets easier, what gets harder, and what we must now measure or watch.

## AI involvement
Written by the owner: which agent proposed or analysed what, and what the owner changed or overruled.
```
