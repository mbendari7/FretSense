# Research: 016 Personalisation

Decisions for [plan.md](plan.md). Each: **Decision / Rationale / Alternatives rejected**. 016 reuses
001's stack unchanged (ADR-0007 web stack, ADR-0008 persistence and sync-ready records, ADR-0009
content pipeline); nothing here adds a runtime dependency.

## R1. Several local profiles in one database (FR-001, FR-002, SC-001)

- **Decision**: keep the single IndexedDB database `fretsense` and bump it to **v2** (R2). Every
  store already carries `localProfileId` (001 data-model §3). The app loads **only the active
  profile's records** into `AppState` (`Repository.loadProfile(id)` through the existing
  `localProfileId` indexes); `meta` gains `activeLocalProfileId`. A profile switch is: one
  `readonly` transaction over the profile-scoped stores → build a new `AppState` → swap it in one
  `set()`. Every view reads only `AppState`, so a view cannot show another profile's data
  (SC-001 is a test over `AppState`, exports and statistics).
- **Rationale**: 001 already indexes by profile; one database keeps the import transaction atomic
  (FR-020) and keeps erase-permanently a single transaction (FR-003).
- **Alternatives rejected**: one database per profile (cross-profile copy import and erase need
  two databases and two transactions, so no atomicity); loading every profile and filtering in
  the UI (a bug in one selector leaks data, which is SC-001's failure mode).

## R2. Database v2 migration (FR-019, FR-020)

- **Decision**: `onupgradeneeded` from v1 → v2 only **adds** stores and indexes; no v1 record is
  rewritten. New stores: `gear`, `paths`, `pathItems`, `packs`, `onboarding` (`tierSettings` waits for 008)
  (data-model §2). New `profileSettings` fields (`activePathId`, `defaultInterfaceId`,
  `defaultCameraId`, `defaultOutputId`) are optional, each with its own `fieldUpdated` entry, so
  v1 settings records stay valid (schemaVersion of profileSettings → 2; a v1 record reads as v2
  with the fields absent).
- **Upgrade safety** (architecture-reviewer r1 #3): each `upgrade` block is gated on `oldVersion`
  (`< 1` creates v1 stores, `< 2` adds v2 stores and indexes, including the missing
  `localProfileId` indexes on `instruments` and `lessonCompletion`); a `blocking` handler closes the
  DB and shows "FretSense was updated. Reload to continue."; a `blocked` event shows "Close other
  FretSense tabs to finish updating."; a `VersionError` (old cached code, newer DB) shows a reload
  prompt and **never** falls back silently to the in-memory repository. fake-indexeddb tests:
  v1 data → v2 open (records intact, new stores and indexes present); v2 DB opened by v1 code.
  Per-store `schemaVersion`: new stores 1; `profileSettings` 2 with a read-time `migrateSettings`
  (v1 → v2: fields absent) in `domain/migrate.ts`, and `SETTINGS_FIELDS` extended.
- **Rationale**: additive migrations can't lose data and need no data rewrite inside a version-change
  transaction.
- **Alternatives rejected**: rewriting settings records on upgrade (a failed upgrade aborts the
  open and the app can't start).

## R3. Path item order keys (FR-012 merge, FR-015, SC-004, SC-005)

- **Decision**: **fractional order keys**. Each path item is its own record with
  `orderKey: string` over the base-62 alphabet `0-9A-Za-z` (ASCII order = string order).
  `keyBetween(a, b)` returns a key strictly between two keys (`a` may be the start, `b` the end),
  using digit-wise midpoints and extending the key by one digit when no midpoint exists. A move
  rewrites **one** record; an insert writes one record; display order sorts by
  `(orderKey, id)`. Merge (FR-012): items are a union by id; each record merges by `syncMerge` (below); equal `orderKey`s sort by id. Keys compare with plain `<` on code units (never `localeCompare`/`Intl`).
  `keyBetween` never returns a key longer than 24 characters: when it would, the path is
  **rebalanced** instead (evenly spaced keys of length ceil(log62(n + 1)) + 1 for that one path,
  none ending in `0`, each checked against the `OrderKey` regex in tests; one commit; r2 #4). Two devices inserting between the same neighbours produce **equal keys** (expected);
  `moveItem` therefore picks the nearest neighbours with *distinct* keys, and if the target sits
  inside a tied run it rekeys that run (bounded by the run, one commit).
  **Tombstones (owner-visible rule, spec Clarifications plan gate r1):** every tombstone carries
  `deletedBy: 'user' | 'profile'`. Two operations (architecture-reviewer r2 #1):
  - **sync merge** (013, and any merge of two divergent copies): *max-by-rank* over the
    lexicographic rank `(deletedBy === 'user', updated, writerId)`; the winning record is taken
    whole (no field mixing, no "updated = max"). Picking the maximum of a total order is a
    semilattice, so the laws (commutative, associative, idempotent) hold and are property-tested,
    with the generator respecting the invariant that `(id, updated, writerId)` identifies one
    payload (HLCs are per writer).
  - **restore apply** (a one-way import step, not a merge): `restore(local, inc) = inc is live and
    local.deletedBy === 'profile' ? restamp(inc) : sync(local, inc)`. It is tested for idempotence
    and the un-delete rule only; an incoming `profile` tombstone is never applied over a live local
    record (restore only adds or un-deletes; tested); the laws are **not** claimed for it. `restamp` gives every
    un-deleted record a fresh `stamp(profileId)` in the same commit, so a later sync with a device
    still holding the old cascade tombstone keeps it live (r2 #2; tested).
  - **One rule for all four stores** (`paths`, `pathItems`, `gear`, `packs`, r2 #3): a `user`
    tombstone survives restore; a `profile` tombstone is undone. This narrows 001 FR-066a for these
    stores (spec Clarifications, plan gate r2). `onboarding` follows settings (per-field LWW).
- **Rationale**: one write per reorder meets < 100 ms p95 at 1,000 items (FR-015) and gives the
  deterministic merge FR-012 demands without a CRDT library. Fractional indexing is a published,
  widely used technique (e.g. Evan Wallace, "Realtime editing of ordered sequences", Figma
  engineering blog, 2017; David Greenspan, "Implementing Fractional Indexing", 2020, for the
  exact no-trailing-zero midpoint algorithm the tests derive from); the key function is property-tested against a brute-force reference
  (sorted insertion of random keys) and the merge laws (commutative, associative, idempotent)
  are property-tested as in 001 SC-013.
- **Alternatives rejected**: integer positions (a move rewrites up to N records and concurrent
  moves collide); an array of ids on the path record (a whole-array LWW loses one side's
  inserts, failing "union of items"); a sequence CRDT library such as Yjs/Automerge (a large
  dependency for one ordered list; Constitution XII).

## R4. Path generation (FR-011, SC-003)

- **Decision**: a pure domain function `generatePath(answers, content, activePack, instruments)`:
  1. eligible lessons = lessons whose `instruments` include a family of the user's instruments
     (or `any`), whose `level` is the chosen level or one step below, and that carry ≥ 1 tag in
     `tagsFor(goals ∪ genres)`; each lesson's drills follow the lesson as separate items;
  2. order: eligible lessons in the active pack, in pack section order then lesson order; then the
     remaining eligible lessons by number of matching tags (descending), then lesson id;
  3. each item's reason names the first matching goal or genre ("matches your goal: soloing over
     blues"); a fallback item says "a starting point for <instrument family> at <level>";
  4. fallback (Edge Cases): if no lesson is eligible, the General Theory pack's lessons for the
     instrument families and level, each labelled as fallback, with a notice.
  No randomness, no clock: same inputs → same output (SC-003). Level unknown (skipped) → all
  levels; goals and genres skipped → every lesson for the family, labelled fallback.
- **Rationale**: FR-011 states the ordering exactly; a pure function is unit- and
  property-testable and trivially fast (300 lessons × a few tags ≪ 500 ms).
- **Alternatives rejected**: scoring with weights (not specified, harder to explain in a reason).

## R5. Goals as content (FR-010, Assumptions)

- **Decision**: goals are owner-curated content in `content/goals.yaml`
  (`{ id, title ≤ 80, tags: tag[], genreMapped?: true }[]`; `tags` ≥ 1 unless `genreMapped`),
  parsed with the YAML core schema (no custom tags; aliases rejected), validated at build time by the content pipeline
  (ADR-0009) against `content/tags.yaml`, compiled into the precached bundle. Genres come from the
  `genre:` namespace of `content/tags.yaml`. The v0.1 goal list is proposed by product-owner and
  **approved by the owner before release** (like lessons).
- **Rationale**: Assumptions say the goal list and mapping are content, not code.
- **Alternatives rejected**: goals hardcoded in TypeScript (content in code; no build validation).

## R6. Profile export v2 (FR-004, SC-005, SC-006)

- **Decision**: 001's format with `schemaVersion: 2` and new optional arrays `gear`, `paths`,
  `pathItems`, `packs`, `onboarding` (contracts/profile-export-v2.md). Caps: gear ≤ 100, paths ≤
  100, pathItems ≤ 50,000, packs ≤ 100, onboarding ≤ 1; texts as 001 (names ≤ 60, other ≤ 200,
  NFC, control/bidi/zero-width rejected). The future `tierSettings` (v0.4) are never exported:
  they are keyed by the device id, which never leaves the device. v1 files import through the migration chain (missing arrays = empty).
  Restore (file profile id exists on this device, live or tombstoned) merges by FR-066a; unknown
  profile id → created with the file's ids; "import as a new profile" → copy with new ids, and
  path items, path defaults and pack ids re-pointed through the id map.
- **Import validation additions** (security-reviewer r1 #1–#3, #6; architecture r1 #11):
  - one shared `safeText(max)` Zod helper for **every** string field (NFC, control/bidi/zero-width
    rejected); `orderKey` matches `^[0-9A-Za-z]{0,23}[1-9A-Za-z]$` at parse time **and** in merge;
  - ids unique within each array; every record's `localProfileId` equals `localProfile.id`; every
    reference resolves inside the file or to a built-in id (`pathItems.pathId`,
    `profileSettings.activePathId`, `default*Id`, `activePackId`, `onboarding.instrumentIds`);
    otherwise reject;
  - **create** mode: any file id already present on this device under another `localProfileId`
    → reject with "This file's records clash with another profile; import it as a new profile";
  - **copy** mode: every id is regenerated locally (`crypto.randomUUID`), the full id map is built
    before any rewrite, all references re-pointed, and the HLC writer ids rewritten to the new
    profile's writer id (privacy-auditor r1 #4); a test asserts no id or writer id from the file
    survives;
  - restore: any file record id that exists on this device under a different `localProfileId`
    is rejected, including a path item whose `pathId` names another profile's path (IDOR guard;
    security-reviewer r2 #1).
- **Export builder** is an allow-list of stores (privacy-auditor r1 #5): a new store is never
  exported by default.
- **Rationale**: one format, one validator, one migration chain (001 R-export).
- **Alternatives rejected**: a second "full profile" format (two validators to secure).

## R7. User packs (FR-014)

- **Decision**: a user pack record stores 001's `packSchema` fields (`packId` ≤ 64 chars kebab);
  the owner is the record's `localProfileId` (no separate `author` field, privacy-auditor r1 #3).
  Two live records with the same `[localProfileId, packId]` (two devices) resolve deterministically:
  the lowest record id keeps the `packId`, the other is renamed `<packId>-copy`; the suffix loop is
  capped at 99 and keeps the id within 64 chars (security-reviewer r1 #5). Pack files are JSON `{ format: "fretsense-pack", schemaVersion: 1, pack }`,
  validated by the same strict Zod `packSchema` (shared with the build) plus the FR-014 limits
  (file ≤ 1 MB checked before reading, ≤ 500 sections, ≤ 200 lessons per section, text ≤ 200).
  An id equal to `general-theory` or an existing pack → copy with a new id. Unknown lesson ids are
  kept and listed as missing. All text renders as plain text (React text nodes; no markdown).
  Parse order: `File.size ≤ 1 MB` checked before `file.text()`; then the shared `depthWithin` and
  `hasPrototypeKeys` pre-scan; then `JSON.parse`; then strict Zod. Pack and path screens never use
  `dangerouslySetInnerHTML` and never build an `href` from pack text (a grep test enforces it).
- **Alternatives rejected**: YAML pack files at runtime (a YAML parser in the client bundle and a
  larger parsing attack surface; the build already owns YAML).

## R8. Erase permanently (FR-003, SC-009)

- **Decision**: one `readwrite` transaction over every profile-scoped store deletes each record
  whose `localProfileId` is the profile (by index), plus the `localProfiles` record and the
  profile's `meta.writerIds` entry; `meta.activeLocalProfileId` is reset if it named the profile
  (privacy-auditor r1 #1). The repository port gains `purgeProfile(id, meta)` (a hard delete;
  `write` only puts). Per-profile state outside IndexedDB is not allowed (no localStorage or Cache
  Storage keyed by profile). SC-009 is an automated scan of every store **and `meta`** after erase
  for the profile id, its writer id and its display name. If no
  live profile remains, a new default profile is created immediately after the purge (a separate transaction); a crash between the two is healed by the startup fallback (data-model lifecycle, Active profile). *(Revised 2026-11-27, provisional: `purgeProfile` writes no records.)*
- **Alternatives rejected**: tombstone-then-compact (leaves tombstones, failing SC-009).

## R9. Quality tier setting (FR-017, US6): **v0.4, not built now**

- **Decision**: nothing is built for the tier in v0.1 (product-owner loop C r1: a setting with no
  consumer misleads users and breaks Constitution XII). With 008 (v0.4): a `tierSettings` store
  keyed by natural key `(localProfileId, deviceId)`, never exported (the device id never leaves
  the device), and one read interface returning the effective tier and its source.

## R10. Gear (FR-005–FR-009)

- **Decision**: instruments stay in 001's `instruments` store. Interfaces/amps, cameras and
  outputs share a `gear` store with `kind` and a strict per-kind schema. Shipped presets live in
  one data file `apps/web/src/domain/gear/presets.ts` (CLAUDE.md rule 8: device models only in
  preset data); hardware facts in it are marked `verified: false` until the owner checks them
  against the manufacturers' data (016 Clarifications; due before 015, v0.2). In v0.1 only the record
  schema and the repository exist (so v0.1 exports are forward-compatible); presets ship in v0.2
  once sourced (FR-007), and the interface, amp and output UI is built with 015 (v0.2), the camera
  UI with 008 (v0.4), per 018 FR-005.

## R11. Performance verification (FR-002, FR-015, SC-004)

- **Decision**: a Vitest + fake-indexeddb benchmark harness at the FR-015 scale (10 profiles,
  50 paths, 1,000 items, 50 packs) measures p95 of switch, reorder and save over ≥ 200 runs and
  reports; the reference-laptop run is perf-auditor's, **blocked on the owner naming the reference
  laptop** (001 O1).

## R12. Default path (FR-011a)

- **Decision**: `defaultPath(activePack, activeFamily, content)` is the same pure module as R4:
  the active pack's lessons in pack order, filtered to the active instrument's family, reason
  "part of <pack name>". Created when onboarding (018) is skipped or the goals step is skipped, and
  when a profile has no path at all on first open of Home (so an existing v0.1 profile gets one).

## R13. Application structure (architecture-reviewer r1 #2, #6, #7, #12)

- **Decision**: extract a shared core `application/session.ts` holding the observable `AppState`,
  `meta`/HLC (`stamp(profileId)` takes the **target** profile's writer id), `common()` and the
  serialising `commit()` queue. `ProfileService`, `PathService`, `PackService` and
  `OnboardingService` are thin classes over that core; `FretSenseApp` stays the facade the UI
  consumes and delegates to them. Import/export stays one orchestrator (the existing
  `previewImport`/`planRestore`) over a per-store merge table. A profile switch drains the commit
  queue before swapping state. `ports.ts` gains the v2 store names, a `purgeProfile` method and
  `findForeignIds(store, ids, profileId)` (keyed gets instead of loading every profile); the
  transaction's store list comes from one constant. `loadProfile` uses the `localProfileId` index
  for every store. Pure additions to `domain/personal`: `pathProgress(items, completion,
  attempts)` (FR-013) and `pathPacing(items, content, hoursPerWeek)` (FR-010, Clarifications plan
  gate r1). FR-016 reuses `FretSenseApp.updateSettings({ stagePreference })` from the lesson
  screen's stage-choice control. A task restores `.dependency-cruiser.cjs` with the layer rules
  (domain imports only domain; `domain/personal` imports only domain).
- **Alternatives rejected**: standalone services with their own HLC/queue (break FR-020 ordering
  and HLC monotonicity); growing `FretSenseApp` further (already the largest file).
