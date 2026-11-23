# Data Model: 001 Theory Engine, Fretboard and Lessons

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md) (R4–R7) | **ADR**: 0003, 0008

Two kinds of data:
1. **Domain values** (pure, immutable, in `packages/theory` and `apps/web/src/domain`): never stored
   as-is, except where embedded in records.
2. **Persisted user records** (IndexedDB, `apps/web/src/infrastructure`): every one carries the
   common fields below (FR-066).

## 1. Domain values (`packages/theory`)

| Type | Fields | Rules (FR) |
|------|--------|-----------|
| `Letter` | `'C' \| 'D' \| 'E' \| 'F' \| 'G' \| 'A' \| 'B'` | — |
| `Accidental` | `-2 \| -1 \| 0 \| 1 \| 2` (bb … ##) | Triple accidentals are an error (FR-010) |
| `Note` | `letter`, `accidental`, `octave: number` | Octave follows the letter: Cb4 = MIDI 59, B#3 = MIDI 60 (FR-001). `midi(note)`, `pitchClass(note)` |
| `PitchClassNote` | `letter`, `accidental` (no octave) | Used for scale and chord spelling |
| `Interval` | `quality: 'P'\|'M'\|'m'\|'A'\|'d'`, `number: 1..15`, `direction: 'up'\|'down'` | Doubly augmented or diminished results are an error (FR-002) |
| `ScaleType` | `id`, `name`, `formula: Interval[]`, `heptatonic: boolean` | 12 types (FR-003); heptatonic ⇒ one letter each (FR-004) |
| `ChordQuality` | `id`, `symbolSuffix`, `formula: Interval[]`, `functions: string[]` | 12 qualities (FR-005, FR-006) |
| `Key` | `tonic: PitchClassNote`, `mode: 'major' \| 'minor'` | 30 keys (FR-007) |
| `DiatonicChord` | `numeral`, `symbol`, `tones: PitchClassNote[]`, `functions` | FR-007, FR-038 |
| `InstrumentFamily` | `'guitar' \| 'bass'` | — |
| `InstrumentProfile` | `family`, `stringCount`, `tuning: Note[]` (low → high), `fretCount`, `scaleLengthMm`, derived `pitchRange`, derived `geometryId` | FR-051–FR-053. Validation: guitar 6–8 strings, bass 4–6; strictly ascending; each open string within the family range (O3); fretCount 12–24 |
| `GeometryId` | branded string `"<family>:<N1>-<N2>-…"` | Deterministic from family + tuning (research R6). Fret count and scale length are excluded |
| `Preset` | `presetId` (e.g. `guitar6-standard`, `bass4-drop-d`, `bass5-beadg`), `InstrumentProfile` | 7 presets (FR-009, FR-052) |
| `FretPosition` | `string: 1..stringCount` (1 = highest pitched), `fret: 0..fretCount` | FR-008 |
| `TheoryError` | discriminated union: `UnknownType`, `TripleAccidental`, `OutOfRange`, `InvalidProfile`, `InvalidInterval` | FR-010 |

## 2. Domain values (`apps/web/src/domain`)

| Type | Fields | Rules |
|------|--------|-------|
| `DrillDefinition` | `id` (unique in lesson), `type` (7 types), `instruments: InstrumentFamily[] \| 'any'`, `params` (per type; progressions need `key`) | FR-027, FR-031, FR-035–FR-036, FR-054, FR-056–FR-059, FR-068 |
| `DrillSettings` | strings, fret range, count (5–100), note set, interval set, direction, qualities, functions, window width, octave mode | FR-030–FR-036; rejected before start if unanswerable (FR-061) |
| `Question` | prompt, `validAnswers: FretPosition[]` (non-empty), item key | FR-061 |
| `ItemKey` | note-finding `(geometryId, string, pitchClass)`; interval `(interval, direction)`; chord tone `(quality, function)`; bass `(drillType, quality)` | FR-041 |
| `DrillSession` (in memory) | definition, settings, seed, questions, answers, state `idle → running ⇄ paused → completed \| abandoned` | Paused on background or leave; resume re-shows the current question; a single-step question's timer restarts, a multi-step question keeps its judged steps and continues at the next pending step with paused time excluded (Edge Cases) |
| `Lesson` (compiled content) | `id`, `title`, `level`, `tags`, `instruments`, `concepts`, `bodyHtml` (sanitised), `preset?`, `drills`, `songs`, `needs`, reserved `play`, `cameraCoach` | FR-022–FR-025, FR-068 |
| `CurriculumPack` (compiled or imported) | `id`, `title`, `source?`, `schemaVersion`, `sections: { title, label?, lessons: lessonId[] }[]` | FR-063 |
| `TagVocabulary` | `{ goal: string[], genre: string[], topic: string[], 'level-hint': string[] }` | FR-068 |
| `Hlc` | `<ISO ms>-<counter 0000–9999>-<writerId>` | Research R5 (send, receive, overflow and bound rules); monotonic per writer. `writerId` is a random UUID per (local profile, device), used only for HLC ordering; it is **not** `meta.deviceId` |

## 3. Persisted records (IndexedDB database `fretsense`, version 1)

### Common fields (`Common.*`, every record, FR-066)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID string | `crypto.randomUUID()` (R5) |
| `localProfileId` | UUID | Owning local profile (the `localProfiles` store uses its own `id`) |
| `created` | Hlc | Set once |
| `updated` | Hlc | Bumped on every change, including tombstoning |
| `schemaVersion` | integer | Record schema version (starts at 1) |
| `deleted` | boolean | Tombstone (default false) |

### Stores

| Store | Key | Indexes | Fields (besides common) | Mutability (FR-066a) | FR |
|-------|-----|---------|------------------------|----------------------|----|
| `meta` | `'device'` | — | `deviceId` (reserved for 016 tier settings), `dbSchemaVersion`, `writerIds: { [localProfileId]: uuid }`, `hlcState` | device-local, never exported | R5 |
| `localProfiles` | `id` | — | `displayName` | mutable (LWW) | FR-066 |
| `profileSettings` | `id` | `localProfileId` (unique; **natural key**) | `fieldUpdated: { [field]: Hlc }` (one per top-level field below), `activeInstrumentId`, `octaveMode: 'any' \| 'exact'`, `adaptiveWeighting: boolean`, `stagePreference: Stage[]` (non-empty, ordered), `activePackId`, `display: { window: [start, end], handedness: 'right' \| 'left', labelMode: 'notes' \| 'degrees' \| 'none', textSize: 1 \| 2 \| 3, fretSpacing: 'uniform' \| 'proportional', theme }`. 016 adds fields to this same record (each with its own `fieldUpdated` entry) | mutable, **per-field LWW** on `fieldUpdated`; record `updated` = max of them | FR-021, FR-064, FR-067 |
| `instruments` | `id` | `localProfileId` | `name`, `profile: InstrumentProfile` (with `geometryId`), `presetOrigin?` | mutable (LWW); family immutable; ≥ 1 live per profile | FR-051, FR-053 |
| `attempts` | `id` | `[localProfileId, timestamp]`, `[localProfileId, itemKey]` | `drillType`, `instrumentId \| null`, `geometryId`, `modality: 'tap'` (later `'fret'`, `'audio'`), `prompt` (a strict discriminated union per `drillType`, §3.1), `answer: FretPosition[]` (≤ stringCount × (fretCount + 1)), `outcome: 'correct' \| 'incorrect'`, `responseMs`, `timestamp` (wall time ISO), `lessonId?`, `drillId?`, `itemKey`, `payloadHash` | **immutable** (only `deleted`/`updated` may change) | FR-033, FR-040, FR-041 |
| `lessonCompletion` | `id` | `[localProfileId, lessonId]` (unique; **natural key**) | `lessonId`, `stages: { read?: Hlc, see?: Hlc, drill?: Hlc }` | mutable; merges as a per-stage union | FR-028, FR-043 |

### 3.1 Frozen encodings (changing any of these is a migration)

- **`itemKey`** grammar (a string, so it can be indexed):
  `nf|<geometryId>|<string>|<pitchClass 0-11>`, `iv|<interval e.g. M3>|<up\|down>`,
  `ct|<qualityId>|<function e.g. b7>`, `rfo|<root pitchClass 0-11>` (root–fifth–octave, FR-041),
  `bs|<drillType>|<qualityId>` (arpeggio, walking-bass, chord-tone-lock). *(T091: aligned to the
  spec's frozen encodings, spec-reviewer r1 #18.)*
- **`prompt`** per `drillType`: `note-finding {pitchClass, string?, midi?}`,
  `interval {root: FretPosition, interval}`, `chord-tone {root, qualityId, function}`,
  `root-fifth-octave {root, qualityId}`, `arpeggio {root, qualityId}`,
  `walking-bass {key, chords}`, `chord-tone-lock {key, chords}`. `drillType` is exactly the spec's
  seven ids (Key Entities). Every object is strict (unknown keys rejected).
- **v0.1 migration (T093a, provisional product-owner decision 2026-11-22).** Attempts stored by the
  v0.1 pre-release (4695363) are migrated once, on load (written back) and on import (before
  validation), by the pure `domain/migrate.ts`. The original `payloadHash` is checked first, then the
  migrated payload is re-hashed, so every path gives the same hash.
  - `bass-arpeggio` → `arpeggio` and `bass-walking` → `walking-bass`: drillType, `prompt.drillType`
    and `bs|<id>|<q>` itemKeys are renamed.
  - v0.1 root–fifth–octave attempts (`bs|bass-root-fifth-octave|<q>`, no root pitch class) and every
    `bass-octave-shapes` attempt become `drillType: 'legacy'`, with prompt `{ drillType: 'legacy',
    legacyDrillType, root, qualityId | null }` and itemKey `lg|<old drillType>|<q>`.
  - Legacy attempts are kept in storage and exports only; they are not shown on Progress. `legacy` is not in the drill-type list:
    it is never offered as a drill and never matches a generated item key, so it never feeds
    weighting or mastery.
  - Any other unknown drill type still rejects the whole file (FR-043).
  - Records keep `schemaVersion: 1`; the migration is idempotent, so no version bump is needed.
- **`payloadHash`** = lowercase hex SHA-256 of the canonical JSON (keys sorted by code point, no
  whitespace, UTF-8, integers only, `null` for absent optional fields) of exactly: `id`,
  `localProfileId`, `drillType`, `instrumentId`, `geometryId`, `modality`, `prompt`, `answer`,
  `outcome`, `responseMs`, `timestamp`, `lessonId`, `drillId`, `itemKey`. It is a consistency
  check, not authenticity: anyone can recompute it. Canonicalisation is a pure domain function;
  hashing sits behind an application `Hasher` port (infrastructure uses SubtleCrypto), so the domain
  stays pure. 013's server reproduces the same function.
- **Ids in content references** (`lessonId`, `drillId`, `presetId`, pack ids): kebab-case,
  `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 characters.

The `[localProfileId, itemKey]` index serves "last 50 attempts per item" (FR-041) in O(log n + 50).
At the 006 scale (≤ 50,000 attempts), the FR-042 7-day and all-time aggregates are computed from the
`[localProfileId, timestamp]` index; derived aggregates may be cached in memory, never persisted as
truth (006 FR-025).

### Lifecycle and state rules

- **First run**: create `meta`, one `localProfiles` record ("Me", renamable), its `profileSettings`
  (defaults: octave `any`, weighting on, stages `[read, see, drill]`, pack `general-theory`,
  uniform spacing, text size 2, right-handed). No instrument: the explorer, drills and key helper
  first show the instrument picker (FR-053).
- **Instrument delete**: rejected if it's the profile's last live instrument; otherwise tombstone, and
  if it was active, `activeInstrumentId` ← the most recently used live instrument (by latest
  attempt, then `updated`).
- **Tuning or string-count edit**: recompute `geometryId`; past attempts keep theirs.
- **Reset (FR-044)**: tombstone all live `attempts` and `lessonCompletion` records of the profile,
  in one transaction.
- **Writes**: one IndexedDB transaction per user action (atomic; 016 FR-020). The HLC state in
  `meta` is read and advanced **inside the same readwrite transaction** as the record write, so two
  tabs can never mint the same HLC (IndexedDB serialises overlapping readwrite transactions).

## 4. Profile export format v1 (FR-043)

```text
{
  "format": "fretsense-profile-export",
  "schemaVersion": 1,
  "exportedAt": Hlc,
  "localProfile": LocalProfileRecord,
  "instruments": InstrumentRecord[],
  "attempts": AttemptRecord[],
  "lessonCompletion": LessonCompletionRecord[],
  "profileSettings"?: ProfileSettingsRecord      // only if the user chose to include settings
}
```

- Tombstoned records are included (they matter for merging).
- `meta` and `deviceId` are never exported. Each HLC embeds the profile's `writerId`, which is
  random per (local profile, device), so exports from two profiles on one device can't be linked by
  it. A test asserts the exact top-level keys and that `deviceId` appears nowhere in the file.
- 016 adds arrays (`gear`, `paths`, `packs`, `onboarding`, `tierSettings`) under the same format and
  bumps `schemaVersion`; v1 files stay importable through the migration chain.
- The full schema is in [contracts/profile-export.md](contracts/profile-export.md).

### Import algorithm (FR-043, FR-066a)

1. Check `File.size` ≤ 50 MB **before** reading the file → read text → a linear pre-scan counts
   bracket depth outside strings and rejects at > 16 → `JSON.parse` → reject prototype keys at any
   depth → check the envelope (format, schemaVersion, attempts is an array of ≤ 200,000) → migrate v0.1 attempts (T093a, carried by array index) → Zod-validate the whole file with strict schemas (unknown fields rejected; caps:
   instruments ≤ 50, attempts ≤ 200,000, lessonCompletion ≤ 1,000; names ≤ 60 and other text ≤ 200,
   NFC-normalised, with control, bidi-override (U+202A–202E, U+2066–2069) and zero-width
   (U+200B–200F) characters rejected) → recompute every `payloadHash` → reject any HLC whose wall
   time is > 24 h ahead of the device clock → reject duplicate ids within a store and lesson-completion duplicates. Lookups use `Map` and
   `Object.hasOwn`; parsed data is never deep-merged or `Object.assign`-ed. On any failure: reject,
   with no change and a readable reason.
2. **Restore** (the file's `localProfile.id` is the active local profile): for each record,
   `merge(local?, incoming, 'restore')`:
   - attempts: identical `payloadHash` ⇒ keep; a live incoming copy un-tombstones a local
     tombstone **with a fresh local `updated`** (so a later sync doesn't re-apply an older
     tombstone); an incoming tombstone applies only if its `updated` is newer; different
     `payloadHash` ⇒ conflict ⇒ reject the whole file;
   - profile settings: matched by natural key; per-field LWW on `fieldUpdated`;
   - instruments: an incoming live record replaces a local tombstone (fresh `updated`); otherwise
     the newest `updated` wins (HLC order, ties by writer id);
   - completion (FN-10b, FR-066a restore precedence (1)–(5); a live incoming record un-deletes a local tombstone, keeping the per-stage union; an incoming tombstone applies only if newer; both tombstoned ⇒ no-op; copy import follows FR-043 instead): matched by natural key `(localProfileId, lessonId)`; per-stage union (earliest
     Hlc kept per stage);
   - the local HLC receives the largest incoming `updated` (research R5 receive rule).
   Before writing, the user sees a preview (added, restored, updated, hidden by incoming tombstones,
   unchanged) and confirms.
3. **Copy** (any other local profile): natural-key records merge into the target's existing ones
   (settings per field, completion as a union); other records get new ids, set `localProfileId` to the target, re-point
   `activeInstrumentId` and `attempt.instrumentId` through the id map, re-stamp `created`/`updated`
   with the target's HLC (attempt `timestamp` kept), and keep `geometryId` and `itemKey` as they are
   (they are content-derived).
4. All writes happen in one transaction.

The merge function is pure and property-tested for convergence (merge order independence in
`sync` mode), idempotence and "no id in two profiles" (SC-013).

## 5. Validation rules summary

| Rule | Source | Where enforced |
|------|--------|----------------|
| Family ranges, string counts, ascending tuning, 12–24 frets | FR-053, O3 | `packages/theory` `validateProfile` |
| Exactly one live `profileSettings` per profile; ≥ 1 live instrument | FR-053, FR-067 | application services + repository tests |
| `stagePreference` non-empty, a subset of the known stages | FR-064 | Zod schema + service |
| Lesson schema, tags in the vocabulary, drill ids unique, `needs` never `[camera]` alone, progressions keyed, preset fret ≤ 24 | FR-022, FR-023, FR-068 | build-time validator (same Zod schemas) |
| Pack references only known lessons; unique ids | FR-023, FR-063 | build-time validator |
| Every question answerable | FR-061 | domain drill generators (property tests) |
