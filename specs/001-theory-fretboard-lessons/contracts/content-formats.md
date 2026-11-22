# Contract: Content Formats (Lessons, Curriculum Packs, Tag Vocabulary)

Validated at build time by `pnpm lessons:validate` (root alias for `pnpm --filter web lessons:validate`) and the Vite content plugin, using the same Zod
schemas the app uses at runtime (research R7). Every error names the file and the field path
(FR-023). The templates are `content/lessons/_template.md` and `content/packs/_template.yaml`.

## Lesson (`content/lessons/<slug>.md`), FR-022, FR-023, FR-068

Frontmatter (YAML), then a markdown body.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | kebab-case string | yes | unique across lessons |
| `title` | string ≤ 120 | yes | |
| `level` | `beginner \| intermediate \| advanced` | yes | |
| `tags` | string[] | yes (may be empty) | each `namespace:value`, namespace ∈ {goal, genre, topic, level-hint}, value in `content/tags.yaml` |
| `instruments` | (`guitar` \| `bass`)[] or `[any]` | yes | FR-054 |
| `concepts` | concept id[] | yes (may be empty) | kebab-case; checked against concepts in 006 |
| `fretboard_preset` | object | no | `root` (pitch-class note), exactly one of `scale` / `chord` (known ids), `labels` (`notes`\|`degrees`\|`none`), `frets?` [start, end] with end ≤ 24, `preset?` (known preset id) |
| `drills` | DrillDefinition[] | yes (may be empty) | each has `id` (unique in the lesson), `type` (7 known types), `instruments`, `params` valid for the type; progression drills require `key: { tonic, mode }` and 2–8 chords of `{ root, quality }` |
| `songs` | `{ title ≤ 120, note? ≤ 200 }[]` | no | plain text |
| `needs` | (`audio-input` \| `camera`)[] | no (default []) | `[camera]` alone is invalid |
| `play`, `camera_coach` | object | no | reserved; ignored in 001 |

Body: CommonMark + the GFM table extension only (no footnotes, task lists, autolink literals or
strikethrough). Raw HTML is **not** allowed: any `html` node is a build error naming file and line,
never a silent strip. h1 is reserved for the title. `a href` must parse to `http:`, `https:` or a
relative URL. The exact mechanism is in research R7.
Allowed output elements: h2–h4, p, ul/ol/li, em/strong, code (inline), table family, img (src must be
a relative path that resolves inside `content/`; any scheme or `../` escape is a build error), a (http/https/relative only). Sections `## Read` and an optional
`## Notes for See` are recognised.

## Curriculum pack (`content/packs/<id>.yaml`), FR-063

| Field | Type | Rules |
|-------|------|-------|
| `id` | kebab-case | unique; `general-theory` is the built-in pack |
| `title` | string ≤ 120 | |
| `source` | string ≤ 200, optional | name of the book or course only (no copied text) |
| `schema_version` | integer | 1 |
| `sections` | `{ title ≤ 120, label? ≤ 40, lessons: lessonId[] }[]` | ≥ 1 section; every lesson id exists; a lesson may appear in several packs and sections |

User-pack runtime import (016) uses this schema plus the 016 FR-014 limits.

## Tag vocabulary (`content/tags.yaml`), FR-068

```yaml
goal: [solo-over-blues, chord-theory, ...]       # owner-curated (open item O4)
genre: [blues, rock, ...]
topic: [notes-on-the-neck, intervals, ...]
level-hint: [...]
```

Values are lower-case kebab-case and unique within a namespace. The file is owner-curated content;
fixtures use placeholder values.
