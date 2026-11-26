# Feedback: 001 walking-bass and chord-tone-lock drills (T098, FR-058, FR-059), Mode B3, 2026-11-25

Method: I could not drive a browser. I read `WalkingBassRunner.tsx`, `walkingBass.ts`, `DrillsScreen.tsx`, `generate.ts` (chord-tone lock), `styles.css` and the runner tests, then walked each flow as a persona against the code. `pnpm vitest run` on `src/domain/drills` plus `WalkingBassRunner.test.tsx` passed: 14 files, 969 tests. I did not start the dev server, so nothing here is a measured timing or a visual check. Items marked (unverified) need a real browser.

## Summary
- Overall: 3.5/5 stars. The rule engine is solid and the wording is clear and specific. The entry flow has gaps: the slot cursor jumps away from a broken note, Undo loses information, and a screen-reader user is never told which slot is next.
- Top 3 problems:
  1. After a broken note is entered, the cursor advances to the next empty slot. The broken note's revealed answers and rule list then disappear until the user clicks the slot again, and the next entry overwrites the visible message.
  2. Undo and "Check line" have state bugs. Undo after a re-entry deletes the old note instead of restoring it. A second Undo says "Removed" and does nothing. A double-click on Check line can record the line twice.
  3. A screen-reader or keyboard user is not told which slot is current after each entry. Focus also starts in the fretboard, behind 16 slot tab stops.
- What worked well:
  - Each broken rule gets its own plain sentence naming the rule and the note played, e.g. "Beat 1 is the chord's root (C); you played E."
  - The "waiting for the next bar" pending state for beat 4 is a good idea.
  - Slot states use text, an icon and a border style (dashed for broken), not colour alone.
  - Slot buttons have full accessible names, e.g. "Bar 2, beat 3, Am, E2, fits, selected".
  - The wrap-around from bar 4 to bar 1 is judged, for R3 and R4.
  - Impossible settings are rejected with a reason (`validateSettings`).
  - Attempts are only written at Check line.

## Findings
| # | Persona | Severity | Where | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-------|---------------|-----------------|-------------------------------|
| 1 | Dev | MAJOR | Walking bass entry, `onTap` advances `current` | I tap a wrong beat-1 note. The slot gets a dashed border, but `current` moves to the next empty slot. The "reveal" markers and the `wb-reasons` list only show for `current`, so I don't see the revealed root positions unless I click the slot back. The next tap replaces the message in the notice line. Only the final slot (nothing left to advance to) behaves differently, so the behaviour is inconsistent. | Feedback for the note I just entered stays visible until I move on on purpose. Alternatively, reveals are shown for the last-entered or last-selected broken slot. | FR-058: after an entry that breaks a rule, the broken slot's reasons and revealed positions stay on screen until the user selects another slot or enters the next note. |
| 2 | Dev | MAJOR | Undo, `history` | History records the slot on every tap. (a) Undo after re-entering a slot clears the slot instead of restoring the previous note. (b) Re-entering slot 3 twice puts `[3,3]` in history. The second Undo does nothing visible but announces "Removed Bar 1, beat 4". Undo does not restore the recorded response time either. | Undo reverts the last action, restoring the previous note on a re-entry, and is disabled or silent when it has nothing to undo. | FR-058: Undo restores the slot's previous note (or empty) and its response time. After N entries and N Undos, the line is empty and Undo is disabled. |
| 3 | Dev | MAJOR | `check()` | The button is not disabled during the async loop of 16 `recordAttempt` awaits. A double-click, or Enter plus click, can write 32 attempts, which breaks the FR-040 "one per note" rule and inflates Progress. A failed write has no try/catch, so the user sees nothing. | Check line runs once. Failure is reported. | FR-040/FR-058: activating Check line twice records exactly 16 attempts. A storage failure shows an error and keeps the line editable. |
| 4 | Alex (screen reader) | MAJOR | Announcements after `onTap` | The live region says what I entered and whether it fits. It never says which slot I am on now. The fretboard `aria-label` changes, but a label change is not announced. Slot navigation says "selected" only in the slot button's name. | After each entry: "Bar 1, beat 3, C. Next: Bar 1, beat 4." | FR-058 Entry: after every entry, Undo or slot change, the announcement ends with the now-current slot ("Bar 2, beat 3, Am"). |
| 5 | Alex (keyboard) | MAJOR (unverified) | Focus order | On mount, focus moves to the fretboard (FR-049). The 16 slot buttons come before the board in the DOM. To change slot I must Shift+Tab back past the board, and there are 16 tab stops with no roving tabindex or arrow keys. The tests don't check this. | Slots are one composite control (arrow keys between slots, one tab stop). Reaching a slot from the board takes one or two keys. | FR-049/FR-058: the slot row is one tab stop with Left/Right moving between slots, and a documented shortcut returns focus to the board. |
| 6 | Maya | MAJOR | Setup and rules paragraph | A paragraph says "Beat 1: the chord's root. Beats 2 and 3: chord tones, notes of the key, or a semitone step between them. Beat 4: lead into the next bar. Moves stay within an octave." I don't know root, semitone, chord tone or lead-in. Nothing tells me which notes are C, E or G, so I just click and read error messages. Walking bass is tagged "Bass pattern", but nothing tells me I can't "fail" it on guitar. | One sentence on what a walking line is. A "Show me the chord tones" hint (the reveal, without a penalty) before the first tap. Jargon linked to the handbook. | FR-058: the drill has a "Show hints" toggle that marks the root and chord tones of the current bar, and each rule line links to or defines its term. |
| 7 | Maya | MINOR | Chord-tone lock prompt: "Play one chord tone of C (bar 1 of 4)" | It does not list C, E, G. "Chord tone" is undefined. The key picker is visible but changes only which chords appear. | A line saying "C chord = C, E, G" after answering, or optionally before. | FR-059: the feedback line after each question names the chord's tones, right or wrong. |
| 8 | Dev | MINOR | R3 message when the lead-in is an octave of the next root | The lead-in is C an octave below the next bar's C. d=12, so it is rejected, and the message says "(C) ... you played C". It looks like my note matches the target. | The message says "you played the same note an octave away" or names the octave. | FR-058 R3: when the lead-in has the same pitch class as the next note, the message says it is the same note and gives the octave, e.g. "you played C2, the next note's octave." |
| 9 | Dev | MINOR | After Check line | The line is locked (`if (checked) return`). I can review reasons by selecting a slot, but I can't fix a note and re-check. "Walk another line" wipes the line and the key stays the same. | At least "Edit line" to re-enter broken notes (the spec allows re-entry only before checking, so this is a request). | Backlog: after Check line, offer "Fix broken notes", which keeps the line and records a new attempt set. |
| 10 | Dev | MINOR | End drill | "End drill" has no confirm while notes are entered and nothing is saved or restored. A stray click at 15/16 loses the line. It sits right next to Check line. | A confirm when the line has notes, or an autosaved draft. | FR-058: End drill with unchecked notes asks for confirmation. |
| 11 | Dev | MINOR | Slot sizes (unverified) | Slots are min 44px wide. With a "C♯2" or "Cb2" label inside, 4 slots in a 210px bar (on a phone) is tight. | Names don't truncate or wrap at the largest text size (FR-048). | FR-048: at 200% text, slot note names don't overlap or clip. |
| 12 | Priya | MINOR | Drills list, first impression | The drill card reads "Build a walking line, one bar per chord..." with a "Bass pattern" tag. She has no guitar, so tapping a fretboard is a fair demo. The ✕ and dashed border give instant feedback, so it is quick to understand. | A one-click "try an example line" so the page shows a result in seconds. | IDEA: a "Fill with an example" button on the walking-bass screen. |
| 13 | Dev | MINOR | Check line enablement | While not all 16 slots are filled the button is disabled. The message "9 of 16 notes entered" does not say which slots are empty, and "pending" beat-4 notes are not explained until I hover or read the name. | The count names the next empty slot. | FR-058: the status line names the first empty slot. |
| 14 | Dev | IDEA | Recording | The recorded item key is per chord quality ("walking-bass", "major"). Progress shows "notes" as the unit. I can't see "which rule I break most" (R1 vs R3) over time. | A per-rule breakdown. | Backlog: record which rule failed per attempt and show a Progress breakdown. |
| 15 | Alex | MINOR | Colour | Slot state is shown by text (accessible name), icon (✓ ✕ …) and border style, so colour is not the only signal. The current slot is a thick outline plus bold text. This passes my check by reading the CSS. Contrast of `--m-ref`/`--m-ok`/`--m-bad` against the background is not checked (unverified). | Contrast of at least 3:1 for borders and outlines. | FR-048: slot borders and the current-slot outline meet 3:1 in both themes. |

## Walk-through notes by flow
- /drills, Walking bass, pick a key: 15 major keys in the picker, with the progression text updating (e.g. "C | Am | Dm | G in C major"). The questions field is hidden for walking bass, which is correct. Keys such as Cb, C♯ and F♯ build (theory-checker checked the spelling).
- Entering 16 notes: the cursor auto-advances and wraps. Breaking each rule once:
  - R1: root message and root reveals (works, but see 1).
  - R2: message plus chord-tone reveals, plus a passing tone when neighbours qualify.
  - R3: stays "pending" until the next bar's beat 1 exists, then judges.
  - R4: judged against the wrapped slot 15 → 0, with an interval name.
  - A slot that breaks two rules lists both.
- Undo and slot re-entry: re-entry re-judges neighbours, which is good. Undo has the problems in finding 2.
- Check line and review: the result line is focused (`resultRef`), which is good. Selecting a slot afterwards shows its reasons and reveals. "See progress" is a real link.
- /progress: `ProgressScreen` labels the unit as "notes". I did not render it (unverified).
- Chord-tone lock, 8 questions: with the default count of 20 and 4 chords, 8 questions is 2 loops of C, Am, Dm, G. It reuses the generic `DrillRunner` (not driven; covered by `chordToneLock.test.ts`, which passed). There is no way to change the progression, only the key.

## Persona quotes
> Dev: "The rule messages are exactly what I wanted, but I wrong-note a beat 1 and the board forgets about it as soon as the cursor moves on."
> Maya: "I don't know what a lead-in is. I'd quit after the first red cross."
> Priya: "Understood in ten seconds: the tick and cross tell me what it does. I'd like it to show me a finished line."
> Alex: "I hear what I played but never where I am. And I have to tab through all sixteen slots to get anywhere."

## Metrics (Mode B)
| Task | Persona | Time | Completed? |
|------|---------|------|-----------|
| Walk a 16-note line and Check line (code and test review only) | Dev | not timed | Yes (by test) |
| Break each rule, Undo, re-enter | Dev | not timed | Yes, with bugs 1 and 2 |
| Chord-tone lock, 8 questions | Maya | not timed | Yes (by test), prompt lacks tone names |
| Keyboard-only line entry | Alex | not timed | Possible, awkward (finding 5) |
| Understand the drill in 60 seconds | Priya | not timed | Likely, with no example mode |

Handed to the product-owner for triage.
