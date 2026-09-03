# Admin Community Scoping Specification

## Purpose

Defines how community scope is selected, displayed, and enforced across every community-scoped
admin screen and endpoint, for both `super_admin` and `community_admin` roles. This is the
multi-tenancy trust boundary: admin endpoints run on an unscoped DB connection, so isolation is
enforced entirely in application code (`server/api/src/middlewares/parseAdminToken.ts`), not RLS.

## Requirements

### Requirement: Super Admin Community Selector

A `super_admin` MUST be offered a community selector, including an "all communities" option, on
every community-scoped screen: Users, Notifications, Dashboard, Schools, Invitations, and
DeletionRequests.

#### Scenario: Selector present on every scoped screen

- GIVEN a `super_admin` is authenticated
- WHEN they open Users, Notifications, Dashboard, Schools, Invitations, or DeletionRequests
- THEN a community selector is rendered offering each community and an "all communities" option

#### Scenario: Selecting a single community scopes the data

- GIVEN a `super_admin` has the selector open on any of those screens
- WHEN they select a specific community
- THEN only that community's data is displayed

#### Scenario: "All communities" shows the unscoped aggregate

- GIVEN a `super_admin` selects "all communities"
- WHEN the screen loads data
- THEN data spans every community (unscoped), not a single one

### Requirement: Community Admin Fixed Scope

A `community_admin` MUST see only their own community's data on every scoped screen and MUST NOT
be offered a community selector.

#### Scenario: No selector shown to a community admin

- GIVEN a `community_admin` is authenticated
- WHEN they open Users, Notifications, Dashboard, Schools, Invitations, or DeletionRequests
- THEN no community selector control is rendered

#### Scenario: Data is limited to the admin's own community

- GIVEN a `community_admin` of community A opens any scoped screen
- WHEN the screen loads data
- THEN only data belonging to community A is shown

### Requirement: Server-Derived Scope for Community Admins

For a `community_admin`, the server MUST derive effective community scope exclusively from the
authenticated admin token and MUST ignore any client-supplied community identifier, regardless of
whether it arrives via query string, request body, or header.

#### Scenario: Forged query parameter is ignored

- GIVEN a `community_admin` token bound to community A
- WHEN a request includes `communityId=B` as a query parameter
- THEN the response is scoped to community A only, and B is never used to select data

#### Scenario: Forged body or header field is ignored

- GIVEN a `community_admin` token bound to community A
- WHEN a request includes a community identifier for community B in the request body or a custom
  header
- THEN the response is scoped to community A only

#### Scenario: Token without a community for a community_admin is rejected

- GIVEN a token claims `adminRole: "community_admin"` but carries no community identifier
- WHEN that token is presented to any admin-protected route
- THEN the request MUST be rejected as unauthorized (treated as an invalid/expired session), never
  granted unscoped access

### Requirement: Super Admin View Parity

For a given selected community, the data a `super_admin` sees MUST be equivalent to what a
`community_admin` of that same community sees on the corresponding screen.

#### Scenario: Same community, same result set

- GIVEN community X has a fixed set of underlying records
- WHEN a `super_admin` selects community X on a scoped screen, and separately a `community_admin`
  of community X opens the same screen
- THEN both requests return the same scoped data set

### Requirement: No Client-Supplied Scope Widening

The system MUST NOT allow any client-supplied parameter, in any request channel, to widen a
`community_admin`'s effective scope beyond the community bound to their token.

#### Scenario: Wildcard or "all communities" value is rejected for a community admin

- GIVEN a `community_admin` token bound to community A
- WHEN a request attempts to request "all communities" or omits scope entirely, expecting an
  unscoped result
- THEN the response remains scoped to community A only
