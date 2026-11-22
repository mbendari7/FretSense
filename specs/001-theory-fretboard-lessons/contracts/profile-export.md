# Contract: Profile Export Format v1 (FR-043, FR-066, FR-066a)

The file is untrusted input on import (THREAT-MODEL T3, T13). It is the same format 016 extends.

## File

| Field | Type | Rules |
|-------|------|-------|
| `format` | `"fretsense-profile-export"` | exact |
| `schemaVersion` | integer | 1 in 001; a newer value than the app knows ⇒ reject |
| `exportedAt` | Hlc string | |
| `localProfile` | LocalProfile record | |
| `instruments` | Instrument record[] | ≥ 1 live |
| `attempts` | Attempt record[] | ≤ 200,000 |
| `lessonCompletion` | LessonCompletion record[] | |
| `profileSettings` | ProfileSettings record, optional | present only if the user chose to include settings |

Record shapes, including the common fields, are in [../data-model.md](../data-model.md) §3.

## Limits (enforced before and during parsing)

- File size ≤ 20 MB, checked before reading; JSON nesting depth ≤ 16, checked by a pre-scan
  before `JSON.parse` (data-model.md §4 step 1).
- Array caps: instruments ≤ 50, attempts ≤ 200,000, lessonCompletion ≤ 1,000,
  `answer` ≤ stringCount × (fretCount + 1).
- Every nested object is strict; `prompt` is a discriminated union per `drillType`; `itemKey`,
  `payloadHash` and id formats are frozen in data-model.md §3.1.
- HLC wall times > 24 h ahead of the device clock ⇒ reject.
- Ids: UUID strings (8-4-4-4-12 hex). Hlc: `^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-(\d{4})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
  and the date part must pass `Date.parse` (the suffix is the per-profile writer id, never the
  device id).
- Strings: NFC-normalised; names ≤ 60 characters, other text ≤ 200; control, bidi-override
  (U+202A–202E, U+2066–2069) and zero-width (U+200B–200F) characters rejected.
- Unknown fields anywhere ⇒ reject. Prototype keys (`__proto__`, `constructor`, `prototype`) ⇒
  reject.
- `attempts[].payloadHash` must equal the hash recomputed from the immutable fields.

## Semantics

| Situation | Mode | Behaviour |
|-----------|------|-----------|
| File's `localProfile.id` = the active local profile | restore | preview counts (added, restored, updated, hidden, unchanged) → user confirms → merge by FR-066a (natural keys for settings and completion; per-field settings); reject the whole file on an attempt payload conflict |
| User picks "import into this profile" when the ids differ | copy | preview → confirm → new ids, re-pointed references, target `localProfileId`, re-stamped HLCs; settings and completion merge into the target's by natural key |
| Invalid, oversized or newer schema | — | reject with a readable reason; no change |
| Older schema | — | migrate (pure `vN → vN+1` chain), then as above |

Before export the user sees what's included and that the file is unencrypted (spec FR-043).

Result shown to the user: counts of added, restored, updated and unchanged records.

## Guarantees (tested, SC-009, SC-013)

- Export → reset → restore-import ⇒ 100% of attempts live again, 0 duplicates.
- Merge in `sync` mode is commutative, associative and idempotent over record sets.
- After any import, no record id is owned by two local profiles.
