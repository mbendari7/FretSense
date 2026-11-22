# 0009. Content Pipeline: Lessons, Curriculum Packs and Tags

- Status: Proposed (pending owner approval)
- Date: 2026-11-21
- Deciders: owner
- Related: specs/001 FR-022–FR-025, FR-063, FR-068, SC-008; research R7; contracts/content-formats.md; THREAT-MODEL T3, T13; ADR-0006

## Context
Lessons are owner-written markdown with structured metadata; curriculum packs group them (no book
dependency); tags feed 016's path generation. Content must be validated at build time (with file
and field named), rendered safely (no scripts or raw HTML), and available offline. 001's profile
import and 016's pack import validate untrusted files at runtime.

## Decision
- Lessons: `content/lessons/*.md` with YAML frontmatter. Packs: `content/packs/*.yaml`. Tags:
  `content/tags.yaml` (namespaced `goal:`, `genre:`, `topic:`, `level-hint:`).
- One set of Zod schemas in `apps/web/src/domain/content`, shared by the build validator
  (`pnpm lessons:validate`, Vite plugin) and runtime import validation.
- Markdown compiled at build time (remark → rehype; any raw-HTML node fails the build; GFM tables
  only; a custom rehype-sanitize allowlist; image paths confined to `content/`; link schemes limited
  to http/https/relative) into precached JSON; no markdown parser in the browser. Zod is the one
  third-party library allowed in the domain layer.
- Safe YAML options (core schema, unique keys, alias cap, size cap); runtime imports are JSON only.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| MDX | Rich interactive lessons | Arbitrary code in content (violates FR-025) | Security |
| Runtime markdown rendering | Simpler build | Parser shipped to the client; sanitisation at runtime | Larger attack surface |
| JSON Schema + Ajv | Standard | Verbose; separate type generation | Zod gives types and paths |
| Valibot | Smaller bundle | Less mature error reporting | Close call; Zod chosen, revisit if bundle size matters |
| Book part/chapter fields in lessons | Simple mapping | Ties content to one book (Constitution XIII) | Replaced by packs |

## Consequences
- Real lessons need the owner-curated tag vocabulary (open item O4); fixtures use placeholders.
- Adding a lesson or a pack needs no code change (SC-008).

## AI involvement
_To be written by the owner._
