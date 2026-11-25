# Spec 001 part: US3 Note-Finding Drill

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 3 - Note-Finding Drill (Priority: P1)

The app names a note and a string; the user taps where it is. Feedback is immediate. Accuracy and
response time are tracked per string.

**Why this priority**: Knowing the notes on the neck underpins everything else, and it is the drill
users will run most often, on guitar and bass.

**Independent Test**: Run 20 questions on the two lowest strings with a mix of right and wrong
answers, then verify the feedback and the per-string accuracy and median time.

**Acceptance Scenarios**:

1. **Given** the prompt "Find G on string 6, low E" (6-string Standard), **When** the user taps a
   string-6 position sounding a G, **Then** it is marked correct with feedback within the budget
   of FR-032.
2. **Given** the same prompt, **When** the user taps a wrong position on string 6, **Then** it is
   marked incorrect and the correct positions on string 6 are revealed until the user continues.
3. **Given** the same prompt, **When** the user taps a position on another string, **Then** the tap
   is ignored, a hint "Tap on string 6" appears, and nothing is recorded.
4. **Given** a completed session, **Then** the summary shows, per string and in total: number
   asked, accuracy %, and median response time.
5. **Given** the settings "naturals only", strings 1–3 and frets 0–5, **Then** every prompt
   satisfies all three constraints and has at least one valid answer.
6. **Given** the user's octave setting is "exact octave", **When** the prompt is "Find G3 on string 5, A" (6-string Standard, 22 frets), **Then** only string 5 fret 10 is correct and fret 22 (G4) is
   incorrect. With the default "any octave", both are correct.
7. **Given** a 20-question session with 8 answered, **When** the user taps End drill, **Then** the
   summary, marked "Ended early", shows those 8 per string and in total, the 8 attempts appear in
   progress, and the lesson's Drill stage is not marked complete (FR-028).
8. **Given** the saved label mode is "Note names", **When** a note-finding question is open,
   **Then** the neck shows no note text, every position's accessible name is reduced as in
   FR-032a (string and fret, "open" at fret 0, plus marker suffixes only), and after the answer the labels and full names return, with the saved label mode unchanged.
9. **Given** 5-string BEADG (20 frets) in exact-octave mode, **When** the prompt is "Find E1 on
   string 5, low B", **Then** only fret 5 is correct and fret 17 (E2) is incorrect.

## Requirements *(mandatory)*

### Functional Requirements

**Note-finding drill**

- **FR-030**: The drill MUST prompt a note and a string and accept taps on that string only. The
  prompt names the string by its number and its open note in the active tuning, spelled
  as the instrument's open-string notes (FR-051) so it matches the nut column (FR-032a), adding "low" or "high" for the lowest- and highest-pitched strings (e.g. "Find G on
  string 6, low E"; on 5-string bass "string 5, low B"; in Drop D "string 4, D"). The prompted
  string is marked on the neck by thickness or outline, not colour alone. Taps
  on other strings are ignored, with a hint. The octave mode is a per-user setting that applies to the note-finding drill only (the
  other drills judge as their own FRs state): "any octave"
  (default; a tap is correct if its pitch class matches) or "exact octave" (the prompt names an
  octave, e.g. "Find G3", and only that exact pitch is correct). In exact-octave mode, prompts are
  generated only for pitches that exist on the prompted string within the fret range (FR-061).
- **FR-031**: Settings MUST include strings (any subset of the active instrument's strings), fret range, question
  count (5–100, default 20), and note set: naturals (7); naturals + sharps (C# D# F# G# A#);
  naturals + flats (Db Eb Gb Ab Bb); all (17 spellings). Cb, Fb, E# and B# are never prompted. With no saved settings for this
  drill, the defaults are: note set naturals, all strings of the active instrument, frets 0–12
  (clamped to the fret count), the profile's octave mode, and 20 questions, on every instrument. In
  the UI the note sets are labelled "Letters only (A–G)", "Letters and sharps", "Letters and
  flats" and "All spellings", with the technical term as secondary text.
  Each string chip uses FR-030's string naming (e.g. "6, low E", "1, high E"; 5-string bass "5, low B"). Drill setup names the active instrument above the string chips, with a "Change" control that opens the instrument switcher (FR-016). (CR-B2-5, CR-B2-8) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-032**: Feedback MUST be visible within 100 ms of the tap at p95 (SC-002). It MUST use icon +
  text + colour and be announced to screen readers. After a correct answer, the next prompt follows
  after the profile's auto-advance choice: 600 ms (default), 1.5 s, or wait for Continue (WCAG
  2.2.1). The next prompt's announcement is queued after the feedback announcement and never
  interrupts it. After an incorrect answer, the correct positions stay visible until the user taps
  Continue. When feedback for an incorrect answer appears, the fretboard scrolls (instantly with "reduce motion", FR-049) so that the revealed correct position nearest the tapped position (fewest frets apart, then fewest strings, then lower fret) and the nut column are fully in view, together with the tapped position when both fit; when they do not both fit, the revealed position wins and the clipped-edge cue (FR-047) points toward the tapped position. Keyboard focus stays on the tapped position (FR-049) and is not moved by this scroll; the next focus move scrolls as usual. Other revealed positions outside the view are indicated by the clipped-edge cue. This scroll happens only after the answer is judged, so FR-032a is unaffected. *(code-reviewer T091–T093 r2 #3, provisional)* Within one question, the prompt, every label revealed in feedback and the feedback text
  and announcement MUST use the question's spelling: the prompted note (note-finding), the reference
  transposed by the interval (interval, FR-002), or the chord's spelling (chord-tone and bass drills,
  FR-005); other revealed positions use FR-060 relative to that note (in chord contexts, "that note" is the chord root). Feedback text uses FR-049's
  announcement wording (6-string Standard, prompt "B♭" ⇒ "Correct, B♭ on string 5 fret 1", never "A♯"; "B♭2" in
  exact-octave mode).
  *(FN-5, provisional)*
- **FR-032a**: While a drill question is unanswered (every drill in this spec, FR-030–FR-037 and
  FR-056–FR-059), the fretboard MUST NOT reveal the answer:
  - positions show no note, degree or function labels and no scale or chord highlights, whatever
    the saved label mode;
  - only the drill's own markers are shown: the prompted string, the interval reference, the
    window, and the user's own taps;
  - each position's accessible name is "String N, fret F" plus only those markers' suffixes (FR-013), except the interval reference, whose name also includes its note with octave in the question's spelling (FR-032), because that note is shown visibly and is part of the prompt (WCAG 2.5.3) *(r2 #7, owner-approved 2026-11-22)*, for example "String 6, fret 3, inside window";
  - the interval reference shows its note name;
  - in multi-step drills, only taps that have been judged show their labels;
  - once the question is answered, labels and full accessible names return for the feedback;
  - a drill never changes the saved label mode (FR-021);
  - the open-string name of every string is always shown at the nut column (FR-047): it is part of
    the instrument, not the answer. While a question is unanswered it is spelled exactly as the
    instrument's open-string notes (FR-051); once the question is answered, an open string keeps the instrument's spelling unless its pitch is one of the question's own notes (the prompted note, the interval reference or target, or a tone of the question's chord), in which case it takes that note's spelling, except where that spelling has a double accidental. FR-060 never applies to the nut column. *(CR-B2-3, owner-approved 2026-11-22)* While a question is open, a fret-0 position's accessible name is "String N,
    open" plus marker suffixes. *(FN-4, R3-2; owner-approved 2026-11-22)*
  - fret-0 positions are full answer targets wherever fret 0 is inside a drill's fret range, and in the explorer and key helper whenever fret 0
    is in the visible window: drawn at the nut column with the same minimum 44 × 44 CSS px target
    (FR-047), the same marker categories (FR-013) and at least the same 3:1 non-text contrast
    (FR-048) as fretted positions, never dashed, faint or outside the neck area, and visible while a
    question is open. A visual regression check at 390 px and 1280 px, in light and dark themes,
    covers it. *(A2-3, provisional)*
- **FR-033**: Response time MUST be measured in milliseconds from the moment the prompt is displayed
  to the answering tap.
- **FR-034**: The summary MUST show, per string and in total: number asked, accuracy %, and median
  response time (answers over 30 s excluded from times only). An "End drill" control MUST be
  available at any time. It shows the summary of the questions answered so far, marked "Ended
  early", and those attempts are kept. A session ended early counts as abandoned for FR-028. Median
  response time is shown as "Typical time" with "(median)" as secondary text. The summary also
  lists every missed question (prompt, the user's answer and the correct position, in the prompt's
  spelling) and offers "See progress" and "Back to drills" alongside "Practise again". A lesson's
  Drill stage is recorded complete when the last question is judged, before the summary is shown;
  leaving the summary by any link doesn't change it. "Back to drills" returns to the lesson's Drill
  stage inside a lesson, otherwise to the drill's setup (`/drills/:type`). Missed questions show the
  correct position(s); multi-step and bass drills list each missed step or note with its slot.
  Ending with 0 answered shows "No questions answered", records nothing and does not count as
  abandoned for FR-028. A question counts as answered only when its last step (or note) is judged. Ending early discards an unfinished question: its taps are not recorded and it appears in neither the summary nor Progress. When one is discarded, the summary adds "Your unfinished question wasn't saved." (with 0 answered: "No questions answered. Your unfinished question wasn't saved."). "Number asked" counts the same unit FR-040 records for the drill type (questions; notes for walking-bass; chords for chord-tone lock), so the summary and Progress always agree. For per-string figures, a multi-step question counts toward the string of its Step 1 (root) position: the user's tap, or the revealed root if Step 1 was missed. *(product-owner 2026-11-22, provisional)* The missed list is in question order and shows the first 10 entries (an entry is a missed
  question, step or note), with "Show all (N)", where N is the total number of entries. Note names in
  the list follow FR-049's octave rule for feedback. When the summary opens, after any final feedback
  announcement, focus moves to its heading. *(FN-11, A2-15, provisional)*
