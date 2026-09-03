# Admin Bootstrap Recovery Specification

## Purpose

Guarantees that the absence of any `super_admin` is surfaced loudly rather than silently
tolerated, and defines the properties a production recovery procedure MUST have. Root cause:
`scripts/migrate.ts` forwards `AUTHORIZED_ADMIN_EMAIL ?? ""`; an empty value makes migration
`0006`'s promotion `WHERE` clause match no row, leaving zero `super_admin` rows.

## Requirements

### Requirement: Startup Super Admin Guard

On server startup, the system MUST check whether at least one `super_admin` row exists in
`admins`. By default, when none exist, it MUST emit a clearly labeled, observable warning and
MUST continue accepting traffic (warn, do not block).

#### Scenario: Zero super admins warns but does not block startup

- GIVEN the `admins` table has zero rows with `role = 'super_admin'`
- WHEN the server starts with the hard-fail flag disabled (default)
- THEN a warning identifying the zero-super-admin state is emitted in the standard log/observability
  output, AND the server proceeds to accept traffic

#### Scenario: At least one super admin emits no warning

- GIVEN the `admins` table has at least one row with `role = 'super_admin'`
- WHEN the server starts
- THEN no zero-super-admin warning is emitted

### Requirement: Opt-In Hard-Fail Mode

The system MUST support an explicit configuration flag that, when enabled, causes startup to
refuse to accept traffic if zero `super_admin` rows exist.

#### Scenario: Hard-fail flag blocks startup

- GIVEN the hard-fail flag is enabled and the `admins` table has zero `super_admin` rows
- WHEN the server starts
- THEN the process MUST exit or refuse to open its listening port, with an actionable error
  message identifying the missing super admin

#### Scenario: Hard-fail flag disabled falls back to warn-only

- GIVEN the hard-fail flag is disabled (default) and the `admins` table has zero `super_admin` rows
- WHEN the server starts
- THEN startup MUST NOT fail (see Startup Super Admin Guard)

### Requirement: Empty Authorized-Admin-Email Warning at Migration Time

The migration runner MUST warn, at the point a promotion-dependent migration executes, when
`AUTHORIZED_ADMIN_EMAIL` is unset or empty, because this condition silently promotes no admin.

#### Scenario: Empty env var triggers a migration-time warning

- GIVEN `AUTHORIZED_ADMIN_EMAIL` is unset or empty
- WHEN the migration runner executes a migration that promotes an admin to `super_admin` based on
  that value
- THEN a warning MUST be logged stating that no admin will be promoted

### Requirement: Recovery Procedure Properties

The documented recovery runbook MUST be idempotent, MUST respect the role/community invariant
(setting `community_id = NULL` when promoting to `super_admin`), and MUST require a read-only
verification query of the target row before any mutating statement runs.

#### Scenario: Re-running the recovery is a no-op once applied

- GIVEN an admin row has already been promoted to `super_admin`
- WHEN the recovery procedure's promotion statement is executed again
- THEN it MUST affect zero additional rows and MUST NOT error or duplicate side effects

#### Scenario: Promotion satisfies the role/community invariant

- GIVEN the recovery procedure targets a verified row
- WHEN the promotion statement runs
- THEN the resulting row MUST satisfy `role = 'super_admin'` AND `community_id IS NULL`

#### Scenario: Verification precedes mutation

- GIVEN an operator follows the runbook
- WHEN they reach the promotion step
- THEN the runbook MUST have already required them to run a read-only `SELECT` confirming the
  target row's identity before any `UPDATE` is issued

### Requirement: Stale Session Handling After Recovery

The recovery runbook MUST require re-authentication for the promoted admin after the role change,
because an already-issued session token still carries the pre-promotion role claims until reissued.

#### Scenario: Runbook instructs re-login after promotion

- GIVEN an admin's role is promoted via the recovery procedure
- WHEN the runbook is followed to completion
- THEN it MUST include an explicit instruction for that admin to log out and log back in before
  relying on the new role, and MUST NOT claim the promotion is effective for an already-active
  session without that step
