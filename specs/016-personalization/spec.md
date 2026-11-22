# Feature Specification: Personalisation (Local Profiles, My Gear, Onboarding, Learning Paths, Curriculum Packs)

**Feature Branch**: `016-personalization` (to be created by the owner)

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "FretSense is personalised for every user, like a customisable app, not built around my setup. Any user, any gear: users build a 'My Gear' setup (instruments with type, strings, tuning, fret count, name; audio interface or amp; camera; output). Free-flowing lessons, no locked content; the curriculum recommends, never forces. User-defined learning paths: onboarding asks about goals (e.g. 'learn to solo over blues', 'play songs by bands I like', 'understand chord theory'), instrument, level, genres and practice time, then generates a suggested path the user can edit, reorder, add to or remove from; users can save several paths and switch. Custom lesson structure (stages and order, saved as default). Curriculum packs: the built-in track is general theory; users create packs mapping lessons to any book or course. Multiple local profiles per device, each with its own gear, settings, paths and progress; offline-first, no account. Adaptive quality tiers (low/medium/high) chosen from a quick device benchmark, user-changeable; minimum target a laptop with integrated graphics. Design the profile, gear, path and progress data models so they can sync later with no migration pain."

**Practice-session value**: a new user answers five questions and is practising within two
minutes, on their own instrument, following a path built around what *they* want to play. A
returning user opens their profile and continues their current path, or switches to another path
or pack, with no setup.

**Depends on**: 001 (local profile data model FR-066, My Gear instruments FR-053, lesson metadata
FR-022, pack format FR-063, stage preference FR-064). **Enables**: 015 (audio interfaces, amps and
outputs are My Gear entries; device profiles are user-editable), 008 (cameras are My Gear entries;
quality tiers), 006 (adaptive recommendations within paths), 013 (sync of these records).
**Build order**: right after 001, before 015. **Constitution**: XIII (personalised, never locked),
VI (local profiles, offline), IX (no data leaves the device). **Lesson tracks**: all; this feature
decides how users reach lessons.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local Profiles (Priority: P1)

Several people share one laptop. Each creates a local profile with a name. Switching profile
switches gear, settings, paths, packs and progress. There is no account and no network.

**Why this priority**: Every other personal setting hangs off a profile.

**Independent Test**: Create three profiles with different instruments and attempts; switch between
them and verify that every view shows only the active profile's data; delete one and verify the
others are untouched.

**Acceptance Scenarios**:

1. **Given** the 001 default profile exists, **When** the user adds a profile "Sam", **Then** Sam
   starts with no progress and onboarding offered, asks Sam to pick or create one instrument (001
   FR-053) before the explorer or drills open, and the default profile is unchanged.
2. **Given** two profiles, **When** the user switches profile, **Then** within 1 s every screen shows
   the new profile's gear, settings, active path, active pack and progress, and nothing from the
   other profile.
3. **Given** a profile is deleted after confirmation, **Then** its records are tombstoned and hidden,
   other profiles are unaffected, and a restore-import of an export taken before deletion
   un-deletes it (001 FR-066a). **Given** "erase permanently" is chosen instead, **Then** every record
   of that profile, tombstones included, is purged from the device.
4. **Given** a profile export, **When** it is imported on another device, **Then** the profile is
   recreated with the same ids (no collisions with existing profiles).

---

### User Story 2 - My Gear (Priority: P1)

The user records their instruments (001), audio interfaces and amps, cameras and outputs. Devices
start from editable presets (e.g. Scarlett Solo 4th Gen, Scarlett 2i2 4th Gen, Katana:GO, a generic
class-compliant interface) or from scratch. Nothing is assumed about their setup.

**Why this priority**: 015 and 008 configure themselves from this, so it must exist first.

**Independent Test**: With mock gear data, create, edit, duplicate and delete each gear type;
verify validation, persistence per profile and that no preset is applied unless chosen.

**Acceptance Scenarios**:

1. **Given** an empty profile, **When** My Gear opens, **Then** it shows empty sections (Instruments,
   Interfaces & amps, Cameras, Outputs) with "add" actions, and no preset preselected.
2. **Given** the user adds an interface from the "Scarlett 2i2 4th Gen" preset, **When** they edit
   its input channel names, its signal type (dry or processed) and its monitoring capability,
   **Then** the edited entry is saved as their own, and the shipped preset is unchanged.
3. **Given** the user creates a device profile from scratch for an unknown interface, **Then** it
   works exactly like a preset-based one (Constitution XIII; 015 FR-004).
4. **Given** several instruments, **When** the user marks one as their default, **Then** the app opens
   with that instrument, and each lesson or drill can still switch instruments.

---

### User Story 3 - Onboarding (Priority: P1)

A new profile is offered a short onboarding: goals, instrument(s), level, favourite genres and
practice time per week. It can be skipped and redone at any time.

**Why this priority**: It turns a generic curriculum into a personal starting point.

**Independent Test**: Run onboarding with fixture answers and verify the stored answers, the
generated path (US4) and that skipping leaves a usable app.

**Acceptance Scenarios**:

1. **Given** a new profile, **When** onboarding runs, **Then** it asks at most 5 screens of questions,
   each skippable, and finishes in under 2 minutes for a first-time user (SC-002).
2. **Given** goals "learn to solo over blues" and "understand chord theory", instrument "guitar",
   level "beginner", genre "blues", 2 h/week, **Then** a suggested path is generated (US4) with a
   short reason per item ("matches your goal: soloing over blues").
3. **Given** the user skips onboarding, **Then** the library works fully, the explorer and drills
   open after a one-tap instrument pick (001 FR-053), and a "build my path" action remains
   available.
4. **Given** the user redoes onboarding, **Then** a new suggested path is created alongside the
   existing ones; nothing is overwritten.

---

### User Story 4 - Learning Paths (Priority: P1)

A path is an ordered list of lessons and drills. The suggested path can be edited, reordered,
extended or trimmed. Users can keep several paths (e.g. "Blues soloing", "Bass basics") and switch
between them. A path recommends the next step; it never forces it.

**Why this priority**: This is the "what do I do today" surface for every session.

**Independent Test**: Create, edit, reorder and delete path items; save three paths; switch paths;
verify persistence, ordering and that every lesson stays reachable outside the path.

**Acceptance Scenarios**:

1. **Given** a path, **When** the user drags an item to a new position, removes one, or adds any
   lesson or drill from the library, **Then** the path is saved in the new order immediately, and
   the change is keyboard-operable.
2. **Given** a path, **Then** a "next step" is shown: the first item not yet completed (a lesson is
   complete when all its stages are complete; a drill when one full session of it is complete, 001
   FR-028). The user can
   open any other item, or any lesson not in the path, at any time.
3. **Given** three saved paths, **When** the user switches the active path, **Then** "next step" and
   path progress reflect the new path, and completion is shared (completing a lesson counts in
   every path that contains it).
4. **Given** a path references a lesson that was later removed from the content, **Then** the item
   is shown as unavailable with its title, and the rest of the path works.

---

### User Story 5 - Curriculum Packs (Priority: P2)

The built-in General Theory pack (001) is the default. A user creates their own pack that maps
lessons to the book or course they follow (e.g. the owner's *Guitar Theory for Dummies* pack):
sections named after the source's chapters, each with lessons chosen from the library. Packs can
be exported and imported as files.

**Why this priority**: Lets learners follow any book or course with FretSense alongside, without
copying the source.

**Independent Test**: Create a pack with 3 sections, reorder, export, import into another profile,
and verify the library groups lessons by the pack.

**Acceptance Scenarios**:

1. **Given** the pack editor, **When** the user creates "My course" with source "Course X",
   sections "Week 1", "Week 2", and assigns lessons, **Then** the library can show lessons grouped
   by that pack.
2. **Given** a pack file from another user, **When** imported, **Then** it is validated (FR-014);
   lessons it references that don't exist on this device are listed as missing, and the rest
   works.
3. **Given** a pack, **Then** it contains only structure (titles, labels, lesson ids). Free-text
   fields are length-limited, and the editor reminds users not to paste text from their source.

---

### User Story 6 - Quality Tier Setting (Priority: P3)

The app keeps a quality tier (low, medium, high, or "automatic") per local profile and device, which
the user can override in settings. The benchmark that picks the automatic tier is built with its
first consumer (008), because its workloads don't exist before then (Constitution XII).

**Why this priority**: A small foundation so 008, 009 and 011 share one tier setting.

**Independent Test**: With an injected tier provider, verify the setting, the override, persistence
per (local profile, device) and the read interface.

**Acceptance Scenarios**:

1. **Given** no benchmark exists yet, **Then** the setting shows "automatic (not measured)" and the
   user can pick low, medium or high.
2. **Given** a user override, **Then** it persists, is labelled "set by you", and "automatic" restores
   the provider's choice.

---

### Edge Cases

- **Profiles are not a security boundary**: anyone with the device can open any local profile. This
  is stated in the profile screen (no PINs in this feature).
- **Last profile deleted**: a new empty default profile is created; the app never runs without one.
- **Two devices, same profile, later sync (013)**: ids are globally unique and records carry
  timestamps and tombstones (001 FR-066), so a later merge needs no migration.
- **Path item for another instrument family**: shown with a family badge; opening it offers to
  switch instrument (001 US2 scenario 8).
- **Very long paths** (≥ 300 items): reordering stays responsive (SC-004).
- **Onboarding answers with no matching lessons**: the path falls back to General Theory basics for
  the chosen instrument and level, with a notice that explains why.
- **Gear preset updated in a later release**: the user's saved copies are unchanged; the app may
  offer "update from preset".
- **Storage full**: profile, path and pack edits fail with a clear message; nothing partial is
  saved (FR-020).
- **Shared devices**: exports are readable files containing that person's data; the export screen
  says so.

## Requirements *(mandatory)*

### Functional Requirements

**Local profiles**

- **FR-001**: Users MUST be able to create, rename, switch and delete local profiles, with no account
  and no network. Every user record MUST belong to exactly one profile (001 FR-066).
- **FR-002**: Switching local profile MUST change every profile-scoped view within 1 s at p95 at the
  FR-015 scale, and MUST NOT show data from another profile.
- **FR-003**: Deleting a profile MUST tombstone its records after confirmation. "Erase permanently"
  (a separate, double-confirmed action) MUST purge all of the profile's records, tombstones
  included. If the last profile is deleted or erased, a new empty one is created.
- **FR-004**: Users MUST be able to export a whole profile (gear, settings, paths, packs, onboarding
  answers, progress) in the 001 **profile export format** (001 FR-043), extended with 016's record
  types, and import it on any device:
  - if the file's local profile id exists on this device (live or tombstoned), the import is a
    **restore** and merges by 001 FR-066a;
  - otherwise the profile is created with the file's ids;
  - "import as a new profile" creates a copy with new ids.

  Import limits (normative; owner to confirm the numbers): file ≤ 50 MB, JSON nesting depth ≤ 16,
  ids must be UUID strings, display names ≤ 60 characters, other text fields ≤ 200 characters,
  unknown fields are rejected. An invalid file, or one from a newer schema version, is rejected
  with no change; older versions are migrated.

**My Gear**

- **FR-005**: My Gear MUST hold, per profile: instruments (001 FR-053), audio interfaces and amps,
  cameras and outputs, each with a user-given name. Each entry is a profile-scoped, sync-ready
  record (001 FR-066).
- **FR-006**: An audio interface or amp entry MUST record: name, optional name pattern for device
  matching (a case-insensitive substring, ≤ 64 characters, never a regular expression), input channels (index, user label, instrument/line/mic hint), signal type (dry or
  processed, per channel where relevant), monitoring capability (hardware direct available or
  not), and optional notes. 015 reads these fields (015 FR-004).
- **FR-007**: The app MUST ship editable gear presets: Focusrite Scarlett Solo 4th Gen, Focusrite
  Scarlett 2i2 4th Gen, Boss Katana:GO, and "Generic class-compliant interface". Choosing a preset
  creates the user's own copy; presets are never applied implicitly. Every feature MUST work
  identically with a user-created entry.
- **FR-008**: Camera and output entries MUST record a name and an optional device-name pattern (as in
  FR-006); the camera entry also stores placement notes. Handedness is a player setting in 001's
  profile settings record (001 FR-067), never stored per camera.
- **FR-009**: Users MUST be able to mark a default instrument, interface, camera and output per local
  profile. They are fields of 001's profile settings record (the default instrument is 001's
  "active instrument").

**Onboarding**

- **FR-010**: Onboarding MUST ask, on at most 5 screens: goals (multi-select from a built-in,
  owner-curated goal list, each goal mapped to lesson tags in the 001 FR-068 vocabulary; at least
  "solo over blues", "play songs by bands I like" (mapped through genres and lessons' songs),
  "understand chord theory", "learn the notes on the neck", "bass grooves and lines"), instrument(s) (pick from My Gear or add one), level (beginner / intermediate /
  advanced), genres (multi-select), and practice time per week. Every question is skippable;
  answers are stored per profile and can be edited later. The instrument step is skippable only if
  the profile already has an instrument. Practice time per week sets the path's pacing estimate
  ("about N weeks at your pace", from the lessons' estimated durations) and 006's default session
  length (hours per week ÷ 5 sessions, rounded to the nearest planner preset).

**Learning paths**

- **FR-011**: From onboarding answers and the active pack, System MUST generate a suggested path: an
  ordered list of lessons and drills whose instruments match the user's instruments, whose level is
  the chosen level or one step below, and that carry at least one tag mapped from the goals or
  genres. Pack items come first in pack order; matching lessons outside the pack follow, ordered by
  number of matching tags (descending), then lesson id. Each item carries a one-line reason. The
  path has no length cap. Generation MUST be deterministic for the same answers and content and
  complete in < 500 ms. It MUST fall back as described in Edge Cases.
- **FR-012**: Users MUST be able to edit any path: rename, reorder (drag and keyboard), add any
  lesson or drill from the library, remove items, and delete the path. Users MUST be able to keep
  several paths and choose the active one. Paths are profile-scoped, sync-ready records. Path items
  reference a lesson, or a drill by (lesson id, drill id) (001 FR-068). Merging two divergent copies
  of a path (001 FR-066a generic merge) MUST keep the union of items, let removals (tombstones) win
  over moves, and order ties by item id, deterministically (the order-key scheme is chosen in
  plan.md).
- **FR-013**: A path MUST show a "next step" (the first incomplete item) and path progress. It MUST
  NOT hide, disable or gate any item or any lesson outside the path (Constitution XIII). When 006's
  adaptive recommendations are on, the path's next step is chosen by 006 **among the path's
  incomplete items** (006 FR-005); still non-binding.

**Curriculum packs**

- **FR-014**: Users MUST be able to create, edit, duplicate, delete, export and import curriculum
  packs in the 001 pack format (001 FR-063), and choose the active pack per profile. Import MUST
  validate the schema and enforce these limits (owner to confirm): file ≤ 1 MB, ≤ 500 sections,
  ≤ 200 lessons per section, ≤ 200 characters per text field, unknown fields rejected. All text is
  rendered as plain text. A pack whose id matches the built-in pack or an existing pack is imported
  as a copy with a new id. Lessons missing on this device are listed, not fatal.
- **FR-015**: The scale bound for 016 is ≤ 10 profiles, ≤ 50 paths per profile, ≤ 1,000 items per
  path, ≤ 50 packs per profile (a performance envelope, not a hard cap). Path reorder, path or pack
  switch, and save operations MUST each complete in < 100 ms at p95 at that scale on the reference
  laptop (001 Clarifications); a local-profile switch gets 1 s (FR-002).

**Lesson structure**

- **FR-016**: The stage preference (001 FR-064) MUST be editable from settings and from inside any
  lesson ("use this order as my default").

**Quality tiers**

- **FR-017**: System MUST store a quality-tier setting (automatic | low | medium | high) per (local
  profile, device id), where the device id is a random local identifier, so a synced setting never
  applies to another device. It MUST expose one read interface returning the effective tier and its
  source (automatic | user). The benchmark that produces the automatic tier, its workloads and its
  thresholds are specified and built in 008 (008 FR-028).

**Cross-cutting**

- **FR-018**: Everything in this feature MUST work offline and on the device; no data leaves it
  (Constitution IX). Every screen MUST work at 390 px and with keyboard and screen reader (verified
  by automated accessibility checks plus a manual NVDA pass on Windows), and drag-and-drop MUST have
  a keyboard alternative.
- **FR-019**: All records introduced here (profiles, gear entries, onboarding answers, paths, path
  items, packs, tier setting) MUST carry the 001 FR-066 fields.
- **FR-020**: Writes MUST be atomic per user action: on a storage error (quota, eviction), nothing
  partial is saved and the user gets a clear message. 001 FR-045's persistent-storage request and
  export reminder apply.

### Key Entities

- **Local profile**: id, display name, defaults (instrument, interface, camera, output), active
  path, active pack.
- **Gear entry**: id, profile id, kind (instrument | interface/amp | camera | output), name,
  preset origin (optional), kind-specific fields (FR-006, FR-008).
- **Gear preset**: shipped, read-only template for a gear entry.
- **Onboarding answers**: goals, instruments, level, genres, practice time, answered-at.
- **Goal**: id, title, mapped lesson tags (owner-curated data).
- **Learning path**: id, profile id, name, origin (generated | manual), ordered items (lesson or
  drill reference, reason, order key).
- **Curriculum pack**: 001 FR-063, plus author (local profile) for user packs.
- **Quality tier setting**: local profile id, device id, tier, source (auto | user).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated tests over ≥ 3 profiles, 0 records from one profile appear in another
  profile's views, exports or statistics.
- **SC-002**: In ≥ 5 timed runs with first-time testers (the owner and at least one other person),
  onboarding plus the first lesson opening takes under 2 minutes.
- **SC-003**: For a fixture of ≥ 30 onboarding answer sets, 100% of generated paths are
  deterministic, contain only items valid for the chosen instruments, and give a reason for every
  item; ≥ 90% of items carry a tag matching a chosen goal or genre (the rest are fallback items,
  labelled as such).
- **SC-004**: At the FR-015 scale, reorder, switch and save operations each complete in < 100 ms at
  p95 on the reference laptop; profile switch completes in < 1 s at p95.
- **SC-005**: Profile export → delete → import restores 100% of records with identical ids; a merge of
  two exports of the same profile edited on two devices produces 0 id collisions and a valid path
  order.
- **SC-006**: 100% of malformed or oversized pack and profile fixtures are rejected with a readable
  reason and no partial change.
- **SC-007**: 100% of tier-setting fixtures pass: override, "automatic" restore, and isolation per
  (local profile, device id).
- **SC-008**: With gear entries created from scratch (no preset), 100% of 015 and 008 acceptance
  scenarios that don't depend on a named device pass (verified when those features land).
- **SC-009**: Erase permanently leaves 0 records of the erased profile in any store (automated scan).

## Assumptions

- The goal list and its goal → tag mapping are owner-curated content (like lessons); agents may
  propose the schema only.
- The owner's laptop is the development benchmark machine (model, CPU, GPU and RAM to be recorded
  in plan.md). The minimum target is a laptop with integrated graphics.
- Profiles are a convenience, not a security boundary.
- Adaptive recommendations (mastery, spaced repetition) are feature 006; 016's "next step" is
  rule-based.
- Sync (013) is out of scope this term; only the data model must be sync-ready.

## Clarifications

### Session 2026-11-21 (spec review: BLOCK, 3 blockers + 17 others, folded in)

- Tier scope → per (local profile, device id), so it stays XIII-compliant and never applies to
  another device; the benchmark moves to 008 (FR-017, US6).
- Import and merge → 001's profile export format and FR-066a merge rules; restore vs new vs copy
  (FR-004); permanent erase added (FR-003).
- New profile → must pick one instrument before the explorer or drills open (US1, US3, FR-010).
- Handedness → a player setting in 001's profile settings record (FR-008).
- **OPEN (owner):** confirm the numbers: import limits (FR-004, FR-014), 5 screens / 2 minutes
  (FR-010, SC-002), < 500 ms generation (FR-011), the FR-015 scale and timings, ≥ 90% tag match
  (SC-003); and have the preset hardware facts (channels, direct monitoring) checked against the
  manufacturers' data.
