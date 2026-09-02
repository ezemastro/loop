# Admin Authorization Specification

## Purpose

Defines how an authenticated admin authorizes a new admin email: which role may be granted, which
community the grant is bound to, and how authorization failures are surfaced. Covers ADM-02. This
specification does not introduce, relax, or re-describe the community-scoping invariant — it
constrains the change so that invariant is preserved.

## Requirements

### Requirement: Role Selection Restricted to Super Admins

The authorize-admin screen MUST allow a `super_admin` to choose the role being granted, offering
exactly `community_admin` and `super_admin`. A `community_admin` MUST NOT be offered a role choice and
the request MUST default to `community_admin`. The client MUST send the chosen role in the request
body so that a super admin can actually grant `super_admin`; today no role is sent and the server
silently collapses every grant to `community_admin` (`controllers/admin.ts:140`).

The existing server-side guard rejecting a `super_admin` grant from a non-super admin
(`controllers/admin.ts:141-147`) MUST remain unchanged and MUST remain the authoritative check. The
client-side gating is a usability affordance, never the enforcement point.

(Unit 1 — ADM-02 authorize)

#### Scenario: Super admin grants a community admin

- GIVEN an operator logged in as `super_admin`
- WHEN they open the authorize-admin screen
- THEN a role selector is shown offering `community_admin` and `super_admin`, defaulting to
  `community_admin`

#### Scenario: Community admin sees no role choice

- GIVEN an operator logged in as `community_admin`
- WHEN they open the authorize-admin screen
- THEN no role selector is rendered and submitting authorizes a `community_admin` in their own
  community

#### Scenario: Server still rejects an unauthorized super admin grant

- GIVEN an operator logged in as `community_admin`
- WHEN a request granting role `super_admin` reaches the API by any means
- THEN the API responds 403 with `errorCode` `SUPER_ADMIN_REQUIRED` and no email is authorized

### Requirement: Community Binding Follows the Role

When the role being granted is `community_admin`, a super admin MUST select a concrete community, and
the screen MUST use the existing `CommunityFilter` with `allowAll={false}` so that "all communities" is
not an expressible choice. When the role being granted is `super_admin`, no community selector MUST be
rendered and no `communityId` MUST be sent, because a super admin has no community by database
invariant.

The client MUST block submission when a `community_admin` grant has no community selected, so the
round trip that produces `COMMUNITY_REQUIRED` does not occur in normal use.

A `community_admin` MUST NOT be shown a community selector; their grant is bound to their own community.

(Unit 1 — ADM-02 authorize)

#### Scenario: Super admin must pick a community for a community admin grant

- GIVEN an operator logged in as `super_admin` with role `community_admin` selected
- WHEN no community has been chosen
- THEN the submit control is disabled and no request is sent

#### Scenario: Super admin grant sends no community

- GIVEN an operator logged in as `super_admin` with role `super_admin` selected
- WHEN they submit a valid email
- THEN no community selector was rendered, no `communityId` is sent, and the authorization succeeds

#### Scenario: Super admin authorizes a community admin end to end

- GIVEN an operator logged in as `super_admin`, role `community_admin`, and a chosen community
- WHEN they submit a valid email
- THEN the request succeeds and the previously-reported `COMMUNITY_REQUIRED` failure does not occur

### Requirement: Community Scoping Invariant Preserved

The effective community for a write MUST continue to be derived from the admin token and never from the
request body for any role that is scoped to a community. Sending `communityId` from the client MUST NOT
change this: for a `community_admin` the server MUST continue to ignore the submitted value and use the
token's community (`middlewares/parseAdminToken.ts:71-76`), and only a `super_admin` — already unscoped —
MUST have a submitted community honored, after UUID validation.

This change MUST NOT modify `adminScopeCommunityId`, MUST NOT modify `requireSuperAdmin`, and MUST NOT
add or remove either guard on any route.

(Unit 1 — ADM-02 authorize)

#### Scenario: A community admin cannot authorize into another community

- GIVEN an operator logged in as `community_admin` belonging to community A
- WHEN a request carrying `communityId` of community B reaches the authorize endpoint
- THEN the authorization is recorded against community A, taken from the token, and community B is
  ignored

#### Scenario: Scoping helpers are untouched

- GIVEN the completed change
- WHEN `middlewares/parseAdminToken.ts` is diffed against the base branch
- THEN `adminScopeCommunityId` and `requireSuperAdmin` show no modifications

### Requirement: Authorization Errors Are Human-Readable

The authorize-admin screen MUST surface API failures through the existing `getErrorMessage` helper
(`services/errors.ts:27-35`) rather than rendering `err.response?.data?.error` directly
(`AuthorizeAdmin.tsx:38`). Known `errorCode` values MUST resolve to their Spanish operator-facing text
from the existing table (`services/errors.ts:7-15`), which already covers `COMMUNITY_REQUIRED` and
`SUPER_ADMIN_REQUIRED`.

(Unit 1 — ADM-02 authorize)

#### Scenario: A known error code renders its Spanish message

- GIVEN the API responds with `errorCode` `COMMUNITY_REQUIRED`
- WHEN the authorize-admin screen renders the failure
- THEN it shows "Hay que elegir una comunidad para esta acción." and not the raw developer-facing text

#### Scenario: An unknown failure falls back cleanly

- GIVEN the API responds with no recognized `errorCode` and no `error` text
- WHEN the authorize-admin screen renders the failure
- THEN it shows the screen's Spanish fallback message and does not render `undefined` or an empty box
