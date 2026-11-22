# 0006. Constitution v2.2.0: Personalised for Every User, No Locked Content, Curriculum Packs

- Status: Proposed (pending owner approval)
- Date: 2026-11-21
- Deciders: owner
- Related: `.specify/memory/constitution.md` (preamble, VI, VIII, IX, XI, XIII), ADR-0001 (book-part
  mapping superseded here), ADR-0003, specs 001, 006, 007, 008, 013, 015, 016

## Context
Up to v2.1.0, FretSense was shaped around the owner: their book (*Guitar Theory for Dummies*) as the
curriculum backbone, their gear (Squier → Scarlett, Katana:GO) as the reference setup, and a
mastery-gated curriculum (006 "unlocking"). The owner has redirected the product: it must serve any
guitarist or bassist, with any gear, following any course, at their own pace.

## Decision
MINOR bump to **2.2.0**:
- Preamble: the built-in curriculum is general theory, delivered as a **curriculum pack**. Users can
  create packs that map lessons to any book or course. The owner's book is one example pack.
- VI: several local profiles per device, each with its own gear, settings, paths and progress.
- VIII: instruments are user-defined in **My Gear**. Built-in profiles become presets.
- IX: active-learning corrections stay local unless the user shares them.
- XI: vision is a user-enabled assistant; every lesson keeps a camera-free path. Compute-heavy
  features have automatic, user-overridable quality tiers (minimum: integrated-graphics laptop).
- New **XIII Personalised, Never Locked**: any gear; no locked content (recommend, never force);
  paths, stage choice and packs are user data; every adaptive behaviour is user-adjustable; all
  user data is profile-scoped and sync-ready (stable ids, timestamps, schema versions, tombstones).

Roadmap consequence: a new feature **016 Personalisation** (local profiles, My Gear, onboarding,
learning paths, curriculum packs, quality-tier benchmark) is built right after 001 and before 015.
001 lays the profile-scoped, sync-ready data model and the built-in pack format. 006 adds adaptive
recommendations on top of 016's paths.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Keep the owner-centred design | Less scope; matches the original brief | Useless to anyone else; hardcodes gear, contradicting VIII's spirit | Owner direction change |
| Account-based cloud profiles | Cross-device from day one | Requires a backend and auth, breaks "no account" (VI) and on-device privacy (IX) | Local-first with opt-in sync later (013) |
| Mastery-gated unlocking (previous 006) | Clear progression, classic ITS design | Frustrates experienced players, blocks free exploration | Recommend, never force |
| Book-bound curriculum | Simple mapping, clear source | Excludes other learners; copyright risk if book text leaks into content | Packs map lessons to any source without copying it |
| Multiple profiles via separate browser profiles | Zero app work | Not discoverable; gear and settings duplicated; no switching | Poor UX |

## Consequences
- 001 grows: profile-scoped records, My Gear instruments (string counts widened), lesson-stage
  preferences, free navigation, the curriculum-pack format, and an adaptive-weighting toggle.
- 006 loses locks. Mastery (default 85% over the last 20 attempts, user-adjustable) only drives
  recommendations and progress display.
- 015 device profiles become user-editable gear entries. Shipped profiles (Scarlett Solo 4th Gen,
  Scarlett 2i2 4th Gen, Katana:GO, generic) are presets.
- 008 adds a guided camera-setup wizard, optional markers, any reasonable angle, left-handed support
  and user-adjustable sensitivity.
- 013 is out of scope this term, but every data model must be sync-ready now.
- The roadmap, SKILLS-MATRIX (user modelling, configurable architecture, schema design), README and
  CLAUDE.md are updated.

## AI involvement
_To be written by the owner._
