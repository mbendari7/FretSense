# Spec 001 part: US6 Bass Patterns and Lines

> Part of [spec.md](spec.md), the index for spec 001. Split verbatim on 2026-11-25 (ADR-0013);
> requirement wording is unchanged. The index has the FR → file map.

## User Scenarios & Testing *(mandatory)*

### User Story 6 - Bass Patterns and Lines (Priority: P2)

Bass-oriented drills and lesson types: root–fifth–octave patterns, arpeggios, walking bass lines
and locking into chord tones. All are tap-based and untimed in 001, and available on any instrument
(declared bass-first in lessons).

**Why this priority**: Bassists are first-class users. These are the core bass skills, and they
reuse the engine with no audio.

**Independent Test**: On 4-string EADG, run each bass drill type once with a fixed progression and
verify the rule-based judgements against fixtures.

**Acceptance Scenarios**:

1. **Given** a root–fifth–octave drill for chord C on 4-string EADG, **When** the user taps C, G
   and the C an octave above in any playable shape (FR-056), **Then** the pattern is marked correct
   and shown as a shape.
2. **Given** an arpeggio drill for Am7, **When** the user taps A, C, E, G in ascending pitch order
   within the window, **Then** it is correct; any out-of-order or non-chord tone is flagged at
   that step.
3. **Given** a walking-bass drill over | C | Am | Dm | G | (4 beats each), **When** the user enters
   4 notes per bar, **Then** R1, R2 and R4 are judged as each note is entered, R3 for each bar once the next bar's
   beat 1 exists (bar 1 for bar 4), every broken rule is named on its slot (in FR-058's wording), Undo and re-entering a slot work before "Check line", and 16 attempts
   are recorded at Check line.
4. **Given** a chord-tone lock drill over the same progression, **When** the user taps one note per
   chord, **Then** chord tones are correct and non-chord tones are flagged with the chord's actual
   tones revealed.

---
5. **Given** 4-string EADG, chord C, strings 1–3, frets 0 to 17, adaptive weighting off (the shared fixture for scenarios 5–12), **When** the user taps C3 1/5, then G2 2/5, then C2 3/3, **Then** Step 3 (octave) is ✓ at the first tap with no "placed" state, then Step 2 ✓, then Step 1 ✓; the feedback is "Correct, C root–fifth–octave shape", the shape is shown, and one attempt with outcome correct is recorded for item (root-fifth-octave, C).
6. **Given** the fixture, **When** the user taps C3 3/15, then C4 1/17, then G3 2/17, **Then** Steps 1, 3 and 2 are ✓ in that order and the question is correct.
7. **Given** the fixture, **When** the user taps C2 3/3 and then C4 1/17, **Then** Step 1 is ✓; 1/17 is flagged "Doesn't fit the shape (more than 3 frets apart or wrong octave)"; Step 3 is missed and C3 1/5 is revealed; after G2 2/5 (Step 2 ✓) the feedback reads "Incorrect. 2 of 3 steps correct. Missed: octave C3 at string 1 fret 5."; one attempt with outcome incorrect is recorded.
8. **Given** the fixture, **When** the first tap is A2 2/7, **Then** it is flagged "Not C or G", Step 1 (root) is missed and C2 3/3 is revealed (lowest-pitched root); that shape is fixed for the rest of the question.
9. **Given** the fixture, **When** the first tap is G2 1/0, **Then** it is flagged "Doesn't fit the shape (…)", Step 2 is missed and G2 2/5 is revealed.
10. **Given** the fixture, **When** the first tap is C3 2/10, **Then** it is flagged "Doesn't fit the shape (…)" and charged to Step 1; Step 1 is missed and C2 3/3 is revealed.
11. **Given** the fixture, **When** the user taps C2 3/3 twice, **Then** the second tap is not judged, charged or recorded, and is announced "String 3, fret 3 is already in this answer".
12. **Given** the fixture, **When** any question ends, **Then** exactly one attempt is recorded for it (FR-040), never one per step.
13. **Given** 5-string BEADG, chord C, all strings, frets 0 to 12, **When** the user taps C2 3/3, **Then** it shows as "placed" (accessible suffix ", placed, root or octave") and Steps 1 and 3 stay pending; then (a) G2 2/5 makes it Step 1 ✓ and Step 2 ✓; (b) G1 4/3 makes it Step 3 ✓ (octave) and Step 2 ✓; (c) the wrong tap C3 2/10 first resolves it as the root (Step 1 ✓), then is flagged "Doesn't fit the shape (…)", Step 3 is missed and C3 1/5 is revealed (never 3/3).
14. **Given** an arpeggio drill for Am7 on 6-string Standard, **When** the user plays Steps 1, 3 and 4 correctly and misses Step 2, **Then** exactly one attempt with outcome incorrect is recorded for item (arpeggio, m7), holding every judged tap in tap order, and the drill summary and Progress each count 1 question.
15. **Given** an arpeggio question with Steps 1 and 2 judged, **When** the app is backgrounded and then resumed, **Then** Steps 1 and 2 keep their marks and revealed positions, the drill asks for Step 3, nothing has been recorded yet, and one attempt is recorded when the last step is judged.
16. **Given** the first arpeggio question with Steps 1 and 2 judged, **When** the user selects "End drill", **Then** the summary reads "No questions answered. Your unfinished question wasn't saved.", nothing is recorded, and the session does not count as abandoned (FR-028).
*(Scenarios 5–16: product-owner 2026-11-22, provisional)*

## Requirements *(mandatory)*

### Functional Requirements

**Bass patterns and lines (amendment)**

- **FR-056**: The root–fifth–octave drill MUST name a root pitch class and ask for a root, the
  perfect 5th above it and the octave above it, in any order. A **valid shape** is a root position R on a selected string within the fret range, plus a position sounding exactly R + 7 semitones (the 5th) and one sounding exactly R + 12 (the octave), all on selected strings within the fret range, whose frets span at most 4 frets inclusive (max − min ≤ 3; open strings count as fret 0). Any octave of the root pitch class may be the root. A tap is **accepted** if at least one valid shape contains it together with every earlier accepted or revealed position in the question; otherwise it is a wrong tap (FR-056a). A step is marked correct as soon as the accepted positions fix its role: the 5th at once; a root-pitch-class tap once a second accepted position shows whether it is the root or the octave . A tap's role is fixed when every valid shape containing it and every accepted or revealed position gives it the same role; it is fixed at once when only one role is possible. Until then it is **placed**: the position shows a "placed" marker (visible "R/8", accessible-name suffix ", placed, root or octave"), the announcement is "<note> placed on string N fret F: root or octave, set by your next note", and Steps 1 and 3 stay pending. The prompt states the fret range in play, as FR-035 does: "Play a root–fifth–octave shape for C, frets 0 to 12". The completed shape is shown afterwards. Only positions inside the fret range are drawn as targets, so no out-of-range reason exists. A settings combination with no valid shape for a selected root is rejected (impossible-settings rule). *(product-owner 2026-11-22, provisional)*
- **FR-056a**: In the root–fifth–octave drill, a wrong tap MUST be flagged at the tapped position with a reason and charged to one pending step: If a placed tap exists when a wrong tap arrives, it is resolved first: the reveal shape is chosen (preferring shapes in which the placed tap is the root, then the reveal order below), the placed tap takes its role in that shape and is marked correct, and the wrong tap is then charged by the rules here to the steps still pending. A revealed position is never a position the user has already tapped. The wrong tap is to Step 2 (5th) if the tap has the 5th's pitch class and Step 2 is pending; to the lowest-numbered pending of Step 1 (root) and Step 3 (octave) if it has the root's pitch class; otherwise to the lowest-numbered pending step. That step is marked missed (FR-057 indicator) and its correct position revealed, from a valid shape containing every accepted and revealed position (if several fit, the first in this order: lowest-pitched root; then root at the lower fret, then on the higher string number; then the same two tests for the 5th's position, then for the octave's). Revealed positions count as fixed for the rest of the question. The drill continues with the remaining pending steps; the question ends when all three steps are judged. Reasons: "Not C or G" (neither pitch class); "Doesn't fit the shape (more than 3 frets apart or wrong octave)". The question is recorded as one attempt (FR-040) when its last step is judged: outcome correct only if no step was missed; answer positions are every judged tap in tap order (the attempt schema, data-model §3, stores positions only; the per-tap result is shown, not stored); response time runs from the prompt to the last step's judgement, excluding paused time (Edge Cases). Step results are shown (FR-057 indicator) but not recorded separately. A tap on a position already tapped or revealed in this question is ignored (not judged, charged or recorded); it is announced "String N, fret F is already in this answer" (or "… was already marked wrong"). *(product-owner 2026-11-22, provisional)*
- **FR-057**: The arpeggio drill MUST ask for the tones of a chord (FR-005) ascending from its lowest root, up to the chord's highest tone (within one octave for every quality except add9, whose last step is the 9th at root + 14 semitones, label "9", spoken "9th"; owner-approved 2026-11-22), inside an inclusive fret window [s, s + w − 1] (default w = 5), where the lowest root is the lowest-pitched position of the root pitch class on a selected string inside the window. The generator chooses s (within the fret range) only where every step's exact pitch, ascending from that lowest root, has at least one position on a selected string inside the window; if no s fits for a chord, that chord is not asked, and if none fits for any selected chord, the settings are rejected. Each step accepts any position inside the window sounding the exact target pitch. The prompt names the chord as FR-036 does and states the window: "Play the A minor 7th arpeggio (Am7) up from its lowest A, frets 5 to 9". Wrong-step reasons: "Outside frets 5 to 9"; "Not the lowest A in frets 5 to 9" (Step 1, right pitch class, wrong octave); "Not the root of Am7" (Step 1, wrong pitch class) *(code-reviewer r3 #3, provisional)*; "Not the ♭3 of Am7" (wrong tone or out of order). *(product-owner 2026-11-22, provisional)* Each step is judged.
  A wrong tone or ordering error is flagged and the correct position revealed, and the drill continues to the next step. The question is recorded as one attempt (FR-040) when its last step is judged: outcome correct only if no step was missed; answer positions are every judged tap in tap order; response time runs from the prompt to the last step's judgement, excluding paused time (Edge Cases). Step results are shown (step indicator) but not recorded separately. *(product-owner 2026-11-22, provisional)* The window is stated, named and drawn as in FR-036.
  Each step is shown as a step indicator in one of three states, each marked by icon + text + colour: pending (no mark), correct (✓, "correct") or missed (✗, "missed"). A missed step never shows ✓. Steps are numbered from 1 in ascending order, one per chord tone in FR-005 order; the root is Step 1 and is played by the user, not given. Each indicator shows the function label (FR-005; the root as "R"), and its accessible name is "Step N, <function>, <state>", with the root spoken as "root" (e.g. "Step 1, root, correct"; "Step 2, ♭3, missed"). When the last step is judged, the feedback starts "Correct, <chord> arpeggio" (FR-056: "Correct, <chord> root–fifth–octave shape") when no step was missed, otherwise it uses the incorrect style and reads "Incorrect. N of M steps correct. Missed: …"; and the feedback text and announcement list every missed step with its target, in the question's spelling and with octave (FR-032, FR-049), e.g. "Missed: ♭3 F♯4 at string 2 fret 7" (6-string Standard). The root is written and spoken "root" in the missed list, e.g. "Missed: root A2 at string 6 fret 5"; only the visible indicator label is "R". FR-056 uses the same indicator with three fixed steps, numbered by tone and not by tap order: Step 1 root ("R"), Step 2 5th (visible "5", spoken and written "5th"), Step 3 octave (visible "8", spoken and written "octave"), e.g. "Step 3, octave, pending"; its missed list uses the same words, e.g. "Missed: octave C3 at string 1 fret 5" (4-string bass). (CR-B2-2) *(Mode B2 triage, provisional, product-owner 2026-11-22)*
- **FR-058**: The walking-bass drill MUST take a progression of 2–8 chords at 4 beats each with a
  declared key (tonic + mode; required in the lesson data). Outside a lesson, this drill and
  chord-tone lock (FR-059) use the built-in progression | I | vi | ii | V | of diatonic triads (FR-007) in a major key the user
  picks from the 15 major keys (default C major: | C | Am | Dm | G |); more progressions come from
  017's catalogue (017 FR-007). The progression loops, so the last bar
  approaches bar 1. The drill accepts 4 notes per bar and judges each against these rules:
  - (R1) beat 1 is the chord root;
  - (R2) beats 2–3 are chord tones, tones of the declared key's scale, or chromatic passing tones
    (a semitone between two such tones);
  - (R3) beat 4 is a step of 1–2 semitones to the next bar's beat-1 note, or that note's perfect
    5th above or below (dominant approach);
  - (R4) no leap larger than an octave (an exact octave is allowed), including across bar lines.

  Each broken rule MUST be named on the slot it applies to, in one plain sentence that states the
  rule and what was played, never built by joining the beat label into a sentence (e.g. beat 4: "A
  lead-in is 1–2 semitones from the next bar's first note (C), or a perfect 5th away; you played C
  itself."). The other rules use: R1 "Beat 1 is the chord's root (<root>); you played <note>."; R2
  "Beats 2 and 3 are chord tones, notes of <key>, or a semitone step between them; you played
  <note>."; R4 "Moves between notes are at most an octave; you moved <article> <interval name> (<n>
  semitones)." (interval named by FR-002 from the two spelled notes, with "a" or "an" as the name
  requires, e.g. "a major 9th (14 semitones)", "an augmented octave (13 semitones)"; when FR-002 gives
  no name (beyond a double octave, or a typed error) the message ends "you moved <n> semitones.";
  theory-checker verifies the wording); R3 (other cases) "A lead-in is 1–2 semitones from the next bar's
  first note (<next>), or a perfect 5th away; you played <note>." FR-065 and
  SC-012 are met only once walking-bass is reachable, and the v0.1 release does not ship until it
  is. Interim builds before that release may leave it out; whether they hide it or show a labelled
  preview is held for the owner (FN-7).
  *(FN-7, provisional)*
  - **Entry:** the screen shows bars and beats as slots, each with its bar's chord. The current slot
    is highlighted (not by colour alone) and announced ("Bar 2, beat 3, Am"). Undo removes the last
    note. Any slot can be selected and re-entered before checking, and re-entering a slot re-judges
    it and its neighbours.
  - **Judging:** R1, R2 and R4 are judged as each note is entered, within FR-032's budget. R3 for
    bar n is judged as soon as bar n + 1's beat 1 exists (bar 1 for the last bar).
  - **Revealed notes:** when a slot breaks a rule, the positions revealed for it, inside the drill's fret range, are: R1
    the root of <chord> ("root of <chord>"); R2 the tones of <chord> ("chord tone of <chord>"), plus
    the notes a semitone between the slot's two neighbouring entered notes when both are chord or key
    tones ("passing tone"), with key notes not revealed; R3 the lead-in options ("lead-in option").
    Each position gets one caption, in the order root, chord tone, lead-in option, passing tone.
    Revealed notes need only satisfy the broken rules; an R4 break reveals nothing extra. The suffix follows FR-013's "revealed answer" suffix, and captions never overlap at the
    largest text size (FR-048). *(A2-12, provisional)*
  - **Recording:** "Check line" becomes available once every slot is filled. The line's attempts
    are recorded then, one per note, each with its final judgement (FR-040).
- **FR-059**: The chord-tone lock drill MUST take a progression (with a declared key) and accept one
  note per chord. Chord tones are correct; otherwise the chord's tones are revealed.
  Walking bass (FR-058) and chord-tone lock (FR-059) take the same strings and fret-range settings
  as the other drills, with the same defaults: all strings, frets 0–12 (clamped to the instrument),
  changeable in the drill's settings. Reveals, the drill-start focus position (FR-049) and the
  FR-047 range indicator use that range. *(A2-r3 #1; owner-approved 2026-11-22)*
