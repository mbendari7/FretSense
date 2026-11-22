# Feedback: 001 theory, fretboard and lessons (v0.1), Mode B (hands-on), 2026-11-22

Build tested: production preview at http://localhost:4173, driven with Playwright/Chromium at 1280x860 and 390x844 (touch). Fresh browser context per persona. Screenshots are in
`C:\Users\myfun\AppData\Local\Temp\claude\b99365817b77b45e\f4abc594-1fb9-4c4b-80f1-3ec67fca7b05\scratchpad\shots-ut\` (referred to below as `shots-ut\`).
No source, tests or specs were edited. No console errors were seen in any run.

Known gap, not repeated in detail: the lesson library is empty (content/lessons/ permissions pending). I only comment on how the product behaves around the gap (finding 1).

## Summary
- Overall: 3.5/5 stars. The explorer, key helper and drills are solid, correct and fast, bass is treated as a first-class citizen, and the whole thing is clean and keyboard-usable. But the product's own headline path ("Start with a lesson") dead-ends, the phone fretboard hides half the neck with no hint, and a few drill prompts and feedback messages would lose a beginner.
- Top 3 problems:
  1. MAJOR: The primary home CTA and the "Lessons" nav item lead to an empty page, and the home title says "Pick up where you left off" to someone who has never done anything (Priya and Maya both hit this in their first 30 seconds).
  2. MAJOR: On a phone the fretboard is cut off at about fret 6 (694 px board in a 358 px box) with no scroll cue, so drills that ask for frets 7 to 12 look impossible.
  3. MAJOR: Keyboard and screen-reader users lose focus on every route change and drill start (focus drops to BODY, 10+ Tab presses to get back to the content), and the next question prompt is not announced.
- What worked well:
  - Instrument picker is clear, takes about 2 seconds (first-run to home 1.7 s in my timing), and the page title promise "Learn the neck you actually play" is understandable in under 10 seconds.
  - Drills are correct. I computed the right fret from the prompt 20 times in a row on guitar and got 18/20 with my 2 deliberate misses; correct answers auto-advanced (about 0.6 s), wrong answers stopped on a "Next question" button and showed the correct spot. Success path and failure path both behave.
  - Wrong answers are not colour-only: pink square with an X, a dashed ring on the right answer, plus text. Good for colour blindness.
  - Bass parity is real: the 5-string BEADG picker option, string 1 = G numbering in drills, a B string on the neck, "R / 3 / 5" labels in the key helper, and four bass-pattern drills (root-fifth-octave, arpeggios, walking bass, octave shapes) that run on a 5-string. Walking bass correctly rejected the target note itself as a "lead into C" approach.
  - Fretboard buttons have real labels ("String 3, fret 5, ..."), arrow keys move between positions (roving tabindex), focus ring is clearly visible (amber), skip link exists, landmarks (header/nav x2/main) exist.
  - Settings persist across reload; dark theme, large text, "Wait for me" after right answer all work and are in the right place.
  - Export gave a real file (`fretsense-progress-2026-11-22.json`), with a plain-language warning that anyone holding it can read it. Reset is gated behind an inline confirmation with "Export first" advice. "FretSense never uploads anything" is stated where it matters.
  - Phone: no horizontal page scroll on any screen (all `scrollWidth == innerWidth`), bottom tab bar, 48x44 px fret tap targets.

## Findings

| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|
| 1 | Priya, Maya | MAJOR | Home, "Start with a lesson / Browse the library" card, sidebar "Lessons" (/library) | The first card on home and the Lessons nav lead to a page that says only "No lessons yet. The explorer and drills work without them." The lesson-first promise in PRODUCT.md is the first thing a visitor clicks and it is a dead end. (Known gap is the content; the point here is the UX around it.) | While the library is empty the home card should not present itself as the primary path. Lessons nav should say what is coming, or be hidden, and send me to the thing that works. | While the library has zero lessons, the home screen shows Explore/Drills as the lead actions, the Lessons page shows an explanatory empty state with 2 working links (Explorer, a drill) and a "coming" note, and no card labelled "Start with a lesson" is shown. |
| 2 | Maya, Priya | MAJOR | Home heading on first visit after picking an instrument | The heading reads "Pick up where you left off." on the very first screen after setup, and the card below is a generic C major scale, not "something I left". The "This week" card says "No answers yet". | "Welcome" or "Here's your guitar". "Where you left off" only when there is a left-off point. | When no drill, lesson or explorer state has been saved for the profile, the home heading does not claim a resume ("Pick up where you left off" appears only after at least one saved activity). |
| 3 | Maya | MAJOR | All screens at 390 px, drill fretboard (.fretboard-scroll) and Explorer board | The board is 694 px wide inside a 358 px scroller. Only frets 1 to 6 show, the right edge is sliced mid-fret, and there is no arrow, fade or hint. A note-finding drill whose answer is at fret 9 looks unanswerable on a phone. Home board is also cut ("B" half visible at right edge). Screenshots: `shots-ut\ph-nfq.png`, `shots-ut\ph-explore.png`, `shots-ut\ph-2-home.png`. | The whole 12-fret neck visible (rotate the board vertically, or shrink it), or at minimum a visible scroll cue and a way to jump to frets 7 to 12. | At 390x844 every drill question shows either all frets in the configured window, or a visible "scroll for more frets" cue plus a "Frets 7 to 12" jump control; the home preview shows no clipped half-note. |
| 4 | Alex | MAJOR | Every route change; Start drill; first-run instrument pick | After pressing Enter on an instrument or Start drill, `document.activeElement` is BODY. Next Tab starts at "Skip to content" and goes through logo, My Gear, Settings, 6 nav items (11 stops) before reaching the content. On every drill question the keyboard user pays that cost again after "Start drill". | Focus moves to the page heading (or the first interactive control in the new view) on navigation, and to the board or the prompt when a drill starts. | After any route change or drill start, focus is placed on the new view's h1/h2 (programmatic, `tabindex=-1`) and a Playwright test asserts `document.activeElement` is inside `main`. |
| 5 | Alex | MAJOR | Drill screen, prompt (#prompt is an `h2` with no live region) | When the next question appears, nothing announces it. Only the result line ("Correct: A#2") is a live region. A screen-reader user who answers, hears "Correct", then does not know a new question loaded or what it is. | The new prompt is announced when it changes ("Question 4 of 20. Find D on string 5"). | The question prompt element (or a polite live region) announces "Question N of M" plus the prompt text on every advance; test via accessible-name/aria-live assertion. |
| 6 | Maya | MAJOR | Chord tones drill prompt: "In A, find the 3 (the third)" | "In A" is a chord symbol, it does not say "A major". "3" vs "b3" is the thing being tested, and I (as Maya) have no idea whether A means the chord, the note, or the key. Dev (bassist) gets it; a beginner will guess. The setup screen lets me pick chord types like "Half-diminished (m7b5)", and the prompt then says "In Cm7b5, find the 5" with no word "chord". | "In the A major chord, find the 3rd (the note that makes it major)." | Every chord-tone and arpeggio prompt names the chord quality in words ("A major chord", "F dominant 7th chord") and uses "3rd/5th/7th" not bare digits; a unit test checks the prompt text for each chord type. |
| 7 | Dev | MAJOR | Walking bass drill, beat 4 feedback | Tapped the root C where beat 4 says "lead into C". Feedback: "Not quite: that's C3. The beat 4: lead into C is marked." It does not say WHY (the approach note must be a step away, not the target) and the sentence is broken English ("The beat 4: lead into C is marked"). Marked answers also include G, Bb, B, C#, D with no explanation of what makes them valid. | "That's the target note itself. A lead-in sits a half or whole step away from C." | Walking-bass wrong-answer feedback states the rule for the beat in one plain sentence and never concatenates the beat label into a sentence; for beat 4 it names the allowed approach types. |
| 8 | Dev, Maya | MAJOR | Walking bass / any drill, open strings (fret 0) | Open-string positions are drawn off the left side of the nut as faint dashed circles with very low-contrast labels (and the beat-1 green check lands there). I could tap them, but I had to know they were there. In note-finding drills there is no visual mark at all for fret 0 until a wrong answer reveals it. Screenshot `shots-ut\b-walk-4.png`. | Open strings clearly drawn as tappable positions with readable labels, same size as fretted positions. | Open-string positions render at the same size and contrast ratio (>= 3:1 for the marker, >= 4.5:1 for the label text) as fretted positions, in all drills and in the explorer. |
| 9 | Maya | MINOR | Note finding, feedback consistency | Prompt "Find B♭ on string 5" gave "Correct: A♯2". Another prompt "Find A♭" marked the answer as "G♯" on the board. The app mixes sharp and flat spelling within one question. A beginner reads that as a bug or as two different notes. | Use the prompt's spelling throughout the question ("B♭2"). | Within one drill question, the prompt, the on-board label and the feedback message use the same enharmonic spelling. |
| 10 | Maya | MINOR | Note finding board | The drill board has no string names or note labels, only the amber highlighted string. Prompt says "string 4 (D)" and there is no way to check by eye which line that is, other than the highlight. Works, but I would be counting strings out loud. | Letter names at the nut end of each string, as on Explore. | Drill boards show the open-string name at the left of each row. |
| 11 | Maya | MINOR | Drill summary | Summary shows only "90% correct, 18 of 20" and a per-string table. It never tells me WHICH notes I missed, and the only exit is "Practise again". No "See progress" or "Back to drills". | The two or three notes I got wrong, and next steps. | The summary lists the missed items (note and string) and offers links to Progress and Drills. |
| 12 | Priya | MINOR | First screen / Home | In 60 seconds I understood: guitar/bass fretboard trainer, private, local. I did not see anything that says it is a research-grade product (no mention of the on-device ML/vision direction, no sample "this is what a finished lesson looks like", no screenshot of drills on home). The home page itself is a single scale preview and four plain cards. The Explorer is the impressive screen and it is two clicks away. | A recruiter-visible "wow" within 10 seconds: a hero with an animated or interactive fretboard, or at least a link to a no-setup demo. | The first-run screen offers a "Try it without choosing" path (default 6-string guitar) so a visitor can reach an interactive fretboard in one click. |
| 13 | Priya | MINOR | First-run | I have to choose an instrument to see anything at all. For a person with no guitar, "What do you play?" is a gate. | "Just looking" button. | First-run shows a "Just looking, use a 6-string guitar" button that sets the default and goes to Home (instrument can be changed later). |
| 14 | Alex | MINOR | Explorer / key helper fret buttons | Accessible names stutter: "String 1, fret 0, E4: E4, degree 3". Fretboard SVGs have no role or label; only the buttons do. | "String 1, open, E4, degree 3 (major third)". | Fret button names follow one pattern, "String N, fret F (open for 0), <note>, degree D", with no repeated note names. |
| 15 | Alex | MINOR | Drill focus start | In a drill, focus starts at string 1 fret 0, even when the prompted string is string 6. Keyboard user arrows down 5 times for every question. | Focus starts on the prompted string. | At question start, keyboard focus lands on fret 0 of the prompted string (or the first target position). |
| 16 | Dev | MINOR | Explorer root picker | Root buttons spell black keys one way only (D♭, E♭, F♯, A♭, B♭ in light theme; C♯, D♯, F♯, G♯, B♭ in dark theme once A is the root). Choosing "E minor pentatonic on bass" is fine, but I cannot choose C♯ vs D♭ when I want one. | Both spellings available, or follow the key. | Root picker offers an enharmonic toggle, and the chosen spelling is carried into note labels. |
| 17 | Sam | MINOR | Custom instrument form (/gear/instruments?new=1) | Header says "Any tuning, 4 to 8 strings", but the form I saw offered only 6, 7 or 8 strings for the guitar family. | Same range as the label. | The string-count options and the card label agree for each instrument family. |
| 18 | Dev | IDEA | Drills (all), bass patterns | Walking bass is the only drill that uses a real progression (Cmaj7, Am7, Dm7, G7 in C). No choice of progression or key (12-bar blues, ii-V-I in any key). | Pick the progression. | A setting to choose from 3 or more progressions and keys, stored per profile. |
| 19 | Sam | IDEA | Home / Progress | No way yet to say "I'm on chapter X of my book" and jump to the related drill; packs exist in Settings ("Lesson pack: General Theory") but there is nothing to browse. I could not evaluate pack-jumping because there are no lessons (known gap). | Pack picker with chapter list when lessons ship. | n/a until lessons land; revisit in Mode B for the next group. |
| 20 | Priya, Maya | IDEA | Progress | Progress screen is a table and a bar. No streak, no "you improved" picture. Fine for v0.1, but this is what a recruiter or a returning learner would look at to decide the product is "alive". | A small chart of accuracy over days. | Progress shows a per-day accuracy chart with a text alternative table. |

## Persona notes

### Maya (beginner guitarist, 16, laptop, no interface)
- Picked "6-String Guitar, Standard (EADGBE)" in 2 clicks. Understood that. "What do you play?" is friendly.
- Home: "Pick up where you left off" confused me (finding 2). Clicked "Start with a lesson", got an empty page (finding 1). This is where a 16-year-old closes the tab. I only carried on because I was told to.
- Drills were fine for note finding. A highlighted string, a letter, tap a fret. Wrong answers give me a clear X and show me the right spot. Good.
- Chord tones prompt "In A, find the 3" lost me completely (finding 6).
- On the phone I could not see past fret 6 (finding 3).

### Dev (intermediate bassist, 5-string BEADG)
- 5-string BEADG is a one-click preset. Neck shows B at the bottom, G on top, which matches how I read a bass. Drill strings listed "1 (G) ... 5 (B)". Good parity.
- The four bass-pattern drills are what I came for. Walking bass is great in idea, but one fixed progression and the beat 4 feedback is unhelpful (finding 7). Open strings are hard to see (finding 8). Arpeggio and root-fifth-octave prompts are clear ("Play the 5th, then the octave, from this root (E)").
- Key helper shows R/3/5 on my bass; seventh chords toggle exists. Useful.
- Nothing felt guitar-only, apart from the empty lesson library.

### Sam (self-taught, theory book)
- No lessons, so I cannot test my book. The pack setting ("Lesson pack: General Theory") exists. Explorer and key helper are the most useful things right now: shareable URLs (`/explore?root=A&scale=minor-pentatonic`) work and let me bookmark a scale.
- Nothing is locked, I can open any drill or scale in any order. That part is right.

### Priya (recruiter, no guitar, 60 seconds)
- 10 s: I get it, "guitar and bass trainer, private". Clean look, no errors, loads instantly.
- 30 s: I had to pick an instrument I do not play (finding 13). Home gave me one fretboard and four cards; the lead card was a dead end (finding 1).
- 60 s: I found Explorer and Drills. They are real and polished. I did not find any sign of the "ML and vision" ambition, or a sense of how big this is. As a hiring manager, a 90 second path that shows the best screen first would help (findings 12 and 13). It does read as a credible, careful product, not a toy: privacy copy, export/import, settings, accessibility.

### Alex (colour-blind, keyboard-only)
- Colour is never the only signal: correct/wrong use icons and text; root notes are diamonds, not just orange; selected key is dark fill and a border. Good.
- Skip link, landmarks, visible amber focus ring, roving arrow-key navigation inside the fretboard: all good.
- Problems: focus is lost on navigation and drill start (finding 4), the new question is not announced (finding 5), fret button names stutter (finding 14), focus starts far from the prompted string (finding 15), open-string label contrast (finding 8).
- Dark theme and large text both work and persist. I did not run an automated contrast tool (axe is not installed in the project), so contrast numbers above are visual judgement, not measurements.

## Metrics (Mode B)
| Task | Persona | Time | Completed? |
|------|---------|------|------------|
| First run: pick instrument and reach Home | Maya | 1.7 s (script, includes page load) | Yes |
| Understand what the product is from first screen | Priya | about 10 s (reading) | Yes |
| Find a lesson to start | Maya, Priya | n/a | No, library empty (known) |
| Note-finding drill, 20 questions, computing correct frets | Maya | about 20 s scripted (0.5 s per answer, 0.9 s auto-advance wait) | Yes, 18/20 (2 deliberate misses) |
| Auto-advance after a right answer | Maya | about 0.6 s (default setting) | Yes |
| Wrong answer then continue | Maya | needs a click on "Next question" | Yes |
| Walking bass bar (4 beats, 5-string) | Dev | 4 taps; beat 4 rejected when I tapped the target | Partly (beat 4 failed on purpose) |
| Chord tones / intervals / root-fifth-octave / arpeggio / octave shapes drills start on 5-string | Dev | each loads and prompts correctly | Yes |
| Export progress then see reset confirmation | Sam | 2 clicks each; file `fretsense-progress-2026-11-22.json` downloaded | Yes |
| Change to dark theme, large text, wait-for-me; reload | Alex | 3 clicks; persisted | Yes |
| Keyboard: reach drill content after Start drill | Alex | 11+ Tab presses (focus resets to BODY) | Yes, slowly |
| Phone: use a drill needing frets 7 to 12 | Maya | scroll area exists but is not signposted | Only if you guess to swipe |
| Console errors across all runs | n/a | 0 | n/a |

## Not tested
- Real-time or audio features (not in v0.1).
- Left-handed toggle on the Explorer (my script could not find the control by button role; may be a radio, not a defect), import of a file, 7/8-string custom instruments end to end, screen reader audio output, and automated contrast measurement. These need a follow-up pass.

## Persona quotes
> Maya: "It asked me what I play, I tapped my guitar, and then the first big button says 'Start with a lesson' and takes me to a blank page. I'd be gone."
> Maya: "'In A, find the 3'? A what? The note A? The A chord? What's a 3?"
> Maya (phone): "Where's fret 9? The neck just stops."
> Dev: "Finally a bass drill that doesn't make me read a guitar neck. Walking bass is the right idea, but tell me why my beat 4 was wrong."
> Sam: "Bookmarkable explorer links are great. I'll come back when my chapters are in."
> Priya: "Looks careful and finished, but I had to pick an instrument I don't play, and the first thing I clicked went nowhere."
> Alex: "I can see where I am and the arrow keys on the neck are lovely. But every time I start a drill, I'm thrown back to the top of the page."
