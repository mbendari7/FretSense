# Feedback: 001 theory, fretboard and lessons, Mode A (second pass, spec changes of 2026-11-22), 2026-11-22

Scope: the 2026-11-22 spec changes only (FN-2 Empty library, FN-3/R3-3 FR-047, FN-4/PO-1 FR-030/032a/036, FN-5 FR-032, FN-6/R3-3 FR-049, FN-7 FR-058, FN-11 FR-034, FN-10b/R2-3/R3-1 FR-043/FR-066a/FR-044, SC-009). Read against `docs/feedback/001-theory-fretboard-lessons-2026-11-22-B.md`. Spec only; no code was run.

Persona naming: the brief calls the book learner "Priya" and the recruiter "employer". I use the standing names: Sam = self-taught book learner, Priya = recruiter. Nobody here is the wrong person; just a label mismatch.

## Summary
- Overall: 4/5 stars. Most of the hands-on MAJORs now have a concrete, testable fix in the spec. What is left is a few gaps the changes do not touch (open-string visibility, a no-gear demo path), a keyboard cost on question 2 onward, and some jargon that survived into the new wording.
- Top 3 problems:
  1. MAJOR: FR-049 moves focus automatically only on drill start. From question 2 focus stays on the last answered spot, so Alex arrows across strings for every question. B-15 is fixed for Q1 only. Also, at drill start focus goes into the board, so nothing says the prompt is read out for question 1.
  2. MAJOR: B-8 (open-string positions drawn off the nut, faint, low contrast) is not covered. FR-032a/FR-049 fix the names and the nut labels, but nothing says fret-0 positions are drawn as full-size tappable targets.
  3. MAJOR: Copy-import is not idempotent (FN-10c held). Sam imports the same file twice ("did it work?") and his history doubles, with nothing in the preview to warn him.
- What worked well:
  - Empty library (FN-2) fixes B-1 and B-2 properly, with exact wording and a rule that no screen shows a lesson-first primary action.
  - FR-047 is the right answer to B-3: cue, text range, jump controls, nut column kept, and an explicit rule that none of it depends on the answer.
  - FR-036 and FR-032 fix B-6 and B-9 with literal sentences I can check ("Find the ♭7th of the A dominant 7th chord (A7), frets 5 to 8", "never A♯2").
  - FR-058 messages fix B-7: one plain sentence per rule, with the exact text for beat 4.
  - FR-034 fixes B-11, including "See progress" and "Back to drills".
  - FR-044 and FR-066a explain reset honestly ("hides, does not erase") and the preview sentence "12 answers you reset earlier will come back" is the right tone.

## Did each change fix what the hands-on test found?
| Change | Fixes | Verdict |
|---|---|---|
| FN-2 Empty library, resume heading | B-1, B-2 | Fixed on paper. Nav item "Lessons" is still there (see 1). |
| FN-3 FR-047 scroll cue and jump controls | B-3 | Fixed on paper. Small gaps (see 5, 6). |
| FN-4 FR-030/032a nut labels, FR-036 words | B-6, B-10 | B-6 fixed. B-10 fixed, with a prompt vs nut spelling clash (see 7). |
| FN-5 FR-032 spelling | B-9 | Fixed. |
| FN-6 FR-049 focus and announcements | B-4, B-5, B-14, B-15 | B-4, B-5, B-14 fixed. B-15 only for Q1 (see 2). |
| FN-7 FR-058 messages | B-7 | Message fixed. "Which notes were valid" not answered (see 12). |
| FN-11 FR-034 summary | B-11 | Fixed. |
| FN-8 open strings (visual) | B-8 | NOT addressed (see 3). |
| Priya items B-12, B-13 (demo, "Just looking") | B-12, B-13 | NOT addressed; a grep for "just looking", "demo" finds nothing in the spec (see 4). |
| FR-043/066a/044, SC-009 | export/import/reset trust | Rules are coherent; two user-facing gaps (see 8, 9, 10). |

## Findings
| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|
| 1 | Maya, Priya | MINOR | Empty library edge case; sidebar "Lessons" | The empty state is good, but "names the family" and "lessons are on the way" are the spec's words. If the screen says "no guitar-family lessons" Maya has no idea what a family is. The "Lessons" nav item still leads to a page with nothing on it, and "on the way" has no date or scope. | Plain words: "No guitar lessons yet". A nav that is honest about it. | The empty state names the instrument in the user's own words (for example "5-string bass"), never the word "family". While empty, the Lessons nav label or page header carries "coming soon" or the nav item is hidden. |
| 2 | Alex | MAJOR | FR-049 later questions: "focus stays on the fretboard at the last answered position and does not move automatically" | Good that feedback is not interrupted. But in note-finding the next prompt names a different string, so I arrow up to 5 strings on every one of 20 questions. B-15 is now fixed only for question 1. For Q1 the focus also jumps into the board, so I am not sure the prompt is spoken (the "Question N of M. <prompt>" announcement is described for later questions and after feedback, not for drill start). | A key or control that jumps focus to the prompted string (or to the question's start position), and the first prompt announced on drill start. | (a) The drill offers a keyboard shortcut (documented on screen) and a "Go to start position" control that moves focus to the question's FR-049 starting position without answering. (b) On drill start the live region announces "Question 1 of N. <prompt>"; test with an aria-live assertion. |
| 3 | Dev, Maya, Alex | MAJOR | FR-032a / FR-048 / FR-049, fret 0 (open strings) | The new text fixes the accessible name ("String N, open") and the nut label. It never says what an open-string position looks like. B-8 was dashed faint circles off the nut with low-contrast labels. FR-048's 3:1 rule covers "markers" generally, but nothing says fret-0 positions are drawn in the same size as fretted ones, in every drill. | Fret 0 drawn as a normal 44 px target at the nut, in every drill and the explorer. | Fret-0 positions render at the same hit-target size and marker contrast (3:1 or more) as fretted positions in every drill and in the explorer, and are visible while a question is open. A visual test at 390 px and 1280 px checks it. |
| 4 | Priya | MAJOR | FR-011 first run; (no requirement) | Priya must pick an instrument she does not play before seeing anything (B-12, B-13). Nothing in this round addresses it. The empty-library rule helps with the dead end, but the recruiter's 60 seconds are still spent on a gate and then on a plain-looking Home. | A "Just looking, use a 6-string guitar" choice that goes straight to an interactive fretboard. | First run shows a "Just looking" action that sets the default 6-string guitar and opens the explorer or Home with the neck visible in one click. Instrument can be changed later. (Owner may deliberately defer; raising it again because it is the recruiter's main blocker.) |
| 5 | Maya, Alex | MINOR | FR-047 text indicator "Frets 0–6 of 12" | Maya reads "Frets 0–6": fret 0 is not a fret to her. Alex: the spec does not say the indicator updates as I scroll or is announced; a cue that is only visual does not help me. | "Open and frets 1–6 of 12". Indicator updates live and is exposed as text. | The indicator text is "Open, frets 1–6 of 12" (or similar, with "open" in plain words), updates on scroll, and is a text node reachable by screen reader (no announcement spam). |
| 6 | Maya | MINOR | FR-047 jump controls "0–6", "7–12" | The example segments assume one phone width at one text size. At large text or 8 strings the number of chips grows (24 frets could be 4 or 5 chips). Each chip is another tab stop before the fretboard. Chip labels "7–12" mean nothing without "frets". | Short row, labelled "Frets 7–12". | Jump control group has a visible label "Jump to frets", the chip text includes "frets" for assistive tech, and the group stays at most one row (wraps or scrolls) at 390 px at the largest text size. |
| 7 | Maya | MINOR | FR-030 prompt spelling vs FR-032a nut spelling | FR-030 says the prompt names the string by its open note "in the active tuning and context spelling". FR-032a says the nut label, while a question is open, is the instrument's exact open-string notes. In an Eb tuning or a flat context these can differ (prompt "string 5, D♯", nut label "E♭"). Maya compares the two and thinks one is wrong. Also, labels at the nut change after answering (FR-032a), which looks like a glitch. | One spelling for the string in prompt and nut label during a question. | In a drill question the string name in the prompt and the nut label are identical (same spelling) before and after the answer. |
| 8 | Sam | MAJOR | FR-043 copy-import / held FN-10c | Copy-import gives every record a new id, and idempotent copy is held. If I import the same file twice (I will, to be sure) my attempts double and my accuracy changes. The preview says "N added" but not that I already imported this file. | A warning when this file was already imported. | The import preview shows "This file was imported on <date>; importing it again adds N duplicate answers" when the file's export id matches a previous copy-import on this device (needs only a local record of file id; owner to confirm privacy position). If the owner keeps FN-10c held, the preview must at least say copy import adds records every time. |
| 9 | Sam, Maya | MINOR | FR-066a preview counts: added, restored, updated, hidden, unchanged | Five counts, and "hidden" (records a file will hide) is a word I do not expect in an import. Each has a sentence, which helps, but "hidden" is zero in copy import and I will not know why. | Only the counts that are non-zero. | The preview shows only non-zero counts, each as its plain sentence, with a heading that says "Restore" or "Copy". Hidden appears only when above 0. |
| 10 | Sam | IDEA | FR-044 reset | Reset only tombstones, so my records still exist. If I reset by accident and have no export, the spec gives me no way back even though the data is on the device. | "Undo reset" for a while. | After reset, a visible "Undo reset" is offered until the next write of a new attempt or until the user leaves settings (owner decision, tradeoff with the privacy line in the reset text). |
| 11 | Alex | MINOR | FR-049 "Home moves focus to the question's starting position" | I read "Home" as the Home screen. It is meant to be the Home key. | Unambiguous wording. | The sentence reads "The Home key moves focus ...", and the on-screen keyboard help lists it. |
| 12 | Dev | MINOR | FR-058 messages | Beat 4 message is now clear. B-7 also said valid approach notes (G, B♭, B, C♯, D) are marked on the board with no explanation. The spec does not say whether the board explains what is valid after a failed slot. R4's "moved 13 semitones" asks a bassist to do arithmetic. | After a miss, shown notes labelled "lead-in options" and "a 9th, more than an octave" style wording. | After a rule fails on a slot, the revealed positions are captioned with the rule's name ("lead-in options") and R4 text states the interval name as well as the semitone count. |
| 13 | Dev | MAJOR | FN-7 owner note: walking-bass hidden in v0.1 | Dev is the persona that cares most about this drill. v0.1 now ships with three bass drills and walking bass hidden (NEEDS MAHMOUD to confirm hide or labelled preview). The spec also says "v0.1 doesn't ship while it is hidden" and "FR-065 and SC-012 are met only once reachable": so I read that as release blocked, not hidden. The two statements need to agree. Also nothing says who picks the progression. | Either walking bass shipped or a visible "coming" tile, never silently missing. | Bass drills list shows walking bass as "Coming soon: walking bass" until FR-058 ships; the release line says explicitly whether v0.1 ships with it hidden or waits. A progression picker (at least 3, key choice) is added to FR-058 or recorded as a later spec (B-18 stays an IDEA). |
| 14 | Maya | MINOR | FR-049/FR-032 announcement "G2 on string 6 fret 3", "G3 at fret 15" | Octave numbers (G2, G3) are written for a theorist. Maya hears "G2" and does not know what the 2 is. In "any octave" mode, saying "G3 at fret 15" also reads as a second right answer she missed. | "G on string 6, fret 3 (also fret 15)". | Feedback text in any-octave mode omits octave numbers on the visible message; octave numbers appear only in exact-octave mode and in accessible names. |
| 15 | Maya, Alex | MINOR | FR-034 missed list | "Lists every missed question". In a 100-question session with 40 misses this is a long page. Not stated: order, grouping, focus on the heading. | Short by default. | The missed list shows the first 10 with "Show all (N)", is a list in document order, and focus lands on the summary heading when it opens. |
| 16 | Priya | MINOR | SC-009 / FR-043 | Not user visible, but a recruiter reading the spec sees SC-009 as the strongest "this is engineered, not hacked" signal in the whole file. Nothing in the app shows it. | A one-line "Restore tested" statement is not needed; just keep it. | No change needed. Optional: README or About links the export/import guarantee. |

## Persona notes

### Maya (beginner guitarist, 16, laptop mic only)
- First two minutes now: instrument pick, "Ready to practise on your 6-String Guitar", two working actions. That is a clear improvement; I would not leave.
- Chord drill: "Find the 3rd of the A major chord, frets 5 to 8" is something I can look up. Better than "In A, find the 3". The window "frets 5 to 8" is stated, which is new and helpful.
- Phone: I now see a cue, "Frets 0–6 of 12" and a "7–12" button. Good, though "0" confuses me (finding 5).
- Spelling: prompt "B♭", feedback "B♭" is what I wanted.
- Still confusing: octave numbers (G2/G3) in feedback; nut vs prompt spelling in odd tunings.

### Dev (intermediate bassist, 5-string BEADG)
- Beat 4 sentence: "you played C itself" is exactly what I wanted to hear.
- Nut labels show B E A D G on every drill; that kills the string-counting I did.
- Walking bass hidden at v0.1 is the bit that hurts (finding 13). I want it, with a progression choice.
- Open strings: still not promised as clearly drawn (finding 3).

### Sam (self-taught, theory book)
- Export, reset, restore is now explained honestly, and I trust the "12 answers will come back" sentence.
- Copy-import twice doubles my history (finding 8). I would not notice until the numbers looked wrong.
- Empty library means I still cannot test my chapters; nothing in these changes addresses that, correctly.

### Priya (recruiter, no guitar, 60 seconds)
- No dead-end first card any more. The Home heading no longer lies. Both good.
- Still no way in without choosing an instrument, and no wow hero (finding 4).

### Alex (colour-blind, keyboard-only)
- Focus to heading on route change, focus into the board on drill start, one polite live region with a queued prompt, and one consistent name pattern ("String N, open", each token once): these fix my four biggest complaints.
- Remaining: Q2 onward focus stays put (finding 2), Q1 prompt not clearly announced (finding 2), cue/indicator announcement (finding 5), "Home" wording (finding 11), fret-0 contrast (finding 3).
- Keyboard-only users now get the nut column text always visible, which also helps screen-magnifier users.

## Persona quotes
> Maya: "'Ready to practise on your guitar' and two buttons that work. That's all I needed the first time."
> Maya: "What is fret zero? And why does it say G2 and G3, I only wanted G."
> Dev: "Tell me when walking bass ships, or show me a tile saying it's coming. Don't just make it disappear."
> Sam: "I imported twice because I wasn't sure it worked. Now my progress says I've done everything twice."
> Priya: "The dead end is gone, but I still have to choose a guitar I don't own."
> Alex: "Focus lands where it should on drill start. Then on question two, I'm walking across the strings again."

## Metrics (Mode B)
Not applicable (spec walkthrough).
