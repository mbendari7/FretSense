# 0011. Constitution v2.3.0: `docs/PRODUCT.md` as the Product North Star; Every Spec Names Its Release

- **Status**: Accepted (owner approval 2026-11-25, recorded in "Owner approvals recorded" below; earlier status: Proposed (pending owner approval))
- Date: 2026-11-21
- Deciders: owner
- Related: `.specify/memory/constitution.md`, `docs/PRODUCT.md`, specs 012, 017, 018

## Context
The owner reframed FretSense as an all-in-one learning **product** (Learn, Look up, Practice, Hear
and See, Write) that an employer can understand at a glance, shipped as releases v0.1–v1.0. Until
now the only product-level guidance was the constitution preamble and the README roadmap, which
was a build order of specs. Nothing said which release a spec belongs to, what is out of scope for
the product, or what `product-owner` should weigh scope decisions against. `product-owner` already
reads `docs/PRODUCT.md`, which did not exist.

## Decision
MINOR bump to **2.3.0**:
- The preamble names `docs/PRODUCT.md` as the home of the vision, pillars, release plan and
  non-goals, subordinate to the constitution.
- VI: every feature spec states which release it belongs to (or which slice ships in which
  release), as well as its practice-session value.
- Governance: the constitution supersedes `docs/PRODUCT.md`. PRODUCT.md guides scope, priority and
  release placement. A spec that conflicts with the release plan or non-goals changes, or the plan
  is   amended first, with owner approval.
- IV (added during 017 clarify, 2026-11-22): the fingering cost model joins the human-owned list
  with the Viterbi optimizer, and handbook explanation and glossary text in `content/handbook/` is
  owner-written, like lesson prose.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Keep the roadmap only in the README | No governance change | No rule ties specs to releases; `product-owner` has no stable reference; README is for visitors | Scope creep can't be checked |
| Put the vision and release plan inside the constitution | One document | The release plan changes often; every change would need an ADR and a version bump | Too heavy for a plan that should be easy to adjust |
| Reference PRODUCT.md without the "names its release" rule (PATCH) | Smallest change | Releases stay advisory; analyze and reviewers can't flag an unplaced spec | The point is to make release placement checkable |
| MAJOR bump | — | No principle was removed or redefined | Not warranted |
| Let agents draft handbook text for the owner to edit | Faster to fill hundreds of entries | The handbook is the most visible teaching text, and Principle IV's honesty claim would have a hole | Owner chose to write it; generated facts cover entries without text |

## Consequences
- 012, 017 and 018 state their release slices. Older specs gain a release line when next amended;
  until then, `docs/PRODUCT.md` is the source of their placement.
- `product-owner` and `/speckit-analyze` can flag a spec whose scope falls outside its release or
  hits a non-goal.
- Changing the release plan is a PRODUCT.md edit with owner approval, not a constitution amendment.

## AI involvement
_To be written by the owner._

## Owner approvals recorded

- Accepted 2026-11-25, owner in chat (copied word for word): "approve anything else left and actually build and create the program". Ledger: `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-blanket-approval-build.md`.
