# Data Model: 016 Personalisation (v0.1 slice)

Extends [001 data-model](../001-theory-fretboard-lessons/data-model.md). Every record carries 001's
common fields (`id`, `localProfileId`, `created`, `updated`, `schemaVersion`, `deleted`; FR-019).
New stores also carry `deletedBy?: 'user' | 'profile'` (set with every tombstone; research R3).
Every string field uses the shared `safeText(max)` schema.
Decisions are in [research.md](research.md).

## 1. Domain values (`apps/web/src/domain`)

| Value | Shape | Rules |
|-------|-------|-------|
| `OrderKey` | `^[0-9A-Za-z]{0,23}[1-9A-Za-z]$` | `keyBetween(a?, b?)`: `a < result < b` by code-unit `<`; never > 24 chars (rebalance instead); equal keys allowed and ordered by id (R3) |
| `Level` | `'beginner' \| 'intermediate' \| 'advanced'` | "one step below" of intermediate is beginner, of advanced is intermediate |
| `Goal` (content) | `{ id: kebab, title ≤ 80, tags: tag[] }` | `content/goals.yaml`; tags exist in `content/tags.yaml`; `tags` ≥ 1 unless `genreMapped: true` (only `songs-i-like`) |
| `PathItemRef` | `{ kind: 'lesson', lessonId } \| { kind: 'drill', lessonId, drillId }` | ids are content ids (001 FR-068) |
| `GeneratedItem` | `{ ref: PathItemRef, reason: string ≤ 200, fallback: boolean }` | output of `generatePath` / `defaultPath` |

## 2. Persisted records (IndexedDB `fretsense` **v2**, additive over v1, R2)

| Store | Key | Indexes | Fields (besides common) | Merge (FR-066a) | FR |
|-------|-----|---------|------------------------|-----------------|----|
| `meta` (changed) | `'device'` | — | adds `activeLocalProfileId?: uuid` | device-local, never exported | FR-001, FR-002 |
| `localProfiles` (001) | `id` | — | `displayName` (1–60) | LWW | FR-001 |
| `profileSettings` (001, schemaVersion 2) | `id` | `localProfileId` (unique) | adds optional `activePathId`, `defaultInterfaceId`, `defaultCameraId`, `defaultOutputId`, each with its own `fieldUpdated` entry. `activeInstrumentId` is the default instrument (FR-009) | per-field LWW (001) | FR-009, FR-013, FR-016 |
| `gear` (new; record schema only in v0.1) | `id` | `localProfileId` | `kind: 'interface' \| 'camera' \| 'output'`, `name` (1–60), `presetOrigin?` (preset id), `namePattern?` (≤ 64, plain substring), `notes?` (≤ 200); interface: `channels: { index ≥ 1, label ≤ 40, hint: 'instrument' \| 'line' \| 'mic', signal: 'dry' \| 'processed' }[] (≤ 32)`, `directMonitoring: boolean`; camera: `placement?` (≤ 200) | R3 `syncMerge` / `restoreApply` | FR-005, FR-006, FR-008 |
| `onboarding` (new) | `id` | `localProfileId` (unique; **natural key**) | `goals: goalId[]`, `instrumentIds: uuid[]`, `level?: Level`, `genres: tag[]`, `practiceHoursPerWeek?: number (0–40, step 0.5)`, `answeredAt: Hlc`, `fieldUpdated` per field | per-field LWW, looked up by `localProfileId` (natural key, like settings) | FR-010 |
| `paths` (new) | `id` | `localProfileId` | `name` (1–60), `origin: 'generated' \| 'default' \| 'manual'` | R3: `syncMerge` / `restoreApply` (a `user` tombstone survives restore); a deleted path hides its items | FR-011, FR-011a, FR-012 |
| `pathItems` (new) | `id` | `pathId`, `localProfileId` | `pathId`, `ref: PathItemRef`, `reason` (≤ 200), `fallback: boolean`, `orderKey: OrderKey` | union by id; R3 `syncMerge` (max-by-rank, `user` tombstone wins over any move) / `restoreApply` | FR-012, FR-015 |
| `packs` (new; user packs) | `id` | `localProfileId`, `[localProfileId, packId]` | 001 `packSchema` fields (`id` reused as record id is **not** done: the record `id` is a UUID and `packId` is the pack's kebab id), `packId`, `title`, `source?`, `sections: { title ≤ 120, label? ≤ 40, lessons: lessonId[] ≤ 200 }[] ≤ 500` | R3 `syncMerge` / `restoreApply`; duplicate `packId` → lowest id keeps it, other renamed `-copy` (R7) | FR-014 |

`profileSettings.activePackId` (001) may name `general-theory` or a user pack's `packId`.
`attempts` is unchanged; `instruments` and `lessonCompletion` gain a `localProfileId` index (v2). Lesson content gains optional `estimatedMinutes` (1–600) for FR-010 pacing.

### Lifecycle and state rules

- **Active profile**: `meta.activeLocalProfileId`; on start, if absent or tombstoned → the most
  recently updated live profile → else create one (001 bootstrap).
- **Delete profile** (FR-003): tombstone the `localProfiles` record and every record of the
  profile (`deletedBy: 'profile'`), in one transaction; switch to another live profile, or create a new default one.
- **Erase permanently** (FR-003, SC-009): hard-delete every record with that `localProfileId`
  in every store, the `localProfiles` record and `meta.writerIds[id]`, and reset
  `meta.activeLocalProfileId` if it named the profile, in one transaction (R8).
- **Default path** (FR-011a): created (origin `default`, name "Start here") when onboarding or its
  goals step is skipped, or when Home opens on a profile with no live path; becomes `activePathId`.
- **Redo onboarding** (US3 scenario 4): a new `generated` path is added; existing paths untouched.
- **Path completion** (US4 scenario 2): a lesson item is complete when every stage the lesson has
  is in `lessonCompletion.stages`; a drill item when an attempt with that `(lessonId, drillId)`
  belongs to a completed session (001 FR-028: the `drill` stage stamp of the lesson). Next step =
  first incomplete live item by `(orderKey, id)`. Completion is shared across paths.
  `pathProgress` = completed live items / live items.
- **Pacing** (FR-010): `pathPacing` = ceil(Σ `estimatedMinutes` of the path's distinct lessons ÷
  (hours per week × 60)) weeks, shown only when hours per week > 0 and every lesson has
  `estimatedMinutes`; otherwise no pacing line.
- **Missing content** (US4 scenario 4, FR-014): items or pack lessons whose ids aren't in the
  compiled content render as "unavailable: <title if known, else id>"; nothing else changes.

## 3. Profile export v2 (FR-004)

See [contracts/profile-export-v2.md](contracts/profile-export-v2.md). Summary: 001 v1 envelope,
`schemaVersion: 2`, new optional arrays `gear`, `onboarding`, `paths`, `pathItems`, `packs`;
`meta` and device ids never exported. Import mode by the file's `localProfile.id`: present on
this device (live or tombstoned) → **restore** (FR-066a merge, with the R3 path-item rule);
absent → **create** with the file's ids (rejected if any id exists under another profile);
user chose "import as a new profile" → **copy** (every id regenerated, the full id map built
first, then `pathItems.pathId`, `profileSettings.activePathId/default*Id/activePackId`,
`onboarding.instrumentIds` re-pointed and HLC writer ids rewritten; research R6).

## 4. Validation rules summary

| Input | Rules | FR |
|-------|-------|----|
| Profile file | 001 rules (size before read ≤ 50 MB, depth ≤ 16, prototype keys, strict Zod, NFC, control/bidi/zero-width rejected, HLC bounds, payloadHash) + v2 caps: gear ≤ 100, paths ≤ 100, pathItems ≤ 50,000, packs ≤ 100, onboarding ≤ 1; ids unique per array; every `localProfileId` = `localProfile.id`; every reference resolves in the file or to a built-in id; `orderKey` regex; newer `schemaVersion` → reject | FR-004, SC-006 |
| Pack file | `{ format: 'fretsense-pack', schemaVersion: 1, pack }`; `File.size` ≤ 1 MB before reading; `packId` ≤ 64; depth ≤ 16; strict `packSchema`; ≤ 500 sections, ≤ 200 lessons each, text ≤ 200; unknown lesson ids kept and listed | FR-014, SC-006 |
| Names | 1–60 chars after trim and NFC; plain text only | FR-004 |
| Goals content | build-time, YAML core schema, no aliases: unique ids, tags exist in `content/tags.yaml`, `tags` ≥ 1 unless `genreMapped` | FR-010 |
| Lesson `estimatedMinutes` | optional integer 1–600 (content pipeline) | FR-010 |
