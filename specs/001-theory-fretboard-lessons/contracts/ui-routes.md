# Contract: UI Routes and Deep Links (FR-024, FR-065, SC-012)

Every route works on a fresh profile with no progress (no lock, Constitution XIII), offline after
first load, and at 390 px. An unknown id shows a "not found" page with a link to the library, never
a crash. If a route needs an instrument and the profile has none, the instrument picker shows
first, then the route (FR-053).

| Route | Screen | Query parameters |
|-------|--------|------------------|
| `/` | Home: explorer shortcut, library, last lesson | — |
| `/explore` | Fretboard explorer (US1) | `root`, `scale` \| `chord`, `labels`, `from`, `to` (all optional, shareable) |
| `/keys` | Key helper (US5) | `tonic`, `mode`, `sevenths`, `hm` |
| `/library` | Lessons grouped by the active pack (US2-1) | `pack`, `all=1` (show all families) |
| `/lessons/:lessonId` | Lesson at the first preferred stage (FR-064) | — |
| `/lessons/:lessonId/:stage` | A specific stage (`read` \| `see` \| `drill`), even if hidden by preference | — |
| `/lessons/:lessonId/drill/:drillId` | Start a lesson drill directly (US2-10) | — |
| `/drills/:type` | Stand-alone drill setup (note-finding, interval, chord-tone, bass types) | settings as query |
| `/progress` | Progress views (FR-042), export/import, reset | — |
| `/settings` | Display, octave mode, adaptive weighting, stage preference, active pack | — |
| `/gear/instruments` | My Gear instruments (FR-053) | — |

Route parameters are validated with the same schemas as content (research R7); invalid values fall
back to defaults with a notice. Rules (security review #8):
- Only the query keys listed above are accepted; unknown keys are dropped.
- `from`/`to` are integers within the **active instrument's** `0..fretCount` and `from ≤ to`;
  `root`/`tonic` are pitch-class notes; `scale`, `chord`, `pack`, `labels`, `mode` must be known
  ids; `sevenths`, `hm`, `all` are `0`/`1`.
- `/drills/:type` accepts `strings` (comma list within 1..stringCount), `from`, `to`, `count`
  (5–100), `set` (known note/interval/quality ids), `dir` (`up`/`down`/`both`), `octave`
  (`any`/`exact`).
- Lessons, packs and drills are looked up in `Map`s, so `/lessons/__proto__` or
  `/lessons/constructor` shows "not found".
- Parameters are only ever shown as React text, never as HTML.
