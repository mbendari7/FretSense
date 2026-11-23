# Feedback: 001 theory, fretboard and lessons, Mode B (round 2, after Phase 11), 2026-11-22

Run against the live dev server at http://localhost:5180/ with Playwright at 390x844 and 1280x800.
Screenshots are in `docs/feedback/001-B2-shots/`. The driver scripts were run from a scratch folder, not the repo, and no source was edited.
The tests of the real flows used wrong taps to force feedback. Typical-time numbers in Progress are therefore scripted, not human.

## Summary
- Overall: 3 / 5 stars. The drill feedback wording, note sets, My Gear and Progress import/export all work. But the answer is often off screen on a phone, the step chips lie, and the nut-column spellings are weird.
- Top 3 problems:
  1. MAJOR: after a mistake, the revealed answer is often not visible and the board does not scroll to it (phone, fret 6 and above).
  2. MAJOR: the arpeggio and root-fifth-octave step chips show a green tick for steps the user got wrong. After answering, the nut column shows spellings like F double-sharp, C double-sharp and E double-flat on open strings.
  3. MAJOR: the feedback text and the board contradict each other on spelling (the text says D flat, the marker and its screen-reader name say C sharp).
- What worked well:
  - All four FR-031 note sets generate correctly spelled prompts.
  - The stated window in chord-tone prompts ("frets 4 to 7").
  - Keyboard flow: focus lands on the board at the start position, Home and End work, Enter doubles as Continue, and the focus ring is visible.
  - Wrong answers use a shape (cross) as well as colour.
  - The import/export counts sentences and the "nothing new" path are clear and honest.
  - No console errors in any run.

## Findings
| # | Persona | Severity | Where | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-------|---------------|-----------------|-------------------------------|
| 1 | Maya (phone) | MAJOR | Note-finding, interval, chord-tone and RFO feedback; FR-047 and FR-032a | Wrong tap on Q3 ("Find B on string 6"): text says "B ... is at fret 7", but the board stays at Open-5 (scroll 0), so the answer marker is not on screen. Only a small right-hand chevron hints at more. Same for fret 12 and for 11 of the first 12 wrong answers on interval, chord-tone and arpeggio. See `maya-07-wrong-2.png`. | After a mistake I can see where the right spot is without hunting. | Once a question is answered wrong, at least one revealed answer position is inside the visible area, either by an automatic scroll or by a "Show answer" control. The unanswered state is unchanged (FR-047 "never depends on the answer" applies only before answering). |
| 2 | Dev, Maya | MAJOR | Arpeggio and RFO step chips; FR-057 | Arpeggio Q1: three wrong taps (three crosses on the board). The chips read "check b3, check 5, octave", so the done-state chip says correct even when the step was missed. See `dev-ph-arpeggio-wrong.png`. The feedback line only describes the last step ("D#3 is at string 1 fret 8"); the missed b3 and 5 are never mentioned. | A chip shows a tick only for a correct step, a cross otherwise. Feedback covers every missed step. | Each step chip shows correct, missed or pending with a non-colour mark. Final feedback lists every missed step with its target. |
| 3 | Dev, Alex | MAJOR | Nut column after answering; FR-032a | After an answer in RFO on D flat the nut column reads "G E double-flat B double-flat F flat" for a G-D-A-E bass. Arpeggio D sharp minor: "F double-sharp, C double-sharp, G double-sharp, E". C sharp minor: "F double-sharp, D, A, E" (mixed). These are the open-string names. | Open strings keep their familiar names (G D A E) or use one consistent spelling that is explained. | The nut column after answering shows each open string's own name, unless the key spelling is the same as the string name. No double accidentals appear on open strings in any drill. |
| 4 | Dev, Alex | MAJOR | Interval Q2 ("octave above this D flat") | Feedback text says "D flat 3 is at string 1 fret 6". The revealed marker label and its accessible name read "C sharp 3, answer". Contradicting spelling in one question. | One spelling per question, in text, label and aria-label. | The feedback text, revealed marker labels and accessible names use the same spelling for the same position. |
| 5 | Maya (phone) | MINOR | Note-finding setup: Strings chips | Chips read "1 (E)", "2 (B)" ... "6 (E)". Two E chips and no hint that 6 is the thickest. In the drill the prompt does say "string 6, low E", so it is fine there. | "6 (low E)" and "1 (high E)". | String chips add "low" or "high" for the extreme strings, matching the prompt. |
| 6 | Maya | MINOR | Note-finding setup: Notes | "naturals" and "17 spellings" are theory jargon for a 16-year-old. | Plain wording only. | The secondary text has no term that a learner would not already know, or has a one-line explanation. |
| 7 | Maya (phone) | MINOR | My Gear | After tapping a preset the page is scrolled down, and the "Added ..." status is above the viewport (top -542 px). Tapping "Custom instrument" opens the form at the bottom edge (748 of 844 px) with focus still on the button. The preset silently becomes active. | Visible confirmation, the form scrolled into view with focus moved to it. | After adding or opening the form, the status or the form heading is in view and receives focus. The active instrument change is stated in the message. |
| 8 | Dev | MINOR | My Gear to drills | Adding a 4-string preset made it active, so the next drill ran on 4 strings, not on the 5-string BEADG I had just set. The drill setup shows only the string chips of the active instrument. | The active instrument is shown near "Start drill". | The drill setup names the active instrument next to its string chips. (The Instrument switcher exists, so the cost is low.) |
| 9 | Priya | MAJOR | Lessons, Library | `/library` says "The lesson library is being written." `content/lessons/` holds only a template, so lessons could not be tested. The Lessons nav tab leads to an empty page. A lesson link gives "Page not found". | A recruiter sees a lesson with Read, See and Drill. | Until lessons ship, either hide the Lessons tab or label it "Coming soon", and show one sample lesson in the demo. |
| 10 | Priya | MINOR | First run | The first screen explains it in one line, but there is no no-guitar "try it" path. She must choose an instrument and lands on a fretboard with no sound. Time to the first drill was 1.7 s. | A demo or sample drill that answers itself in 60 s. | A first-run "Try a sample drill" path works without an instrument choice and shows feedback within 60 s. |
| 11 | Alex | MINOR | First run | Two `h1`s on the first screen ("Learn the neck you actually play." and "What do you play?"). | One h1, with the picker as h2. | Every route has exactly one h1. |
| 12 | Alex | MINOR | Drill, Tab order | Continue is before the board. A keyboard user on the board who presses Tab leaves the page (focus goes to the body). Enter on the board does Continue, which is good, but it is only hinted via the "Home key" line. | The user is told once that Enter continues. | The on-board hint also names Enter and Space for answering and continuing. |
| 13 | Maya | MINOR | Interval drill | No window is stated, unlike chord-tone. On phone the interval answer is often outside the visible 1-5 range (see #1). Defaults match FR-035 (m3 M2 M3 P4 P5 P8). | The range is stated, e.g. "frets 0 to 12". | The interval prompt or range text says which frets are in play. |
| 14 | Maya | MINOR | Progress import | When the file has nothing new (same file), the dialog still offers an enabled "Import" button. "Restore" vs "Copy" and "profile" and "record" are jargon. | A disabled button or "Close", plain wording. | When nothing is new, the primary action is "Close" or disabled. Counts say "5 answers, 1 instrument", not "6 records". |
| 15 | Maya | MINOR | Wrong-answer feedback | "Incorrect; C on string 6 is at fret 8" never says what I tapped. | "You tapped F (fret 1). C is at fret 8." | Feedback names the note tapped as well as the correct spot. |
| 16 | Alex | IDEA | Fretboard | At 1280x800 the board takes about 700 of the 1100 px available, with big gaps. | Use the full width. | n/a |

## Persona walk-through
### Beginner guitarist (Maya)
- First run to a drill at 390 px: 1.7 s to "Your guitar, mapped". No horizontal page scroll anywhere.
- Note sets verified for 20 questions each. Letters: A to G. Sharps: D#, C#, G#, F#, A#. Flats: Ab, Bb, Db, Gb. All: both. Wrong spellings never appeared in prompts or feedback, and the note-finding feedback had no spelling mismatches.
- Fretboard scrolling on phone: range text "Open and frets 1-5 of 12", jump buttons "Open-5", "6-10", "11-12", and a right cue shown while clipped. All present and correct. But finding #1 stops them being useful after a mistake.
- Progress: empty state is friendly ("No practice recorded yet ... Start a note-finding drill"). Export gave `fretsense-progress-2026-11-22.json` (5.2 KB) with a clear message ("Anyone with it can read them").
- Import of the same file: "Restore from file ... nothing new to import", and the result "Nothing was imported: this file has nothing new." Import into a fresh profile: "Copy from file ... 6 new records will be added" plus a warning that importing again adds them again. This is clear.

### Intermediate bassist (Dev, 4-string and 5-string)
- Root-fifth-octave, arpeggio, interval and chord-tone all run on a 4-string bass at both sizes, with G D A E nut names and bass-aware "low/high" labels on 5-string BEADG ("string 5, low B").
- Feedback uses octave numbers ("C2 is at string 3 fret 3") and names every correct position in the window. That is very good for a bassist.
- Problems: #2, #3, #4. Random roots include D flat, F sharp and D sharp minor, which is harsh for a bassist. A key or root filter exists only for chord-tone.
- My Gear: adding a preset and a custom 4-string bass works; a bad note ("H2") gives a plain error.

### Keyboard and screen-reader user (Alex)
- 14 Tab presses reach Start drill. Focus then lands on "String 6, open, prompted string". The polite live region contains "Question 1 of 20." plus the prompt. After a wrong answer it announces "Incorrect; C on string 6 is at fret 8" (the cross icon is hidden).
- Home returns to the start position, End goes to fret 12, Enter answers and Enter again acts as Continue. Focus then sits on the last answered position. The focus ring is visible (see `alex-01-kb-feedback.png`).
- The accessible names hide the note before answering and show it afterwards ("String 6, fret 1, F2, your tap, incorrect"). Good.
- Colour: markers differ by shape and symbol, not only colour.
- Problems: #11, #12, and #4 (contradicting aria-label). I could not run a real screen reader, only read the DOM.

### Recruiter with no guitar (Priya)
- The first screen explains the product in one sentence, and a hero fretboard appears within 2 seconds of choosing an instrument. It is clear, and nothing is locked.
- But there is no demo and no lessons (#9, #10). Within 60 seconds she can see a neck and answer a quiz but cannot hear anything or see a lesson.

## Persona quotes
> Maya: "It told me the B is at fret 7, but I'm looking at frets 1 to 5. Where is fret 7? I have to guess which jump button to press."
> Dev: "My three wrong taps all got a tick on the chips. And why does my D string say 'C double-sharp'? I just want D."
> Alex: "Enter to continue is a good touch. But the label says C sharp and the text says D flat. Which one do I trust?"
> Priya: "The idea is clear in one line. Lessons are empty, so I can't see the 'learning' half."

## Metrics
| Task | Persona | Time | Completed? |
|------|---------|------|------------|
| First run to the home fretboard | Maya (phone) | 1.7 s | Yes |
| Add a custom 4-string bass, bad note then fix | Dev | about 3 s scripted | Yes |
| Start a note-finding drill from home | Maya | under 2 s scripted | Yes |
| Find the answer on the board after a mistake (fret 7 or higher, 390 px) | Maya | needs a jump press and a scroll | Only by guessing a jump (#1) |
| Keyboard: first drill answer, then Continue | Alex | 14 Tabs and 3 keys | Yes |
| Export, then re-import the same file | Maya | under 2 s scripted | Yes (nothing new) |
| Open a lesson | Priya | n/a | No, the library is empty (#9) |

## Hand-off
Hand this report to the product-owner for triage. Ordering suggestion: #1, #2, #3 and #4 are the "fix now" candidates for T095 and T091. #9 depends on content work.
