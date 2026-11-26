# Contract: Profile Export v2 (016 FR-004)

Extends [001 profile-export v1](../../001-theory-fretboard-lessons/contracts/profile-export.md).

```text
{
  "format": "fretsense-profile-export",
  "schemaVersion": 2,
  "exportedAt": Hlc,
  "localProfile": LocalProfileRecord,
  "instruments": InstrumentRecord[],            // ≤ 50
  "attempts": AttemptRecord[],                  // ≤ 200,000
  "lessonCompletion": LessonCompletionRecord[], // ≤ 1,000
  "profileSettings"?: ProfileSettingsRecord,    // v2 fields optional (data-model §2)
  "gear"?: GearRecord[],                        // ≤ 100
  "onboarding"?: OnboardingRecord[],            // ≤ 1
  "paths"?: PathRecord[],                       // ≤ 100
  "pathItems"?: PathItemRecord[],               // ≤ 50,000; every pathId names a path in the file
  "packs"?: PackRecord[]                        // ≤ 100
}
```

- Tombstones included. `meta`, `deviceId` and device-keyed records are never exported; a test
  asserts the exact top-level key set and that no device id appears.
- `schemaVersion` 1 → migrated (missing arrays = empty); > 2 → rejected, no change.
- Import mode, chosen before preview (data-model §3): **restore** (profile id known on this
  device, live or tombstoned), **create** (unknown id; file ids kept), **copy** ("import as a new
  profile"; new ids, references re-pointed).
- Merge per store: `paths`, `pathItems`, `gear`, `packs` by research R3 `restoreApply` (a `user`
  tombstone survives; a `profile` tombstone is undone and the record re-stamped);
  `onboarding` per-field LWW by natural key.
- Validation (research R6): `safeText` on every string; ids unique per array; every
  `localProfileId` equals `localProfile.id`; every reference resolves; `orderKey` regex; create
  mode rejects ids owned by another profile; copy mode regenerates every id and writer id.
- The export builder is an allow-list of stores.
- Preview counts by kind (added, restored, updated, hidden, unchanged), as 001 FR-066a, with the
  new kinds named in plain words: "paths", "path steps", "packs", "gear", "onboarding answers".
- All writes in one transaction; any validation failure → reject with a readable reason.
