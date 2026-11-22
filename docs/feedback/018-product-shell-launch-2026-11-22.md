# Feedback: Product Shell and Launch (018), mode A, 2026-11-22

Spec walkthrough of `specs/018-product-shell-launch/spec.md` (Draft, 2026-11-21), read against
`docs/PRODUCT.md`. Personas: Priya, Alex, Maya, Dev, Sam.

## Summary
- Overall: 4/5 stars. A thorough shell spec, with honest "Available now / Coming in" labels, an
  error catalogue and a measured 2-minute first-run target. The people least served are the ones
  it was written for first: a visitor with no instrument, a keyboard or screen-reader user, and a
  bassist trying the demo.
- Top 3 problems:
  1. "Only the instrument step is required" (FR-005), but Priya and other evaluators don't own an
     instrument, and in v0.1 there's no demo mode, so Try it now is their only way in (finding 1).
  2. v0.1 onboarding asks for My Gear (interfaces, amps) even though nothing in v0.1 uses gear.
     That contradicts FR-010 and loses Maya on jargon (finding 3).
  3. Demo mode's 60-second promise (SC-007) has no stated network condition, though assets are
     downloaded on start (FR-025). Its live pipeline output has no text alternative, and how it
     knows "the visitor plays bass" (US6 AS6) isn't defined (findings 4, 5 and 6).
- What worked well: Open FretSense for returning visitors, and the PWA opening at Home. Not
  asking for permissions in onboarding (FR-007). Errors that never block unrelated features
  (FR-020), with a button that does the fix. The 300 ms skeleton rule (no flashing). Analytics off
  by default and never asked in the first onboarding step. Demo data discarded on exit. Marker
  categories distinguished by shape *and* colour-vision tested (FR-015, SC-005). The
  first-impression test with non-players (SC-006).

## Findings
| # | Persona | Severity | Where (story / screen / FR) | What happened | What I expected | Suggested acceptance criterion |
|---|---------|----------|-----------------------------|---------------|-----------------|-------------------------------|
| 1 | Priya | MAJOR | US2; FR-005 (instrument step required); v0.1 has no demo mode | I press Try it now and I'm asked to choose my instrument. I don't have one. I guess, or I leave. In v0.1 this is the *only* path into the app for an evaluator. | A "just looking" choice that gets me straight to the good part. | The instrument step offers "I don't play yet / just looking", which picks a 6-string guitar in standard tuning, skips the remaining optional steps and lands on Home with a first drill, in ≤ 2 taps after Try it now. SC-001 includes at least 2 testers who own no instrument. |
| 2 | Dev | MAJOR | US2 AS1; FR-005 (one-tap presets); PRODUCT.md v0.1 demo step 2 | The worked example is "Guitar, 6-string, Standard". Nothing says 4- and 5-string bass presets are equally one tap on the first instrument screen, yet the v0.1 demo script picks a 5-string bass. | Bass at the same level as guitar, not under "Custom" or "More". | The first instrument screen shows guitar 6-string standard, bass 4-string (EADG) and bass 5-string (BEADG) as one-tap presets, all visible without scrolling at 390 × 844 px. The ≤ 4-tap rule in US2 AS1 is tested with the 5-string bass too. |
| 3 | Maya | MAJOR | US2 AS2; FR-005 (My Gear step); FR-010 | In v0.1 onboarding asks me to "add an interface or amp from a preset". I don't know what an interface is, and in v0.1 nothing listens anyway. FR-010 says unshipped features must not be shown. | No gear questions until gear does something, and plain words when they appear. | The My Gear step is shown in onboarding only once a shipped feature uses gear (v0.2, 015). When it is shown, its first option is "Just my phone or laptop mic" in plain words, and the words "interface" and "amp" each have a one-line explanation. |
| 4 | Priya | MAJOR | US6; FR-025; SC-007 | Demo assets download only when I press Try the demo, but the 60 s budget (SC-007) names no network speed. On a hotel or office connection the download alone could take most of my minute. | The 60 s is honest for a typical connection, and I can see how long it'll take. | SC-007 states the network condition (for example 20 Mbit/s, measured with throttling in CI) and counts download time inside the 60 s. If the estimated download exceeds 15 s, the progress shows an estimated time and the tour's first step plays from the first clip while the rest loads. |
| 5 | Dev, Priya | MAJOR | US6 AS6; FR-024 | "Given the visitor plays bass, the demo offers both clips." How does it know? There's no step where I say I play bass, and FR-024 only requires a bass clip to exist somewhere in the tour. | A one-tap Guitar or Bass choice, and the whole tour on that instrument. | The demo's first screen offers Guitar or Bass (default Guitar, one tap). The tour, the clip, the tab staff and the notation clef follow that choice, and the ≤ 60 s budget holds for both. |
| 6 | Alex | MAJOR | US6 AS2; FR-022–FR-024; FR-033 | The demo's proof is visual: a pitch trace, a hand overlay and a growing tab. The "nothing important only as video" rule covers only the landing page. With a screen reader, the demo shows me nothing. | Each tour step tells me in text what the pipeline just did. | Every demo tour step has a text caption of what's happening, using live values (for example "Heard A2, string 5, fret 0; camera agrees"), announced politely. Pausing the tour stops the announcements. The SC-004 keyboard run includes the whole demo. |
| 7 | Alex | MAJOR | US2; US3; FR-033 | FR-033 lists WCAG items in general terms, but nothing says where focus goes on a route change, an onboarding step change or after a skeleton resolves. Single-page apps usually leave focus on the old button. | Focus and announcements I can rely on. | On every route change and onboarding step, focus moves to the new page's main heading and the page title updates. Skeletons set the region busy and give a single "Loading" announcement, not one per placeholder. An automated test checks focus after each transition. |
| 8 | Sam | MAJOR | US2 welcome step; FR-005 | I use FretSense on my laptop and now open it on my phone. There's no profile on the phone, so I'm pushed through onboarding again. Sync is a later release (013), and the welcome screen doesn't mention import. | "I already have a profile" on the welcome screen. | The onboarding welcome screen has a secondary action, "Import a profile file" (016 FR-004). A successful import skips onboarding and opens Home on that profile. A rejected import shows the "import rejected" catalogue error and returns to welcome. |
| 9 | Priya | MAJOR | US1 AS2; FR-002 | In v0.1, two of the five pillars are live and three say "Coming in". The tour reads as "mostly not built yet", and nothing on it lets me *see* the live pillars working. | The live pillars first, each one click from a real example. | In the feature tour, available pillars are listed first, each with a deep link straight to a live example (for example Handbook "Dorian on 5-string bass"; a note-finding drill) that skips onboarding on a default instrument. Coming pillars are visually secondary but still honestly dated. |
| 10 | Alex, Maya | MINOR | US3 AS1; FR-008 | The bottom bar holds Home, Lessons, Handbook, Practice "and, once shipped, Studio". In v0.1 the fifth slot isn't defined (Progress? More?). Where the profile switcher lives (FR-012) isn't said either. | A fixed, predictable bar. | For each release the bottom bar's items are listed (v0.1: Home, Lessons, Handbook, Practice, More), and the profile switcher sits in a named place (for example the Home header) that's the same on every screen. |
| 11 | Maya | MINOR | US3 AS3; FR-009 | A fresh profile's Home shows "the first path step and one quick drill". There's no one-line "what to do first" for someone who doesn't know what a path is. | "Start here" with one big button. | On a fresh profile, Home has exactly one primary action ("Start your first lesson" or "Try a 1-minute drill"), with the path shown under it. |
| 12 | Sam | MINOR | US7 AS2 ("a calm screen") | "Asked at most once, on a calm screen" is untestable as written. | A defined moment. | The consent question appears on Home only, after the user's first completed drill or lesson and never during one, at most once. A test checks it never appears in onboarding or in a drill. |
| 13 | Maya | MINOR | US5 AS1; FR-019 | "FretSense can't hear your instrument" is good, but "how to allow the mic in their browser" depends on the browser, and on iOS it's in system Settings, not the browser. | Steps for *my* browser and device. | Mic- and camera-denied messages detect the browser family and platform and show the matching 1–3 steps inline, with the docs link for more (US8 AS1). |
| 14 | Priya | IDEA | FR-002 ("How it's built" link) | "How it's built" goes to `docs/AI-WORKFLOW.md`, a process document. As a recruiter I want proof in 30 seconds: tests, benchmarks, model cards. | A one-page "Engineering highlights". | Backlog: a short engineering page with the live benchmark numbers, test counts and spec → task → test traceability, generated from committed results. |
| 15 | Dev | IDEA | US7 AS4; FR-030 ("What's new") | "What's new" is shown once after an update, but a bassist doesn't care about a guitar-only change. | Release notes that say who each change is for. | Changelog items can be tagged guitar, bass or all, and "What's new" puts items for the active instrument first. |

## Persona quotes
> Priya: "The landing page plan is right: pitch, a video and one button. But in v0.1 the button
> asks me which instrument I play. I don't play anything; I'm here for 60 seconds."

> Maya: "Step four asks me to add an 'interface'. Is that a cable? I just want to learn a song."

> Dev: "If the demo shows a guitar riff and makes me hunt for the bass clip, it's another
> guitar app that tolerates bass."

> Sam: "I've done three weeks of lessons on my laptop. On my phone it wants me to start over.
> Let me import my profile from the first screen."

> Alex: "Colour-vision checks and shape-coded markers: genuinely good. But the demo's whole point
> is visual, and nobody has said what a screen reader hears."

## Metrics (Mode B)
Not applicable (mode A).
