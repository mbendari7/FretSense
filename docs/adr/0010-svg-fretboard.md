# 0010. SVG Fretboard Rendering

- Status: Proposed (pending owner approval)
- Date: 2026-11-21
- Deciders: owner
- Related: specs/001 FR-011–FR-018, FR-047–FR-049, FR-062, SC-003, SC-006; research R8; ADR-0003

## Context
The fretboard must show up to 8 strings × 25 positions, be keyboard- and screen-reader-operable per
position, distinguish roots without colour, support left-handed mirroring and proportional spacing,
scale to music-stand text sizes, and update within 100 ms p95.

## Decision
An SVG React component. Geometry (positions, fret x-coordinates via xₙ = 1 − 2^(−n/12), normalised)
comes from `packages/theory`. Each note marker is a focusable element with an accessible name; roots
use a distinct shape and outline; mirroring uses a group transform with upright text; the neck
scrolls inside its own container at 390 px.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Canvas 2D | Fast for many shapes | No per-element focus or a11y; hit-testing by hand | FR-049 |
| CSS grid of divs | Accessible | Proportional spacing and inlays are awkward; heavier DOM | Worse fit |
| WebGL | Very fast | Unnecessary for ≤ 200 static shapes; no a11y | Overkill |

## Consequences
- Visual regression screenshots per preset and the worst-case geometry.
- 008's live highlighting (FR-027) reuses the same component.

## AI involvement
_To be written by the owner._
