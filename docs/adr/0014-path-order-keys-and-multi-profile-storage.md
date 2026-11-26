# ADR-0014: Path order keys and multi-profile storage (016)

- **Status**: Proposed (the owner accepts or rejects it)
- **Date**: 2026-11-25
- **Deciders**: the owner; drafted by the main AI agent under the 2026-11-25 standing approval
- **Related**: specs/016-personalization/research.md R1–R3, R6; ADR-0008

## Context

016 adds several local profiles per device and user-ordered learning paths that must merge
deterministically across devices later (FR-012, 013 sync) and reorder in < 100 ms at 1,000 items
(FR-015).

## Decision

1. **One database, per-profile loading.** Keep IndexedDB `fretsense`, bump to v2 with additive
   stores (`gear`, `onboarding`, `paths`, `pathItems`, `packs`); load only the active profile's
   records into app state; `meta.activeLocalProfileId` selects it.
2. **Fractional order keys** for path items: one record per item with a base-62 `orderKey`;
   moves rewrite one record; order is `(orderKey, id)` by code-unit `<`; keys never exceed 24
   characters (a path rebalance instead); equal keys from concurrent inserts are expected and
   handled by `moveItem`.
3. **Tombstones say why.** `deletedBy: 'user' | 'profile'`. Sync merge is max-by-rank over
   `(deletedBy === 'user', updated, writerId)` (a semilattice: the merge laws hold). Restore is a
   one-way apply that undoes only `profile` tombstones and re-stamps what it un-deletes.
4. **Shared application core** (`application/session.ts`) for state, HLC and the commit queue;
   thin services over it; `FretSenseApp` stays the UI facade.

## Alternatives rejected

- One database per profile: no single transaction for copy import or erase.
- Loading every profile and filtering in the UI: one selector bug leaks data (SC-001).
- Integer positions: O(N) writes per move and colliding concurrent moves.
- An id array on the path record: whole-array LWW drops concurrent inserts.
- A CRDT library (Yjs, Automerge): large dependency for one ordered list (Constitution XII).
- Plain "tombstone always wins": a restored profile would come back with empty paths (contradicts 001 FR-066a).

## Consequences
- Upgrade gated on `oldVersion`, with `blocking`/`blocked`/VersionError handling (never a silent
  in-memory fallback).

- Order keys can grow under repeated inserts at one spot; a rebalance runs past 24 characters.
- Export format v2 (`schemaVersion: 2`); v1 files migrate.
- 013: two devices rebalancing one path concurrently interleave two key spaces; 013 must add a
  rebalance epoch on the path (harmless in v0.1, which has no sync).
