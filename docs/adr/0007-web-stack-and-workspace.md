# 0007. Workspace, Web Stack and Test Toolchain for 001

- Status: Proposed (pending owner approval)
- Date: 2026-11-21
- Deciders: owner
- Related: specs/001-theory-fretboard-lessons/plan.md, research.md R1–R3, R10–R12; Constitution II, III, VI, XII

## Context
001 needs a pure theory library and an offline, installable web app, with test-first development,
≥ 90% coverage gates and enforced layering. The constitution fixes pnpm, strict TypeScript, React +
Vite and Vitest + fast-check, but leaves the PWA tooling, state handling, routing and E2E tooling
open.

## Decision
- A pnpm workspace with `packages/theory` and `apps/web`; TypeScript project references; no task
  runner.
- React + Vite (current stable majors at the setup task, recorded here when pinned) + vite-plugin-pwa (Workbox precache); React Router with history URLs and an SPA
  fallback (deep links for FR-065).
- No state library: application services expose observable stores, read via
  `useSyncExternalStore`; DI at one composition root.
- Tests: Vitest + fast-check, Testing Library + jest-axe, Playwright (Chromium and WebKit, matching FR-046; no Firefox) with
  axe, offline and 390 px runs, visual regression and the latency benchmark. dependency-cruiser and
  ESLint enforce the layers and the no-pitch-literal rule.

## Alternatives considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| Turborepo / Nx | Caching, task graphs | Overhead for two packages | XII: no requirement |
| Next.js | Mature, routing built in | SSR/server features unused by an offline on-device app | Wrong shape |
| Redux Toolkit / Zustand | Familiar patterns | Extra dependency; logic drifts out of the domain | No requirement (XII) |
| Hand-written service worker | Full control | Easy to get cache updates wrong | Workbox is the standard |
| Jest / Cypress | Popular | Jest is slower with ESM; Cypress has no WebKit (Safari, FR-046) | Vitest + Playwright fit better |

## Consequences
- Records, `ItemKey` and merge live in `apps/web/src/domain` with no app imports, so they can move
  mechanically into a package when 006 (`packages/learner`) needs them.
- Two coverage gates: `packages/theory` and `apps/web/src/domain`.
- Hosting stays undecided until deployment is needed (a later ADR); CI runs E2E against the local
  production build.

## AI involvement
_To be written by the owner._
