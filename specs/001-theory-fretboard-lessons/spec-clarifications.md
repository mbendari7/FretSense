# Spec 001 part: Clarifications

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## Clarifications

### Session 2026-11-21 (owner answers, folded in with the v2.2.0 direction change)

- Q: Default fret count? → A: It comes from each My Gear instrument; defaults are 22 for guitar and
  20 for bass, editable (FR-014, FR-053).
- Q: Octave-specific note-finding? → A: A per-user setting; any octave counts by default (FR-030,
  FR-067).
- Q: Weak-spot weighting: miss counts or SM-2? → A: Simple miss counts in 001; FSRS (or SM-2) in
  006. Users can turn adaptive weighting off (FR-041, FR-067).
- Q: Book mapping? → A: No book dependency. Built-in General Theory pack plus a pack system; the
  owner creates their own book pack in 016 (FR-022, FR-063).
- Q: 7-string guitar? → A: Covered by "any user, any gear": guitar 6–8 strings, bass 4–6 strings
  (FR-053). The family pitch ranges were first proposed as guitar F#1–E4 and bass B0–C3,
  then widened in spec review to guitar E1–E4 and bass A0–C3 (FR-053); they remain a proposal for
  owner confirmation (research O3).
- Q: Reference devices for SC-002/SC-003? → A: The owner's laptop is the development benchmark
  machine. **OPEN (owner):** its model, CPU, GPU and RAM, and the reference phone (model, OS,
  browser), must be written here before SC-002/SC-003 benchmark tasks run (Constitution V).
- Spec review 2026-11-21 (BLOCK, 2 blockers + 14 others) folded in: FR-066a merge rules, geometry id
  (FR-040, FR-041, FR-051, FR-053), terminology, copy vs restore import (FR-043), profile settings
  record (FR-067), no-instrument and last-instrument rules (FR-053), empty stage set (FR-064), tag
  format and drill ids (FR-068), worst-case geometry in SC-002/003, per-instrument stats (FR-042),
  persistent storage (FR-045). Family ranges widened to guitar E1–E4, bass A0–C3 (owner to
  confirm).

### Session 2026-11-22 (team loop A and spec-reviewer re-review; proposals, owner approval pending)

- spec-reviewer re-review: BLOCK on the missing Release line only (fixed: Release paragraph), plus
  8 MAJOR and 15 MINOR findings and 19 checklist gaps.
- product-owner review: REVISE → APPROVE once edits are in (subject to the owner). user-tester Mode A
  (`docs/feedback/001-theory-fretboard-lessons-2026-11-22.md`, 3/5, 2 BLOCKER) triaged: 19 fix now,
  1 moved to 017 (CR-017), 3 backlogged (017 playback, 006 weighting reasons, 016 library filter).
- Applied: Release line; drills never reveal their answer (FR-032a, FR-049); first-run drill and
  explorer defaults (FR-011, FR-021, FR-031, FR-035, FR-036); End drill and paused-session rule
  (FR-034, Edge Cases); prompts name strings by open note and neck orientation (FR-030,
  Assumptions); "Use my instrument instead" (FR-026); auto-advance choice (FR-032); walking-bass
  entry and judging (FR-058); window stated and drawn (FR-036, FR-057); marker categories (FR-013);
  full WCAG 2.2 AA incl. dialogs and forms (FR-048); export/import preview wording (FR-043,
  FR-066a); empty progress state.
- **Frozen encodings settled before T021/T022** (data-model §3.1 must follow): the immutable attempt
  payload (FR-066a), the closed list of record types with device-local metadata exempt and no device
  id in 001 (FR-066), the canonical drill-type ids (Key Entities), and one attempt per judged unit
  with the pattern-drill item keys (FR-040, FR-041). One export limit of 50 MB shared with 016
  (FR-043).
- **Held for the owner (not applied):** saving last drill settings per drill type (in 001 as
  FR-031a, or in 018; 018 FR-009 depends on it); default profile name ("Player 1" per 018 FR-005 vs
  "Me" in data-model); where the explorer and key helper live in 018's navigation (`/` route);
  idempotent copy import and "Continue this file's profile" (privacy trade-off: copied records become
  traceable to their source profile; affects frozen encodings); cross-spec changes to 016, 017 and
  018; a11y colour-difference threshold (proposal: CIEDE2000 ≥ 20, as 018 FR-015) and music-stand
  legibility distance (proposal: 1 m); O1–O4.

### Session 2026-11-22 (v0.1 build, team loop D; provisional under the standing approval, owner review pending)

- Export/import size limit (FN-10a): one 50 MB limit (spec wins); data-model.md and contracts/profile-export.md aligned. (product-owner FN-10)
- The simplified walking-bass drill is hidden until full FR-058 ships in a later 001 task group; the other three bass drills (root–fifth–octave, arpeggio, chord-tone lock) ship. (FN-7, NEEDS MAHMOUD to confirm hide vs labelled preview)
- Harmonic-minor alternatives are shown in addition to the natural-minor chords (US5-2 "also shown"); theory API v1.1 adds helper exports (contracts/theory-api.md).
- 4-string EADG bass preset id: `bass4-standard`.
- Lesson-completion tombstones (FN-10b, provisional, applied): completion merges as a per-stage union (earliest time per stage kept); restore-import un-deletes a locally tombstoned completion when the file holds it live, keeping the union of both records' stages; an incoming tombstone applies only if its HLC is newer than the local record's last update. SC-009 covers completion as well as attempts.
- Root–fifth–octave (FR-056, applied): a step counts only within 3 frets of the root, and the finished shape must span at most 4 frets (max − min ≤ 3).
- Spec change requests FN-2, FN-3, FN-4, FN-5, FN-6, FN-7, FN-10b and FN-11 are written into the FRs (marked provisional) and are in loop A; their code changes wait for loop A to pass.
- Idempotent copy import (FN-10c) stays **held for the owner** (privacy trade-off: a stable copied id makes copied records traceable to their source; needs privacy-auditor). It is not in FR-043. "Continue this file's profile" also remains held. (NEEDS MAHMOUD)
- 2026-11-22, owner: "And now you have all my full approval, so keep going." The FN-2 to FN-11 spec change requests are written into the FRs above (marked provisional) and go through loop A now.
- 2026-11-22, owner (spec gate escalation after spec-reviewer r3): "Apply all 7 fixes (Recommended)". R3-1 to R3-7 applied with spec-reviewer's exact wording.
- Mode A2 triage (product-owner, 2026-11-22, provisional): fix-now edits A2-1, 2/11, 3, 5, 6, 8 (interim warning), 9, 12, 13, 14 and 15 applied. Held (NEEDS MAHMOUD): A2-7 nut spelling after the answer (would reverse owner-approved R3-2), FN-10c, FN-7. Backlog: "Just looking" (018 FR-005), Undo reset (016), more walking-bass progressions (017).
- 2026-11-22, owner (A2 spec gate escalation): range for walking bass and chord-tone lock = "Same as other drills (Recommended)"; FR-047 wording fixes = "Apply both (Recommended)".
- Q: How are attempts stored by the v0.1 pre-release (4695363) under the old drill-type ids handled? → A (provisional, product-owner, 2026-11-22): A versioned migration on load and import renames `bass-root-fifth-octave`, `bass-arpeggio` and `bass-walking` to `root-fifth-octave`, `arpeggio` and `walking-bass`. Old root–fifth–octave keys and `bass-octave-shapes` attempts are kept under a legacy id in storage and in exports (so older exports import whole and round-trip, FR-043, SC-009), but never shown on Progress, never offered as a drill, and never used for weighting or mastery (r2 #8), so older exports still import whole (FR-043); see data-model §3.1. *(code-reviewer T091 r1 #4. Owner 2026-11-22: "Keep migration, drop drill (Recommended)": the migration stays and `bass-octave-shapes` stays removed.)*
- Q: code-reviewer T091–T093 r2 #3–#6, #8, #9 and r1 #6 → A (provisional, product-owner, 2026-11-22): applied to FR-032 (scroll to the revealed answer after a wrong answer), FR-047 (range text "No whole fret in view of N"; segments sized by the widest cell), FR-049 (start on the highest-numbered selected string), the T093a clarification (legacy attempts kept in storage and exports, not shown on Progress), SC-013 and Key Entities (the v0.1 rename is the only migration; stored `legacy` drill type), FR-066a restore precedence (6) (an unmatched incoming tombstone is not written or counted). r2 #7 (the interval reference's accessible name includes its note) was approved by the owner on 2026-11-22 and applied to FR-032a/FR-049.
- Q: test-writer T100 ambiguities → A (provisional, product-owner, 2026-11-22): the tapped note in chord drills is spelled relative to the chord root (FR-049, FR-032); arpeggio steps are numbered by chord tone, with the root as Step 1 played by the user (per US6 scenario 2); FR-056 uses 3 fixed steps R/5/8 ("octave"); FR-053 messages use the preset's full display name.
- Q: test-writer FR-056/FR-057 gaps → A (provisional, product-owner, 2026-11-22): FR-056 accepts any octave of the root as long as the three notes form an exact-pitch shape (5th +7, octave +12, span ≤ 3 frets), judged against every shape still possible; a wrong tap is charged by pitch class to one pending step, which is missed and revealed, and the drill continues (FR-056a); FR-057 picks the window so the full arpeggio fits from the lowest root, and the prompt says "up from its lowest A"; the root is written and spoken "root" in missed lists; add9 arpeggio steps are R, 3, 5, 9 with the 9 at +14 (owner-approved 2026-11-22). The 3-fret limit applies to the whole shape.
- Q: test-writer T100b gaps → A (provisional, product-owner, 2026-11-22): one attempt per rfo question (FR-040 wins over per-step); no out-of-range reason (unreachable); a placed tap is resolved first (root-preferred) before a wrong tap is charged; "placed" only when both roles remain possible (marker "R/8", suffix ", placed, root or octave"); revealed positions can fix a placed tap's role; full reveal tie-break order; repeat taps ignored; the 5th is spoken and written "5th"; final feedback "Correct, <chord> arpeggio" or "Incorrect. N of M steps correct. Missed: …"; US6 scenarios 5–13 added. Open MINOR: FR-034 per-string summary for multi-string questions (proposal: the shape root's string).
- Q: FR-056a per-tap "accepted or wrong" marks vs the data model → A (provisional, coordinator, 2026-11-22): not stored; the attempt keeps `answer: FretPosition[]` in tap order, so no schema change. Final feedback lines end with a full stop.
- Q: Arpeggio per-step attempts (FR-040) vs weighting, Progress, pause and End drill → A (provisional, product-owner, 2026-11-22): arpeggio records one attempt per question, like root–fifth–octave (FR-040, FR-057); weighting counts FR-040 attempts (FR-041, R9); the summary and Progress count the same unit and Progress groups name it (FR-034, FR-042); a multi-step question resumes at its next pending step with paused time excluded (Edge Cases); ending early discards an unfinished question with a notice (FR-034); per-string stats use the Step 1 root's string. The per-step wording was a pending proposal, never owner-signed. No frozen-encoding change.
- Q: Owner decisions 2026-11-22 (copied into reviews/README.md) → A: (1) add9 arpeggio steps R, 3, 5, 9 with the 9th at root + 14 ("R-3-5-9, 9th above"). (2) Copy import (FR-066a copy mode) drops records that are deleted (tombstoned) in the file: they are not written and not counted ("Copy import drops deleted"). (3) Interval drill (FR-035, FR-032): each black-key reference is spelled so that the answer needs no E♯, B♯, C♭, F♭ or double accidental; when one spelling of the reference would give such an answer and the other would not, the other is used; if both would, the question is not asked ("Avoid F♭-style references"). (4) The 10 General Theory lessons are approved to ship ("Approve all 10").
