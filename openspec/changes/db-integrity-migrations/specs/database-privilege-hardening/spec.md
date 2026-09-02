# Database Privilege Hardening Specification

## Purpose

Defines the least-privilege grant matrix for the RLS-subject application role `loop_app` on the
five tables that deliberately have no row-level security, and the boot-time assertion that keeps
that matrix from drifting. Covers audit item **SEC-09**.

Out of scope: the privileges of `loop_app_unscoped` (the `BYPASSRLS` admin/pre-tenant role), the
existing RLS policies from migration `0007`, and whether any of these tables should gain RLS.

## Requirements

### Requirement: Scoped Role Holds No Privilege On Admin Tables

`loop_app` MUST hold no privilege of any kind on `admins` or `admin_valid_emails`. No code path
reachable on the scoped connection reads or writes either table; every access is on the unscoped
admin connection or the boot bootstrap.

#### Scenario: Admin credentials are unreachable from the scoped connection

- GIVEN a connection as `loop_app`
- WHEN it executes `SELECT * FROM admins`
- THEN the database rejects it with SQLSTATE `42501`

#### Scenario: The admin allowlist cannot be written from the scoped connection

- GIVEN a connection as `loop_app`
- WHEN it executes `INSERT INTO admin_valid_emails (email, role, community_id) VALUES (...)`
- THEN the database rejects it with SQLSTATE `42501`

#### Scenario: The admin panel keeps working

- GIVEN the unscoped connection used by the admin panel and the boot bootstrap
- WHEN it creates an admin, links a Google id, or upserts the authorized admin email
- THEN every operation succeeds unchanged

### Requirement: Community Catalog Is Read-Only For The Scoped Role

`loop_app` MUST retain `SELECT` on `communities` and `community_email_domains` and MUST hold no
`INSERT`, `UPDATE`, or `DELETE` on either. The login path resolves a community by email domain on
the scoped connection and depends on that read.

#### Scenario: Community lookup on the login path still works

- GIVEN a login request whose email domain must be resolved to a community
- WHEN the scoped connection joins `communities` to `community_email_domains`
- THEN the query succeeds and login proceeds

#### Scenario: The catalog cannot be mutated from the scoped connection

- GIVEN a connection as `loop_app`
- WHEN it attempts `INSERT INTO communities`, `UPDATE communities`, or
  `DELETE FROM community_email_domains`
- THEN each is rejected with SQLSTATE `42501`

### Requirement: Invitations Retain SELECT And UPDATE For The Scoped Role

`loop_app` MUST retain `SELECT` and `UPDATE` on `invitations`, and MUST hold no `INSERT` or
`DELETE`. `UPDATE` is required for two reasons: the single-use consume writes `used_by_user_id` and
`used_at` on the scoped connection, and `SELECT … FOR UPDATE` — the row lock that makes an
invitation single-use — requires the `UPDATE` privilege in addition to `SELECT`. A blanket revoke
of DML on this table MUST NOT be applied.

#### Scenario: Invite registration completes

- GIVEN a registration request carrying a valid invitation token
- WHEN the scoped transaction locks the invitation row with `SELECT … FOR UPDATE` and then marks it
  consumed
- THEN both statements succeed and the account is created

#### Scenario: Account deletion releases its invitation

- GIVEN a user who registered through an invitation
- WHEN they delete their own account on the scoped connection
- THEN the `UPDATE invitations SET used_by_user_id = NULL` succeeds

#### Scenario: Invitations cannot be created or destroyed from the scoped connection

- GIVEN a connection as `loop_app`
- WHEN it attempts `INSERT INTO invitations` or `DELETE FROM invitations`
- THEN each is rejected with SQLSTATE `42501`, because issuing and revoking invitations are
  admin-only operations on the unscoped connection

### Requirement: Future Tables Do Not Inherit Write Privileges

The default privileges that grant `loop_app` full DML on every future table MUST be narrowed to
`SELECT`. Any later migration that adds a table needing scoped writes MUST grant those privileges
explicitly.

#### Scenario: A newly created table is read-only by default

- GIVEN the default privileges after this change
- WHEN a subsequent migration creates a table without an explicit grant
- THEN `loop_app` can `SELECT` from it but cannot `INSERT`, `UPDATE`, or `DELETE`

#### Scenario: The unscoped role's defaults are unchanged

- GIVEN the same newly created table
- WHEN `loop_app_unscoped` writes to it
- THEN the write succeeds, because its default privileges were not narrowed

### Requirement: The Boot Assertion Verifies The Grant Matrix

`assertDbHardening()` MUST assert the grant matrix above for the scoped role, in both directions:
that each revoked privilege is absent, and that each retained privilege — in particular `UPDATE` on
`invitations` — is present. It MUST reuse the existing severity behavior, throwing in production
and warning otherwise. Its existing role, RLS, and fail-closed probe assertions MUST be preserved.

#### Scenario: An over-broad grant is caught at boot

- GIVEN `loop_app` has been granted `INSERT` on `communities`
- WHEN the API boots in production
- THEN `assertDbHardening()` reports the problem and the process exits non-zero

#### Scenario: An over-narrow revoke is caught at boot

- GIVEN `UPDATE` on `invitations` has been revoked from `loop_app`
- WHEN the API boots in production
- THEN `assertDbHardening()` reports the missing privilege and the process exits non-zero, rather
  than the defect surfacing later as a failed user registration

#### Scenario: A correct matrix boots silently

- GIVEN the grant matrix exactly as specified
- WHEN the API boots
- THEN `assertDbHardening()` reports no problem and the existing role, RLS, and fail-closed probe
  checks still run
