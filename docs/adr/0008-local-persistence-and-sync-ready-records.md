# 0008. Local Persistence and Sync-Ready Records

- **Status**: Accepted (owner approval 2026-11-25, recorded in "Owner approvals recorded" below; earlier status: Proposed (pending owner approval))
- Date: 2026-11-21
- Deciders: owner
- Related: specs/001 FR-040–FR-045, FR-051, FR-053, FR-066, FR-066a, SC-009, SC-013; research R4–R6; data-model.md; ADR-0006; Constitution XIII; spec 013, 016

## Context
Constitution XIII requires all user data to be local-profile-scoped and sync-ready, so that the
optional sync (013) adds no migration. 001 must also restore exports after a reset, copy data
between local profiles, and never mix statistics from different tunings.

## Decision
- IndexedDB through `idb`, behind repository ports; atomic transactions per user action; persistent
  storage requested on first run.
- Every record: UUIDv4 `id`, `localProfileId`, HLC `created`/`updated`
  (`<ISO ms>-<counter>-<writerId>`; the writer id is random per local profile per device and is
  never the device id), `schemaVersion`, `deleted` tombstone. HLC send/receive/overflow rules, a
  24 h future bound, and HLC state advanced in the same transaction as the write.
- Natural-key stores (profile settings, lesson completion) merge by natural key; settings merge per
  field on a per-field HLC map (013 uses the same rule, not server receive time).
- Attempt payload hash: SHA-256 over a frozen canonical JSON; hashing behind a port.
- Attempts are immutable (a payload hash); mutable records use last-writer-wins on the HLC.
  Restore-import un-deletes; copy-import re-keys. The merge function is pure and property-tested.
- The instrument geometry id is the canonical string `family:N1-N2-…`; attempts store it, so stats
  follow the tuning, not the instrument record.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Dexie / RxDB | Rich APIs, RxDB has sync | Heavier; RxDB dictates the sync design before 013 | Not needed; premature lock-in |
| localStorage | Simple | ~5 MB, synchronous, no transactions | Too small, not atomic |
| SQLite WASM on OPFS | SQL queries | Large download, uneven iOS support | Overkill for key-value access |
| Wall-clock `updated` | Simple | Clock skew breaks LWW across devices; switching later forces a migration | Violates "no migration" |
| CRDT library (Automerge/Yjs) | Proven merge semantics | Heavy; storage format lock-in; our data is mostly immutable | Disproportionate |
| Per-instrument geometry version counter | Simple | Retuning back doesn't reunite stats | The content-derived id is better |

## Consequences
- 013 can sync records as they are; 016 adds record types without touching 001's.
- Export files contain tombstones, so they can be larger; the 20 MB limit covers the 006 scale.

## AI involvement
_To be written by the owner._

## Owner approvals recorded

- Accepted 2026-11-25, owner in chat (copied word for word): "approve anything else left and actually build and create the program". Ledger: `specs/001-theory-fretboard-lessons/reviews/2026-11-25-owner-blanket-approval-build.md`.
