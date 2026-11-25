# Spec 001 part: US2 Lessons

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 2 - Lessons: Any Lesson, Stages of Your Choice (Priority: P1)

The user browses the active curriculum pack (General Theory by default) and opens any lesson. Nothing
is locked. In one place they go through the stages they have chosen (by default Read → See → Drill),
in the order they have chosen. Lessons declare which instruments they apply to.

**Why this priority**: Lessons turn a curriculum into daily practice, at the user's own pace.

**Independent Test**: Add one placeholder-text lesson with a preset and one drill; open it and step
through Read, See and Drill without leaving the lesson screen.

**Acceptance Scenarios**:

1. **Given** lesson files exist, **When** the user opens the library, **Then** lessons are grouped
   by the active pack's sections in pack order, and filtered to the active instrument's family (with
   a "show all" toggle). Lessons not in the active pack are reachable under "All lessons".
2. **Given** a lesson preset "G Mixolydian, degrees, frets 0–12", **When** See opens, **Then** the
   fretboard shows exactly that configuration.
3. **Given** See, **When** the user changes the root or labels and taps "Reset to lesson",
   **Then** the preset is restored.
4. **Given** a preset that specifies Drop D, **When** See opens, **Then** Drop D applies only within
   the lesson, a banner says so, and the user's own instrument is restored on leaving.
5. **Given** a lesson defining a note-finding drill on the two lowest strings, **When** Drill starts,
   **Then** it runs with those parameters inside the lesson.
6. **Given** a lesson lists songs, **Then** Read shows them as "Songs to practice" (title and
   optional note only; no audio).
7. **Given** the user completes a stage, **Then** the library shows that stage as complete. No
   lesson, stage or drill is ever disabled because another one is incomplete.
8. **Given** a lesson declared for bass only while the active instrument is a guitar, **When** it is
   opened through "show all", **Then** a notice offers to switch to one of the user's basses (or to
   add one), and the lesson still opens.
9. **Given** the user's stage preference is "See, Drill" (Read off), **When** any lesson opens,
   **Then** it starts at See, shows only See and Drill in that order, and offers "show all stages"
   for this lesson. The preference persists as the user's default.
10. **Given** a jump from the library straight to a lesson's Drill, **Then** the drill starts with no
    other stage required.
11. **Given** a lesson preset `bass4-drop-d` and an active 5-string BEADG, **When** the user taps
    "Use my instrument instead", **Then** See shows the lesson's root, type, labels and window on 5
    strings, and drill attempts are stored with the 5-string's instrument id.

## Requirements *(mandatory)*

### Functional Requirements

**Lessons**

- **FR-022**: System MUST load markdown lessons (original text, Constitution IV) with structured metadata: id, title,
  level (beginner | intermediate | advanced), tags (goal, genre and topic tags, used by 016 to
  suggest paths), instruments, concepts, optional fretboard preset, drills, optional songs, an
  optional `needs` list (`audio-input`, `camera`; default empty; used from 015 on; `camera` never
  alone), and optional Play / Camera-coach sections (reserved, ignored in 001). Lessons carry no
  book or chapter reference; grouping and order come from curriculum packs (FR-063).
  While no lesson is available, the Lessons tab stays visible and opens the library, which says "The first lessons are being written" and links to Drills, the explorer and the key helper. No placeholder lesson or "coming soon" control is shown. (CR-B2-9 interim) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-023**: Every lesson and built-in pack MUST be validated against its schema at build time. A
  missing field, an unknown scale/chord/drill/preset/tag-format value, a duplicate id, a progression
  without a key, `needs: [camera]` alone, a pack referencing an unknown lesson, a preset fret beyond 24, or an image that is not a local file inside `content/` (remote URL,
  any scheme, or a path that escapes `content/`) MUST fail the build with the file and field named. A preset beyond the active
  instrument's fret count is clamped at runtime (Edge Cases). The same check MUST be runnable
  locally.
- **FR-024**: The lesson screen MUST present the user's chosen stages (FR-064) in one place, in the
  chosen order, with direct navigation to any stage, including stages hidden by the preference
  ("show all stages").
- **FR-025**: Read MUST render headings, paragraphs, lists, emphasis, tables, images and links, MUST
  NOT execute embedded scripts or raw HTML, and MUST list songs as "Songs to practice".
- **FR-026**: See MUST apply the lesson preset (root, type, labels, optional window, optional
  built-in instrument preset id such as `bass4-drop-d`) temporarily for the lesson, with a banner. A preset for a different family than the active instrument is applied only if the user confirms.
  The banner MUST name the preset in plain words (e.g. "Drop D: lowest string tuned down to D") and
  offer "Use my instrument instead". That option applies the preset's root, type, labels and window
  to the active instrument (window clamped to its fret count). Attempts are then recorded with the
  instrument's id and geometry id. Lesson-drill strings that don't exist on it fall back to all
  strings, with a notice. Declining a preset for a different family than the active instrument does
  the same. The choice holds for the current lesson visit. A profile setting, "Lesson tunings: use
  the lesson's (default) / always use my instrument", makes it permanent.
  Drill attempts made while a preset is applied are stored with the preset's geometry id and a null
  instrument id (FR-040). The preset replaces the whole geometry temporarily (string count
  included), whatever the user's instrument, and the banner names it (e.g. "Showing 6-string Drop D;
  your 7-string returns when you leave").
  The user's saved settings and instrument MUST be restored on leaving, and "Reset to lesson" MUST
  restore the preset.
- **FR-027**: Drill MUST list and launch the lesson's drills with their parameters.
- **FR-028**: System MUST record which stages of each lesson are complete: Read when the end of the
  body has been visible; See when opened; Drill when every question of one of the lesson's drills
  has been answered (an abandoned session doesn't count). The library MUST show this. Completion is
  informational only: it MUST NOT gate any lesson, stage, drill or tool (FR-065).
- **FR-029**: Play and Camera-coach are out of scope. No non-functional controls for them may be shown.
