---
paths:
  - "specs/**"
  - ".specify/**"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "apps/**"
  - "packages/**"
  - "scripts/**"
---

# Commands

> Moved verbatim from CLAUDE.md on 2026-11-25 (ADR-0013). 

**Spec Kit** (skills in `.claude/skills/`, scripts in `.specify/scripts/powershell/`):

| Purpose | Command |
|---------|---------|
| New feature folder (+ `feature.json`) | `.specify/scripts/powershell/create-new-feature.ps1 -Json -ShortName <name> -Number <N> "<description>"`, then `git checkout -b <BRANCH_NAME>` (this Spec Kit version doesn't create the branch) |
| Plan setup | `.specify/scripts/powershell/setup-plan.ps1 -Json` |
| Prerequisite check | `.specify/scripts/powershell/check-prerequisites.ps1 -Json [-RequireTasks -IncludeTasks]` |
| Resolve a template | `.specify/scripts/powershell/resolve-template.ps1 <name> -Json` |
| Switch active feature | edit `.specify/feature.json` → `{"feature_directory": "specs/NNN-name"}` |

**Dev commands** (root `package.json`, since the v0.1 build; updated 2026-11-25 with owner approval):
`pnpm install`, `pnpm test`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm depcruise`,
`pnpm lessons:validate`, `pnpm dev` (= `pnpm --filter web dev`), `pnpm build`,
`pnpm --filter @fretsense/theory test`. There is no `e2e` script yet (planned: `pnpm --filter web e2e`).
Each feature's `quickstart.md` defines its own. **`pnpm lint` currently fails**: `eslint` is not a root devDependency (as of 2026-11-25).
Adding it is a dependency change that goes through security-reviewer and architecture-reviewer.

**RTK and tests (ADR-0013).** The RTK hook rewrites `git status/diff/log`, `pnpm vitest run`, `pnpm tsc` and
`pnpm lint`, but not script aliases like `pnpm test` or `pnpm --filter X test`. For compressed test output, run
`cd packages/<pkg> && pnpm vitest run` (or `cd apps/web && pnpm vitest run --configLoader runner`) through the
Bash tool. Use `rtk bypass <cmd>` when you need the full, unfiltered output.
