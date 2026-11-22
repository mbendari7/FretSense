# Feature Specification: Audio I/O and Device Management

**Feature Branch**: `015-audio-io-device-management` (to be created by the owner)

**Created**: 2026-11-21

**Status**: Draft (amended 2026-11-21 for constitution v2.2.0: any gear, user-editable device profiles;
clarify answers recorded)

**Input**: User description: "Plug my instrument into the computer through an audio interface or a USB amp, have FretSense detect it, let me pick input and output devices, and use that signal across lessons, drills, pitch detection, ML and vision fusion. Gear: Focusrite Scarlett (4th Gen, Studio bundle) and Boss Katana:GO; must work with any class-compliant USB interface. Device detection and selection (names, channel counts, hot-plug, separate input/output and input-channel selection, per-profile memory, known-device profiles, raw audio with browser processing off). Signal check and calibration wizard (level meter, clipping, gain-staging guidance, noise floor, hum, clean vs effected detection, instrument auto-detection, built-in tuner, round-trip latency calibration via cross-correlation, A/V sync calibration). Output routing (setSinkId with fallback, direct-monitoring hint). Lesson integration (frontmatter needs, device checklist, audio-only/camera-only/fused modes, laptop-mic fallback). AudioBackend strategy with WebAudio and native Tauri + Rust/cpal backends; device state machine; sample-rate handling; mock devices, hot-plug simulation, golden recordings, latency benchmarks."

**Practice-session value**: a user plugs in *their* interface or USB amp (whatever it is) and, on a
returning session, is ready to practise in under 30 seconds (first-time setup under 90 s): right device, right channel, clean signal, correct gain, known latency,
tuned instrument. That is what makes every later audio feature (pitch, play-along, chords,
fusion) accurate.

**Depends on**: 001 (InstrumentProfile, lessons), 016 (My Gear interface/amp and output entries,
local profiles). **Enables**: 002, 003, 009 and 010 now depend on
015. The tuner and instrument auto-detection steps use 002's pitch detector and are enabled when 002
lands (US3 scenarios 4 and 5). A/V calibration (US5) needs only the camera and a frame-difference
motion-onset detector built here. It doesn't depend on 008; 008 and 010 consume its result. **Human-owned** (Constitution IV): the cross-correlation estimator for
round-trip latency and A/V offset. **Lesson track**: none directly; it enables every lesson's Play
and Camera-coach stages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect and Select Devices and Channels (Priority: P1)

The user sees every input and output device, with clear names and channel counts. They pick an
input device and channel (e.g. input 1 = instrument) and an output device separately, and link them
to entries in their My Gear (016). The app remembers the choice per instrument and offers tailored
tips when a device matches one of the user's gear entries or a shipped preset.

**Why this priority**: Without the right device and channel, nothing downstream works.

**Independent Test**: With the mock device layer, present 3 inputs and 2 outputs with different
channel counts. Select input 2 / channel 2 for the bass profile and verify capture, persistence and
restore after a reload.

**Acceptance Scenarios**:

1. **Given** the mic permission is granted, **When** the device list opens, **Then** every input
   and output is listed with its name and channel count, and the active ones are marked.
2. **Given** a 2-input interface (e.g. a Scarlett 2i2 4th Gen) is selected, **When** the user chooses
   input channel 1, **Then** only that
   channel's signal is captured (SC-004).
3. **Given** the user selects devices for their 5-string bass, **When** they later switch to
   that instrument, **Then** those devices and that channel are restored if present.
4. **Given** a device whose name matches a My Gear entry or a shipped preset (e.g. Scarlett Solo or
   2i2 4th Gen, Katana:GO), **Then** that entry's settings and tips are shown. **Given** an unknown
   class-compliant interface, **Then** the user is offered "create a device profile" (016 FR-006),
   generic tips are shown, and everything still works.
6. **Given** a USB amp whose My Gear entry says it sends a **processed** signal, **Then** the signal
   check (US3 scenario 3) explains that detection works best with a dry signal and shows how to
   switch, if the entry or preset knows how.
5. **Given** capture starts, **Then** the browser's echo cancellation, noise suppression and auto gain
   are requested off, and the applied settings are verified. If the platform ignores the request, a
   warning explains the accuracy impact.

---

### User Story 2 - Hot-Plug and Safe Fallback (Priority: P1)

Plugging in a device is detected, and the app offers to switch to it. Unplugging the active device
mid-session never crashes the app: the session pauses, the app falls back safely, and it resumes
when the device returns.

**Why this priority**: USB cables get bumped. A crash mid-practice destroys trust.

**Independent Test**: The hot-plug simulation adds and removes devices on random schedules during a
running drill, and verifies the state-machine transitions, user prompts and the absence of errors.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** the Scarlett is plugged in, **Then** it appears within 2 s
   (SC-001), and a prompt offers to switch to it.
2. **Given** a drill is using the Scarlett, **When** it is unplugged, **Then** within 1 s the drill
   pauses, a message explains what happened, and the app offers the next available input (e.g. the
   laptop mic, with the accuracy warning) or waiting for reconnection.
3. **Given** the device is reconnected, **Then** the previous device, channel and calibration are
   restored, and the user can resume.
4. **Given** any (state, event) pair of the device lifecycle, **Then** the behaviour is defined and
   tested (FR-009).

---

### User Story 3 - Signal Check and Calibration Wizard (Priority: P1)

After connecting, a wizard walks through: input level meter, clipping detection, gain-staging
guidance, noise floor, hum, clean vs effected signal, round-trip latency, and (when 002 exists)
tuner and instrument auto-detection.

**Why this priority**: Bad gain, hum or heavy effects silently ruin pitch and chord detection.

**Independent Test**: Feed golden recordings (clean DI, clipped, noisy, 50 Hz and 60 Hz hum, Katana
clean/crunch/high-gain/reverb) through the wizard and verify each verdict.

**Acceptance Scenarios**:

1. **Given** live input, **Then** a level meter (peak + RMS) updates at ≥ 30 Hz, and clipping is
   flagged on any sample at or above −0.5 dBFS, with guidance such as "Turn the Gain knob down until
   the light stays green", worded for the detected device profile.
2. **Given** silence with the instrument connected, **Then** the noise floor is measured (dBFS), and
   hum at 50 or 60 Hz (and harmonics) is detected and named, with tips (grounding, single-coil
   position, distance from screens).
3. **Given** a driven or heavily effected signal (e.g. the Katana:GO's processed USB output),
   **Then** the wizard warns that pitch and chord detection will be less accurate and recommends a
   clean or dry setting, with device-specific instructions where known.
4. **Given** 002 is available, **Then** a tuner is the first screen after connecting, using the
   active InstrumentProfile's strings.
5. **Given** 002 is available, **When** the user plays open strings, **Then** the app suggests guitar
   or bass from the detected pitch range, and asks to confirm the InstrumentProfile.

---

### User Story 4 - Round-Trip Latency Calibration (Priority: P1)

The app plays a click to the chosen output, captures it on the input, measures the delay by
cross-correlation (human-owned estimator), and stores the offset per device, backend and sample
rate. Play-along timing (003) uses it.

**Why this priority**: Timing feedback is wrong by tens of milliseconds without it.

**Independent Test**: With the mock device layer injecting known delays, verify the estimates. On
hardware, verify repeatability across 10 runs.

**Acceptance Scenarios**:

1. **Given** a loopback (an output-to-input cable, or the interface's own loopback, or speaker to
   mic), **When** calibration runs, **Then** the round-trip latency is reported in ms with a
   repeatability check, and stored.
2. **Given** a failed measurement (no click detected, low correlation peak), **Then** the app says
   why and offers a retry, and never stores a bad value.

---

### User Story 5 - Audio–Video Sync Calibration (Priority: P2)

The user performs a calibration gesture that is both visible and audible (a pluck or a clap)
several times. The app estimates the camera-to-audio clock offset by cross-correlating onset times
(human-owned estimator), stores it, and 010's fusion step applies it.

**Why this priority**: Fusion and camera coaching (010) can't align events without it. Only needed
once the camera features exist.

**Independent Test**: With synthetic audio+video streams at known offsets, verify the estimates,
then verify repeatability on hardware.

**Acceptance Scenarios**:

1. **Given** ≥ 10 claps or plucks visible and audible, **Then** an offset (ms) with a confidence is estimated and
   stored per (camera, audio device, backend).
2. **Given** an inconsistent result (the spread exceeds the tolerance), **Then** the calibration is
   rejected with a retry prompt.

---

### User Story 6 - Output Routing and Monitoring (Priority: P2)

The metronome, backing tracks, reference tones and lesson audio play on the chosen output device.
When the interface monitors the instrument in hardware, the app doesn't double it in software.

**Why this priority**: The user hears everything in their headphones on the interface, with no
doubled or delayed signal.

**Independent Test**: With mock outputs, verify routing for each sound category, the fallback when
output selection isn't supported, and the monitoring mode.

**Acceptance Scenarios**:

1. **Given** the user's interface is selected as output, **Then** all app sounds play through it (where the
   platform supports output selection). Otherwise the app explains that the system default output is
   used.
2. **Given** the user's gear entry says hardware direct monitoring is available, **Then** the
   monitoring setting recommends hardware direct, software monitoring is off by default, and a hint
   explains why. The user can choose hardware direct, software or off at any time.

---

### User Story 7 - Lesson Device Checklist and Modes (Priority: P2)

Lessons declare what they need (`needs: [audio-input]`, or `[audio-input, camera]`). Every lesson
keeps an audio-only (or tap-only) path, so there are no camera-only lessons (Constitution XI).
Starting a lesson shows a device checklist and picks a mode: audio-only or fused. Camera modes are
hidden while the 008/010 feature flags are off. With no interface, the
laptop mic is offered, with an accuracy warning.

**Why this priority**: Turns device management into a smooth start to every lesson.

**Independent Test**: Lesson fixtures with each `needs` combination × device availability states;
verify the checklist and the chosen mode.

**Acceptance Scenarios**:

1. **Given** a lesson needs audio input and only the laptop mic is available, **Then** the checklist
   shows "Using laptop mic: accuracy will be lower" and the lesson runs audio-only.
2. **Given** a lesson declares the camera, and the camera is off or the flag is disabled, **Then**
   it runs audio-only, and the Camera-coach parts show as unavailable, not broken.

---

### User Story 8 - Native Desktop Backend (Priority: P3, stretch goal, out of scope this term)

An optional desktop app provides a native audio backend with control over the host API, buffer size
and sample rate. Its latency is compared with the browser backend on the development rig
(ADR-0005).

**Why this priority**: A stretch goal (owner, 2026-11-21). Kept only if measurements show a material
latency gain (ADR-0005 rule: p95 round trip ≥ 10 ms lower, or meets an ADR-0002 budget that the
browser misses). The browser is the only backend this term; FR-020 keeps the interface so native
can be added later without changing consumers.

**Independent Test**: Run the same golden recordings and latency benchmark through both backends and
compare.

**Acceptance Scenarios**:

1. **Given** both backends, **Then** the same contract tests and golden recordings pass, and the
   ADR-0005 table is filled from measured runs.

---

### Edge Cases

- **Labels before permission**: device names are hidden until mic permission is granted. The app asks
  for permission only when the user opens audio setup or starts an audio feature (Constitution IX),
  never at startup. The permission probe used to unlock labels MUST stop all tracks immediately after
  enumeration.
- **Built-in mic with built-in speakers**: with echo cancellation off, metronome and backing audio
  bleed into the input. The app MUST detect this combination, recommend headphones, and offer to
  enable the browser's echo cancellation in that mode only, stating the accuracy trade-off.
- **Output disconnected mid-session**: an audio-output-dependent activity (metronome, backing track)
  pauses, falls back to the system default output with a notice, and resumes on confirmation.
- **Phones and tablets**: input via the built-in mic or a USB-C class-compliant interface where the
  OS allows. Where output selection is unsupported (e.g. iOS Safari), the system output is used with
  a notice.
- **Permission denied**: audio features are unavailable, with a clear "how to enable" message.
  Tap-based features keep working (Constitution XI).
- **Multi-channel limits**: if the platform delivers only a mono or stereo downmix and the chosen
  channel can't be isolated, the app warns and suggests the interface's own routing.
- **Sample-rate mismatch**: the device runs at 44.1 kHz and models expect a different rate. The input
  is resampled (FR-019). A sample-rate change mid-session triggers recalibration.
- **Exclusive mode / device busy** (a DAW holds the device): a clear message; no crash.
- **Two identical devices**: distinguished by stable device id plus an index. Preferences restore by
  id first, then by name.
- **Bluetooth output selected**: a warning about its high latency (usually ≥ 150 ms), recommending a
  wired output for play-along.
- **USB amp as both input and output** (e.g. Katana:GO): supported. Where its gear entry declares
  hardware monitoring, that is the recommended monitoring mode.
- **Low-latency transport unavailable on the platform**: fall back to a higher-latency transport,
  and report it in the performance overlay (transport design in plan.md).

## Requirements *(mandatory)*

### Functional Requirements

**Devices and channels**

- **FR-001**: System MUST list input and output devices with display names, channel counts (where the
  platform exposes them) and active state, and refresh the list on device changes.
- **FR-002**: Users MUST be able to select an input device, an input channel, and an output device
  independently.
- **FR-003**: System MUST remember the preferred input device, channel and output device per My Gear
  instrument (per local profile), and restore them by stable id, then by name, when present.
- **FR-004**: Device profiles are **user data**: My Gear interface/amp and output entries (016 FR-006,
  FR-008), created from shipped, editable presets (Focusrite Scarlett Solo 4th Gen, Focusrite
  Scarlett 2i2 4th Gen, Boss Katana:GO, generic class-compliant; 016 FR-007) or from scratch.
  Physical devices are matched to entries by the entry's name pattern, then to presets. A match MAY
  change **defaults and tips** (channel labels, signal type, monitoring recommendation) but never
  **availability**: every capability works identically for an unmatched interface. No model is
  hardcoded outside the preset data. Unmatched interfaces default to software monitoring off, with
  the hint "use your interface's direct-monitor control if it has one".
- **FR-004a**: Each interface/amp entry's **signal type** (dry or processed, set by the user, 016
  FR-006) MUST be shown in the signal check. When the entry says processed, or FR-012 detects heavy
  processing, the app MUST recommend the dry signal for detection, without blocking.
- **FR-005**: Capture MUST request echo cancellation, noise suppression and automatic gain control
  off, verify the applied settings, and warn when any remains on.

**Hot-plug and lifecycle**

- **FR-006**: System MUST detect device additions and removals and reflect them within 2 s (SC-001).
- **FR-007**: On a new device, System MUST offer to switch, and never switch automatically,
  whether or not an exercise is running.
- **FR-008**: If the active input disconnects, System MUST pause the active audio feature within 1 s,
  keep all session data, offer fallbacks (another input, the laptop mic with a warning, or wait), and
  restore the device, channel and calibration on reconnection. If the active output disconnects,
  output-dependent activities pause and fall back to the system default output with a notice.
- **FR-009**: Input-device handling MUST follow an explicit lifecycle state machine with this closed
  set.
  - **States**: `idle` (no permission requested), `permission-pending`, `denied`, `disconnected`,
    `connecting`, `streaming`, `paused` (mid-session loss), `busy` (held exclusively by another
    app), `released` (mic off, no feature needs it), `error`.
  - **Events**: request-permission, permission-granted, permission-denied, device-added,
    device-removed, user-select, stream-started, stream-failed, device-busy, xrun, release, resume,
    sample-rate-changed, output-removed.

  Every (state, event) pair MUST have defined behaviour (a transition or an explicit ignore) and MUST
  be exhaustively tested. Calibration is a **separate** process with its own states (`none`,
  `running`, `valid`, `invalid`, `cancelled`). A device can be `streaming` while uncalibrated: drills
  that need timing then show "calibrate for accurate timing", and play-along timing scores are
  disabled until calibrated.

**Signal check**

- **FR-010**: A live level meter (peak and RMS, dBFS) MUST update at ≥ 30 Hz. Clipping is flagged at
  ≥ −0.5 dBFS sample peaks, with gain-staging guidance worded per device profile.
- **FR-011**: The wizard MUST measure the noise floor (dBFS RMS over 2 s of silence) and detect mains
  hum at 50 or 60 Hz (fundamental plus the 2nd–4th harmonics: 100/150/200 or 120/180/240 Hz), naming
  the frequency. Hum is reported when the fundamental's band level is ≥ −50 dBFS and ≥ 6 dB above
  the broadband noise floor.
- **FR-012**: The wizard (and an on-demand re-check) MUST classify the input as clean,
  driven/distorted, or heavily time-effected (reverb/delay), using a rules-based signal-feature
  classifier. If a learned model is ever used instead, it falls under Constitution X and must beat
  the rules baseline. For non-clean signals the wizard warns and recommends a clean or dry setting,
  with device-specific steps where known (e.g. Katana:GO).
- **FR-013**: When 002 is available, the wizard MUST start with a tuner for the active profile's
  strings, and offer instrument auto-detection (guitar vs bass from the detected open-string range)
  with confirmation of the instrument. It runs only when the user is creating an instrument or has
  none selected; otherwise the selected My Gear instrument is trusted and the tuner just checks its
  tuning. The user plays the **lowest open string**, and the app suggests the presets (001 FR-009,
  any string count) whose lowest string is within 1 semitone; between 41 Hz and 75 Hz (where
  extended-range guitars and basses overlap) it always asks the user.
  Tuner accuracy inherits 002's criteria. Until 002 lands, these steps are omitted, not shown
  disabled.

**Calibration**

- **FR-014**: Round-trip latency calibration MUST play a click sequence to the output, capture it on
  the input, and estimate the delay by cross-correlation (human-owned estimator). It reports the
  median of ≥ 5 clicks and their spread (max − min). It rejects results whose normalised correlation
  peak is < 0.5, whose peak-to-sidelobe ratio is < 10 dB, or whose spread is > 2 ms. It stores the
  value per (input device, output device, backend, sample rate, buffer configuration). For the
  browser backend, "buffer configuration" means the latency hint plus the platform-reported base and
  output latency. The captured audio is discarded right after estimation; only the derived value is
  kept. Speaker-to-mic loopback is allowed but labelled "acoustic" and excluded from SC-002.
- **FR-015**: A/V offset calibration MUST:
  - require a camera mode of ≥ 30 fps;
  - use ≥ 10 visible and audible gestures;
  - estimate visual motion-onset times with sub-frame interpolation of frame-difference motion
    energy;
  - estimate the offset by cross-correlating audio and visual onset times (human-owned estimator).

  It publishes the offset and its spread (IQR), and rejects results whose IQR exceeds 12 ms. It stores
  the offset per (camera, camera resolution and fps mode, input device, backend). Captured frames and
  audio are discarded right after estimation. Feature 010 applies the offset and monitors in-session
  drift (010 FR-005).
- **FR-016**: Latency calibrations MUST be invalidated and re-requested when the device, backend,
  sample rate or buffer configuration changes. A/V calibrations are invalidated when any of their key
  fields changes.

**Output and monitoring**

- **FR-017**: All app sounds (metronome, backing tracks, reference tones, lesson audio) MUST route to
  the selected output where the platform supports output selection. Otherwise they fall back to the
  system default, with a notice.
- **FR-018**: A monitoring setting (hardware direct / software / off) MUST exist per interface entry
  (for a device with no My Gear entry, per device stable id in the profile settings record) and be
  user-changeable at any time. The recommendation comes from the gear entry (FR-004): hardware
  direct where the entry declares it available. Where the entry declares **no** direct monitoring,
  the first audio feature asks "You may not hear your instrument. Turn on software monitoring?"
  and shows its latency. Software monitoring shows "uncalibrated" while no valid calibration exists.
  Software monitoring is a mic-active context (FR-022). Software
  monitoring, when chosen, shows its added latency, taken from the current round-trip calibration.

**Signal path**

- **FR-019**: System MUST detect the device sample rate (44.1, 48, 88.2, 96 kHz) and resample, with
  anti-aliasing, to each consumer's expected rate (DSP: native rate; ML: the rate in the model's
  registry manifest, 007 FR-023).
- **FR-020**: Audio capture MUST sit behind an AudioBackend interface with interchangeable
  implementations: (a) browser (the only backend this term); (b) native desktop (US8, stretch). Both
  MUST deliver identical sample streams to consumers through the same real-time transport contract
  (lock-free, no allocation or locking in the audio callback; Constitution V).
- **FR-021**: A mock device layer MUST simulate devices (names, channels, sample rates, injected
  latency, hot-plug schedules, failures) for tests. Golden recordings MUST be played through each
  backend in tests.

**Privacy and lessons**

- **FR-022**: The microphone MUST be active only while a feature that needs it is in use: setup
  wizard, tuner, calibrations, audio drills, a lesson's Drill and Play stages in audio mode (not Read
  or See), recording, and software monitoring while one of these is active (monitoring alone never
  keeps the mic on). A visible "listening" indicator MUST
  show whenever capture is live, and all tracks MUST stop when no feature needs them (Constitution
  IX; `privacy-auditor` gate).
- **FR-023**: Lesson frontmatter MUST support an optional `needs` list (`audio-input`, `camera`;
  default empty; defined in 001 FR-022). `camera` is never allowed alone. Lesson start MUST show a
  device checklist and select audio-only or fused mode by device availability, feature flags and
  whether the user has turned the vision assistant on (008 FR-001).
  Unmet needs show as unavailable, never broken.
- **FR-024**: With no external interface, System MUST offer the built-in mic with a warning that
  accuracy will be lower.

**Observability**

- **FR-025**: The performance overlay MUST show the active backend, transport, sample rate, buffer
  configuration, calibrated round-trip latency, buffer fill and dropout count.
- **FR-027**: Development test tooling (not shipped to users): (a) the hardware latency reference is a
  loopback cable measured with a dedicated round-trip latency utility (SC-002); (b) the A/V sync
  reference is an ESP32 device that fires an LED flash and a piezo click with LED-to-click skew
  ≤ 1 ms, verified by capturing a photodiode and the piezo on two inputs of one interface at 48 kHz
  (SC-008). The latency utility and its stated accuracy (≤ 0.5 ms) are named in plan.md (owner). Its firmware, wiring and its own timing verification live under `bench/` (plan.md). In
  the app, users calibrate with a guided pluck or clap (FR-015).
- **FR-028**: Phones and tablets get a **limited mode**, triggered by capability detection (no output
  selection, or no multi-channel input) or by user choice: built-in microphone input (or a USB-C
  class-compliant interface where the OS allows), system output when output selection is
  unsupported, no A/V calibration below 30 fps, and a notice listing what is limited. Laptops are
  the primary target.
- **FR-026**: The level meter and clipping state MUST have a screen-reader readout (e.g. "Level −12 dB,
  OK") and a cue that doesn't rely on colour. The wizard MUST work at 390 px and be readable from a
  music stand (Constitution VI).

### Key Entities

- **AudioDevice**: stable id, name, kind (input/output), channel count, sample rates, matched device
  profile.
- **DeviceProfile**: a My Gear interface/amp or output entry (016), or a shipped preset: name
  pattern, channels and labels, signal type, monitoring capability, tips.
- **DevicePreference**: InstrumentProfile id → input device id, channel, output device id.
- **DeviceLifecycle**: current state, last event, error detail.
- **SignalReport**: peak, RMS, clipping count, noise floor, hum frequency, clean/effected class.
- **LatencyCalibration**: device pair, backend, sample rate, buffer size, round trip ms, spread, date.
- **AVOffsetCalibration**: camera, input device, backend, offset ms, spread, date.
- **LessonNeeds**: audio-input and/or camera; resolved mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Development test rig (not a product default, Constitution XIII): the owner's laptop (the
development benchmark machine, recorded in plan.md), the owner's Scarlett 4th Gen and Katana:GO, in
Chrome (latest stable) on Windows. Every SC that names a device MUST also pass with a gear entry
created from scratch for that device (no preset).

- **SC-001**: A newly plugged device appears in the list within 2 s of the physical plug-in
  (stopwatch or video timestamp; the first-ever plug with driver installation is excluded) in ≥ 95%
  of 20 trials per device (Scarlett, Katana:GO, one other class-compliant interface if available).
- **SC-002**: Round-trip latency is measured to ±2 ms.
  - **Accuracy on mock devices**: with known delays (5–200 ms, including fractional-sample delays),
    added noise (SNR 30 dB) and a band-limited click transfer function, estimates fall within
    ±0.5 ms of truth in 100% of ≥ 200 cases.
  - **Accuracy on hardware**: with a cable loopback, the estimate is within ±2 ms of a reference
    measurement made with an established round-trip-latency utility on the same cable and settings
    (Clarifications).
  - **Repeatability**: 10 consecutive calibrations fall within ±2 ms of their median.
- **SC-003**: Across 50 randomised hot-unplug events mid-session (20 on real hardware, 30 simulated;
  input and output): 0 crashes or unhandled errors, the session pauses within 1 s, and the previous
  state is restored on replug in 100% of cases.
- **SC-004**: On the Scarlett, with a 1 kHz sine at −12 dBFS on one input and silence on the other,
  the selected channel is captured with ≥ 40 dB isolation (RMS ratio between channels) in 100% of 20
  trials per channel selection. The "can't isolate" warning appears in 100% of cases where the
  applied channel count is below what was requested or the captured channels are near-identical
  (correlation > 0.99).
- **SC-005**: Browser processing (echo cancellation, noise suppression, auto gain) is verified off, or
  a warning is shown, in 100% of capture starts.
- **SC-006**: The clean/driven/time-effected classifier reaches ≥ 90% accuracy on a labelled,
  session-disjoint set of ≥ 200 guitar clips and ≥ 50 bass clips (Katana:GO
  clean/crunch/high-gain/reverb/delay, plus Scarlett DI with plug-ins), reported separately per
  instrument. Bass is reported as "insufficient data" until real or public bass clips exist.
- **SC-007**: Hum detection achieves ≥ 95% recall on ≥ 100 hum fixtures (50 and 60 Hz, per FR-011
  levels), with ≤ 5% false positives on ≥ 100 clean fixtures.
- **SC-008**: The A/V offset estimate is within ±5 ms of truth on synthetic streams (30 fps, random
  sub-frame offsets). On hardware, it is within ±10 ms of a reference from a synchronised LED-flash +
  click device (Clarifications), across 5 calibrations at ≥ 30 fps.
- **SC-009**: The resampler output for 44.1 → 48 kHz and 48 → the model rate keeps pitch error below
  0.1 cent on test tones and aliasing below −80 dB (golden tests).
- **SC-010**: The device state machine is covered for 100% of (state, event) pairs with 0 undefined
  transitions.
- **SC-011**: Over 10 runs each: first-time setup (connect → level → noise/hum → latency) takes
  ≤ 90 s, and ≤ 120 s once the 002 tuner step exists. A returning session (device auto-restored,
  level check) is ready in ≤ 30 s.
- **SC-012**: (Stretch, only if the native backend is taken up.) Both backends are measured on the
  test rig and recorded in ADR-0005, and the ADR-0005 keep/drop rule is applied.
- **SC-013**: privacy-auditor stream-lifetime tests show the mic live only in the FR-022 contexts,
  with the indicator visible 100% of the time it is live, and 0 captured calibration media retained.

## Assumptions

- Interfaces are USB class-compliant. Vendor control panels (e.g. Focusrite Control) aren't needed for
  basic use.
- Latency benchmarks run on the owner's test rig, are owned by `perf-auditor`, and are committed.
  CI runs the mock-device latency tests (no audio hardware in CI). Every user runs their own
  calibration in the app; results are saved per device (FR-014).
- Fixture recordings for SC-006 and SC-007 made by the owner use the per-recording opt-in
  (Constitution IX) and live under `fixtures/golden/` with consent records.
- Shared-memory transport requires cross-origin isolation headers on the deploy target. The threat
  model is updated accordingly.
- Feature 002 provides the pitch detector for the tuner and auto-detection steps.

## Clarifications

### Session 2026-11-21 (owner answers, constitution v2.2.0)

- Q: Exact Scarlett model? → A: Don't hardcode any model. Device profiles are user-editable My Gear
  entries, with shipped presets for Scarlett Solo 4th Gen, Scarlett 2i2 4th Gen, Katana:GO and a
  generic interface. The owner tests on their own Scarlett (FR-004).
- Q: Katana:GO over USB: dry or processed? → A: The user sets it per device. Signal check detects
  heavy processing and recommends the dry signal for detection (FR-004a, FR-012).
- Q: Tauri desktop this term? → A: No. Browser only; ADR-0005 stays open as a stretch goal (US8,
  FR-020).
- Q: Monitoring? → A: A user setting (hardware direct, software or off); hardware direct is
  recommended when the device supports it (FR-018).
- Q: Hardware latency reference? → A: For development testing, a loopback cable measured with a
  dedicated round-trip latency utility. In the app, every user calibrates their own device, saved
  per device (FR-014, FR-027, SC-002).
- Q: A/V sync reference? → A: An ESP32 LED-flash + piezo-click device for development testing; users
  calibrate with a guided pluck or clap (FR-015, FR-027, SC-008).
- Q: Phones? → A: Laptop first; phones get the built-in mic and a limited mode (FR-028).
- Q: Reference hardware? → A: The owner's laptop is the development benchmark machine (details to be
  recorded in plan.md); the minimum target is a laptop with integrated graphics.
- Spec re-review 2026-11-21 (BLOCK: 1 blocker + 8 others) folded in: software monitoring as a
  mic-active context (FR-018, FR-022), default for no direct monitoring, ESP32 skew ≤ 1 ms and its
  verification (FR-027), ≥ 10 gestures (US5), auto-detect only when there is no instrument and
  extended-range-safe (FR-013), limited-mode trigger (FR-028), lesson-mode rule (FR-023). **OPEN
  (owner):** name the round-trip latency utility.
