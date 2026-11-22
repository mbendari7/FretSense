# Quickstart and Validation Guide: 001

> These commands **don't exist yet**. They become real when the setup tasks (Phase 1 in
> tasks.md) land. Don't run or cite them before then (CLAUDE.md).

## Prerequisites

- Node 22 LTS, pnpm 9 (via `corepack enable`).
- Playwright browsers: `pnpm exec playwright install chromium webkit`.
- For SC-002/SC-003 only: the reference laptop and phone named in the spec's Clarifications (open
  items O1, O2) and Chrome remote debugging for the phone.

## Commands (planned)

| Command | What it does |
|---------|--------------|
| `pnpm install` | install the workspace (frozen lockfile in CI) |
| `pnpm lint` | ESLint + the pitch-literal rule + dependency-cruiser layer rules |
| `pnpm typecheck` | `tsc -b` across project references |
| `pnpm test` | Vitest unit + property tests, all packages |
| `pnpm test:coverage` | the same, with the ≥ 90% gates on `packages/theory` and `apps/web/src/domain` |
| `pnpm --filter @fretsense/theory test` | theory engine only |
| `pnpm lessons:validate` | alias for `pnpm --filter web lessons:validate`: validate lessons, packs and tags (FR-023) |
| `pnpm --filter web dev` | local PWA dev server |
| `pnpm --filter web build && pnpm --filter web preview` | production build with the service worker |
| `pnpm --filter web e2e` | Playwright E2E (offline, 390 px, a11y, no-lock crawl, visual) |
| `pnpm --filter web bench:latency` | SC-002/SC-003 latency benchmark (perf-auditor; reference devices) |

## Validation scenarios (each maps to spec acceptance criteria)

| # | Scenario | How | Expected |
|---|----------|-----|----------|
| V1 | Theory fixtures | `pnpm --filter @fretsense/theory test` | 100% of fixtures pass (SC-001); coverage ≥ 90% (SC-010) |
| V2 | Any-instrument property tests | the same | pass for 7 presets + ≥ 100 generated instruments (SC-011) |
| V3 | Explorer (US1) | `/explore?root=D&scale=ionian` on a 6-string Standard instrument | D E F# G A B C#, roots marked by shape (US1-1) |
| V4 | First run with no instrument | fresh browser profile → `/explore` | the instrument picker appears first; one tap picks a preset (FR-053) |
| V5 | Lessons and stage preference (US2) | set stages to "See, Drill"; open a fixture lesson | starts at See; only See and Drill shown; "show all stages" works (US2-9) |
| V6 | Nothing locked | `pnpm --filter web e2e -g no-lock` | every route in contracts/ui-routes.md opens on a fresh profile (SC-012) |
| V7 | Note-finding (US3) | run 20 questions | per-string accuracy and median time; exact-octave mode works (US3-6) |
| V8 | Weighting (US7) | domain tests with a seeded history | string 3 share ≥ 1.5× (US7-1); uniform when off (US7-5) |
| V9 | Export → reset → import | E2E | 100% of attempts restored, 0 duplicates (SC-009) |
| V10 | Copy import into another profile | domain tests (016 adds the UI) | new ids, no id in two profiles (SC-013) |
| V11 | Offline | build + preview, then go offline in Playwright | all US1–US7 scenarios pass (SC-005) |
| V12 | 390 px and targets | E2E | no page-level horizontal scroll; 100% of targets ≥ 44 × 44 px (SC-006) |
| V15 | Hostile input | `pnpm test` (import fuzz) + `lessons:validate` on the hostile-markdown corpus | 100% rejected or allowlisted, with no change on rejection (FR-025, FR-043) |
| V16 | Network and CSP | `pnpm --filter web e2e -g csp` | 0 CSP violations, 0 requests to non-self origins (Constitution IX) |
| V13 | Lesson validation | `pnpm lessons:validate` on the invalid fixtures | 100% fail with file + field (SC-008) |
| V14 | Latency | `bench:latency` on O1/O2 devices | p95 < 100 ms per preset and for the worst case (SC-002, SC-003) |
