# product-owner r1 (team loop C): 016-personalization, 2026-11-25

**Verdict:** REVISE (spec-text edits only; APPROVE expected on re-review)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| F1 | BLOCKER | No release slice (Constitution VI) | **Applied**: Release line; story and FR tags |
| F2 | MAJOR | "Default path" used by 018 is undefined | **Applied**: FR-011a; US3 scenario 3 |
| F3 | MAJOR | "Play songs by bands I like" needs a song library (non-goal) | **Applied**: FR-010 uses the owner-approved goal list; style goal is genre-mapped |
| F4 | MAJOR | Unverified hardware presets in v0.1 | **Applied**: FR-007 tagged v0.2, ships only after facts are sourced |
| F5 | MINOR | 5-screen count unclear with 018 screens | **Applied**: counts question screens only |
| F6 | MINOR | 006 session length is v0.3 | **Applied**: stored now for 006 |

Decisions (proposals): v0.1 scope table (US1, US3 without gear, US4, US5, FR-016, instruments + gear record schema; FR-007/interfaces v0.2; cameras and US6/FR-017 v0.4). Ownership split with 018 (Applied as US3 "Ownership").

**NEEDS MAHMOUD**: the v0.1 goal list and mapping:

| Goal id | Title | Tags |
|---|---|---|
| know-the-neck | Learn the notes on the neck | goal:know-the-neck, topic:notes-on-the-neck, topic:octaves |
| chord-theory | Understand chord theory | goal:chord-theory, topic:chords, topic:intervals, topic:keys |
| solo-over-blues | Solo over blues | goal:soloing, topic:scales, genre:blues |
| soloing-general | Improvise and solo | goal:soloing, topic:scales, topic:modes |
| bass-lines | Bass grooves and lines | goal:bass-lines, topic:bass-patterns, topic:chords |
| songs-i-like | Play the styles I like | (the genres chosen in the genre question) |

**Owner sign-off:** 2026-11-25, goal list: "Approve all 6 (Recommended)" (AskUserQuestion). Spec: "approve anything else left and actually build and create the program" (chat).
