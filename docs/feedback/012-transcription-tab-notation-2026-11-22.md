# Feedback: Studio: Transcription to Tab and Notation (012, amended), mode A, 2026-11-22

Spec walkthrough of `specs/012-transcription-tab-notation/spec.md` (Draft, amended 2026-11-21 as
the Studio destination), read against `docs/PRODUCT.md` and 018. Personas: Priya, Alex, Maya,
Dev, Sam.

## Summary
- Overall: 3/5 stars. The engineering side is strong: evaluation set first, a baseline, per-
  instrument metrics, an exact MusicXML round trip and recording off by default. But the Studio
  as a *screen* is underspecified. There's no first-run or empty state, no pre-permission moment,
  no count-in for recording, an editor and confidence marks that depend on drag and colour, and no
  answer for chords or low B on a laptop mic.
- Top 3 problems:
  1. The editor (US3) and the confidence, estimated and provisional marks (FR-002, FR-011, edge
     cases) have no keyboard path and no non-colour encoding. Alex can't fix a note, and nobody
     can tell a greyed note from a provisional one (findings 9 and 10).
  2. The gear-poor path is promised (US1 AS5) but not designed. Chords strummed into a laptop mic
     with only the monophonic fallback, and a 5-string's low B (≈ 31 Hz) on a laptop mic, will
     both produce confident-looking nonsense (findings 1 and 2).
  3. There's no first-visit, empty-library or pre-permission state. And there's no way to keep a
     great take's audio once "keep recording" was off when I started (findings 3, 4 and 6).
- What worked well: Demo clip as a no-permission source, and the editor's blank score, so the
  Studio has a gear-free path. Positions marked "estimated" without the camera, with honestly
  lower targets (SC-002). The 5-line bass tab and the bass-clef-8vb notation. Refusing a string
  move with a reason (FR-012). Kept recordings deletable separately and out of the export by
  default (FR-020). The storage scan that proves 0 bytes are kept (SC-009). The timed "open Studio
  to exported 4-bar riff ≤ 3 min" test (SC-008).

## Findings
| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|
| 1 | Maya | MAJOR | US1 AS5; edge case "Polyphony beyond model support"; Depends on 009 or 002 | I only know chords, so I strum G–C–D into my laptop mic. If 009 isn't available and the monophonic fallback (002) runs, I get a row of greyed, wrong single notes and think the app is broken. | Being told up front what this device can transcribe, or chords shown as chords. | When the active pipeline is monophonic and polyphonic input is detected (or a strum onset is detected), the Studio shows a single notice ("This device transcribes single notes; chords are shown as chord names only" or "aren't supported yet") instead of filling the tab with low-confidence notes. The notice links to the Docs. The evaluation set (FR-001) includes strummed-chord clips recorded on a laptop mic. |
| 2 | Dev | MAJOR | US1 AS2; US1 AS5 (laptop mic); FR-009 | The low B (≈ 31 Hz) and low E (≈ 41 Hz) are below what most laptop mics pick up reliably. On a mic, my 5-string bass line would lose its lowest notes or show them an octave off, with no warning. | A warning before I record, and honest per-input accuracy. | When the active instrument's lowest open string is below a documented mic-reliable frequency and the input is a built-in mic, the Studio warns before Live or Record starts. FR-009 reports accuracy separately for interface and built-in-mic input, per instrument, including the 5-string's low B. |
| 3 | Maya, Priya | MAJOR | US1 (opening Studio); US6 (empty library); 018 FR-018 | The spec starts at "chooses Live or Record". It doesn't say what a first visit with an empty library looks like, or how Live, Record, Demo clip and "start from scratch" are explained. | Three or four clear choices with one line each, and a no-permission way to see it work. | On the first Studio visit, the screen shows each source (Live, Record, Demo clip, Blank score) with a one-line plain-language explanation. Demo clip is marked "no microphone needed". The empty library shows one sentence and one action. Neither has an empty panel. |
| 4 | Maya, Sam | MAJOR | US1; FR-008 (mic only while active) | Pressing Live jumps straight to the browser's mic prompt. Nothing tells me first that audio stays on my device or that listening stops when I stop. | A short, honest explanation before the browser asks. | Before the first mic (or camera) request, a one-screen explanation states that FretSense listens only while Live or Record is on, that audio stays on the device, and that nothing is kept unless "Keep recording" is chosen, with Continue and Not now. Not now offers Demo clip and Blank score. |
| 5 | Sam | MAJOR | US1 (Record); US2 (tempo estimation); FR-004; FR-010 | Count-in exists only for playback (US4). To record to a steady beat I have to bring my own metronome, and the app then has to *guess* a tempo I already knew. | An optional click and count-in when recording, with that tempo used as the grid. | Live and Record offer an optional count-in (1 or 2 bars) and a click at a chosen tempo (40–240 BPM) and meter. When the click is on, the transcription uses that tempo and meter instead of estimating them. The click is never recorded into the take. |
| 6 | Sam | MAJOR | FR-008 (keep recording: per-take opt-in, off by default); US4 (switch to recording) | I nail a take with "keep recording" off. Afterwards I want to hear it against the transcription, but the audio was never kept. The spec doesn't say whether the choice is made before or after the take. | Being able to decide after hearing myself, without anything being stored by default. | After a Record take stops, the user is asked "Keep the recording of this take?" The audio is held in memory only until they answer and is discarded if they decline or leave the screen. The SC-009 storage scan still finds 0 bytes when they decline. |
| 7 | Dev, Sam | MAJOR | US1; edge cases; 018 US5 AS2 | No edge case covers the interface being unplugged, or the tab losing focus, *during* a Record take or a Live session. Without one, I could lose a 90-second take. | The take so far is kept. | If the input device disconnects or the audio context is suspended during Live or Record, capture stops, the notes so far are kept and transcribed, 018's "interface disconnected" state is shown, and the user can continue in a new take. An automated hot-unplug test checks that no notes are lost. |
| 8 | Maya | MAJOR | US5; FR-007; US2 AS2; FR-011 | The words on screen are MusicXML, Guitar Pro, quantised, tempo map, proportional notation, estimated, provisional and confidence. I don't know which export I want, or what "proportional notation" means. | Plain descriptions in the places I make choices. | Each export option has a one-line plain description ("For notation apps", "To print", "Text you can paste into a message"). Every notice in this spec is written without the terms quantise, tempo map or proportional, or links a glossary entry. Plain-text tab and PDF are listed first. |
| 9 | Alex | MAJOR | US3 AS2 (drag a note to another string); FR-006 | Moving a note is described as dragging. No keyboard model is given for selecting a note, changing string or fret, or entering durations, and the editor gives a screen reader nothing to announce. | A complete keyboard editor, with the selected note read out. | Every editor action has a keyboard path: Left and Right move between notes, Up and Down move to another string (with the FR-012 refusal announced), number keys type a fret, and documented shortcuts set duration and technique. The selected note is announced as bar, beat, string, fret, pitch and duration. The shortcuts are listed in the Docs and in an in-editor help panel. |
| 10 | Alex | MAJOR | FR-002 (confidence); FR-011 (provisional); edge case (low-confidence shown greyed); US1 AS4 (estimated) | Four states (normal, estimated, provisional, low-confidence) seem to be shown by grey or tint. Greyed text may fail contrast, and I can't tell "provisional" from "low confidence" by colour. | Each state with its own visible marker, and a legend. | Estimated, provisional and low-confidence notes each have a distinct non-colour marker (for example an outline, a dashed underline, a "?" glyph), explained in a legend on the tab. Every mark keeps ≥ 3:1 contrast in both themes, and the state is included in the note's text alternative. |
| 11 | Sam | MAJOR | Practice-session value ("compare what they played with what they meant to play") | The value statement promises this, but no story or FR delivers it. | Either a way to compare against a target, or no claim. | Either remove the claim, or add a story: the user picks a reference (a handbook entry, a lesson exercise or another transcription), and the Studio marks wrong notes, wrong positions and timing offsets per note. Backlog candidate for after v1.0 if it's added. |
| 12 | Priya | MINOR | US1 AS4; FR-011 (positions may change for up to 2 s) | Watching Live with the camera off, fret numbers change under my eyes. Without knowing why, it looks like a bug. | A hint the first time it happens. | The first time a provisional position changes in a session, a one-line inline hint explains that positions settle as more notes arrive. It's not shown again for that profile. |
| 13 | Alex | MINOR | US1 (Live); FR-033 in 018 (announced state changes) | If every note that appears in Live is announced, a screen reader floods. If none is, Live is silent. | A sensible default. | In Live, the screen reader gets a polite summary at most once per bar ("Bar 4: 6 notes"), and the full detail is available on pause. |
| 14 | Maya, Sam | MINOR | FR-007 (NEEDS CLARIFICATION: which formats in v1.0) | User view for the clarify step: plain-text tab and PDF are what Maya and Sam would actually use. Guitar Pro matters least to them. | — | Recommend that v1.0 ships plain-text tab, PDF and MusicXML, and that Guitar Pro may follow. (Input to clarify; product-owner decides.) |
| 15 | Sam | MINOR | US6; FR-019 ("search them") | It doesn't say what library search matches: name only, or also instrument, date, key or tempo. | Find "that bass line in E from last week". | Library search matches name and instrument, and can be filtered by date range. Results show the instrument, date, length and whether a recording is attached. |

## Persona quotes
> Priya: "Demo clip turning into tab with no permission prompt: that's the headline and it's
> right. But I want to know what I'm looking at when I first open the Studio, before I press
> anything."

> Maya: "I strummed my three chords and got a line of grey numbers. Is it broken, or am I? And
> what's MusicXML? I just want to print it."

> Dev: "5-line tab and a bass clef from day one: thank you. On my laptop mic the low B just won't
> register, though, and the spec doesn't warn me."

> Sam: "Let me play to a click, and let me keep the take *after* I hear it was a good one. And
> you promised I could compare it to what I meant to play. Where is that?"

> Alex: "Every editing example is a drag, and every confidence state is a shade of grey. I can't
> fix a single note with the keyboard, and I can't tell 'provisional' from 'unsure'."

## Metrics (Mode B)
Not applicable (mode A).
