# FretSense web app: Impeccable audit (technical quality)

Date: 2026-11-26. Target: `apps/web` (dev server http://localhost:5173). Read-only; no project files edited.

**Evidence base (all actually run):**
- Source read: `src/ui/styles.css`, `Fretboard.tsx`, `Layout.tsx`, `common.tsx`, the Gear, Progress, Drills, Settings and WalkingBass screens.
- Impeccable detector: on `src/ui`, and on 8 routes at 390x844 and 1280x800.
- Playwright Chromium probe in a throwaway context. It completed onboarding, then measured 10 routes at 390 and 1280 px in light and dark: page scrollWidth, h1 count, targets under 44 px, computed font sizes and body background. It also ran at the largest text size.
- Contrast computed with the WCAG relative-luminance formula from the CSS token hex values.
- `pnpm build` and `pnpm vitest run`: 77 files, **2381 tests passed**.
- Touch: emulated viewport only; no touch gestures were synthesised. The fretboard uses native `overflow-x` scrolling and click handlers (no custom drag surface), so the risk to gestures is low but untested.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Text on fretboard markers fails 4.5:1 (white on root 3.87, on correct 3.42, on incorrect 3.06; revealed-answer label in light theme 2.22). The light-theme focus ring is 1.99:1 |
| 2 | Performance | 3 | One 599 kB JS chunk (185 kB gzip), no route splitting; otherwise lean |
| 3 | Theming | 2 | Tokens exist, but dark mode only re-themes `.shell`: the body stays light, error text is 2.39:1, and about 12 hard-coded colours remain |
| 4 | Responsive Design | 3 | No page-level horizontal scroll anywhere at 390 px (even at the largest text size), but fretboard labels stay 13 px and drill-setup radio rows are 24 px tall with a broken layout |
| 5 | Implementation Integrity | 3 | A coherent, product-specific system. A "review fixes" CSS block overrides earlier rules and caused the light-theme reveal-label regression; dialog and radio classes have no CSS |
| **Total** | | **13/20** | **Acceptable (significant work needed)** |

## Implementation Integrity Verdict

**PASS (with isolated drift).** This is a product-specific system, not a template:
- Rosewood and nickel neck tokens, with an Okabe-Ito marker palette.
- Marker shapes are distinct by kind: diamond root, square reference, dashed square for incorrect, a translucent circle for revealed, and ✓/✕ labels on taps.
- A sticky nut column, clipped-edge chevron cues and "Jump to frets" segments trace directly to FR-047.

Detector results:
- `side-tab` on `.notice` (`styles.css:109`, `border-left: 4px`): verified, minor.
- `side-tab` on `.rail a.active` (`styles.css:80`, inset 3 px stripe): a **false positive in intent**. It is a nav-selection indicator alongside a surface background, and it turns into a top stripe on phones.
- `straggler` (advisory) on the `/progress` empty state and the `/settings` paragraph: cosmetic.

Drift found by hand:
- No-op rules at `styles.css:31-34`.
- The "review fixes" block at `styles.css:279-282` re-declares `.mk-revealed` and `.m-revealed .fb-label` and silently breaks light-theme contrast.
- Classes used in TSX with no CSS: `.radio-row`, `.dialog`, `.dialog-backdrop`, `.preset-grid.compact`.

## Executive Summary

- Audit Health Score: **13/20** (Acceptable).
- Issues: **P0: 0 · P1: 8 · P2: 7 · P3: 3**.
- Top issues:
  1. Fretboard marker labels: text contrast fails, and labels stay fixed at 13 px when FR-048 requires 24 px at the largest size.
  2. Revealed-answer labels are unreadable in the light theme (2.22:1).
  3. The focus ring fails 3:1 in the light theme (1.99:1 on paper).
  4. The import-preview and reset "dialogs" miss the FR-048 dialog rules.
  5. Form errors are not next to or linked to their fields, and error text is 2.39:1 in the dark theme.
- Next steps: fix the marker and label system (size plus contrast) and the focus token first, then dialogs and forms, then the dark-mode shell.

### Contrast ratios computed (WCAG 2.x)

| Pair | Light | Dark | Need |
|---|---|---|---|
| `--ink` on `--paper` | 13.35 | 14.36 | 4.5 |
| `--ink-soft` on `--paper` / `--surface` | 6.14 / 6.96 | 8.33 / 7.34 | 4.5 |
| `--accent` on `--surface` / `--paper` (links) | 5.19 / **4.57** (barely) | 6.64 / 7.53 | 4.5 |
| `--accent-ink` on `--accent` (primary button) | 5.19 | 7.96 | 4.5 |
| `#a8325e` (`.field-error`, `button.danger`) on `--surface` / `--paper` | 6.40 / 5.64 | **2.39 / 2.72 FAIL** | 4.5 |
| `--m-ok` as text (`.badge`, `.progress-pill`, `.steps li.correct`) on `--surface` / `--paper` | **3.42 / 3.02 FAIL** | **4.48 FAIL** / 5.08 | 4.5 |
| Focus `#e69f00` on `--paper` / `--surface` | **1.99 / 2.25 FAIL** | 7.71 / 6.80 | 3 |
| `--line` borders (inputs, buttons) on `--surface` / `--paper` | **1.47 / 1.29 FAIL** | **1.47 / 1.66 FAIL** | 3 |
| `button.danger` border `#e0b3c8` on `--surface` | **1.83 FAIL** | 8.35 | 3 |
| Revealed label `--ink` on 28% `#56b4e9` over wood | **2.22 FAIL** | 5.64 | 4.5 |
| Outline label `--ink` on wood (kind not yet used) | **1.46 FAIL** | 8.56 | 4.5 |
| `.fb-icon` white on `--m-ok` / `--m-bad` | **3.42 / 3.06 FAIL** | same | 4.5 |

Pairs that do not change with the theme:

| Pair | Ratio | Need |
|---|---|---|
| White label on `--m-tone` `#0072b2` | 5.19 | 4.5 |
| White label on `--m-root` `#d55e00` | **3.87 FAIL** | 4.5 |
| White label on `--m-ref` `#e69f00` (as asked; the CSS actually uses `#1c2733`, which gives 6.72) | **2.25 FAIL** | 4.5 |
| White label on `--m-ok` `#009e73` | **3.42 FAIL** | 4.5 |
| White label on `--m-bad` `#cc79a7` | **3.06 FAIL** | 4.5 |
| White on `--m-reveal` `#56b4e9` (hypothetical solid fill) | **2.31 FAIL** | 4.5 |
| Strings / frets / nut / inlays on wood | 8.03 / 6.55 / 8.32 / 6.68 | 3 |
| Window stroke `--m-reveal` / prompted string `--m-ref` on wood | 4.49 / 4.60 | 3 |
| Marker fill vs wood: tone 2.00, root 2.68, ref 4.60, ok 3.03, bad 3.38 | tone and root fills fail, but every marker has a white stroke at **10.35:1**, so their boundaries pass | 3 |
| Focus stroke `--focus` on wood | 4.60 | 3 |
| Focus vs `--m-ref` marker (same hex) | 1.00 (the ring sits on the 48x44 hit rectangle, mostly over wood, so this is minor) | 3 |

Labels are 13 px bold, which is below the 18.67 px bold "large text" threshold, so 4.5:1 applies.

## Detailed Findings by Severity

### [P1] Marker label text fails 4.5:1
- **Location**: `src/ui/styles.css:142` (`.fb-label { fill:#fff; font-size:13px }`) on `.mk-root`, `.mk-correct` and `.mk-incorrect` (`:136-139`). Also `.fb-icon` at `:241-243`.
- **Category**: Accessibility.
- **Impact**: Root note names (shown on every Explore view) and the ✓/✕ on taps are hard to read for low-vision users. The ratios are 3.87, 3.42 and 3.06.
- **Standard**: WCAG 1.4.3. **FR-048** (AA in both themes), **FR-013**.
- **Recommendation**: Either:
  - Make labels large text (≥18.67 px bold, at which point 3:1 applies and all three pass) and grow the markers. This also serves the next finding.
  - Or use dark ink `#1c2733` on root, ok and bad, as `.m-reference` already does (3.91 / 4.42 / 4.94; root and ok still need large text).

  Apply the same rule to `.fb-icon`.
- **Suggested command**: `/impeccable colorize`

### [P1] Fretboard labels are fixed at 13 px and do not reach 24 px at the largest text size
- **Location**: `styles.css:142` (`.fb-label` 13 px), `:128` (`.fb-fretnum` 12 px), `:288` (`.fb-nutname` 14 px). Fixed geometry in `Fretboard.tsx:62-70` (marker r = 16 in `MarkerShape`, `:430-446`).
- **Category**: Accessibility / Responsive.
- **Impact**: Measured at the largest size (`--step` 19.2 px): `.fb-label` 13 px and `.fb-fretnum` 12 px on /explore and /keys. Text size settings do not reach the fretboard at all.
- **Standard**: **FR-048** ("fretboard labels of at least 24 CSS px at the largest… markers grow and the neck scrolls").
- **Recommendation**: Drive label size from `--step` (for example `font-size: calc(var(--step) * 1.25)`). Scale marker radius, `MIN_CELL` and `STRING_GAP` from the text size in `Fretboard.tsx`, then re-run the FR-047 overflow and jump-segment tests.
- **Suggested command**: `/impeccable adapt`

### [P1] Revealed-answer label unreadable in the light theme
- **Location**: `styles.css:281-282` (the "review fixes" block sets `.m-revealed .fb-label` and `.m-outline .fb-label` to `fill: var(--ink)`, overriding `:143`).
- **Category**: Accessibility / Implementation Integrity.
- **Impact**: After a wrong answer, the answer's note name (`DrillRunner.tsx:374`) is drawn in `#1c2733` on a dark wood tint at **2.22:1** in the light theme. The `outline` kind would be **1.46:1** (not yet used anywhere). The dark theme passes at 5.64.
- **Standard**: WCAG 1.4.3. **FR-048**, FR-032 (reveal).
- **Recommendation**: Give the label a fixed light ink that does not change with the theme (pearl `#efe9dc` gives 8.56 on wood), or a fixed-colour token for anything drawn on the neck. The neck itself never re-themes, so labels on it must not use the page `--ink`.
- **Suggested command**: `/impeccable colorize`

### [P1] Focus indicator below 3:1 in the light theme
- **Location**: `styles.css:24` (`--focus:#e69f00`) and `:66` (`:focus-visible` outline).
- **Category**: Accessibility.
- **Impact**: The keyboard focus ring is 1.99:1 on `--paper` and 2.25:1 on `--surface`, so it is hard to see on every button, link and input in the light theme. It passes in the dark theme (7.71) and on the fretboard (4.60).
- **Standard**: WCAG 1.4.11 (2.4.7 visibility). **FR-049** ("Focus is always visible"), FR-048.
- **Recommendation**: Split the token. Add `--focus-page` for the light theme: a dark two-tone ring, for example `outline: 3px solid var(--ink); box-shadow: 0 0 0 5px #e69f00`, or an amber darkened to ≥3:1 such as `#a65300` (4.80 on paper). Keep `#e69f00` for the fretboard `.fb-hit` stroke.
- **Suggested command**: `/impeccable harden`

### [P1] Status and error text colours fail in one theme each
- **Location**:
  - `styles.css:103, 111` (`#a8325e`, not a token) in the dark theme: **2.39 / 2.72**.
  - `--m-ok` used as text in `:115` (`.badge`), `:212` (`.progress-pill`) and `:234` (`.steps li.correct`): light **3.42 / 3.02**, dark on surface **4.48**.
- **Category**: Accessibility / Theming.
- **Impact**:
  - Drill setup errors, instrument-form errors, the save-failed alert and Delete buttons are close to unreadable in the dark theme.
  - "Active" instrument badges and lesson progress pills are weak in the light theme.
- **Standard**: WCAG 1.4.3. **FR-048**.
- **Recommendation**: Add `--danger` (light `#a8325e`; dark around `#e58fb0`, which gives 6.48) and `--ok-ink` (light `#007a55` gives 5.36 / 4.73; dark `#2fd3a5` gives 8.01). Keep Okabe-Ito `--m-ok` for fills only.
- **Suggested command**: `/impeccable colorize`

### [P1] Import-preview and reset confirmations miss the FR-048 dialog rules
- **Location**:
  - `src/ui/screens/ProgressScreen.tsx:189-231`: `role="dialog" aria-modal="false"`, no focus move to `#imp-h`, no Escape, no focus containment or return.
  - `ProgressScreen.tsx:245-251`: reset is a `role="group"`. The destructive "Clear progress" button comes first. Clicking "Clear progress…" unmounts the trigger, so focus falls to `<body>`. There is no heading focus and no Escape.
- **Category**: Accessibility.
- **Impact**: Keyboard and screen-reader users lose their place. When the reset confirm appears, the next Tab can land on the destructive action first.
- **Standard**: WCAG 2.4.3 and 2.1.1. **FR-048** names import preview and reset explicitly.
- **Recommendation**: Use one shared dialog primitive (native `<dialog>` with `showModal()`, or the WalkingBass pattern with real styles):
  - focus the heading on open;
  - trap Tab;
  - Escape closes, except while `applying`;
  - return focus to the opener;
  - put the safe button first.
- **Suggested command**: `/impeccable harden`

### [P1] Form errors are not next to or linked to their fields
- **Location**:
  - `src/ui/screens/GearScreen.tsx:136, 173`: one `.field-error` at the bottom of the instrument form, even for "String N: … isn't a note".
  - `DrillsScreen.tsx:174`: the same pattern.
  - No `aria-invalid`, `aria-describedby` or `aria-errormessage` anywhere in `src/ui`.
- **Category**: Accessibility.
- **Impact**: Users must hunt for which tuning input or fret field is wrong. Screen readers announce the alert but do not associate it with the field.
- **Standard**: WCAG 3.3.1 and 1.3.1. **FR-048** ("named in text next to the field, linked to it and announced").
- **Recommendation**: Track errors per field and render them under the field. Set `aria-invalid="true"` and `aria-describedby` to the error's id, keep `role="alert"` (or a polite live region), and move focus to the first invalid field on submit.
- **Suggested command**: `/impeccable harden`

### [P1] Input and button boundaries below 3:1
- **Location**: `styles.css:7` (`--line`) used at `:97` and `:106` for every button, input and select border. `button.danger` border at `:103`.
- **Category**: Accessibility.
- **Impact**: Number inputs and selects on white cards are 1.47:1 against their background, so their hit areas are hard to see for low-vision users. The tuning inputs and fret fields are the main problem.
- **Standard**: WCAG 1.4.11. **FR-048**.
- **Recommendation**: Add `--line-strong` at ≥3:1 for interactive controls only (light: about `--ink-soft`, which is 6.96 on surface; dark: about `#6b7785`, which is 3.36 on surface). Keep `--line` for decorative dividers.
- **Suggested command**: `/impeccable colorize`

### [P2] Dark mode re-themes `.shell` only, so the page canvas stays light
- **Location**: `styles.css:2-30` (`:root` with `color-scheme: light`), `:36-46` (dark only on `.shell`), `:53` (`body { background: var(--paper) }` resolves to the light value). `index.html` has a fixed `theme-color`.
- **Category**: Theming.
- **Impact**: Measured: body background stays `rgb(238,241,244)` in dark mode on every route. It shows on overscroll and rubber-band, and the root scrollbar stays light.
- **Standard**: FR-048 ("light and dark themes").
- **Recommendation**: Apply the theme on `<html>` (`document.documentElement.dataset.theme`) and declare the dark tokens on `:root`. Add `<meta name="theme-color" media="(prefers-color-scheme: dark)">`. Delete the no-op rules at `:31-34`.
- **Suggested command**: `/impeccable colorize`

### [P2] Drill-setup radio rows: broken layout and 24 px targets
- **Location**: `DrillsScreen.tsx:127-135, 147`. `.radio-row` has no CSS, so `.form label { flex-direction: column }` (`styles.css:187`) stacks the radio, its label and its detail on separate lines.
- **Category**: Responsive / Accessibility.
- **Impact**: Seen at 390 px: the radio sits alone, with "naturals" detached below it. Measured "Any octave on the string" at 203x24 and "Exact octave" at 183x24.
- **Standard**: **FR-047** (44x44 for every control); WCAG 2.5.8 passes (24 px).
- **Recommendation**: Add `.radio-row, .inline label { flex-direction: row; min-height: 44px; align-items: center }`.
- **Suggested command**: `/impeccable layout`

### [P2] Radio semantics: no arrow-key movement
- **Location**:
  - `src/ui/common.tsx:53-61` (`Segmented`): `role="radiogroup"` built from buttons, each tabbable, with no arrow-key handling.
  - `DrillsScreen.tsx:134-135, 147`: native radios with no `name`, so each is its own group.
- **Category**: Accessibility.
- **Impact**: Tab order is inflated (Settings has five segmented groups of 2–3 buttons each), and the radio pattern that screen-reader users expect does not work.
- **Standard**: WAI-ARIA APG radio group. **FR-049**.
- **Recommendation**: Roving `tabIndex` plus Arrow and Home/End keys in `Segmented`, and add `name` to native radio sets.
- **Suggested command**: `/impeccable harden`

### [P2] Walking-bass "End drill?" dialog is unstyled
- **Location**: `WalkingBassRunner.tsx:285-286`. `.dialog-backdrop` and `.dialog` are not defined in `styles.css`.
- **Category**: Accessibility / Implementation Integrity.
- **Impact**: It has `aria-modal="true"` but renders inline at the bottom of the section, with no backdrop, and the content behind it stays clickable. Sighted users may not notice it.
- **Standard**: FR-048 dialog rules, CR-B3-8.
- **Recommendation**: Use the shared dialog primitive from the import/reset fix (a native `<dialog>` gives a backdrop and inertness).
- **Suggested command**: `/impeccable harden`

### [P2] Instrument editor and Delete
- **Location**:
  - `GearScreen.tsx:176`: Cancel does not return focus to the Edit or Custom button, so focus is lost. There is no Escape.
  - `GearScreen.tsx:74`: Delete removes an instrument at once, with no confirmation or undo.
- **Category**: Accessibility.
- **Impact**: Focus is lost after Cancel, and an instrument can be destroyed by accident.
- **Standard**: **FR-048** ("instrument editor" dialog), FR-053.
- **Recommendation**: Return focus to the opener and handle Escape. Confirm Delete (safe button first) or offer an undo toast.
- **Suggested command**: `/impeccable harden`

### [P2] Single 599 kB JS chunk
- **Location**: build output `dist/assets/index-k48XflOg.js`: 598.79 kB (185.17 kB gzip). Vite warns; PWA precache is 644 KiB across 11 entries.
- **Category**: Performance.
- **Impact**: Slower first load on phones. Offline (FR-045) is unaffected once cached. What fills the chunk was not measured (not attributed).
- **Recommendation**: Lazy-load routes (`React.lazy` for Lessons, Progress, Gear and the drill runners), and load lesson content per lesson. Confirm the contents with a bundle visualiser first.
- **Suggested command**: `/impeccable optimize`

### [P2] PWA icons: SVG only
- **Location**: `vite.config` manifest (`dist/manifest.webmanifest`: a single `icon.svg`, `sizes:"any"`); `index.html` has no `apple-touch-icon`.
- **Category**: Responsive / Implementation Integrity.
- **Impact**: iOS "Add to Home Screen" ignores SVG manifest icons and uses a screenshot. There is no maskable icon for Android.
- **Standard**: **FR-046** (installable on Safari iOS and Chrome Android).
- **Recommendation**: Add 192 and 512 PNG icons, a maskable variant and a 180 px `apple-touch-icon`.
- **Suggested command**: `/impeccable polish`

### [P3] Fretboard re-renders on every scroll event
- **Location**: `Fretboard.tsx:120-125, 345` (`onScroll={sync}` calls `setGeo`, which re-renders every `<g>` position: up to 8x25).
- **Category**: Performance.
- **Recommendation**: Throttle `sync` with `requestAnimationFrame`, or move the cue and range state into a small child component.
- **Suggested command**: `/impeccable optimize`

### [P3] CSS drift
- **Location**:
  - Hard-coded colours outside tokens: `styles.css:70, 74, 75, 103, 111, 134, 136, 139, 142, 144, 160, 161, 241`.
  - The override block at `:279-282`.
  - `.notice` side stripe at `:109` (detector).
- **Category**: Theming / Implementation Integrity.
- **Recommendation**: Fold the "review fixes" into the original rules and tokenise the literals (on-slate ink, on-marker ink, danger).
- **Suggested command**: `/impeccable polish`

### [P3] Brand and skip-link targets below 44 px
- **Location**: `Layout.tsx:33-35`. Measured `a.brand` at 126x28 and `.skip` at 105x24 when focused.
- **Category**: Responsive.
- **Standard**: FR-047 (44x44); WCAG 2.5.8 passes.
- **Recommendation**: `min-height: 44px` on `.brand` and `.skip`.
- **Suggested command**: `/impeccable polish`

## Patterns & Systemic Issues
- **Okabe-Ito hues are used as text and white-label backgrounds.** The palette is built for fills distinguishable under colour-blindness, not for 4.5:1 text. Root, ok and bad all fail as text or under white labels. The system needs separate "on-marker ink" and "status text" tokens.
- **Neck colours are fixed but some neck labels use theme tokens.** `--ink` on wood breaks the light theme. Everything drawn on the neck should use neck-scoped tokens.
- **There is no shared dialog primitive.** There are three ad-hoc confirm patterns (ProgressScreen import, ProgressScreen reset, WalkingBass), each missing different FR-048 rules.
- **Fixed-pixel SVG typography**: the text-size setting stops at the fretboard.

## Positive Findings
- **FR-047 holds**: page scrollWidth equals viewport width (390) on all 10 routes, in light and dark, including at the largest text size. The fretboard scrolls inside its own area with chevron cues, a range text node and Jump-to-frets controls (44 px).
- Fretboard positions have 48x44 hit rectangles, a 46 px string gap and a 52 px minimum cell. The bottom tab bar has 44 px items, and `scroll-padding-bottom: 110px` keeps focus clear of it.
- Every route has exactly one h1, and route changes move focus to the h1. There is a skip link. The fretboard uses a roving tabindex with arrows, Home/End and Enter/Space. Live regions are polite.
- FR-013 non-colour coding is real: diamond root, square reference, dashed incorrect, translucent revealed, and ✓/✕ labels. Every marker has a white ring at 10.35:1 against wood. Strings, frets, nut and inlays are 6.5–8.3:1.
- Body text passes comfortably in both themes (`--ink-soft` 6.14–8.33). Primary buttons are 5.19 / 7.96.
- 2381 tests pass. No console errors on any route.

## Recommended Actions
1. **[P1] `/impeccable colorize`**:
   - on-marker label ink plus large-text sizing;
   - neck-scoped label colour for revealed and outline;
   - `--danger` and `--ok-ink` tokens for each theme;
   - `--line-strong` for control borders.
2. **[P1] `/impeccable adapt`**: scale fretboard labels and markers with text size (24 px at the largest, per FR-048), then re-verify FR-047 at 390 px.
3. **[P1] `/impeccable harden`**:
   - two-tone light-theme focus ring;
   - a shared dialog primitive for import, reset, walking-bass and the instrument editor;
   - per-field linked errors;
   - Segmented arrow keys and radio `name`s.
4. **[P2] `/impeccable colorize`**: move the theme to `<html>`/`:root`, plus a dark `theme-color`.
5. **[P2] `/impeccable layout`**: `.radio-row` and inline radio labels at 44 px.
6. **[P2] `/impeccable optimize`**: route code-splitting; rAF-throttle fretboard scroll sync.
7. **[P2] `/impeccable polish`**: PNG, maskable and apple-touch icons (FR-046); tokenise the literal colours; merge the "review fixes" CSS; 44 px brand and skip link.
8. **`/impeccable polish`**: a final pass.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` after fixes to see your score improve.
