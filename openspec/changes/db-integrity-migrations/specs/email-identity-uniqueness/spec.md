# Email Identity Uniqueness Specification

## Purpose

Defines the guarantee that one email address corresponds to at most one `users` row, enforced by
the database rather than by an application pre-check, and the API contract for the conflict that
results. Covers audit item **SEC-05**. Password and login semantics are out of scope.

## Requirements

### Requirement: Case-Insensitive Uniqueness Is Enforced By The Database

The database MUST enforce that no two `users` rows share the same `lower(email)`. The enforcement
MUST be a unique index on the expression `lower(email)`, so that it is usable by the existing
`lower(email) = lower($1)` lookups. The application-level existence check MUST NOT be treated as
the enforcement mechanism.

#### Scenario: Two identical emails cannot coexist

- GIVEN a `users` row with `email = 'Ana@colegio.edu.ar'`
- WHEN a second row is inserted with `email = 'ana@COLEGIO.edu.ar'`
- THEN the database rejects the insert with SQLSTATE `23505` on `idx_users_email_lower_uq`

#### Scenario: Concurrent registrations produce exactly one account

- GIVEN two registration requests for the same email arriving simultaneously
- WHEN both pass the application's pre-insert existence check
- THEN exactly one `users` row exists afterwards, and the second request receives HTTP 409

### Requirement: Migration Refuses To Deduplicate Silently

The migration that adds the unique index MUST verify beforehand that no duplicate `lower(email)`
group exists. If any duplicate is found, the migration MUST abort with an error naming the
offending addresses, and MUST NOT delete, merge, or rewrite any `users` row. Resolution of
duplicates is an operator action performed before the migration is applied.

#### Scenario: Duplicates abort the migration

- GIVEN the database contains two `users` rows whose `lower(email)` is `bruno@colegio.edu.ar`
- WHEN the migration runs
- THEN it raises an exception listing `bruno@colegio.edu.ar`, the transaction rolls back, no row is
  modified, and the migration is not recorded in `schema_migrations`

#### Scenario: Clean database applies without touching data

- GIVEN no duplicate `lower(email)` group exists
- WHEN the migration runs
- THEN the unique index is created and zero `users` rows are modified

### Requirement: Unique Violations Map To HTTP 409

The API MUST translate a unique violation on the email index into a `ConflictError` carrying the
`USER_ALREADY_EXISTS` error code, which the error middleware already renders as HTTP 409. The
translation MUST discriminate by constraint name and MUST NOT treat every SQLSTATE `23505` from the
`users` table as an email conflict.

#### Scenario: Racing registration returns a conflict, not a 500

- GIVEN a registration whose insert violates the email unique index
- WHEN the error propagates to the error middleware
- THEN the response is HTTP 409 with `errorCode: "USER_ALREADY_EXISTS"`, not HTTP 500

#### Scenario: A Google-id collision is not reported as an email conflict

- GIVEN an insert that violates `users_google_id_key` rather than the email index
- WHEN the error is inspected
- THEN it is NOT mapped to `USER_ALREADY_EXISTS`

#### Scenario: Both registration paths are covered

- GIVEN the password registration path and the Google registration path
- WHEN either inserts a row whose email already exists
- THEN both return HTTP 409, not HTTP 500
