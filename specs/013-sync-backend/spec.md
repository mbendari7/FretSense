# Feature Specification: Optional Sync Backend (Progress Sync and Dataset Contributions)

**Feature Branch**: `013-sync-backend`

**Created**: 2026-11-21

**Status**: Draft (specify only; clarify/plan pending; scope this term is in Clarifications)

**Input**: User description: "Backend and databases (optional sync, the app stays offline-first): a FastAPI service with PostgreSQL for opt-in progress sync and dataset contributions, SQL migrations, indexes, auth (OAuth or JWT), rate limiting and an OpenAPI contract. IndexedDB on the client."

**Practice-session value**: the owner practises on a phone in the music room and a laptop at the
desk. Opt-in sync keeps progress, mastery and plans consistent across devices, without making any
feature depend on the network.

**Depends on**: 001 (progress export schema), 006 (attempt history as source of truth), 007
(contribution bundles and consent).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opt-In Account and Device Linking (Priority: P1)

The owner explicitly opts in, signs in with an external identity provider, and links devices.
Without opt-in, the app makes no backend calls.

**Why this priority**: Constitution VI and IX. Sync must be invisible unless chosen.

**Independent Test**: With sync off, run all app flows and assert 0 requests to the backend origin.
Then opt in, sign in, link a second device, and sign out.

**Acceptance Scenarios**:

1. **Given** sync is off, **Then** there are no network requests to the backend.
2. **Given** the owner opts in, **When** they sign in, **Then** a session is established with
   short-lived tokens, and the device is listed under the account.
3. **Given** the owner deletes the account, **Then** all server-side data is deleted within 24 h,
   and local data remains.

---

### User Story 2 - Progress Sync (Priority: P1)

Attempts (the source of truth), lesson completion, custom profiles and settings sync both ways,
merging by attempt id. The app works offline and syncs when reconnected.

**Why this priority**: The main reason the backend exists.

**Independent Test**: Two clients make offline changes, reconnect in either order, and converge to
the identical state.

**Acceptance Scenarios**:

1. **Given** concurrent offline attempts on two devices, **When** both sync, **Then** both devices
   hold the union of attempts, with no duplicates and identical derived mastery.
2. **Given** a conflicting settings change, **Then** last-writer-wins applies per field, by server
   receive time, and the overwritten value is visible in the sync log.

---

### User Story 3 - Dataset Contributions (Priority: P3)

With explicit, revocable consent, the owner uploads 007 contribution bundles (recordings and labels)
to private storage for training on another machine.

**Why this priority**: Convenience for the owner's own training workflow. Optional.

**Independent Test**: Upload a fixture bundle, revoke consent, and verify deletion and its
propagation to dataset builds.

**Acceptance Scenarios**:

1. **Given** consent is revoked, **Then** the bundle is deleted server-side, and the next dataset
   build excludes it (007 FR-003).

---

### Edge Cases

- Backend unreachable: the app keeps working; sync retries with backoff; a status indicator shows
  "offline".
- Token expiry mid-sync: refresh, or re-auth prompt; no data loss.
- Schema version mismatch: the server rejects with an upgrade hint; the client never corrupts data.
- Abuse or brute force: rate limits per user and IP.
- Large histories (≥ 100k attempts): incremental, cursor-based sync.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The client MUST NOT contact the backend unless sync is explicitly enabled.
- **FR-002**: Authentication MUST use an external identity provider (OAuth 2.0 / OIDC with PKCE),
  with short-lived access tokens and rotating refresh tokens. Every endpoint MUST authorise
  per user (no cross-user access).
- **FR-003**: The API MUST be defined by a versioned OpenAPI contract. Client and server MUST pass
  contract tests against it.
- **FR-004**: Sync MUST be incremental (cursor-based) and idempotent. It merges attempts by id,
  lesson completion as a union, and settings per field with last-writer-wins and a sync log.
- **FR-005**: The database schema MUST be managed by versioned, reversible migrations, with indexes
  justified by the documented query patterns.
- **FR-006**: Rate limiting MUST apply per user and per IP, with documented limits and standard
  429 responses.
- **FR-007**: All inputs MUST be schema-validated with size limits. Uploads are limited in size and
  type.
- **FR-008**: Account deletion MUST remove all server-side user data within 24 h, and export of
  all server-side data MUST be available.
- **FR-009**: Dataset contributions MUST require per-bundle consent, be revocable, and be stored
  privately.
- **FR-010**: The service MUST run locally via containers, with the database, and deploy via CI.
  Secrets come from the environment or a secret store, never the repo.
- **FR-011**: Structured logs MUST exclude personal data and media. Error tracking is scrubbed.
- **FR-012**: The threat model MUST be updated (T5, T6), and `security-reviewer` and
  `privacy-auditor` gates MUST pass.

### Key Entities

- **User**, **Device**, **Attempt (synced)**, **Settings document**, **Sync cursor**, **Sync log
  entry**, **Contribution bundle**, **Consent record**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 backend requests with sync disabled (automated E2E network assertion).
- **SC-002**: In randomised two-device offline/online fixture schedules (≥ 1,000 runs), 100%
  converge to identical states.
- **SC-003**: Incremental sync of 1,000 new attempts completes in < 2 s p95 on a typical connection.
- **SC-004**: 100% of contract tests pass for client and server. 0 high/critical dependency
  vulnerabilities at release.
- **SC-005**: Account deletion fixtures confirm 0 rows remain for the user after the deletion job.

## Assumptions

- Single owner initially. Multi-user is supported by design but not a goal.
- Hosting choice and cost limits are decided at plan time via ADR.
