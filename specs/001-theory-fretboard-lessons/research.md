# Research: 001 Theory Engine, Fretboard and Lessons

**Date**: 2026-11-21 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Each decision lists what was chosen, why, and what was rejected. Decisions that are hard to reverse
or that add a dependency are also recorded as ADRs (all **Proposed** until the owner approves them).

## Open items that this plan does not resolve (owner)

| # | Item | Blocks | Where it goes |
|---|------|--------|---------------|
| O1 | Reference laptop: model, CPU, GPU, RAM, OS, browser | SC-002, SC-003 benchmark tasks (Constitution V) | spec Clarifications |
| O2 | Reference phone: model, OS, browser | SC-002, SC-003 benchmark tasks | spec Clarifications |
| O3 | Family pitch ranges (guitar E1–E4, bass A0–C3) | FR-053 validation constants, SC-011 generator bounds | spec Clarifications |
| O4 | Tag vocabulary values (FR-068) | Lesson validation of real lessons (fixtures use placeholder tags) | `content/tags.yaml` (owner-curated) |

Benchmark and validation tasks that depend on O1–O4 are marked **blocked-on-owner** in tasks.md.
Everything else can proceed.

---

## R1. Workspace and toolchain → ADR-0007

- **Decision**: a pnpm workspace with two packages for 001: `packages/theory` and `apps/web`.
  TypeScript 5.x `strict` with project references, on Node 22 LTS. No task runner (Turborepo or Nx):
  pnpm's `--filter` and `-r` are enough for two packages.
- **Rationale**: the constitution mandates pnpm and strict TypeScript. Project references keep
  `packages/theory` compiled and type-checked on its own, so it can't import the app.
- **Alternatives**: Turborepo or Nx (caching is unnecessary for two packages, so it's added
  complexity, Constitution XII); npm or Yarn workspaces (the constitution names pnpm); a single
  package (can't enforce that theory is pure and dependency-free).

## R2. Web app framework and PWA → ADR-0007

- **Decision**: React + Vite (current stable majors at setup), `vite-plugin-pwa` (Workbox) with a precache of the app shell and
  all compiled content, so everything works offline after first load (FR-045). An installable
  manifest covers FR-046. Client-side routing uses React Router with history URLs; the static host
  serves `index.html` as the fallback, so every lesson, stage and drill has a direct link (FR-065,
  SC-012).
- **Rationale**: the constitution names React + Vite. Workbox precaching is the standard way to
  make a static PWA work offline. Direct links are needed for "nothing locked" and for 016 paths.
- **Alternatives**: Next.js (SSR and server routes add nothing to an offline, on-device app);
  SvelteKit or Solid (not the mandated stack); a hand-written service worker (reinvents Workbox and
  is easy to get subtly wrong for cache updates); hash routing (works without host config, but
  produces uglier links; history routing with an SPA fallback is supported by every candidate host).

## R3. Application state → ADR-0007

- **Decision**: no state-management library. Application services (use cases) own state and
  expose small observable stores; React reads them through `useSyncExternalStore` hooks. Services
  are wired at one composition root with dependency injection (constructor parameters), so tests
  pass in in-memory repositories, a fixed clock and a seeded RNG.
- **Rationale**: the state is modest (settings, active drill session, library view), and DI at a
  composition root is what makes the domain testable (clean architecture rule in the constitution).
- **Alternatives**: Redux Toolkit (boilerplate, and it pushes logic into reducers instead of the
  domain); Zustand or Jotai (fine libraries, but they add a dependency for no requirement, XII);
  React context for everything (re-render storms on the drill hot path, which risks SC-002).

## R4. Local persistence → ADR-0008

- **Decision**: IndexedDB through the `idb` wrapper (≈1 kB). Repositories are ports in the
  application layer, with an IndexedDB adapter in infrastructure and an in-memory adapter for tests;
  `fake-indexeddb` tests the real adapter in Node. `navigator.storage.persist()` is requested on
  first run (FR-045).
- **Rationale**: IndexedDB is the only browser store that is asynchronous, transactional (atomic
  writes per user action), large enough for 50,000+ attempts, and available on every FR-046 target.
- **Alternatives**: Dexie (a heavier, richer API we don't need; `idb` plus our own repositories keeps
  the schema explicit); localStorage (synchronous, about 5 MB, no transactions); SQLite in WASM on
  OPFS (strong querying, but a large WASM download, uneven iOS support, and overkill for key-value
  access patterns); RxDB (sync framework lock-in before 013 is designed).

## R5. Ids, clocks and the merge rule (FR-066, FR-066a) → ADR-0008

- **Decision**:
  - Record ids are UUIDv4 from `crypto.randomUUID()` (no dependency, available in all FR-046
    targets over HTTPS).
  - `created` and `updated` are **hybrid logical clock** (HLC) strings: `<ISO-8601 wall time ms>-
    <4-digit counter>-<writerId>`. They sort lexicographically, survive clock skew between
    devices, and break ties by writer id, which is exactly FR-066a's tie rule. The writer id is a
    random UUID per (local profile, device), so it is not a device identifier (privacy review).
  - HLC rules (pure domain functions, unit-tested):
    - **send** (local write): `wall = max(now, last.wall)`; counter = 0 if wall advanced, else +1.
    - **receive** (import, later sync): `last = max(last, remote)` before the next send, so local
      edits after an import always sort after imported ones.
    - **overflow**: counter 9999 + 1 ⇒ `wall + 1 ms`, counter 0.
    - **bound**: remote wall times > now + 24 h are rejected (import fails); `last` never advances
      past now + 24 h (security review #1).
    - **atomicity**: HLC state is advanced in the same IndexedDB readwrite transaction as the write.
  - Natural-key stores (`profileSettings`, `lessonCompletion`) are matched by natural key in every
    merge; settings carry a per-field HLC map so 013 can merge per field without a migration
    (architecture review #1, #2).
  - Tombstones: `deleted: true` plus an `updated` bump; records are never hard-deleted (except 016's
    "erase permanently").
  - `schemaVersion` on every record and on the export file; migrations are pure functions
    `vN → vN+1`, applied on read and on import.
  - The merge function (FR-066a) is a pure domain function: `merge(local, incoming, mode)` where
    mode is `restore` or `sync`; attempts are compared by an immutable payload hash (frozen
    encoding in data-model.md §3.1; hashing behind a `Hasher` port so the domain stays pure).
- **Rationale**: these are the minimum fields that let 013 sync later without rewriting records
  (Constitution XIII). Adding an HLC now avoids a migration that a later switch from wall-clock
  timestamps would force.
- **Alternatives**: UUIDv7 (time-ordered, but needs a dependency or custom code, and ordering
  already comes from the HLC); auto-increment keys (collide across devices); plain wall-clock
  `updated` (clock skew makes last-writer-wins wrong across devices); CRDT libraries such as Automerge
  or Yjs (powerful, but heavy and they dictate the storage format before 013's design; our records
  are mostly immutable attempts plus small LWW records).

## R6. Instrument geometry id (FR-051, FR-053)

- **Decision**: the geometry id is the canonical string `"<family>:<note>-<note>-…"` from low to
  high, with notes in scientific pitch notation and ASCII accidentals (e.g.
  `guitar:E2-A2-D3-G3-B3-E4`, `bass:B0-E1-A1-D2-G2`). It is a pure function in `packages/theory`.
- **Rationale**: deterministic on every device; readable in exports and test failures; no hash
  collisions; enharmonic tunings stay distinct on purpose (Eb tuning spelled `Eb2-…` is not
  `D#2-…`; the spelling is the user's).
- **Alternatives**: a hash of the tuning (opaque, collision handling needed); a per-instrument
  version counter (a reviewer finding: it doesn't reunite stats when a user retunes back); the
  instrument id alone (mixes tunings, which FR-041 forbids).

## R7. Content pipeline: lessons, packs, tags → ADR-0009

- **Decision**:
  - Lessons are markdown files with YAML frontmatter (`content/lessons/*.md`); packs are YAML
    (`content/packs/*.yaml`); the tag vocabulary is `content/tags.yaml`.
  - Schemas are written once with **Zod** in `apps/web/src/domain/content/` and used both by the
    build-time validator (a Node script and a Vite plugin) and at runtime for imports (001 profile
    import; 016 pack import later).
  - At build time, markdown is compiled with remark → rehype into JSON modules that the app
    precaches. No markdown parser ships to the browser. Exact mechanism (security review #4):
    - the validator walks the mdast and **fails the build** (file and line) on any `html` node;
      `allowDangerousHtml: false`; no `rehype-raw`;
    - only the GFM **table** extension is enabled (footnotes, task lists, autolink literals and
      strikethrough are off);
    - a custom `rehype-sanitize` schema (not `defaultSchema`) allows exactly: h2–h4 (h1 is reserved
      for the title from frontmatter), p, ul, ol, li, em, strong, code, table, thead, tbody, tr, th,
      td, img[src, alt], a[href];
    - `img src` is resolved with `path.resolve` and must stay inside `content/` (no `../` escape, no
      scheme, percent-decoded first); `a href` is parsed as a URL and its protocol must be `http:`,
      `https:` or relative (so `javascript:`, `data:` and `vbscript:` fail, including
      entity-encoded forms);
    - a rehype step **after** sanitise adds `rel="noopener noreferrer"` and `target="_blank"` to
      external links.
  - YAML is parsed with `schema: 'core'`, `uniqueKeys: true`, `maxAliasCount: 10` and a 256 kB
    per-file cap. Runtime imports (001 profile files) are JSON only; 016 decides its pack import
    format and is recommended to accept JSON only.
  - Tests: a hostile-markdown corpus (XSS cheat-sheet vectors, `javascript:` links, `<svg onload>`,
    entity-encoded schemes, path traversal) must fail the build or produce allowlisted output
    (FR-025); fast-check generates arbitrary JSON (deep nesting, `__proto__`/`constructor` at every
    level, huge arrays, control/bidi characters) and the import always rejects with no change, or
    accepts a valid file (FR-043).
  - `pnpm lessons:validate` runs the same validation locally and in CI (FR-023). Errors name the
    file and the field path.
- **Rationale**: one schema source prevents the build and the runtime from drifting. Build-time
  rendering removes a runtime parser and its attack surface (THREAT-MODEL T3), and makes content
  fully offline.
- **Alternatives**: Valibot (smaller bundle, a good option; Zod chosen for its maturity, error
  messages with paths, and JSON Schema export for contracts; the bundle cost (~13 kB gz) is
  acceptable); JSON Schema + Ajv (verbose to author, and the types must be generated separately);
  MDX (lets lessons contain components and code, which is exactly the arbitrary execution FR-025
  forbids); runtime markdown rendering (ships a parser and makes sanitisation a runtime concern).

## R8. Fretboard rendering → ADR-0010

- **Decision**: an SVG React component that draws strings, frets, inlays and note markers from
  positions computed by `packages/theory`. Uniform spacing by default; proportional spacing uses
  the equal-temperament fret formula xₙ = L·(1 − 2^(−n/12)), normalised to the view width (FR-062).
  Every note marker is a focusable element with an accessible name (FR-049); roots get a distinct
  shape and outline, not just colour (FR-013). The neck scrolls inside its own container at 390 px
  (FR-047). Left-handed mode mirrors with a transform on the neck group while text stays upright
  (FR-017).
- **Rationale**: SVG elements are DOM nodes, so they are focusable, labelled, hit-testable and
  scale crisply for music-stand reading (FR-048). At most 8 strings × 25 positions = 200 markers,
  well within SVG performance for SC-003.
- **Alternatives**: Canvas (fast, but no per-element accessibility or focus; we would rebuild a
  parallel accessibility tree); a CSS grid of DOM divs (accessible, but proportional spacing and
  inlays are awkward, and the markup is heavier); WebGL (unnecessary for 200 static shapes).

## R9. Weak-spot weighting (FR-041)

- **Decision**: for each candidate item, with n = its attempts among the last 50 and m = its misses,
  weight w = 1 + 3·(m + 1)/(n + 2) (a Laplace-smoothed miss rate, scaled). Prompts are drawn by
  weighted sampling with a seeded PRNG (a small, documented 32-bit generator in the domain layer).
  With adaptive weighting off, w = 1 for every valid item (US7-5).
  Complexity: O(k) per draw for k candidate items (k ≤ 8 strings × 12 pitch classes = 96), with no
  index structure needed (Constitution XII).
- **Check against US7-1**: with string 3 at 40% accuracy (≥ 20 attempts) and the others at ≥ 90%,
  w₃ ≈ 1 + 3·13/22 ≈ 2.77 and wₒ ≈ 1 + 3·3/22 ≈ 1.41, so string 3's share among 6 strings ≈
  2.77/(2.77 + 5·1.41) ≈ 0.28 versus 1/6 ≈ 0.17 under empty history: about 1.69×, above the 1.5×
  requirement. The test uses a fixed seed and 200 prompts, with the tolerance derived in the test
  (binomial bound), not tuned after the fact.
- **Alternatives**: SM-2 or FSRS (scheduling is feature 006, per the owner's answer); Elo-style
  ratings (more state, harder to explain to users); pure miss counts without smoothing (unstable
  for items with few attempts).

## R10. Testing strategy → ADR-0007

- **Decision**:
  - `packages/theory`: Vitest + fast-check, fixture tables in `fixtures/theory/*.json`
    (signed off by the owner and theory-checker, SC-001), property tests over all presets and
    ≥ 100 generated instruments (SC-011), coverage gate ≥ 90% lines and branches (SC-010).
  - `apps/web/src/domain`: the same tools; pure drill generators, judges, weighting, merge and HLC;
    the same 90% gate (the constitution applies it to packages holding core logic).
  - Components: Vitest + Testing Library + `jest-axe`.
  - End to end: Playwright (Chromium for Chrome/Edge/Android, WebKit for Safari; FR-046 doesn't
    target Firefox, so it isn't run), including offline mode (service worker,
    `context.setOffline(true)`), a 390 × 844 viewport, `@axe-core/playwright`, target-size checks
    (SC-006), the no-lock crawl (SC-012) and screenshot visual regression for the fretboard.
  - Latency (SC-002, SC-003): a Playwright benchmark that records tap → feedback-paint time with
    `performance.mark` and `requestAnimationFrame`, run on the reference laptop and, through remote
    debugging, the reference phone (O1, O2). `perf-auditor` owns and runs it.
- **Alternatives**: Jest (slower with ESM and TypeScript; Vitest shares Vite's config); Cypress (no
  WebKit, so no Safari coverage); Lighthouse alone for performance (not tap-to-feedback latency).

## R11. Architecture enforcement

- **Decision**: `dependency-cruiser` rules in CI:
  - `packages/theory` imports nothing outside itself (and no Node or DOM globals);
  - explicit allow-lists in `apps/web/src`:
    - `domain` → `@fretsense/theory`, `zod` (the only third-party library allowed in domain,
      ADR-0009);
    - `application` → `domain`, `@fretsense/theory`;
    - `infrastructure` → `application`, `domain`, `@fretsense/theory`, `idb`;
    - `ui` → `application`, `domain`, `@fretsense/theory` (pure geometry such as `fretX` and
      `positionsOf`, which ui may call directly), `react`, `react-router`;
    - only `main.tsx` (the composition root) imports from all layers;
  - `apps/web/content-plugin` and `apps/web/scripts` → `domain/content` only.

  An ESLint rule (`no-restricted-syntax`) forbids string literals that look like pitches
  (`/^[A-G](bb|b|#|##)?-?\d$/`) outside `packages/theory/src/presets.ts`, `fixtures/` and tests,
  backing ADR-0003's "no hidden tuning" rule; the property tests (SC-011) are the real guard.
- **Alternatives**: `eslint-plugin-boundaries` (works, but less expressive for package-level rules);
  code review only (doesn't scale, and isn't enforced).

## R12. CI and hosting

- **Decision**: GitHub Actions on every PR: install (frozen lockfile), lint, typecheck,
  dependency-cruiser, unit and property tests with coverage gates, `lessons:validate`, build,
  Playwright (Chromium + WebKit) against the built app. Supply chain (security review #7):
  - `pnpm audit --audit-level high` fails CI; Dependabot for `npm` and `github-actions`;
  - workflow-level `permissions: contents: read`; no `pull_request_target`; checkout with
    `persist-credentials: false`; Actions pinned by commit SHA and checked by a lint step
    (THREAT-MODEL T7);
  - pnpm pinned via `packageManager` + corepack; install scripts blocked except an explicit
    `onlyBuiltDependencies` allowlist;
  - a licence allowlist check (MIT, ISC, BSD-2/3, Apache-2.0, 0BSD; anything else fails until
    reviewed);
  - secret scanning: GitHub push protection plus gitleaks in CI (THREAT-MODEL T8). Hosting is a static host with an SPA fallback; the choice of host
  and preview deploys is left to a later ADR when deploying starts, because 001 doesn't need it to be
  complete. A strict CSP (`default-src 'self'`, no `connect-src` beyond `'self'`) is set in the
  built `index.html` meta and on the host (THREAT-MODEL T1). Full policy (privacy #5, security #6):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
  connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none';
  form-action 'none'`, plus as headers `frame-ancestors 'none'`, `Permissions-Policy: camera=(),
  microphone=(), geolocation=()`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
  Because a meta CSP can't set `frame-ancestors` and the host is undecided, the app also refuses to
  show destructive actions (reset, import) when `window.top !== window.self`. vite-plugin-pwa uses
  `injectRegister: 'script'` (no inline script); the Workbox runtime is bundled, with no runtime
  caching of other origins, and the service worker updates with prompt-to-reload plus a
  `navigateFallbackDenylist` for non-app paths. Playwright asserts zero CSP violations and zero
  requests to any non-self origin across the full route crawl. The future hosting ADR must set the
  headers and disable host analytics, speed insights and log drains.
- **Alternatives**: committing to Vercel now (ties the plan to a vendor before there's a need);
  self-hosted runners (no need).

## R13. Theory engine API shape

- **Decision**: a functional API over immutable value types (`Note`, `Interval`, `ScaleType`,
  `ChordQuality`, `Key`, `InstrumentProfile`, `FretPosition`); errors are returned as a
  discriminated `Result<T, TheoryError>`, not thrown, so typed errors are exhaustive (FR-010). See
  [contracts/theory-api.md](contracts/theory-api.md).
- **Alternatives**: classes with methods (mutable-state temptations, worse tree-shaking); throwing
  exceptions (untyped; callers forget to catch).

## R14. Scope boundaries with 016

- **Decision**: 001 implements the local-profile **model** with exactly one auto-created profile, My
  Gear **instruments**, the profile settings record, the pack **format** with one built-in pack, and
  the profile export format v1 with restore and copy import. 016 adds the profile switcher, other
  gear kinds, onboarding, paths and pack authoring as new record types and screens, with no change to
  001's records (Constitution XIII).
