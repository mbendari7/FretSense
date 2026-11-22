# Feature Specification: Reference Handbook

**Feature Branch**: `017-reference-handbook` (to be created by the owner)

**Created**: 2026-11-21

**Status**: Draft (specify; spec-reviewer BLOCK and product-owner REVISE folded in; clarified 2026-11-22; re-review pending)

**Input**: User description: "An interactive guidebook users can browse and search anytime, separate from the lessons: scales and modes, chords (every common type plus inversions and voicings), arpeggios, intervals, chord progressions (I–IV–V, ii–V–I, I–V–vi–IV, 12-bar blues, and more), keys, the circle of fifths, and a glossary. Every entry is interactive: shown on the fretboard for the user's instrument and tuning, playable as audio, transposable to any key, with labels switchable between note names, degrees and fingers. Chord voicing finder: every playable shape for a chord on the user's instrument, ranked by playability (reuse the fingering cost model). Progression explorer: choose a key and a progression, hear it with a backing loop, and see the matching scales to solo over. Fast search with fuzzy matching ('Am7', 'dorian', '2 5 1'). 'Practice this' on every entry jumps to a drill. 'Learn this' jumps to the related lesson. Users can favourite entries and build personal cheat sheets that export to PDF. All content is generated from the theory engine (no hardcoded tables), and all explanation text is original. Never copy text from books or websites; curriculum packs may only reference chapters."

**Practice-session value**: in the middle of practice, the user wonders "what's the fingering for
A♭maj7 on my 5-string?" or "what do I solo with over ii–V–I in B♭?". They find the answer in a few
seconds, see it on *their* neck in *their* tuning, hear it, and jump straight into a drill on it.
In v0.1 a chord entry shows every chord tone on their neck; from v0.3 the voicing finder adds
ranked, fingered shapes.
Cheat sheets put the user's own reference on the music stand.

**Release** (`docs/PRODUCT.md`): **core** (US1–US5, on 001's catalogue of 12 scales and 12 chord
qualities) ships in **v0.1 "Fretboard"**; **complete** (US6–US8, plus the extended scales and
chords) ships in **v0.3 "It teaches you"**, because the voicing finder needs 005's fingering cost
model. Each FR below is tagged *[core]* or *[complete]*.

**Depends on**: 001 (theory engine FR-001–FR-010, fretboard and display settings FR-011–FR-021,
FR-062, drills FR-030–FR-037 and FR-056–FR-059, lesson tags FR-068, packs FR-063, sync-ready
records FR-066), 016 (profiles, My Gear active instrument, profile export FR-004), 018 (navigation,
design system, states). *[complete]* also depends on 005 (fingering cost model). **Enables**: 018
(Handbook destination), 005 (shares this feature's chord-symbol lookup), 003 (later "Practice
this" play-along variants). **Constitution**: II (generated from formulas), IV (owner-written
explanation text), VIII (any instrument), XIII (nothing locked, profile-scoped data), VI (offline).
**Lesson stages**: none directly. The handbook sits beside the lessons and links into Read and Drill.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Handbook (Priority: P1) *[core]*

The user opens **Handbook** and browses by section: Scales and modes, Chords, Arpeggios,
Intervals, Progressions, Keys, Circle of fifths, Glossary. Each entry opens on a page that shows
its facts (formula, spelled notes, degrees or functions, related entries), the user's active
instrument neck with the entry on it, and a short explanation if one exists.

**Why this priority**: the reference itself. Everything else builds on an entry page.

**Independent Test**: on a fresh profile with a 6-string guitar in Drop D, open one entry of every
type, and verify the facts against theory fixtures and the positions against 001 FR-008.

**Acceptance Scenarios**:

1. **Given** a 5-string bass (BEADG) is the active instrument, **When** the user opens "Dorian",
   **Then** the neck shows 5 strings with every Dorian position for the current root in the visible
   window, and the facts show the formula 1 2 b3 4 5 6 b7 and the spelled notes.
2. **Given** the user opens the chord "Cm7b5", **Then** the facts show C E♭ G♭ B♭ with functions R
   b3 b5 b7, the inversions it has (root position, 1st, 2nd, 3rd), and links to the arpeggio
   entry "Cm7b5 arpeggio" and to the keys in which it is diatonic.
3. **Given** the user opens the progression "ii–V–I", **Then** it shows the chords in the current
   key with Roman numerals and chord symbols (Dm7 G7 Cmaj7 in C major), and each chord links to its
   chord entry.
4. **Given** the user opens the circle of fifths, **When** they select a key, **Then** the key's
   signature, relative key, neighbouring keys (one step either way on the circle) and diatonic chords are shown, and the key entry is
   one tap away.
5. **Given** an entry has no owner-written explanation yet, **Then** the page shows its generated
   facts only. There's no placeholder text and no empty box.
6. **Given** A♭maj7 on a 5-string bass in v0.1, **Then** every A♭, C, E♭ and G in the window is
   shown, the root is marked by shape, and a position window of frets 3–6 can be selected.
7. **Given** Dorian, **When** the user activates the fact label "b3", **Then** its definition shows
   in place, and focus returns to the label when it closes.

---

### User Story 2 - Make Any Entry Interactive (Priority: P1) *[core]*

On any entry the user can transpose to any root or key, switch labels (note names, degrees or
functions, fingers where a fingering exists, none), change the view (whole neck, a position
window, or 3 notes per string for 7-note scales), play it as audio, and flip to left-handed. These
are the same controls as 001's explorer, so nothing is new to learn.

**Why this priority**: an interactive handbook is the point. A static page is just a book.

**Independent Test**: for one entry of each type, change the root, labels, view and instrument, and
check that the neck, the facts and the audio all follow.

**Acceptance Scenarios**:

1. **Given** "Mixolydian" in G, **When** the user transposes to E♭, **Then** the notes respell
   (E♭ F G A♭ B♭ C D♭), the neck updates, and the address of the page reflects E♭.
2. **Given** a scale in a 4-fret position window of frets 5–8, **When** labels are set to Fingers,
   **Then** each position shows its finger number following FR-014 of this spec, and the labels stay readable
   in the left-handed view.
3. **Given** any entry, **When** the user presses Play, **Then** sound starts within 150 ms (p95),
   the pitches match the positions shown (octave included), and the sounding position is
   highlighted as it plays.
4. **Given** the chord entry "C" and the 1st inversion is selected, **Then** E is marked as the
   bass note with a shape (not only colour), and playback sounds E as the lowest note.
5. **Given** the device can't start audio until the user interacts (browser autoplay rules),
   **Then** the first press of Play starts audio, and nothing is shown as broken.

---

### User Story 3 - Search (Priority: P1) *[core]*

A search box is always one tap away in the Handbook. The user types "Am7", "dorian", "2 5 1",
"b flat blues", "dorain" (a typo) or "tritone" and gets the right entry first. A query with a root
("A dorian", "Bb7") opens the entry already transposed.

**Why this priority**: mid-practice the user knows *what* they want, not where it lives.

**Independent Test**: run the search fixture (SC-002) and time each keystroke.

**Acceptance Scenarios**:

1. **Given** the query "Am7", **Then** the first result is the chord entry m7 with root A, and
   opening it shows A C E G.
2. **Given** the query "2 5 1" (or "ii V I", "251", "two five one"), **Then** the first result is
   the ii–V–I progression.
3. **Given** the query "dorain", **Then** Dorian is within the first 3 results, with a "did you mean"
   hint.
4. **Given** a query with no match, **Then** the user sees "no results", up to 3 near matches, and a
   link to browse sections. Never a blank screen.

---

### User Story 4 - Learn This, Practice This (Priority: P1) *[core]*

Each entry has **Learn this** (the related lesson in the user's active curriculum pack) and
**Practice this** (a drill already set up for the entry, in the current root, on the active
instrument).

**Why this priority**: it turns looking something up into practising it, which is the product's
promise.

**Independent Test**: crawl every entry type and check that each button opens the expected lesson
or drill, or the defined fallback (SC-009).

**Acceptance Scenarios**:

1. **Given** the chord entry "Bm7", **When** the user taps Practice this, **Then** the chord-tone
   drill opens with root B, quality m7, and the active instrument's strings and fret window.
2. **Given** the scale entry "E minor pentatonic", **When** the user taps Practice this, **Then** a
   note-finding drill opens limited to E G A B D.
3. **Given** the active pack has two lessons tagged with the entry's topic, **When** the user taps
   Learn this, **Then** both are listed and either opens at the user's preferred stage (001 FR-064).
4. **Given** no lesson in the active pack matches, **Then** lessons from the user's other packs are
   offered. If there are none, the button reads "No lesson yet" and is not a dead end (it explains
   and offers Practice this).

---

### User Story 5 - Favourites (Priority: P2) *[core]*

The user stars entries. A favourite remembers the entry *and* its state: root or key, view,
labels and, for voicings, the chosen shape. Favourites appear at the top of the Handbook.

**Why this priority**: practice returns to the same few things every day.

**Independent Test**: favourite five entries in different states, switch profile and back,
export and re-import the profile, and verify that all five reopen in the saved state.

**Acceptance Scenarios**:

1. **Given** "A Dorian, position 5–8, degree labels" is favourited, **When** opened from
   Favourites, **Then** it opens in exactly that state on the active instrument.
2. **Given** the favourite was saved on a guitar and the active instrument is now a bass, **Then**
   it opens on the bass with the same root and labels, and a position window that doesn't fit is
   replaced by the whole neck, with a notice.

---

### User Story 6 - Chord Voicing Finder (Priority: P2) *[complete]*

For any chord, inversion and active instrument, the user sees every playable shape, ranked by
playability, and can filter by neck region, string set, voicing kind, inversion and
"open strings allowed". Each shape shows fingers, can be played, and can be favourited or added to
a cheat sheet.

**Why this priority**: the most common question a player asks a chord book, answered for their own
tuning and string count, which a book can't do.

**Independent Test**: run the voicing fixture (SC-005) on the standard-tuning guitar, Drop D,
DADGAD, 4-string and 5-string bass presets, and on random instruments.

**Acceptance Scenarios**:

1. **Given** Cmaj7 on a 6-string in standard tuning, **Then** every listed shape contains C, E and
   B (G may be omitted per FR-023), respects the stretch limit, and the top results include the
   common open and barre shapes in the golden set.
2. **Given** a 4-string bass, **Then** shapes of 2–4 notes are offered, double-stops and shells
   first, and the user can switch to "arpeggio shapes" instead.
3. **Given** filters leave no playable shape, **Then** the user is told which filter to relax.
4. **Given** the user changes the stretch limit from 4 to 5 frets, **Then** the list updates within
   300 ms (p95) and the change is saved in their settings.

---

### User Story 7 - Progression Explorer (Priority: P2) *[complete]*

The user picks a key and a progression, then presses play. A backing loop plays the chords at a
chosen tempo and feel. The neck shows the current chord's tones over a chosen solo scale, and the
page lists the scales that fit each chord and the whole progression.

**Why this priority**: "what do I play over this?" is the question that turns theory into music.

**Independent Test**: realise every built-in progression in all 15 keys of its mode against fixtures, and
measure loop timing over 5 minutes.

**Acceptance Scenarios**:

1. **Given** ii–V–I in B♭ major at 100 BPM, **When** the user presses play, **Then** Cm7 F7 B♭maj7
   loop with 4 beats per chord (as defined), the current chord is highlighted, and the neck marks
   chord tones distinctly from the other scale tones.
2. **Given** the 12-bar blues in A, **Then** each chord lists its "Fits every chord tone" scales (A
   Mixolydian over A7, D Mixolydian over D7, and so on), the whole-progression list says that no
   single scale fits every chord, and A minor pentatonic and A blues are listed separately as
   "Common choice (some notes clash)", with their clashing tones named and marked on the neck.
3. **Given** the loop is playing, **When** the user changes tempo, key or solo scale, **Then** the
   change takes effect at the next bar, with no gap in the audio.
4. **Given** playback stops because the phone's screen locked, **When** the user returns, **Then**
   it resumes from the start of the bar it stopped in.

---

### User Story 8 - Cheat Sheets and PDF Export (Priority: P3) *[complete]*

The user builds named cheat sheets from entries and favourites, orders them, adds their own short
notes, and exports a printable PDF that's legible on a music stand and in black and white.

**Why this priority**: a personal reference beats a generic chart, but it's a convenience built on
everything above.

**Independent Test**: build a 24-item sheet mixing every entry type, export it offline, and open it
in two PDF readers and as a greyscale print preview.

**Acceptance Scenarios**:

1. **Given** a sheet "Blues in A" with 6 items, **When** exported, **Then** the PDF shows each item
   as a diagram (neck or chord box for the active instrument at export time) with its title,
   formula, notes and the user's note, in the saved order.
2. **Given** the device is offline, **When** the user exports, **Then** the PDF is produced on the
   device with no network request.
3. **Given** a sheet has no items, **Then** export is unavailable, with a hint to add entries.

---

### Edge Cases

- **Theoretical keys and triple accidentals**: theoretical keys reached by a root (G♯, D♯ and A♯
  major) are spelled correctly (G♯ major has F𝄪) with a hint naming the common enharmonic key (A♭
  major). Any root and type that would need a triple accidental (001 FR-010), which can only be
  reached through a link or search with an unusual spelled root, shows the typed error as a notice
  and offers the enharmonic root. Black-key roots in the root picker follow the 001 FR-019 spelling
  toggle.
- **Instruments with few frets or unusual tunings** (12-fret travel guitar, 7- and 8-string guitars,
  6-string bass, DADGAD, open tunings): every entry renders. When no voicing fits, the finder says
  so and suggests widening the stretch or window. CAGED shapes are not offered because they assume
  standard tuning.
- **Bass playback on small speakers**: low B (≈ 31 Hz) is inaudible on laptop speakers. A "play an
  octave up" setting exists (default off), and the first bass playback shows a one-time hint about
  it.
- **Audio unavailable** (no output device, context blocked): the entry works without sound, with a
  non-blocking notice. Play is never shown as working when it can't.
- **Extended chords**: an entry's formula always shows every tone. Voicings may omit tones only per
  FR-023, and say which tone is omitted.
- **Favourite or sheet item that no longer resolves** (e.g. a catalogue item renamed in a later
  version): it shows as "unavailable" with its saved title, and can be removed. It is never
  silently dropped.
- **Deleted instrument**: favourites and sheets aren't tied to an instrument. They render on the
  active instrument.
- **Invalid links** (unknown entry, bad root, a window outside the fret count): fall back to the
  entry's defaults with a notice, or to "not found" with a link to browse (as in 001's route
  contract).
- **Very large sheet**: more than 100 items is refused with a message (FR-033).
- **Mic and camera**: never used by this feature; no permission is ever requested.
- **First visit with no instrument chosen**: a handbook deep link (from a shared link or the landing
  page's feature tour) renders at once on the 6-string guitar Standard preset, with a non-modal
  "Shown on 6-string guitar · Change" control. Nothing blocks the entry. This is a preview on an editable preset, not an assumed default
  (Constitution XIII): the Change control is always visible, and only an explicit Change saves an instrument; staying on the
  preview never does. Practice this, Learn this and Favourite from the preview open 001's
  instrument picker first (001 FR-053).
  Other routes keep 001's instrument-picker-first rule (001 FR-053).

## Requirements *(mandatory)*

### Functional Requirements

**Catalogue and content** *[core unless marked]*

- **FR-001**: The handbook MUST contain these entry types: scale or mode, chord, arpeggio,
  interval, progression, key, the circle of fifths (one interactive entry), and glossary term.
- **FR-002**: Every note, spelling, degree, function, fretboard position and voicing shown MUST be
  computed by the theory engine from formulas (Constitution II). Catalogue definitions MUST contain
  only names, aliases, formulas (intervals or degrees), Roman numerals, chord qualities, mode,
  beats per chord, style-scale references and topic tags. A build-time check MUST reject a
  definition that lists absolute notes. Topic tags MUST be validated against the 001 FR-068
  vocabulary at build time.
- **FR-003**: *[core]* The scale catalogue MUST include 001 FR-003's 12 scale types. *[complete]*
  It MUST add these 12, each
  defined by its formula (degrees relative to the major scale on the same root):

  | Scale | Formula | | Scale | Formula |
  |-------|---------|-|-------|---------|
  | Major blues | 1 2 b3 3 5 6 | | Locrian natural 2 | 1 2 b3 4 b5 b6 b7 |
  | Phrygian dominant | 1 b2 3 4 5 b6 b7 | | Altered | 1 b2 b3 b4 b5 b6 b7 |
  | Dorian b2 | 1 b2 b3 4 5 6 b7 | | Harmonic major | 1 2 3 4 5 b6 7 |
  | Lydian augmented | 1 2 3 #4 #5 6 7 | | Whole tone | 1 2 3 #4 #5 b7 |
  | Lydian dominant | 1 2 3 #4 5 6 b7 | | Diminished half-whole | 1 b2 #2 3 #4 5 6 b7 |
  | Mixolydian b6 | 1 2 3 4 5 b6 b7 | | Diminished whole-half | 1 2 b3 4 b5 b6 6 7 |

  Each 7-note scale follows 001 FR-004 (one letter per degree, so C altered is C D♭ E♭ F♭ G♭ A♭
  B♭). The 6- and 8-note scales are spelled exactly by their formulas (C whole tone: C D E F♯ G♯
  B♭; C half-whole: C D♭ D♯ E F♯ G A B♭). This extends 001 FR-006's degree labels with #2 and b4.
- **FR-004**: *[core]* The chord catalogue MUST include 001 FR-005's 12 qualities. *[complete]* It
  MUST add these 18, with
  canonical symbols shown for C and formulas as chord-tone functions: C5 (1 5), C6 (1 3 5 6), Cm6
  (1 b3 5 6), C6/9 (1 3 5 6 9), Cm(maj7) (1 b3 5 7), C7sus4 (1 4 5 b7), C7#5 (1 3 #5 b7), C7b5
  (1 3 b5 b7), C9 (1 3 5 b7 9), Cmaj9 (1 3 5 7 9), Cm9 (1 b3 5 b7 9), C7b9 (1 3 5 b7 b9), C7#9
  (1 3 5 b7 #9), C7#11 (1 3 5 b7 #11), C11 (1 3 5 b7 9 11), Cm11 (1 b3 5 b7 9 11), C13 (1 3 5 b7 9
  13; the 11th is not part of the formula), Cmadd9 (1 b3 5 9). This extends 001 FR-006's function
  labels with 6, b9, #9, 11, #11 and 13.
- **FR-004a**: Chords with 3 or more distinct tones MUST list their inversions: root position plus
  one per remaining chord tone, up to the 3rd inversion. Dyads (C5) have none. The inversion's bass
  note MUST be shown in slash notation (C/E). A slash in a canonical quality (6/9) is part of the
  quality, never a bass note, because a slash bass is always a note name. Inversions of 6 chords
  are named as 6 chords (C6/A), and the entry notes the enharmonic chord (Am7).
- **FR-005**: There MUST be one arpeggio entry per chord quality (FR-004), generated from that
  chord's formula, playable over 1–3 octaves where the instrument's range allows.
- **FR-006**: The interval catalogue MUST include exactly these 23 intervals: P1, m2, M2, A2, m3,
  M3, P4, A4, d5, P5, A5, m6, M6, d7, m7, M7, P8 (with the enharmonic pairs A2/m3, A4/d5, A5/m6 and
  M6/d7 explained), and the compound intervals m9, M9, P11, A11, m13 and M13. Each interval entry MUST show every shape of that interval from a chosen root within the
  visible window, on the same string and across strings.
- **FR-007**: The progression catalogue MUST include at least: I–IV–V, I–V–vi–IV, ii–V–I (major),
  iiø–V–i (minor), I–vi–IV–V, vi–IV–I–V, I–vi–ii–V, iii–vi–ii–V, i–iv–v, i–VII–VI–V (Andalusian;
  the V is borrowed from harmonic minor and labelled as borrowed), I–♭VII–IV (♭VII borrowed from
  Mixolydian, labelled as borrowed), the 8-bar blues (I–V–IV–IV–I–V–I–V, one bar each), the 12-bar
  blues (with a quick-change option), the minor 12-bar blues, and I–V–vi–iii–IV–I–IV–V. Roman
  numerals follow 001 FR-007's conventions (natural minor uses VI and VII without flats). Each
  definition gives Roman numerals, chord qualities, beats per chord and its mode (major or minor).
  Each MUST be realisable in all 15 keys of its own mode (001 FR-007).
- **FR-008**: Key entries MUST cover the 30 keys of 001 FR-007 (signature, scale, diatonic triads
  and sevenths, relative and parallel keys) and link to 001's key helper.
- **FR-009**: The circle-of-fifths entry MUST show the 15 major and 15 minor key signatures
  (enharmonic keys B/C♭, F♯/G♭, C♯/D♭ shown as pairs), relative minors on an inner ring, and,
  for the selected key, its neighbours and its diatonic chords. It MUST be operable by touch, mouse
  and keyboard: Left and Right move around the ring, Up and Down switch between the major and minor
  rings, and Enter opens the key entry. Each key is announced as its name, signature and relative
  key ("G major, 1 sharp, relative minor E minor"), and this is part of SC-010's keyboard run.
- **FR-010**: Explanation text MUST be owner-written (Constitution IV), stored as validated content
  files keyed by entry id. An unknown id or schema error MUST fail the build. Explanation text MUST
  NOT be copied from books or websites. Curriculum packs MAY reference a book's chapter numbers and
  titles only (001 FR-063). Before v0.1 ships, these 9 beginner entries MUST have explanation text:
  the major and natural minor scales, the major and minor pentatonic scales, the blues scale, the
  major, minor and 7 chords, the I–IV–V progression and the 12-bar blues. Every other entry MAY ship
  with generated facts only (FR-011) and gain text over time.
- **FR-011**: An entry without explanation text MUST show its generated facts only, with no
  placeholder or empty section. A build report MUST list explanation coverage per entry type.
- **FR-012**: The glossary MUST contain owner-written definitions for every section name, entry
  type, label mode and control label in this feature, and for every degree, function and interval
  label the catalogue uses, including b4 and #9, which have no interval entry of their own. A
  build-time check verifies this. Individual
  scale and chord names are explained on their own entries, not in the glossary. Each term MAY link
  to related entries. Glossary coverage is required for v0.1.
- **FR-012a**: Every fact label (formula, degree, function, interval name) MUST open its glossary
  definition in place, in one tap or key press, without leaving the entry.

**Interactivity** *[core]*

- **FR-013**: Every entry with notes MUST render on the active instrument's neck with 001's display
  settings (window, handedness, text size, fret spacing; FR-014–FR-021, FR-062), and every root
  position MUST be marked by shape as well as colour (001 FR-013). An entry opens with the
  profile's saved label mode, window and handedness (001 FR-021) unless its link or favourite
  specifies otherwise. With no saved choice, labels default to note names, and scales and
  arpeggios open in the first 4-fret position window that contains the lowest root (not the whole neck).
  The last choice per entry type is saved. The defaults are covered by a test.
- **FR-013a**: A chord entry's neck MUST show every chord tone in the visible window, with the root
  and the selected inversion's bass note marked by shape, and MUST offer a 4–6-fret position-window
  view.
- **FR-014**: Labels MUST switch between note names, degrees or functions, fingers, and none. The
  Fingers option MUST be offered only when the current view has a fingering. *[core]* fingerings
  exist for scale and arpeggio position windows exactly 4 frets wide: within a window starting at
  fret *s*, a fretted note at fret *f* uses finger 1 + (*f* − *s*); open strings show "0". Wider
  windows offer no Fingers option.
  *[complete]* fingerings for chord voicings come from the voicing finder (FR-022). Fingers labels
  MUST be titled "Suggested fingering". The core rule applies to every instrument. Bass-specific
  fingering (such as 1-2-4 in low positions) comes with the voicing and fingering work in
  *[complete]*.
- **FR-015**: Scale and arpeggio entries MUST offer three views: whole neck (within the visible
  window), a position window of 4–6 frets starting at any fret, and, for 7-note scales, 3 notes per
  string (each string takes the next 3 scale tones in pitch order, starting from a chosen
  position).
- **FR-016**: Every entry MUST be transposable from the root picker to any of the 12 roots, using
  001 FR-019 spelling for black-key roots. Links and search MAY name any of the 21 spelled roots
  (7 letters × ♭, ♮, ♯). Key entries MUST be transposable to any of the 30 keys, and progressions to
  any of the 15 keys of their own mode.
- **FR-017**: Every entry with notes MUST be playable: scales and arpeggios ascending then
  descending in pitch order through the shown positions; chords strummed low to high (spread
  adjustable 0–100 ms, default 30 ms) or as a block; intervals melodic (up, down) and harmonic;
  progressions as one pass of the chords. Tempo MUST be adjustable from 40 to 240 BPM (default 80).
  Pitches MUST match the shown positions, octave included. *[core]* sound goes to the system's
  default output. From v0.2, it follows 015's output selection (015 FR-017).
- **FR-018**: Playback MUST start within 150 ms of pressing Play (p95), and the sounding position
  MUST be highlighted within ±30 ms of its scheduled onset. Playback MUST be stoppable at any time,
  MUST have volume and mute controls, and MUST offer "play bass an octave up" (default off). The
  sounding-position highlight MUST change size or outline as well as colour. An "Announce notes
  during playback" setting (default off) reads the string, fret and note politely.
- **FR-019**: Every entry state (entry, root or key, view, window, labels, inversion, added bass note, voicing) MUST
  be addressable by a shareable link. Invalid parameters MUST fall back to defaults with a notice.
  Parameters are validated as in 001's route rules.

**Search** *[core]*

- **FR-020**: Search MUST index entry names, canonical symbols and aliases (e.g. Am7, A-7, Amin7,
  "A minor seven"; Roman-numeral and number forms of progressions such as "ii V I", "2 5 1", "251",
  "two five one"; mode names and their alternative names), and glossary terms. It MUST match case-
  and accidental-insensitively (b, ♭, "flat"; #, ♯, "sharp"), tolerate up to 2 typing errors in
  words of 5 or more letters (1 in shorter words), and rank results: exact name or symbol, then
  prefix, then alias, then fuzzy match. A query that includes a root MUST open the entry in that
  root. Slash-chord queries (e.g. "C/E") MUST open the chord entry with that inversion selected.
  Queries that tie at the same rank across entry types MUST be grouped by type, with a visible type
  label, in the order Scale, Chord, Key, Progression, Arpeggio, Interval, Glossary.
- **FR-021**: Results MUST update within 100 ms of each keystroke (p95) on the reference devices
  named in 001's plan, offline. With no results, search MUST show up to 3 near matches and a link to
  browse. "/" MUST focus search anywhere in the Handbook unless focus is in a text field; this is
  listed in the Docs.

**Voicing finder** *[complete]*

- **FR-022**: For a chord, inversion and the active instrument, the voicing finder MUST list every
  shape that: sounds the inversion's bass note as its lowest note; contains every required tone of
  the chord (FR-023); uses at most 4 fretting fingers, where one finger may barre; stays within the
  stretch limit (a user setting, 3–6 frets, default 4);   and has no unplayed string between played strings unless "allow muted inner strings" is on
  (default off). Partial shapes relax the tone rule: a shell holds the root, the 3rd (or the 4th in
  sus chords) and the 7th (or the 6th); a double-stop holds any 2 chord tones including the 3rd or
  the 7th, and is labelled "partial". In a rootless voicing, "root position" means the lowest tone
  is the 3rd or the 7th. Each shape MUST show its
  fingering and kind (open, movable or barre, shell, drop 2, drop 3, triad on a string set,
  double-stop) and be playable.
- **FR-023**: Tones a voicing MAY omit: the 5th (unless it is altered: b5 or #5); in 11th chords,
  the 3rd and the 9th; in 13th chords, the 9th; the root only when "rootless voicings" is on
  (default off). An omitted tone MUST be named on the shape.
- **FR-024**: Shapes MUST be ranked by 005's fingering cost model (owner-written, part of the
  human-owned fingering core, Constitution IV), with ties broken by lower fret
  position and then by more sounding strings. The ranking MUST be deterministic for the same
  inputs.
- **FR-025**: Users MUST be able to filter by fret region, string set, kind, inversion and "open
  strings allowed". When filters leave no result, the finder MUST name the filter or setting to
  relax.
- **FR-026**: On bass, the finder MUST offer shapes of 2–4 notes (double-stops and shells first) and
  a switch to arpeggio shapes.

**Progression explorer** *[complete]*

- **FR-027**: Users MUST be able to choose a progression (FR-007), a key and a tempo (40–240 BPM),
  and play a backing loop of the chords, with a choice of at least 3 accompaniment patterns
  (sustained, strummed eighths, arpeggiated) plus an optional click and an optional bass root. The
  current chord MUST be highlighted. Changes to tempo, key, pattern or solo scale MUST take effect
  at the next bar with no gap.
- **FR-028**: For each chord, the explorer MUST list "Fits every chord tone" scales from the FR-003 catalogue,
  rooted on the chord's root or on the key's tonic, that contain every chord tone. For the whole
  progression it MUST list the scales rooted on the tonic that contain every tone of every chord;
  when there are none, it MUST say so. Labelled separately as "Common choice (some notes clash)",
  it MUST list the progression's style scales from its definition (e.g. minor pentatonic and blues
  over a 12-bar blues), naming each one's clashing tones and marking them on the neck with a
  distinct shape. Both labels are covered by the FR-012 glossary check.
- **FR-029**: While the loop plays, the neck MUST show the chosen solo scale with the current
  chord's tones marked by shape and colour, updated at each chord change.
- **FR-030**: Loop timing MUST NOT drift more than 5 ms from the tempo grid over 5 minutes at
  120 BPM, measured on the rendered audio output (onsets detected in a captured buffer).

**Links to lessons and drills** *[core]*

- **FR-031**: **Practice this** MUST open a drill already set to the entry, its root and the active
  instrument:

  | Entry | Drill (001) |
  |-------|-------------|
  | Scale or mode | Note-finding (FR-030, FR-031), note set limited to the scale |
  | Chord | Chord-tone drill (FR-036) for that root and quality |
  | Arpeggio | Arpeggio drill (FR-057) |
  | Interval | Interval drill (FR-035) for that interval |
  | Progression | Chord-tone lock (FR-059); on bass, the walking-bass drill (FR-058) is also offered |
  | Key | Chord-tone drill over the key's diatonic chords |
  | Circle of fifths, glossary term | No drill of their own; they link to the related entry, which has Practice this |

  To make every row work, this feature extends 001's drills (a cross-spec change that the owner
  approves in clarify): the note-finding drill accepts a "scale" note set of any spelled notes
  (including C♭, F♭, E♯, B♯ and double accidentals); the interval drill accepts every FR-006
  interval; the chord-tone drill accepts an explicit list of (spelled root, quality) chords,
  including E♯, B♯ and double-accidental roots, as well as every FR-004 quality; the arpeggio drill
  accepts every FR-004 quality, with its range extended up to the chord's highest tone (two octaves for 9th, 11th and 13th chords), widening the drill's fret window to fit and saying so
  when the default window is too small; and the chord-tone lock and walking-bass drills accept
  progressions of up to 16 bars, with one chord per bar or longer (no built-in progression splits
  a bar).
- **FR-032**: **Learn this** MUST list the lessons in the active pack whose topic tags (001 FR-068)
  match the entry's tags. If there are none, it MUST offer matching lessons in the user's other
  packs, and if there are still none it MUST say "No lesson yet" and offer Practice this. Nothing
  is locked (Constitution XIII): any listed lesson opens. Each result MUST show its pack name and
  chapter reference (001 FR-063). Opening a lesson from another pack MUST NOT change the active
  pack.

**Favourites and cheat sheets**

- **FR-033**: *[core]* Users MUST be able to favourite any entry together with its state (FR-019),
  and see and reorder favourites. *[complete]* Users MUST be able to create, rename, reorder,
  duplicate and delete named cheat sheets of up to 100 items. Each item is an entry state plus an
  optional user note of up to 280 characters. Favourites MUST have an empty state (one sentence
  plus "Star any entry to keep it here"). Reordering favourites and sheet items MUST work by
  keyboard (Move up and Move down, plus Alt+Arrow) and by touch without dragging, and the new
  position is announced ("Moved to 2 of 6").
- **FR-034**: *[complete]* A cheat sheet MUST export to PDF on the device, offline, in A4 or Letter
  (default from the device locale), with each item as a neck diagram (or chord box for voicings)
  for the active instrument at export time, its title, formula, spelled notes and the user's note.
  It MUST remain legible in greyscale, because shapes and labels carry the meaning, not colour.
  When a saved window doesn't fit the export instrument, the item carries a caption ("Shown on whole
  neck: saved window doesn't fit 5-string bass").
- **FR-035**: Favourites and cheat sheets MUST be profile-scoped, sync-ready records (001 FR-066:
  global ids, timestamps, schema version, tombstones), merged by 001 FR-066a, and included in the
  profile export (016 FR-004). An item that no longer resolves MUST show as "unavailable" and
  remain removable.
- **FR-036**: *[core]* The playback tempo and the "bass an octave up" choice MUST be saved in the
  profile's settings (001 FR-067). *[complete]* The voicing-finder settings (stretch limit, muted
  inner strings, rootless voicings) MUST be saved there too.

**Quality** *[core]*

- **FR-037**: Every handbook screen, playback and (when shipped) PDF export MUST work offline after
  the first load, and MUST make no network request.
- **FR-038**: Every handbook screen MUST meet 001's accessibility rules (FR-047–FR-049): no
  page-level horizontal scroll at 390 px, keyboard operation including search results and the
  circle of fifths, and a text alternative for every neck and chord box (a list of string, fret,
  note and label).
- **FR-039**: Opening an entry from search or browse MUST render its neck within 300 ms (p95) on
  the reference devices.

**Chord-symbol lookup** *[core]*

- **FR-040**: System MUST parse a single chord symbol (root, a quality from FR-004, and an optional
  slash bass) into an entry state, or return a typed error. A slash bass that is a chord tone
  selects that inversion. A slash bass that isn't a chord tone (C/D, Am/G) is kept as an added bass
  note in the entry state: the neck marks it by shape, playback sounds it lowest, and the voicing
  finder requires it as the lowest note. The parser is shared with 005 and
  covered by a fixture.

### Key Entities

- **Catalogue item**: a definition from FR-003–FR-009: id, type, names and aliases, formula or Roman
  numerals and durations, topic tags, style scales (progressions only). Shipped content, not user
  data.
- **Handbook entry**: a catalogue item realised by the theory engine for a root or key and an
  instrument. Derived, never stored.
- **Entry state**: entry id plus root or key, view, window, labels, inversion, added bass note and
  voicing id. This is
  what links, favourites and sheet items hold.
- **Explanation**: owner-written text for one entry id. Shipped content.
- **Voicing**: a derived shape: positions, fingers, kind, omitted tones, cost. Its id is
  deterministic from its positions and the instrument's geometry.
- **Favourite**: profile-scoped, sync-ready: entry state, order key.
- **Cheat sheet**: profile-scoped, sync-ready: name, ordered items (entry state and an optional
  note).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of catalogue items, realised on all 21 spelled roots (7 letters × ♭, ♮, ♯) and
  all 30 keys where applicable, match the theory fixtures (expected typed errors included), as
  checked by theory-checker.
- **SC-002**: On a search fixture of at least 200 queries: 100% of exact names and symbols return
  the expected entry first, ≥ 95% of alias, typo and number-form queries return it in the top 3,
  and per-keystroke latency is within FR-021. The fixture includes at least 20 ambiguous queries
  ("A minor", "b flat blues") with their expected grouped order, passing 100%.
- **SC-003**: Every entry type renders correctly (positions per 001 FR-008) on every built-in
  instrument preset and on at least 100 randomly generated valid instruments, with no errors.
- **SC-004**: In timed runs with at least 5 testers (the owner and at least one other person),
  finding a named scale in a named key and playing it takes ≤ 30 s at the median, starting from
  Home.
- **SC-005**: *[complete]* On a voicing fixture of at least 50 (chord, inversion, instrument)
  cases, 100% of returned shapes satisfy FR-022 and FR-023, and for the standard-tuning guitar
  cases the owner-approved golden shape is in the top 3 for ≥ 90% of cases.
- **SC-006**: *[complete]* All FR-007 progressions realise correctly in all 15 keys of their mode
  (fixture),
  and the loop meets FR-030 in an automated 5-minute run.
- **SC-007**: *[complete]* A 24-item cheat sheet exports to PDF in ≤ 10 s on the reference laptop,
  offline, and opens correctly in at least 2 PDF readers.
- **SC-008**: An automated offline crawl of every handbook route records 0 network requests after
  the first load.
- **SC-009**: A crawl of every entry type and state finds 0 dead ends: every Practice this and Learn
  this opens a drill, a lesson, a lesson list or the defined fallback.
- **SC-010**: 0 serious or critical automated accessibility violations on every handbook screen,
  and a keyboard-only run of search → entry → play → favourite completes.

## Assumptions

- The theory engine is extended (not forked) for the new scales, chords, intervals and
  progressions. Every addition goes through theory-checker.
- 001's display settings, drills and route rules are reused, not re-specified.
- Playback is synthesised on the device. No recorded samples of copyrighted material are used.
  The sound design is a plan decision.
- PDF generation runs on the device. The method is a plan decision (ADR).
- The single-symbol chord lookup (FR-040) is the one 005 extends to parse chord sheets.
- The latency targets (FR-018, FR-021, FR-039) can be benchmarked only once 001's reference devices
  are fixed (001 plan, open items O1 and O2).
- Cross-spec changes this feature needs, for owner approval: 001's drill sets (FR-031), 001 FR-006 label sets (FR-003, FR-004), the deep-link exception to 001 FR-053 (Edge Cases),
  and 016 FR-004's export list gaining favourites and cheat sheets
  (FR-035).
- Guitar-specific shape systems that assume standard tuning (CAGED) are out of scope; 3 notes per
  string and position windows work on any instrument.
- Owner-written content (explanations, glossary) lives under `content/handbook/`, next to
  `content/lessons/`. The exact layout is decided at plan time.

## Clarifications

### Session 2026-11-22 (owner accepted every recommended answer)

- Q: Must every core entry have explanation text before v0.1? → A: No. 9 beginner entries must
  (FR-010); every other entry may ship with generated facts only. Glossary coverage is required
  (FR-012).
- Q: Do the 12 extra scales and 18 extra chords ship in v0.1 or v0.3? → A: v0.3 (*[complete]*).
  Core uses 001's catalogue (FR-003, FR-004, Release).
- Q: Is handbook text protected like lesson prose? → A: Yes. Constitution IV and CLAUDE.md rule 7
  now cover `content/handbook/` (part of the v2.3.0 amendment, ADR-0011, still Proposed).
- Q: Who owns the voicing finder? → A: The fingering cost model is owner-written as part of 005 and
  joins the human-owned list. The shape enumerator may be agent-implemented, verified against brute
  force on small inputs. FR-022–FR-026 stay provisional until 005 is specified.
- Q: Approve the changes this feature needs in other specs (001 drill sets and label lists, 016
  FR-004's export list)? → A: Approved. They are applied when 017 is planned, so 001's drafted
  tasks don't change now.
- Q: PRODUCT.md says "100% of the search fixture" for v0.1; SC-002 allows ≥ 95% top-3 for fuzzy
  queries. → A: PRODUCT.md now says "meets 017 SC-002".
- Q: Should deep links render before an instrument is chosen? → A: Yes, deep links only, on the
  6-string guitar Standard preset with a non-blocking Change control (Edge Cases).
- Q: Confirm the numbers: playback start 150 ms, search 100 ms per keystroke, entry render 300 ms,
  loop drift 5 ms? → A: Confirmed (FR-018, FR-021, FR-039, FR-030).
