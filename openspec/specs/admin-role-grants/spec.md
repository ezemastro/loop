# Admin Role Grants Specification

## Purpose

Defines who may grant which admin role tier, and the invariant tying `super_admin` to no
community and `community_admin` to exactly one community. These are regression specs: the
described behavior already exists (`server/api/src/controllers/admin.ts`,
`server/migrations/0006_admins_invitations_deletion.sql`) and must not silently regress.

## Requirements

### Requirement: Only a Super Admin May Grant Super Admin

Only an admin whose own session role is `super_admin` MAY grant the `super_admin` role to another
email. A `community_admin` attempting to grant `super_admin` MUST be rejected.

#### Scenario: Community admin is rejected

- GIVEN an authenticated `community_admin` session
- WHEN they submit an authorize-email request with `role: "super_admin"`
- THEN the response MUST be rejected with an authorization error, and no `admin_valid_emails` row
  is created

#### Scenario: Super admin grant succeeds

- GIVEN an authenticated `super_admin` session
- WHEN they submit an authorize-email request with `role: "super_admin"`
- THEN a new `admin_valid_emails` row MUST be created with `role = 'super_admin'` and
  `community_id = NULL`

### Requirement: Community Admin Grants Are Scoped

A `community_admin` MAY grant the `community_admin` role, and every email they authorize MUST be
scoped to their own community regardless of any community identifier supplied in the request.

#### Scenario: Community admin grant is pinned to their community

- GIVEN an authenticated `community_admin` of community A
- WHEN they submit an authorize-email request with `role: "community_admin"` and any
  client-supplied community identifier (including one for a different community)
- THEN the created row MUST be scoped to community A, never to the supplied value

### Requirement: Super Admin Granting Community Admin Requires a Target Community

When a `super_admin` grants `community_admin` to an email, the request MUST specify a target
community, and the created row MUST be scoped to that community.

#### Scenario: Super admin grants a scoped community admin

- GIVEN an authenticated `super_admin` session
- WHEN they submit an authorize-email request with `role: "community_admin"` and
  `communityId: C`
- THEN a new row MUST be created with `role = 'community_admin'` and `community_id = C`

### Requirement: Role/Community Invariant Enforced at the Database

Every row in `admins` and `admin_valid_emails` MUST satisfy: `role = 'super_admin'` implies
`community_id IS NULL`, and `role = 'community_admin'` implies `community_id IS NOT NULL`. This
MUST be enforced by a database constraint independent of application logic.

#### Scenario: Violating write is rejected by the database

- GIVEN the `admins_role_scope_chk` (or equivalent) constraint is active
- WHEN a write attempts to insert or update a row with `role = 'super_admin'` and a non-null
  `community_id`, or `role = 'community_admin'` and a null `community_id`
- THEN the database MUST reject the write
