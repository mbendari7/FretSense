# Spec 001 part: US7 Local Progress and Weak-Spot Weighting

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 7 - Local Progress and Weak-Spot Weighting (Priority: P3)

Every drill answer is stored on the device, in the active local profile. Future questions favour
weak items unless the user turns adaptive weighting off. Progress can be viewed, exported to JSON and
imported.

**Why this priority**: Makes practice efficient over weeks, but drills are useful without it.

**Independent Test**: Seed a history with poor accuracy on one string, generate 200 seeded prompts,
and compare that string's share with an empty-history run. Then export, reset, import, and compare
the progress views.

**Acceptance Scenarios**:

1. **Given** history where string 3 accuracy is 40% and the others are ≥ 90% (≥ 20 attempts each),
   **When** 200 prompts are generated across all strings with a fixed seed, **Then** string 3's
   share is at least 1.5× its share under empty history.
2. **Given** progress exists, **When** the user exports, **Then** a JSON file with a schema
   version, all attempts and lesson completion is saved.
3. **Given** that file, **When** the user imports it on a fresh install (after first load),
   **Then** the progress views match the original exactly.
4. **Given** a malformed or newer-schema file, **When** imported, **Then** it is rejected with a
   readable reason and existing progress is unchanged.
5. **Given** adaptive weighting is turned off, **When** 200 prompts are generated with the same
   seeded weak-string history as scenario 1, **Then** the distribution equals the empty-history
   distribution (uniform over valid prompts).

## Requirements *(mandatory)*

### Functional Requirements

**Progress**

- **FR-040**: System MUST record every drill answer on the device (one attempt per question for note-finding, interval, chord-tone, root–fifth–octave and arpeggio, however many taps or steps it took (FR-056a, FR-057); per note for walking-bass,
  written at Check line (FR-058); per chord for chord-tone-lock): attempt id, drill type,
  instrument id (null under a temporary lesson preset), geometry id, input modality (tap in 001; fret and audio are added by 008 and 003), prompt,
  answer position(s), outcome, response time, timestamp, and lesson id if any. Stats are grouped per
  modality.
- **FR-041**: Question generation MUST weight toward weak items, within the active local profile. An
  item is (geometry id, string, pitch class) for note-finding (so stats from different tunings are
  never mixed, and retuning back to a tuning reuses its stats), (interval, direction) for intervals, (quality, function) for chord
  tones, (root-fifth-octave, root pitch class) for
  root–fifth–octave, and (drill type, quality of the chord the note is played over) for arpeggio,
  walking-bass and chord-tone-lock. Weighting uses simple miss counts: an
  item's weight increases monotonically with its smoothed miss rate over its last 50 live (non-tombstoned) attempts, counted within the
  active instrument's family for interval, chord-tone and pattern items
  (formula documented in plan research R9) Attempts are counted as FR-040 records them: a multi-step question is one attempt, and it is a miss if any step was missed. *(product-owner 2026-11-22, provisional)*. Spaced repetition is feature 006. Given the same history and
  seed, the sequence MUST be identical, and it MUST meet US7 scenario 1. Adaptive weighting is a
  per-user setting (default on); when off, generation is uniform over valid prompts (US7 scenario 5).
- **FR-042**: A progress view MUST show accuracy and median time per item group, per instrument
  family and per My Gear instrument, over the last 7 days (rolling, device local time) and all time. Attempts made under
  a lesson preset are shown as "Lesson preset: <preset name>" in per-instrument stats and count
  toward the preset's family. Attempts of a deleted instrument are shown under "Deleted instrument:
  <name>", grouped by instrument id, even when a live instrument has the same geometry.
  Counts are of recorded attempts (FR-040). Each item group names its unit: "questions" for every drill except walking-bass ("notes") and chord-tone lock ("chords"), e.g. "18 of 24 questions correct". A total across groups, if shown, uses "answers" (one answer = one recorded attempt). Typical time is shown per item group only and is never pooled across drill types. *(product-owner 2026-11-22, provisional)*
- **FR-043**: Users MUST be able to export the active local profile's data (schema version, local
  profile id, attempts, lesson completion, instruments, optionally settings) in the **profile export
  format** (016 extends the same format with its own record types) and import it:
  - into the **same** local profile id (restore): records merge by the FR-066a rules;
  - into a **different** local profile (copy): every record gets a new id and the target's local
    profile id, so no id ever exists in two profiles; natural-key records (settings, lesson
    completion) merge into the target's existing ones by natural key (FR-066, FR-066a). Incoming
    tombstones never apply in copy import: a tombstoned record in the file is not copied and not counted (owner decision 2026-11-22, "Copy import drops deleted"); live attempts in the file that refer to a dropped instrument are copied with instrumentId null and shown under "Deleted instrument" (FR-042). An incoming live natural-key record whose
    target record is tombstoned un-deletes it with only the incoming stages (lesson completion) or
    fields (settings, only when "Apply settings from this file" is on), as a newly written record.
    *(spec-reviewer 2026-11-22 #3b, R2-5, R2-6; provisional)*
  - Import MUST validate the file (schema, size ≤ 50 MB, the single limit for the profile export format,
    which 016 also uses; an export of 50,000 attempts MUST fit under it and import successfully, and
    an export that would exceed it MUST warn before saving, unknown fields rejected). Exports include
    tombstoned records. A record referring to an instrument id absent from both the file and the target profile, or a failed migration step, rejects the whole file. An import is applied in one
    transaction: an interruption leaves no partial change.
  - Lesson completion MUST be merged as a union.
  - Export offers "Include settings" and import offers "Apply settings from this file" (shown
    only when the file has settings); both default off. Before confirming, the preview names the
    import mode (Restore or Copy) and, in one sentence, why that mode
    applies. In Copy mode the preview also states, next to the confirm button: "Copy import adds this file's answers and instruments as new records every time. Importing the
    same file again adds them again."
    *(A2-8 interim; FN-10c held)*
  - The whole file MUST be rejected, with no change, if it is invalid, has an attempt whose id
    matches a local attempt with a different immutable payload (FR-066a), or comes from a newer
    schema version.
  - Older schema versions MUST be migrated.
  - Copy import re-stamps `created` and `updated` with the target profile's writer id (attempt wall
    times are kept).
  - Before export, the screen MUST first show a summary (profile name, instruments, counts of
    attempts, completed stages and records hidden by reset, settings if ticked, and the date range
    of the attempts), with the full list of every attempt with its time and response time one tap
    away, and MUST state above the fold at 390 × 844 px that the file is unencrypted, readable by anyone who has it, and that local
    profiles are not private from other people using the same device.
- **FR-044**: Users MUST be able to reset attempts and completion after confirmation. Settings are
  kept. Reset tombstones the records (FR-066); an export taken before the reset restores them
  (FR-066a). The confirmation MUST say that reset hides progress but does not erase it from the
  device, and that later exports still contain it; permanent erasure is 016 ("erase permanently").
