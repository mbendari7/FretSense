# Feedback: Reference Handbook (017), mode A, 2026-11-22

Spec walkthrough of `specs/017-reference-handbook/spec.md` (Draft, 2026-11-21), read against
`docs/PRODUCT.md`. Personas: Priya, Alex, Maya, Dev, Sam.

## Summary
- Overall: 4/5 stars. The data model, search and "Practice this" table are excellent, but the
  v0.1 (core) handbook could ship as a numbers-only reference that beginners can't read, with
  chord pages that don't answer the question the spec says it exists to answer.
- Top 3 problems:
  1. In v0.1, chord entries have no fingering. The spec's own practice-session value ("what's the
     fingering for A♭maj7 on my 5-string?") is only answered in v0.3, and the core chord page's
     neck view isn't defined (finding 1).
  2. Explanation text is optional (FR-010 open question, FR-011). Maya opens "Dorian" and gets
     "1 2 b3 4 5 6 b7" and nothing else, with no default labels or view chosen for her (findings 2
     and 3).
  3. Ambiguous queries ("A minor", "C major", "b flat blues") match a scale, a chord, a key and a
     progression equally, and the ranking rules and SC-002 don't say what comes first (finding 4).
- What worked well: generated-from-formulas content (FR-002) with a build check. The "2 5 1",
  "251" and "two five one" aliases and the typo tolerance. The FR-031 table that gives every entry
  type a drill or a defined fallback. Bass getting double-stops, shells and walking bass first.
  Root and bass note shown by shape, not only by colour. The one-time "play an octave up" hint for
  low B on laptop speakers. No mic or camera ever requested.

## Findings
| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|
| 1 | Sam, Dev | MAJOR | Practice-session value; US1; FR-014; FR-022 *[complete]* | I open "A♭maj7" in v0.1 to find a shape. The voicing finder is v0.3 and FR-014 gives chords no fingers in core. US1 never says what a core chord page puts on the neck: every chord tone over the whole neck? | Either one playable shape, or a clearly defined "chord tones on the neck" view that's still useful mid-practice. | In *[core]*, a chord entry's neck shows every chord tone in the visible window, with the root and the selected inversion's bass note marked by shape, and a position-window view (4–6 frets) so I can pick out a shape. The practice-session value is split per release, so v0.1 doesn't promise fingerings. |
| 2 | Maya | MAJOR | US1 AS5; FR-010 (NEEDS CLARIFICATION); FR-011 | Facts-only pages are allowed. On "Dorian" I see "formula", "degrees", "b3", "b7" and "functions R b3 b5 b7", with no sentence telling me what any of it means or why I'd use it. | A sentence or two in plain words on the entries a beginner opens first, and a way to find out what "b3" means without leaving the page. | Before v0.1, every entry in a named beginner set (at least the major and minor scales, both pentatonics, blues, the major, minor and dominant 7 chords, I–IV–V and the 12-bar blues) has owner-written explanation text, and every fact label (formula, degree, function, interval name) opens its glossary definition in place, one tap or key press away. |
| 3 | Maya, Priya | MAJOR | US2; FR-014; FR-015 | No defaults are stated for labels or view. If Dorian opens as the whole neck with degree labels, Maya sees about 40 dots of "b3" and "6" and leaves. | Sensible defaults that suit a first-time reader. | Each entry type has documented defaults: labels default to note names, and scales open in the first position window (not the whole neck) unless the user changes it. Defaults are covered by a test. The user's last choice per entry type is remembered in profile settings. |
| 4 | Sam, Maya | MAJOR | US3; FR-020; SC-002 | "A minor" is an exact name for the natural minor scale, the Am chord and the A minor key, and arguably for the minor pentatonic too. "b flat blues" could be the scale or the 12-bar progression in B♭. The ranking rules (exact, then prefix, then alias, then fuzzy) give a tie, and SC-002's "expected entry first" isn't defined for ties. | I get the one I meant, or at least see clearly which result is which. | When a query matches more than one entry type at the same rank, results are grouped by type with a visible type label (Scale, Chord, Key, Progression), in a documented type order. The search fixture includes at least 20 ambiguous queries with their expected order. |
| 5 | Priya | MAJOR | Edge case "First visit with no instrument chosen"; FR-019 | Someone sends me a shared link to "A Dorian". A required instrument picker stands between me and the page, and I don't own an instrument. | The page I was sent, at once. | Opening any handbook link with no active instrument renders the entry right away on a default 6-string guitar in standard tuning, with a visible, non-modal "Shown on 6-string guitar · Change" control. No modal blocks the entry. |
| 6 | Alex | MAJOR | US1 AS4; FR-009; FR-038 | The circle of fifths "MUST be operable by keyboard", but there's no keyboard model and no screen-reader output. A ring with an inner ring is easy to get wrong. | Predictable arrow-key movement, and announcements I can understand. | The circle uses a documented pattern: Left and Right move around the ring, Up and Down switch between the major and minor rings, Enter opens the key entry. Each key is announced with its name, signature and relative key (for example "G major, 1 sharp, relative minor E minor"). This is covered by the SC-010 keyboard run. |
| 7 | Alex | MAJOR | US5; FR-033 (reorder favourites and sheet items) | "Reorder" usually means drag and drop, and no keyboard alternative is required. | I can reorder without a mouse. | Favourites and cheat-sheet items can be reordered with the keyboard (Move up and Move down actions, or an Alt+Arrow shortcut) and with touch without dragging. The new position is announced ("Moved to 2 of 6"). |
| 8 | Alex | MINOR | US2 AS3; FR-018 | The sounding position is "highlighted" during playback. It doesn't say how, so it could be a colour change only. A screen reader gets nothing while it plays. | A highlight that doesn't rely on hue, and an optional spoken readout. | The playback highlight changes size or outline as well as colour. An optional "announce notes during playback" setting reads each note (string, fret, note name). |
| 9 | Maya | MINOR | US7 AS2; FR-028 | "Strict fit", "style scales" and "clashing tones" are new jargon on the page that's meant to turn theory into music. | Plain words, such as "fits every chord" and "common choice, but these notes rub". | The labels are in plain words, each term has a glossary entry (FR-012 check), and every clashing tone is shown on the neck with a distinct shape, not only listed. |
| 10 | Dev | MINOR | US2 AS2; FR-014 | The core fingering rule (finger = 1 + fret − window start, clamped 1–4) is a guitar habit. On bass, a 4-fret window is usually played one finger per fret low on the neck, or with 1-2-4. | Bass fingers that match how bassists are taught, or at least no claim of a single "correct" fingering. | Fingers labels are presented as a suggested fingering. On instruments whose scale length is marked as bass, the core rule uses 1-2-4 below fret 5 (or the rule is documented as a known simplification in the entry's text alternative). |
| 11 | Sam | MINOR | US4 AS3–AS4; FR-032 | Learn this can list lessons from my *other* packs. It doesn't say whether opening one switches my active pack, or whether the list shows the book chapter each lesson maps to. | I see "Chapter 4: Modes" next to the lesson, and my active pack stays the same. | Each Learn this result shows its pack name and chapter reference (001 FR-063). Opening a lesson from another pack doesn't change the active pack. |
| 12 | Priya, Maya | MINOR | US5 ("Favourites appear at the top") | No empty state is given for a profile with no favourites. That's every first visit, and it risks an empty box at the top of the Handbook, which US1 AS5 bans elsewhere. | Either nothing, or one helpful line. | With no favourites, the Handbook shows one line, "Star any entry to keep it here", with a star icon, or hides the section. It never shows an empty panel. |
| 13 | Dev | MINOR | US5 AS2; US8; FR-034 | A favourite saved on guitar and exported in a cheat sheet while the bass is active falls back to the whole neck "with a notice". A PDF can't show a notice. | The PDF tells me the diagram changed. | When an item's saved window doesn't fit the export instrument, the PDF item says so in a small caption ("Shown on whole neck: saved window doesn't fit 5-string bass"). |
| 14 | Sam | IDEA | US3; FR-021 | Search is "one tap away", but there's no keyboard shortcut for practising at a laptop with a guitar on my lap. | Press "/" to search. | Pressing "/" anywhere in the Handbook focuses search, unless the focus is already in a text field. The shortcut is listed in the Docs. |
| 15 | Sam | IDEA | US4; FR-032 | Links go from an entry to a lesson, but not from my book's chapter to every handbook entry it covers. | "Chapter 6: everything in the handbook for this chapter". | A pack chapter view lists the handbook entries whose tags match it (the reverse of FR-032). Backlog candidate for 016 or 017 complete. |

## Persona quotes
> Priya: "Typing '2 5 1' and getting ii–V–I in the key I want, on a bass neck, with sound: that's
> the 'oh, this is real' moment. Just don't make me pick an instrument I don't own first."

> Maya: "I clicked Dorian and it's a row of numbers with 'b' in front of some. What's a b3? Why
> would I want this? I'd close the tab."

> Dev: "Finally a chord book that starts bass on double-stops and offers walking bass from a
> progression. The octave-up hint is a nice touch. The fingering rule is a guitarist's, though."

> Sam: "I typed 'C major' and need to know whether I'm looking at the chord, the scale or the
> key. And in v0.1 I can't actually look up a shape for A♭maj7, which is the thing I'd want."

> Alex: "Roots and bass notes by shape: great. The circle of fifths and drag-to-reorder are where
> keyboard users usually get stuck, and the spec doesn't say how they'll work."

## Metrics (Mode B)
Not applicable (mode A).
