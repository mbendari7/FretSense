# 0004. Constitution v2.1.0: Audio I/O Ownership, Single-Performer Leakage Rule, Device Indicators, No AI Authorship

- Status: Proposed (pending owner approval)
- Date: 2026-11-21
- Deciders: owner
- Related: `.specify/memory/constitution.md`, ADR-0001, specs 007, 008, 015

## Context
Four changes became necessary after v2.0.0:
1. Feature 015 adds a cross-correlation estimator for round-trip latency and audio–video offset.
   The owner wants it on the human-owned list.
2. The 007 spec review found that Principle X's "no performer spans train and test" can't be
   satisfied for owner data, because the owner is the only performer.
3. Feature 015 handles live microphone streams continuously. The owner wants the mic active only
   when needed, with a clear "listening" indicator.
4. The owner set a git rule: agents never commit, and AI is never credited as an author.

## Decision
MINOR bump to **2.1.0**:
- IV adds the cross-correlation estimator.
- X: session, song and augmentation groups never span splits. Performer-disjointness applies where
  more than one performer exists. Single-performer owner data is a separate, session-disjoint test
  set reported on its own. Test-group assignment stays stable across versions.
- IX: mic and camera are active only while needed, with a visible indicator.
- VII: agents never write git history and are never credited as authors. The owner writes the PR
  "AI involvement" section.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Keep X literal (performer-disjoint always) | Strongest generalisation claim | Owner data could never be in test, so the app is never evaluated on the owner's own rig | Contradicts the practice-value goal |
| Drop performer-disjointness entirely | Simple | Overstates generalisation with public multi-performer data | Weakens ML rigor |
| Put the git rule only in CLAUDE.md | Less governance churn | Agents read the constitution as the highest authority; analyze checks it | The rule must bind every agent |
| MAJOR bump | — | No principle was removed or redefined incompatibly | Not warranted |

## Consequences
- 007 FR-011, FR-018, FR-026 and 008 FR-016 follow the refined X wording.
- `privacy-auditor` checks stream lifetimes and indicators. `perf-auditor` owns latency benchmarks.
- CLAUDE.md "Git rules" mirrors VII.

## AI involvement
_To be written by the owner._
