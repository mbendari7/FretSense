# Feature Specification: Product Shell and Launch

**Feature Branch**: `018-product-shell-launch` (to be created by the owner)

**Created**: 2026-11-21

**Status**: Draft (specify; spec-reviewer BLOCK and product-owner REVISE folded in; clarified 2026-11-22; spec-reviewer re-review PASS WITH NOTES; see reviews/ for product-owner status)

**Input**: User description: "Everything that makes it feel like a product: a landing page (the pitch, a short demo video or GIF, a feature tour, and a 'Try it now' button); demo mode that works with NO guitar, interface or camera, where bundled recorded audio and video clips play through the real pitch, vision and transcription pipeline in the browser, so a recruiter can see everything in 60 seconds; first-run onboarding (create a profile, set up My Gear or skip, goals, and a suggested learning path); app navigation (Home (today's practice), Lessons, Handbook, Practice, Studio (record → tab and notation), Progress, Settings); a consistent design system (colour-blind-safe colours, typography, components, dark and light themes, responsive down to phones); accessibility (WCAG AA), loading and empty states, friendly error states (no mic, camera denied, device unplugged), and an offline indicator; production quality (deployed on a custom domain, PWA install, performance budget with Lighthouse at least 90, privacy-friendly opt-in analytics, error tracking, a changelog and release notes); a /docs section with a user guide, FAQ and gear setup guides."

**Practice-session value**: the shell gets the player practising sooner and keeps them there. A
new player goes from the landing page to their first drill in under two minutes with no gear. A
returning player opens the installed app and starts today's practice in two taps. When something
goes wrong (the mic is blocked, the interface is unplugged), they're told what happened and how to
keep practising, instead of hitting a dead end.

**Release** (`docs/PRODUCT.md`): **shell and onboarding** ships in **v0.1 "Fretboard"** (US1–US5,
US7 baseline, US8 core docs). **Launch polish** ships in **v1.0 "It writes it down"** (US6 demo
mode, US7 analytics and error tracking, the remaining docs). Each FR is tagged with the release
it ships in (usually *[v0.1]* or *[v1.0]*; parts owned by other features carry those features'
releases). Navigation destinations, error states and docs pages appear as their features ship
(FR-010).

**Depends on**: 001 (PWA, offline, accessibility FR-045–FR-050, route contract), 016 (profiles
FR-001–FR-004, My Gear FR-005–FR-009, onboarding questions FR-010, path generation FR-011, next
step FR-013), 017 (Handbook). *[v1.0]* also depends on 002, 003, 008, 009, 010 and 012 (the
pipeline that demo mode drives) and 015 (device error states). **Enables**: every user-facing
feature uses its navigation, design system and state patterns. **Constitution**: VI (offline,
390 px, no account), IX (opt-in telemetry, no media leaves the device), XI (graceful degradation),
XIII (never locked), V (performance claims backed by benchmarks). **Lesson stages**: none; it
hosts them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Landing Page (Priority: P1) *[v0.1]*

A visitor arrives at the product URL. One screen tells them what FretSense is, who it's for and
why it's different. A short looping demo shows the app in use, a feature tour walks through the
five pillars, and **Try it now** opens the app. No sign-up, no install needed.

**Why this priority**: it's the first thing an employer or a new player sees. If it doesn't land in
10 seconds, nothing else gets seen.

**Independent Test**: a 10-second first-impression test with at least 5 people who don't play
(SC-006), plus Lighthouse on the landing page (SC-003).

**Acceptance Scenarios**:

1. **Given** a first visit on a phone, **Then** the pitch, the demo media and **Try it now** are all
   visible without scrolling at 390 × 844 px.
2. **Given** the feature tour, **Then** each pillar (Learn, Look up, Practice, Hear and See, Write)
   is marked honestly as **Available now** or **Coming in vX.Y**, matching the release that's live.
3. **Given** the user has "reduce motion" set, **Then** the demo media shows a still image with a
   play button, and nothing autoplays.
4. **Given** a returning visitor who has completed onboarding on this device, **Then** the landing
   page offers **Open FretSense** first, which goes straight to Home on the last active profile.
5. **Given** *[v1.0]*, **Then** a **Try the demo** button sits beside Try it now (US6).

---

### User Story 2 - First-Run Onboarding (Priority: P1) *[v0.1]*

After Try it now, a short flow sets the player up: welcome → instrument → **Start practising**
(straight to Home) or **Personalise** (profile name → My Gear (from v0.2) → goals → suggested path) → Home,
with the first step ready. It runs 016's onboarding questions and path generation; this feature
owns the flow, the screens and the skip and resume behaviour.

**Why this priority**: a personalised product has to collect a little information, without
losing the player before they play a note.

**Independent Test**: timed first-run sessions with no gear (SC-001), plus automated runs that
skip each optional step in turn.

**Acceptance Scenarios**:

1. **Given** a first run, **When** the user picks "Guitar, 6-string, Standard" and taps Start
   practising, **Then** they reach Home with 016's default path and a first step in ≤ 3 taps after
   Try it now (welcome → preset → Start practising). The same holds with 4-string bass EADG and
   5-string bass BEADG chosen at the preset step.
2. *[v0.2, once 015 ships]* **Given** the user chooses Personalise, **Then** the gear step offers
   "Just my phone or laptop mic" first, then an interface or amp (each with a one-line
   explanation) from a preset or from scratch (016 FR-006, FR-007), or skip, and it can be revisited
   from Settings. In v0.1 the gear step isn't shown.
3. **Given** the user answers the goals (016 FR-010), **Then** a suggested path (016 FR-011) is
   shown with a one-line reason per item, and the user can accept it, edit it, or start without
   one.
4. **Given** the user closes the app mid-onboarding, **When** they return, **Then** onboarding
   resumes at the same step with their answers kept, and they can still skip the rest.
5. **Given** onboarding is finished, **Then** it never shows again for that profile, but can be
   re-run from Settings without losing progress.
6. **Given** Try it now, **When** the user picks "I don't play yet / just looking", **Then** Home
   with a first drill shows in ≤ 2 taps.
7. **Given** the welcome screen, **When** the user imports a profile file, **Then** onboarding is
   skipped and Home opens on that profile; a rejected file shows the "import rejected" error and
   returns to welcome.

---

### User Story 3 - App Navigation and Home (Priority: P1) *[v0.1]*

The app has seven destinations: **Home** (today's practice), **Lessons**, **Handbook**,
**Practice**, **Studio**, **Progress** and **Settings**. On a phone, the most used destinations
sit in a bottom bar; on wider screens, in a side rail. Home shows today's practice: the path's
next step, a resume of the last lesson, favourites and a quick drill.

**Why this priority**: the structure every feature hangs on, and the place a session starts.

**Independent Test**: an E2E crawl of every destination at 320, 768 and 1280 px, keyboard-only,
on a fresh profile and a profile with history.

**Acceptance Scenarios**:

1. **Given** a phone (≤ 600 px wide), **Then** a bottom bar shows 4 destinations plus **More**,
   which holds the rest. The current destination is shown by an icon change and a label, not
   colour alone.
2. **Given** v0.1 is live, **Then** Studio is not shown, because its feature hasn't shipped
   (FR-010). **Given** v1.0, **Then** Studio is shown.
3. **Given** a fresh profile, **Then** Home has exactly one primary action ("Start your first
   lesson", or "Try a 1-minute drill" when there's no path), with the path below it and no empty
   panels.
4. **Given** a profile with history, **Then** Home shows the path's next step, the last lesson to
   resume, up to 4 favourites, and (once 006 ships) the planned review items. Every item opens in
   one tap.
5. **Given** any screen, **Then** the active profile and a profile switcher are reachable in at most
   2 taps.

---

### User Story 4 - Design System (Priority: P1) *[v0.1]*

Every screen is built from one set of design tokens (colour, type, spacing, radius, elevation,
motion) and one component library, in light and dark themes, colour-blind safe, from 320 px phones
to desktop monitors. A living style guide page shows every component in every state.

**Why this priority**: consistency is what makes a project feel like a product, and accessibility
has to be designed in, not bolted on.

**Independent Test**: automated contrast and colour-vision checks on the tokens, plus visual
regression of the style guide in both themes at 5 widths.

**Acceptance Scenarios**:

1. **Given** the theme is "System", **When** the OS switches to dark, **Then** the app follows
   without a reload. The user can also pin Light or Dark.
2. **Given** the fretboard's marker categories (root, chord tone, scale tone, target, correct,
   wrong), **Then** each pair is distinguishable under protanopia, deuteranopia and tritanopia
   simulation, *and* each category has its own shape or label.
3. **Given** any component in the style guide, **Then** it shows its default, hover, focus, active,
   disabled, loading and error states, in both themes.

---

### User Story 5 - Loading, Empty, Error and Offline States (Priority: P1) *[v0.1]*

Every screen has a designed loading, empty and error state. Errors say what happened, why, and
what to do, with a button that does it. They never block features that don't need the failed
part. An offline indicator appears when the connection drops, and says nothing important is lost.

**Why this priority**: the product principle "finished means every state". The no-mic,
camera-denied and unplugged cases are when users quit.

**Independent Test**: an automated test triggers every entry in the error catalogue (FR-019) and
checks the message, the action and that unrelated features still work.

**Acceptance Scenarios**:

1. *[v0.2, with 015]* **Given** the mic permission is denied, **When** the user opens a feature that listens, **Then**
   they see "FretSense can't hear your instrument", the reason, how to allow the mic in their
   browser, and a button to continue with tap input. Handbook, lessons and tap drills keep working.
2. *[v0.2, with 015]* **Given** an audio interface is unplugged mid-drill, **Then** the drill
   pauses with "Your interface was disconnected", and offers the built-in mic in the meantime. When
   the interface returns, it resumes as 015's device lifecycle defines (015 FR-008), which this
   feature doesn't override.
3. *[v0.4, with 008]* **Given** the camera is denied, **Then** the camera features say so, explain how to fix
   it, and the audio-only path stays available.
4. **Given** the device goes offline, **Then** an offline indicator appears within 2 s, and every
   core feature keeps working.
5. **Given** a screen takes more than 300 ms to load, **Then** a skeleton of its layout shows;
   below 300 ms nothing flashes.

---

### User Story 6 - Demo Mode (Priority: P1 for v1.0) *[v1.0]*

**Try the demo** works with no instrument, interface or camera, and asks for no permission.
Bundled audio and video clips run through the *real* pitch, onset, vision, fusion and
transcription pipeline in the browser. A guided tour shows each pillar, ending in the Studio with
tab and notation. A recruiter sees the whole product in 60 seconds.

**Why this priority**: the people who most need to see FretSense working (employers, reviewers)
are the least likely to have a guitar and an interface to hand.

**Independent Test**: from a clean browser on the reference laptop, press Try the demo and time
how long it takes to reach a transcribed tab; check that there were 0 permission prompts and that
the output matches the clip's labels (SC-007).

**Acceptance Scenarios**:

1. **Given** a clean browser, **When** the user presses Try the demo, **Then** no mic or camera
   permission is requested, a "Demo" badge stays visible, and the first clip starts within 5 s.
2. **Given** a demo clip is playing, **Then** the live pitch trace, the hand overlay with the
   detected string and fret, and the growing tab are all produced by the same pipeline a real user
   gets, not pre-rendered. Detected notes are also announced as text (pitch, string, fret) for
   screen readers.
3. **Given** the guided tour, **Then** it has at most 6 steps, each skippable, and reaches the
   Studio's tab and notation within 60 s of pressing Try the demo.
4. **Given** the device can't run the vision tier, **Then** the demo continues on the audio-only
   path with a notice, as a real user would (Constitution XI). The 60 s limit still applies, and
   positions are judged against 012's optimizer-only target.
5. **Given** the user leaves the demo, **Then** no demo data stays in any profile, and the app
   returns to the landing page or to their own profile.
6. **Given** the demo's first screen, **Then** the visitor chooses a guitar clip or a bass clip
   (guitar is preselected), and can switch at any step.
7. **Given** any demo clip, **Then** the demo shows that clip's measured accuracy from the
   evaluation report, and links to the report. It never implies accuracy it hasn't measured.

---

### User Story 7 - Production Quality (Priority: P2) *[v0.1 baseline; v1.0 telemetry]*

FretSense runs on its own custom domain over HTTPS, installs as a PWA, and meets a performance
budget checked on every release build. *[v1.0]* Users can opt in to privacy-friendly analytics
and to error reports. Every release has a changelog entry, and the app shows "What's new" once
after an update.

**Why this priority**: it's the difference between a project and a product. It's P2 because a
local build can be demonstrated without it, but no release ships without it.

**Independent Test**: the release pipeline runs Lighthouse and the size budget on the named pages
(SC-003), and a network-capture E2E run checks telemetry behaviour with consent off and on
(SC-008).

**Acceptance Scenarios**:

1. **Given** a release build, **When** CI runs, **Then** it fails if any named page scores below 90
   in any of the four Lighthouse categories, or if a size budget (FR-026) is exceeded.
2. **Given** a fresh install, **Then** analytics and error reporting are **off**. They're offered
   once, as a dismissible card on Home after the first completed drill, and always in Settings →
   Privacy. They're never asked during onboarding, on the landing page or in demo mode.
3. **Given** analytics is on, **Then** only the documented events are sent, with no profile data,
   gear names, free text, audio, video or stable device identifier.
4. **Given** a new version is deployed, **When** the user next opens the app, **Then** they're
   offered the update (001's prompt-to-reload rule) and, after it, a one-time "What's new"
   summary linked to the full release notes.

---

### User Story 8 - Docs: User Guide, FAQ, Gear Setup (Priority: P3) *[v0.1 core; grows per release]*

A **Docs** section, available offline and reached from Settings and from More, holds a user
guide (one page per destination), an FAQ, and gear setup guides (*[v0.2]* laptop or phone mic, a
generic class-compliant interface, a USB amp; *[v0.4]* camera placement). Error states link to
the matching guide page.

**Why this priority**: it supports every other story, but most users only look when something
goes wrong.

**Independent Test**: a link crawl from every error state and destination to docs pages, plus a
check that every shipped destination has a user-guide page.

**Acceptance Scenarios**:

1. *[v0.2]* **Given** the "mic denied" error, **When** the user taps "How to fix", **Then** the
   gear guide opens at the section for their browser.
2. **Given** v0.1, **Then** the guide covers Home, Lessons, Handbook, Practice, Progress and
   Settings, and gear guides that need features not yet shipped are not listed.

---

### Edge Cases

- **Private browsing or storage blocked**: the app works for the session, and a notice says
  progress won't be kept.
- **Storage full or evicted**: the write fails atomically (016 FR-020), with a message and a link to
  export the profile.
- **Unsupported browser** (no service worker, no Web Audio): the landing page says which browsers
  are supported. The app opens what it can.
- **Very old cached version**: the update prompt appears. An incompatible stored schema is migrated
  (001) before the app opens; it is never wiped.
- **Two tabs open**: a change in one shows in the other within 2 s, or that tab asks to reload.
  Data is never lost.
- **Demo mode assets not yet downloaded and the device is offline**: Try the demo says the demo needs
  a one-time download, and offers Try it now instead.
- **Slow networks**: demo assets download with visible progress and can be cancelled. The landing
  page never waits for them.
- **Right-to-left or long translations**: out of scope (English only); text containers still don't
  clip at 200% text zoom.
- **Visitor with a screen reader**: the landing page's demo media has a text description and
  captions. Nothing important exists only as video.
- **Analytics endpoint unreachable or blocked by an ad blocker**: nothing breaks, and nothing is
  retried in a loop.

## Requirements *(mandatory)*

### Functional Requirements

**Landing page**

- **FR-001** *[v0.1]*: The landing page MUST show, above the fold at 390 × 844 px: a one-line pitch
  from `docs/PRODUCT.md`, demo media (looping video or animation of the live release, ≤ 20 s, with
  captions and a text description), and **Try it now**.
- **FR-002** *[v0.1]*: The landing page MUST include a feature tour of the five pillars, each marked
  **Available now** or **Coming in vX.Y** from the live release. Available pillars MUST be listed
  first, each with a deep link to a live example (such as "A Dorian" in the Handbook, which opens without an instrument per 017's Edge Cases, or a
  note-finding drill, which first shows the one-tap instrument picker, 001 FR-053); coming pillars are visually secondary. The page MUST also link to the source repo, to
  "How it's built" (`docs/AI-WORKFLOW.md`) and to a privacy statement.
- **FR-003** *[v0.1]*: When onboarding has been completed on the device (not merely when 001's
  automatic profile exists), the landing page MUST offer **Open FretSense** first. The installed
  PWA MUST open at Home, not the landing page. If onboarding is incomplete, the installed PWA MUST
  resume onboarding instead.
- **FR-004** *[v0.1]*: The product name, domain and pitch text MUST come from one configuration
  source, so a rename changes one place. The product name is **FretSense**.

**Onboarding**

- **FR-005** *[v0.1]*: First-run onboarding MUST run, in order: welcome → instrument (required;
  one-tap presets for every 001 FR-009 instrument, guitar and bass alike, or custom, 001 FR-053) →
  **Start practising** (to Home) or **Personalise** → [profile name (renames 001's automatically
  created profile; default "Player 1") → My Gear *[v0.2+, with 015: mic, interface and amp only; cameras are set up in 008's own flow]*
  (016 FR-005–FR-009) → the remaining 016 FR-010
  questions → suggested path (016 FR-011: accept, edit or skip)] → Home. Every screen after the instrument step MUST offer **Skip the rest**, which goes to Home with 016's
  default path. Start practising, Skip the rest and "I don't play yet" all mark onboarding complete;
  Personalise stays available from Settings → Re-run onboarding. This
  instrument step answers 016 FR-010's instrument question, so it isn't asked twice, and it counts
  toward 016's limit of 5 screens. The instrument screen MUST show 6-string guitar Standard,
  4-string bass EADG and 5-string bass BEADG as one-tap presets, all visible without scrolling at
  390 × 844 px, plus "I don't play yet / just looking", which selects 6-string guitar Standard and
  continues as Start practising. The welcome screen MUST offer a secondary action, "Import a
  profile file" (016 FR-004). Interface and amp setup MUST NOT appear in onboarding until a shipped
  feature uses them (v0.2, 015; FR-010). Once shown, its first option MUST be "Just my phone or
  laptop mic", and "interface" and "amp" each get a one-line explanation.
- **FR-006** *[v0.1]*: Onboarding MUST save each answer as it's given, resume at the last step after
  an interruption, and be re-runnable from Settings without changing progress.
- **FR-007** *[v0.1]*: Onboarding MUST NOT ask for mic or camera permission. Permissions are asked
  only when a feature that needs them is opened (Constitution IX).
- **FR-007a** *[v0.2]*: Before the first mic or camera permission request, one screen MUST say that
  FretSense listens or watches only while a feature is on, that audio and video stay on the device,
  and that nothing is kept unless the user chooses. It offers Continue and Not now. Every feature
  that requests these permissions (015, 008, 012) uses this screen.

**Navigation and Home**

- **FR-008** *[v0.1]*: The app MUST provide these destinations: Home, Lessons, Handbook, Practice,
  Studio, Progress, Settings. At widths ≤ 600 px, a bottom bar MUST show 4 destinations plus
  **More**. The defaults are Home, Lessons, Handbook and Practice (v0.1), and Home, Lessons,
  Handbook and Studio (v1.0, when Practice moves to More and stays reachable from Home). Users MAY choose the 4 in Settings, saved per profile. Wider screens
  MUST use a side rail with all of them. Docs is reached from Settings and from More.
- **FR-009** *[v0.1]*: Home MUST show today's practice: the active path's next step (016 FR-013), the
  last lesson to resume, up to 4 favourites (017), and one quick drill. The quick drill is the next
  path step's drill if it has one; otherwise it's note-finding on the active instrument with the
  profile's last drill settings. It can be changed in Settings. A fresh profile's Home MUST have
  exactly one primary action. *[once 006 ships]* It MUST
  also show 006's planned items, each with its reason. Each item MUST open in one tap. Nothing on
  Home may lock or hide other content (Constitution XIII).
- **FR-010** *[v0.1]*: A destination, Home item, docs page or tour step whose feature hasn't shipped
  MUST NOT be shown (no non-functional controls, 001 FR-029). The landing page's feature tour is the
  only place future releases are mentioned.
- **FR-011** *[v0.1]*: Every destination MUST have a stable route that deep-links, works offline
  after the first load, and follows 001's route rules (validation, not-found page, instrument
  picker first).
- **FR-012** *[v0.1]*: The active profile and a profile switcher (016 FR-001) MUST be reachable from
  every screen in at most 2 taps, through a profile avatar in the top app bar.

**Design system**

- **FR-013** *[v0.1]*: All UI MUST use one set of design tokens (colour, typography scale, spacing,
  radius, elevation, motion durations) and one component library. A style-guide route MUST render
  every component in each of its states, in both themes.
- **FR-014** *[v0.1]*: Themes MUST be Light, Dark and System (the default, following the OS live).
  The choice is saved per profile (001 FR-067).
- **FR-015** *[v0.1]*: Text MUST meet a contrast of 4.5:1 (3:1 for large text), and UI components and
  focus indicators 3:1, in both themes (WCAG 2.2 AA). The fretboard's marker categories MUST be
  pairwise distinguishable under protanopia, deuteranopia and tritanopia simulation, with a colour
  difference of at least 20 (CIEDE2000) under each, *and* each category MUST also differ by shape or label.
- **FR-016** *[v0.1]*: Layouts MUST reflow from 320 px to 1920 px wide (WCAG 1.4.10), with no
  page-level horizontal scroll (the fretboard may scroll inside itself, 001 FR-047), touch targets
  of at least 44 × 44 CSS px, no clipped text at 200% browser zoom, and 001 FR-048's three text
  sizes on every screen. A focused element MUST never be hidden behind the bottom bar or other
  fixed UI.
- **FR-017** *[v0.1]*: Motion MUST respect "reduce motion": no autoplay, no parallax, and transitions
  of 0 ms or cross-fades only. Settings MUST offer Reduce motion: System (default), On, Off.

**States**

- **FR-018** *[v0.1]*: Every screen MUST define loading (a layout skeleton after 300 ms, nothing
  before), empty (a sentence plus one next action) and error states.
- **FR-019** *[v0.1]*: An error catalogue MUST define, for each condition, the message (what
  happened, why, what to do), the primary action, the docs link, the fallback capability, and the
  owning feature and release. *[v0.1]* entries: audio output blocked until interaction, storage
  unavailable (private mode), storage full, unsupported browser, update available, import
  rejected, offline, not found. *[v0.2, owned by 015]*: mic not available, mic denied, audio device
  unplugged. *[v0.4 and v1.0, owned by 008 and 009]*: camera not available, camera denied, model
  failed to load, device too slow for a quality tier. An entry is added to the catalogue, and to
  SC-010's test, when its owning feature ships. Mic- and camera-denied messages MUST show 1–3
  inline steps for the detected browser family and platform (including iOS Settings), plus the
  docs link.
- **FR-020** *[v0.1]*: An error MUST NOT block a feature that doesn't depend on the failed part
  (Constitution XI). No error may show a stack trace or raw error code as its main text.
- **FR-021** *[v0.1]*: An offline indicator MUST appear within 2 s of losing connectivity and clear
  within 2 s of regaining it, and say that core features keep working.

**Demo mode**

- **FR-022** *[v1.0]*: **Try the demo** MUST run bundled audio and video clips through the same
  pipeline real input uses (pitch, onsets, vision, fusion, transcription), on the device, with no
  mic or camera permission requested. The clips are recorded by the owner (guitar and bass), with the
  video framed on the neck and hands only, and documented by a dataset card (Constitution X).
- **FR-023** *[v1.0]*: Demo mode MUST run in an isolated, temporary demo profile that is discarded on
  exit, MUST show a persistent "Demo" badge, and MUST NOT write to any user profile.
- **FR-024** *[v1.0]*: The guided demo tour MUST have at most 6 skippable steps, include at least one
  guitar clip and one bass clip, and reach the Studio's tab and notation (012) within 60 s on the reference laptop. On phones the demo
  runs audio-only by default, with a notice that the full demo is best on a laptop; it has no time
  gate on phones. If vision can't run, it MUST continue audio-only with a notice. Its first screen
  offers Guitar or Bass (Guitar by default, one tap), and the clip, tab staff, notation clef and tour
  follow that choice. Every tour step MUST have a text caption with live values ("Heard A2, string
  5, fret 0; camera agrees"), announced politely; pausing stops the announcements.
- **FR-025** *[v1.0]*: Demo assets MUST be downloaded only when the demo is started (never on the
  landing page's initial load), with visible progress and cancel, and cached for offline use after
  the first run. If the estimated download is over 15 s, progress shows an estimated time, and the
  first tour step starts as soon as its own clip has loaded. The total demo download budget is set
  in the plan and enforced in CI. Demo clips
  MUST NOT be in any training or validation split (Constitution X), and each MUST have its labels
  and its measured accuracy in the evaluation report.

**Production quality**

- **FR-026** *[v0.1]*: Release builds MUST meet a performance budget, enforced in CI: Lighthouse
  (mobile preset, median of 3 runs) ≥ 90 in Performance, Accessibility, Best Practices and SEO on the landing page, Home, a
  Handbook entry and a lesson (and, *[v1.0]*, the Studio); Largest Contentful Paint ≤ 2.5 s,
  Cumulative Layout Shift ≤ 0.1, Total Blocking Time ≤ 200 ms in the same runs; compressed
  JavaScript on initial load ≤ 150 KB for the landing page and ≤ 250 KB for the app shell. Models,
  demo assets and per-route code load on demand and are excluded from the initial budget.
- **FR-027** *[v0.1]*: The app MUST be served over HTTPS on the product's custom domain
  (`fretsense.mahmoudbendari.ca` for v0.1–v0.4; whether to move to its own domain is revisited
  before v1.0), with the
  security headers defined in 001's plan (including the isolation that 015's real-time audio
  needs), and MUST be installable as a PWA (001 FR-046).
- **FR-028** *[v1.0]*: Analytics MUST be opt-in, off by default, cookieless, and limited to a
  documented event schema (a contract file written at plan time: page views by route template,
  with no parameters or query strings, and feature-used counts). It MUST NOT send profile data, gear
  names, free text, audio, video, recordings, or any identifier that persists beyond a single page
  session. Consent is per device (it applies to every profile on it), is stored outside profile
  data and never synced, and nothing is sent from the landing page or demo mode. Turning it off
  MUST take effect immediately.
- **FR-029** *[v1.0]*: Error reporting MUST be opt-in and off by default, with the same consent
  rules as FR-028. Reports MUST be scrubbed of profile data, file contents, free text, media, URLs'
  parameters and query strings, file names and storage keys before sending, and limited to the
  error type, scrubbed stack, release version and browser family. Both FR-028 and FR-029 MUST pass
  privacy-auditor and add threat rows to `docs/THREAT-MODEL.md` (Constitution IX). The provider is
  cookieless and self-hosted or privacy-first, chosen by ADR. The owner approved amending 001
  FR-050 to allow opt-in, documented, scrubbed telemetry (2026-11-22); the amendment is applied to
  001 when this v1.0 slice is planned, and neither FR may ship before it.
- **FR-030** *[v0.1]*: Every release MUST have a changelog entry (version, date, added, changed,
  fixed) and release notes. After an update, the app MUST show a one-time "What's new" summary that
  links to the full notes.

**Docs**

- **FR-031** *[v0.1]*: A Docs section, available offline, MUST contain a user-guide page for every
  shipped destination, an FAQ, and gear setup guides for the gear that shipped features support
  (*[v0.1]* none required; *[v0.2]* laptop or phone mic, a generic class-compliant interface, a USB
  amp; *[v0.4]* camera placement). Every error-catalogue entry with a fix MUST link to a docs
  section.
- **FR-032** *[v0.1]*: Docs pages MUST use the same design system and accessibility rules as the
  app. *[v1.0]* Docs pages MUST be searchable from the Docs section.

**Accessibility (all screens)**

- **FR-033** *[v0.1]*: Every screen MUST meet WCAG 2.2 AA: landmarks, a skip link, visible focus, a
  logical focus order, labelled controls, announced state changes (errors, offline, drill
  feedback), and the page language set. Every release MUST also pass a manual screen-reader run of
  onboarding and every destination, recorded in the release notes. On every route change and
  onboarding step, focus MUST move to the new main heading and the page title MUST update.
  Skeletons mark their region as busy and give one "Loading" announcement.
- **FR-034** *[v0.1]*: Destination contents: Lessons = 001's library and packs; Practice = every
  drill, with 001's settings; Progress = 001 FR-042; Settings = profile and switcher, My Gear,
  instrument, display and text size, theme, reduce motion, stage preference, active pack,
  bottom-bar choice, quick drill, re-run onboarding, export and import, Docs, consent *[v1.0]*, and
  About with the version.
- **FR-035** *[v0.2 listening; v0.4 camera]*: A persistent "Listening" and "Camera on" indicator that
  doesn't rely on colour alone MUST show on every screen while the mic or camera is active, with a
  one-tap stop (Constitution IX).

### Key Entities

- **Product config**: name, domain, pitch, live release, and the release in which each pillar
  ships. Shipped data, one source.
- **Design tokens**: named colour, type, spacing, radius, elevation and motion values for each
  theme.
- **Error catalogue entry**: condition id, message parts, primary action, docs link, fallback
  capability, owning feature.
- **Onboarding progress**: profile-scoped, sync-ready (001 FR-066): current step and completion.
  The answers themselves are 016's records.
- **Consent record**: per device, outside profile data: analytics on or off, error reports on or
  off, with a timestamp. Never synced, never sent anywhere.
- **Demo profile**: temporary, isolated, discarded on exit.
- **Release entry**: version, date, changelog items, release notes, "What's new" summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** *[v0.1]*: In timed runs with at least 5 first-time testers with no gear (the owner
  and at least 4 others, at least 2 of whom own no instrument), the median time from opening the
  landing page to the first drill answer is ≤ 2 minutes, and 100% finish without help.
- **SC-002** *[v0.1]*: A returning user reaches the first item of today's practice from the
  installed app in ≤ 10 s and ≤ 2 taps (automated E2E, reference phone).
- **SC-003** *[v0.1]*: Every release build meets FR-026 in CI on every named page. Builds over budget
  are blocked.
- **SC-004** *[v0.1]*: 0 serious or critical automated accessibility violations on every route in
  both themes. A keyboard-only run and a manual screen-reader run of onboarding and every
  destination complete, including the demo (v1.0). An automated test checks focus after every
  transition. 100% of token
  colour pairs meet FR-015 contrast in both themes.
- **SC-005** *[v0.1]*: 100% of fretboard marker category pairs pass the FR-015 colour-vision check
  under all three simulations, and visual regression shows a distinct shape or label for each
  category.
- **SC-006** *[v0.1]*: In a 10-second first-impression test, at least 4 of 5 people who don't play
  can say what FretSense does and who it's for.
- **SC-007** *[v1.0]*: On the reference laptop with the demo assets already cached, demo mode
  reaches a transcribed tab in ≤ 60 s from pressing Try the demo, with 0 permission prompts. On the
  first run, measured with the network throttled to 20 Mbit/s down, the download time counts within
  the 60 s, for both the guitar and the bass clip. Each clip's output is scored against its labels, and the
  score shown in the demo matches the evaluation report.
- **SC-008** *[v1.0]*: In a network-capture E2E run, with analytics and error reports off (the
  default), 0 requests go to any telemetry or third-party endpoint. With them on, 100% of payloads
  contain only FR-028 and FR-029 fields.
- **SC-009** *[v0.1]*: Visual regression at 320, 390, 768, 1280 and 1920 px in both themes shows no
  page-level horizontal scroll and no clipped text, for every route, also at 200% zoom and at 001
  FR-048's largest text size.
- **SC-010** *[v0.1]*: 100% of error-catalogue conditions are triggered by an automated test that
  checks the message, the action, the docs link and that unrelated features still work.
- **SC-011** *[v0.1]*: Every release has a changelog entry and release notes, and "What's new"
  shows exactly once per update (automated test).

## Assumptions

- English only. Translations are out of scope, but text isn't hard-wired into layouts.
- The hosting provider must support custom response headers (CSP, cross-origin isolation for
  015). It's chosen at plan time by ADR.
- The notation renderer, analytics provider and error-reporting provider are plan decisions, each
  with an ADR. They must be self-hostable or privacy-preserving, with no third-party cookies.
- Docs, FAQ, gear guides and UI copy are product text, not lesson or handbook prose. Agents may
  draft them; the owner edits and approves every page before release.
- The demo video on the landing page is a screen recording of the live release, refreshed each
  release.
- "Reference laptop" and "reference phone" are the benchmark devices named in 001's plan and
  ADR-0002.

## Clarifications

### Session 2026-11-22 (owner accepted every recommended answer)

- Q: Keep the name "FretSense"? → A: Yes (FR-004), after a quick trademark and domain search by the
  owner. The name lives in one configuration source.
- Q: A subdomain of mahmoudbendari.ca or its own domain? → A: `fretsense.mahmoudbendari.ca` for
  v0.1–v0.4; revisit before v1.0 (FR-027). The host must support custom response headers.
- Q: Demo clips recorded by the owner, or from public datasets? → A: Recorded by the owner, guitar
  and bass, video framed on the neck and hands only, with a dataset card, never in a training or
  validation split (FR-022, FR-025).
- Q: Ship opt-in analytics and error reports at all? → A: Yes, both at v1.0, cookieless,
  self-hosted or privacy-first, per-device consent, default off. 001 FR-050's amendment is
  approved and applied at v1.0 planning (FR-028, FR-029).
- Q: Bottom bar at v1.0? → A: Home, Lessons, Handbook, Studio, plus More; Practice moves to More and
  stays on Home (FR-008).
- Q: Who writes the docs, FAQ, gear guides and UI copy? → A: Agents draft, the owner edits and
  approves (Assumptions). Lesson and handbook prose stays owner-only.
- Q: Minimum colour difference between fretboard marker categories? → A: CIEDE2000 ≥ 20 under each
  of the three simulations (FR-015).

### Session 2026-11-25 (owner)

- Consent scope (product-owner r2 open item) → **per device**, unchanged (owner, AskUserQuestion: "Per device
  (Recommended)"). Spec approved for planning (owner chat, word for word: "approve anything else left and actually
  build and create the program").
