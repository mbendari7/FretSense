# Feature Specification: Theory Engine, Interactive Fretboard and Lesson System (Guitar + Bass, No Audio)

**Feature Branch**: `001-theory-fretboard-lessons`

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21 for constitution v2.2.0: personalised for every user, no locked content,
curriculum packs; clarify answers recorded in Clarifications; spec-reviewer re-review and product-owner
review 2026-11-22 folded in and re-checked against constitution v2.3.0; owner approval pending)

**Input**: User description: "Theory engine, interactive fretboard and lesson system (no audio). US1 (P1) Fretboard explorer: any of 12 roots × scales (major, natural/harmonic/melodic minor, the 7 modes, major and minor pentatonic, blues) and chords (maj, min, dim, aug, sus2, sus4, 7, maj7, m7, m7b5, dim7, add9); labels toggle between note names, scale degrees and none; root highlighted. US2 (P1) Lessons: open a lesson tied to a book chapter and go Read → See (fretboard preset from frontmatter) → Drill in one place. US3 (P1) Note-finding drill with accuracy and response time per string. US4 (P2) Interval and chord-tone drills. US5 (P2) Key helper: diatonic chords with Roman numerals and their neck positions. US6 (P3) Local progress tracking that weights questions toward weak spots, with JSON export/import. Also: tunings (standard, Drop D, Eb, DADGAD), configurable fret count, left-handed view, 390 px phone layout, offline use, measurable success criteria (100% pass on theory fixtures, feedback under 100 ms)." Amendment: "Make everything instrument-agnostic with an InstrumentProfile (string count, tuning, fret count, pitch range, scale length). Profiles: 6-string guitar (standard, Drop D, Eb, DADGAD), 4-string bass (EADG, Drop D), 5-string bass (BEADG), custom tunings. Lessons and drills declare which instruments they apply to. Bass lesson types: root–fifth–octave patterns, arpeggios, walking bass lines, locking into chord tones."

**Practice-session value** (Constitution VI): before picking up their guitar or bass, a user opens
one screen to see a scale, chord or key on *their* instrument and tuning, opens any lesson they like
in the stages they prefer, and runs a 2–5 minute drill that targets their weakest strings,
intervals and patterns.

**Release** (`docs/PRODUCT.md`): **v0.1 "Fretboard"**, in full. Every FR and SC in this spec ships
in v0.1. 001 meets two of v0.1's exit criteria directly: 100% of the theory fixtures pass (SC-001),
and the app works offline after the first load (FR-045, SC-005). It also enables a third, the
≤ 2-minute path from landing page to first drill answer measured by 018 SC-001, through FR-053's
one-tap preset picker and US3. Later capabilities are separate specs, not deferred 001 FRs: Play
stages in v0.2 (002, 003), Camera-coach stages in v0.4 (010), and 017's approved extensions to
001's drills and labels, specified and planned in 017 (core v0.1, complete v0.3).

**Curriculum** (Constitution XIII): 001 ships the built-in **General Theory** curriculum pack and
the pack format. Lessons are not tied to any book. Users create their own packs (mapping lessons to
a book or course) in 016. 001 enables the Read/See/Drill stages of every lesson that needs no audio
(notes on the neck, intervals, scales and modes, chords, keys and diatonic harmony, bass patterns).
Play stages arrive with 002/003, and Camera-coach stages with 010.

**Personalisation foundation**: 001 creates one local profile automatically and stores everything
local-profile-scoped and sync-ready (FR-066). Profile management, full My Gear (interfaces, cameras,
outputs), onboarding, learning paths and pack authoring are feature 016.

**Terminology** (spec review, 2026-11-21): **local profile** = one person's space on the device
(FR-066). **Instrument geometry** (the `InstrumentProfile` value: family, strings, tuning, fret
count, scale length) has a deterministic **geometry id** derived from family + tuning (FR-051).
**Instrument** = a My Gear record holding a name and a geometry (FR-053). **Preset** = a built-in
geometry (FR-009). In this spec, "profile" alone never means an instrument.

## How this spec is organised

This file is the index. The spec is split into parts next to it (ADR-0013, owner-approved
2026-11-25). Requirement wording was moved verbatim; `scripts/check-fr-ids.mjs` checks that the
FR and SC sets are unchanged. Grep for an FR-ID to find it, or use the map below.

| Part | File |
|------|------|
| US1 Fretboard Explorer | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| US2 Lessons | [spec-us2-lessons.md](spec-us2-lessons.md) |
| US3 Note-Finding Drill | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| US4 Interval and Chord-Tone Drills | [spec-us4-interval-chord-tone-drills.md](spec-us4-interval-chord-tone-drills.md) |
| US5 Key Helper | [spec-us5-key-helper.md](spec-us5-key-helper.md) |
| US6 Bass Patterns and Lines | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| US7 Local Progress and Weak-Spot Weighting | [spec-us7-progress.md](spec-us7-progress.md) |
| Edge cases, shared requirements (theory engine, cross-cutting, instruments, spelling and generation, personalisation) and key entities | [spec-shared-requirements.md](spec-shared-requirements.md) |
| Clarifications (every session) | [spec-clarifications.md](spec-clarifications.md) |

### FR → file map

FR-031a is not defined in 001. It is only mentioned, as a held owner item, in
[spec-clarifications.md](spec-clarifications.md), so it has no row.

| FR | File |
|----|------|
| FR-001 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-002 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-003 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-004 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-005 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-006 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-007 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-008 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-009 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-010 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-011 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-012 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-013 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-014 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-015 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-016 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-017 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-018 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-019 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-020 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-021 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-022 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-023 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-024 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-025 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-026 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-027 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-028 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-029 | [spec-us2-lessons.md](spec-us2-lessons.md) |
| FR-030 | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-031 | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-032 | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-032a | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-033 | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-034 | [spec-us3-note-finding-drill.md](spec-us3-note-finding-drill.md) |
| FR-035 | [spec-us4-interval-chord-tone-drills.md](spec-us4-interval-chord-tone-drills.md) |
| FR-036 | [spec-us4-interval-chord-tone-drills.md](spec-us4-interval-chord-tone-drills.md) |
| FR-037 | [spec-us4-interval-chord-tone-drills.md](spec-us4-interval-chord-tone-drills.md) |
| FR-038 | [spec-us5-key-helper.md](spec-us5-key-helper.md) |
| FR-039 | [spec-us5-key-helper.md](spec-us5-key-helper.md) |
| FR-040 | [spec-us7-progress.md](spec-us7-progress.md) |
| FR-041 | [spec-us7-progress.md](spec-us7-progress.md) |
| FR-042 | [spec-us7-progress.md](spec-us7-progress.md) |
| FR-043 | [spec-us7-progress.md](spec-us7-progress.md) |
| FR-044 | [spec-us7-progress.md](spec-us7-progress.md) |
| FR-045 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-046 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-047 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-048 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-049 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-050 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-051 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-052 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-053 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-054 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-055 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-056 | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| FR-056a | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| FR-057 | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| FR-058 | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| FR-059 | [spec-us6-bass-patterns.md](spec-us6-bass-patterns.md) |
| FR-060 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-061 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-062 | [spec-us1-fretboard-explorer.md](spec-us1-fretboard-explorer.md) |
| FR-063 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-064 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-065 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-066 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-066a | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-067 | [spec-shared-requirements.md](spec-shared-requirements.md) |
| FR-068 | [spec-shared-requirements.md](spec-shared-requirements.md) |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the theory fixtures pass. They cover 21 spelled roots (7 naturals, 7 sharps,
  7 flats) × 12 scale types and × 12 chord qualities (expecting a typed error wherever a triple
  accidental would be needed), the 30 keys, every built-in profile's mapping for frets 0–24, and
  the named edge cases. The owner and theory-checker sign off the expected values.
- **SC-002**: Drill tap → feedback is under 100 ms at p95 over at least 200 taps on the reference phone and on the reference laptop (both named in Clarifications), measured and reported
  separately for the 6-string Standard and 5-string BEADG presets and for the worst case allowed
  geometry (8 strings, 24 frets) (Constitution VIII).
- **SC-003**: Changing root, type, labels, profile or handedness updates the fretboard within 100 ms
  at p95 on the same devices, reported separately for the 6-string Standard and 5-string BEADG
  presets and the 8-string, 24-fret worst case.
- **SC-004**: From a cold start (app launch with an existing instrument), any scale or chord can be shown on the active instrument in at
  most 3 interactions and under 10 s on the reference phone and laptop; from a fresh profile, in at
  most 4 interactions (including the one-tap instrument pick) and under 15 s.
- **SC-005**: Offline after first load, 100% of the acceptance scenarios for US1–US7 pass.
- **SC-006**: At 390 px, 0 screens scroll horizontally at page level, and 100% of controls and fretboard positions are at
  least 44 × 44 px (automated check; inline text links exempt).
- **SC-007**: A 20-question note-finding session, including setup, takes under 3 minutes at
  ≤ 5 s per answer, measured with the FR-031 defaults.
- **SC-008**: A valid new lesson appears after a rebuild with no code change. 100% of invalid
  lesson fixtures fail validation with the file and field named.
- **SC-009**: Export → reset → restore-import (same local profile) leaves 100% of the attempts that were live at export time live with identical payloads, and every lesson-completion stage that was complete at export time complete with its original time, with no two live records sharing an id or a natural key (0 duplicates).
- **SC-010**: Theory engine line and branch coverage is at least 90%.
- **SC-011**: All theory, explorer and drill property tests pass across all 7 built-in presets
  and at least 100 randomly generated valid My Gear instruments covering every allowed string count
  (guitar 6–8, bass 4–6) and fret counts 12–24 (no hidden 6-string or 22-fret assumption).
- **SC-012**: 100% of lessons, stages, drills and tools are reachable by direct link from a fresh
  profile with no progress and from a seeded profile (every stage complete, low accuracy) (automated
  crawl); both reach the identical set (FR-065), and 0 controls are disabled or hidden for progress
  reasons.
- **SC-013**: Every persisted record type in 001 carries the FR-066 fields (schema check over all
  stores), and property tests of the FR-066a generic merge (013) over two divergent exports of the same
  local profile show no id collisions, convergence (merge order doesn't matter) and idempotence
  (merging the same export twice equals merging it once). Restore-import, which by design favours
  the file's live records over local tombstones, is property-tested for idempotence and the SC-009
  round trip. The only migration in 001 is the v0.1 drill-type rename (Clarifications, data-model §3.1): it runs on load and on import, is idempotent, keeps `schemaVersion: 1`, and is tested to produce the same payload hash on both paths. *(r2 #9, provisional)*

## Assumptions

- 001 creates and uses one local profile, with no rename or switch UI. Creating, switching and
  deleting several profiles is feature 016; 001's data model already supports it (FR-066).
  Boundaries: 001 owns that profile, instruments, the settings record, the pack format and export v1;
  016 owns profile create, rename, switch and delete, erase permanently, other gear, paths and pack
  authoring; 018 owns onboarding (including renaming the profile), Home, navigation and the theme
  choice.
- String 1 is the highest-pitched string. On every screen the lowest-pitched string is drawn at the
  bottom of the neck and the highest at the top (the player's view looking down at the instrument,
  as in tab). The left-handed view mirrors the fret direction, never the string order.
- Melodic minor means the ascending ("jazz") form.
- "Neck positions" means where the chord tones lie; voicings, CAGED shapes and fingerings are
  out of scope (005).
- Bass drills in 001 are untimed and tap-based; timed play-along is feature 003.
- Fixture lessons use placeholder text only. Real lessons, including the built-in General Theory
  pack, are written by agents in original wording, checked by theory-checker and approved by the
  owner (Constitution IV, v3.0.0).
- Progressions in lessons are given as structured root + quality data; chord-symbol parsing is
  feature 005.
- Audio, camera, ML, sync and spaced repetition beyond FR-041 are out of scope (002–013).
- Cross-spec changes approved in 017 (017 Clarifications, 2026-11-22) are applied when 017 is
  planned, not in 001's current tasks: wider drill inputs (017 FR-031 extends FR-031, FR-035,
  FR-036 and FR-057–FR-059); extra degree and function labels (017 FR-003 and FR-004 extend
  FR-006); and a handbook deep-link preview on the 6-string Standard preset (017 Edge Cases), an
  exception to FR-053's picker-first rule for handbook deep links only. 018's "I don't play yet"
  (018 FR-005) is an explicit user choice of a preset, so it is consistent with FR-053.

## Clarifications

All clarification sessions are in [spec-clarifications.md](spec-clarifications.md). New sessions go there.
