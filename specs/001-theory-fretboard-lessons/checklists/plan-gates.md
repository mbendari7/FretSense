# Plan Gate Results: 001

**Date**: 2026-11-21 | **Plan**: [plan.md](../plan.md)

Reviewer verdicts on the plan, and what changed in response. The owner decides whether the fixes are
acceptable; subagents can't approve their own fixes.

| Gate | Verdict | Findings | Status |
|------|---------|----------|--------|
| architecture-reviewer | CHANGES REQUESTED (4 MAJOR, 6 MINOR, 1 INFO) | per-field settings vs 013; natural-key identity; HLC receive/overflow/multi-tab; frozen payload hash and itemKey; device id in HLC; depcruise allow-lists; validator location; future package move; Firefox; version pins; plan-gates.md / ARCHITECTURE.md missing | All fixed in spec FR-066/066a, 013 US2-2/FR-004, data-model §3.1/§4, research R5/R10/R11, ADR-0007/0008, plan. **Deferred**: `docs/ARCHITECTURE.md` (docs-keeper, before 002) |
| security-reviewer | CHANGES REQUESTED (7 MEDIUM, 5 LOW) | HLC poisoning + tombstone direction + preview; strict nested shapes + hash spec; size-before-read, depth pre-scan, array caps, id formats; markdown mechanism; fuzz + hostile corpus; full CSP + headers + framing; CI supply chain; route keys + Map lookups; Hlc regex + bidi; YAML options; T14–T17 | All fixed in spec FR-066a, data-model §3.1/§4, research R5/R7/R12, contracts (profile-export, content-formats, ui-routes), quickstart V15/V16, ADR-0008/0009, THREAT-MODEL. **016 decision**: pack import format (JSON only recommended) |
| privacy-auditor | CHANGES REQUESTED (1 HIGH, 3 MEDIUM, 3 LOW) | device id embedded in HLCs; export disclosure; reset wording; threat-model assets/boundary; CSP directives + remote images; bundled Workbox + host analytics; plan-gates.md missing | All fixed: per-profile writer id (option a), FR-043 disclosure, FR-044 reset text, THREAT-MODEL assets/boundaries 6–7/T12, CSP, remote images are build errors, host-ADR requirements, this file |
| docs-keeper | pending (after tasks) | — | — |

Re-review: the fixes add requirements to spec FR-043, FR-044, FR-066 and FR-066a, and to 013, so the
**amended spec needs owner approval** before implementation.
