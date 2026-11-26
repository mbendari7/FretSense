# Contract: Personalisation domain API (`apps/web/src/domain/personal/`)

Pure functions (no I/O, no clock, no randomness); the application layer persists their results.

| Function | Signature | Rules |
|----------|-----------|-------|
| `keyBetween` | `(a?: OrderKey, b?: OrderKey) → OrderKey \| 'rebalance'` | `a < k < b` by code-unit `<`; throws on `a ≥ b`; returns `'rebalance'` instead of a key > 24 chars (research R3) |
| `orderedItems` | `(items: PathItemRecord[]) → PathItemRecord[]` | live items sorted by `(orderKey, id)` |
| `moveItem` | `(items, id, toIndex) → { id, orderKey }[]` | usually one write; uses the nearest distinct-key neighbours; rekeys a tied run or the path (rebalance) when needed |
| `rebalance` | `(items) → { id, orderKey }[]` | evenly spaced keys, order preserved |
| `syncMerge` | `(a, b) → record` | max-by-rank `(deletedBy === 'user', updated, writerId)`, whole record; commutative, associative, idempotent (property-tested); used for `paths`, `pathItems`, `gear`, `packs` |
| `restoreApply` | `(local \| undefined, incoming, stamp) → record` | one-way: live incoming over a local `profile` tombstone → incoming re-stamped; else `syncMerge`; tested for idempotence and un-delete only |
| `generatePath` | `(answers, content, activePack, families) → GeneratedItem[]` | FR-011, research R4; deterministic |
| `defaultPath` | `(activePack, family, content) → GeneratedItem[]` | FR-011a |
| `nextStep` | `(items, completion, attempts) → PathItemRecord \| undefined` | first incomplete live item (data-model §2) |
| `pathProgress` | `(items, completion, attempts) → { done, total }` | FR-013 |
| `pathPacing` | `(items, content, hoursPerWeek) → number \| undefined` | weeks, or undefined when any lesson lacks `estimatedMinutes` (FR-010) |
| `validatePackFile` | `(text: string, size: number) → Result<Pack>` | contracts/pack-file.md |

Application services (`apps/web/src/application/`, over the shared `session.ts` core, research R13; `FretSenseApp` stays the UI facade): `ProfileService` (create, rename, switch,
delete, erase, export, import), `PathService` (create default/generated/manual, rename, add,
remove, move, delete, set active), `PackService` (create, edit, duplicate, delete, export, import,
set active), `OnboardingService` (save answer per field, read). Each user action is one repository
commit (FR-020).

UI routes added (001 contracts/ui-routes.md style; nothing gated):
`/profiles`, `/paths`, `/paths/:pathId`, `/packs`, `/packs/:packId`. Onboarding screens are 018's.
