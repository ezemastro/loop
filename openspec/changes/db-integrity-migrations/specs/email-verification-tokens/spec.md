# Email Verification Tokens Specification

## Purpose

Defines how email verification tokens are stored and how long they remain usable. Covers audit item
**SEC-10**. Password reset and change-password tokens are out of scope (SEC-06, SEC-11); so is
whether verification is required at all, which stays under the existing
`REQUIRE_EMAIL_VERIFICATION` flag.

## Requirements

### Requirement: Tokens Are Stored Irreversibly

The database MUST NOT store the verification token in a form from which the link can be
reconstructed. `users` MUST hold only the SHA-256 digest of the token. The cleartext column MUST be
dropped, not merely left unused. Hashing MUST be performed by the application, so that no database
extension is required.

#### Scenario: The cleartext column no longer exists

- GIVEN the migration has been applied
- WHEN the `users` table is inspected
- THEN no `email_verification_token` column exists, and
  `email_verification_token_hash` does

#### Scenario: Reading the database does not yield a usable link

- GIVEN a user with a pending verification token
- WHEN the `users` row is read with full database privileges
- THEN the value present cannot be used as the `token` query parameter of
  `GET /auth/verify-email`

#### Scenario: The hash lookup is unique

- GIVEN two users each with a stored token hash
- WHEN a third row attempts to store an identical hash
- THEN the database rejects it, because the partial index on the hash is unique

### Requirement: Tokens Expire After 24 Hours

Every issued token MUST carry an expiry timestamp set to 24 hours after issuance. Verification MUST
match on both the hash and an unexpired timestamp. An expired token MUST be rejected exactly as an
unknown token is, without disclosing that it once existed.

#### Scenario: A fresh token verifies

- GIVEN a token issued 10 minutes ago
- WHEN `GET /auth/verify-email` is called with it
- THEN the account is marked verified and the stored hash is cleared

#### Scenario: An expired token is refused

- GIVEN a token whose `email_verification_expires_at` is in the past
- WHEN `GET /auth/verify-email` is called with it
- THEN verification fails and the account remains unverified

#### Scenario: Resending rotates both the hash and the expiry

- GIVEN an unverified user with a pending token
- WHEN they request a new verification email
- THEN a new token is issued, the stored hash changes, the expiry is reset to 24 hours ahead, and
  the previous link no longer verifies

### Requirement: Outstanding Tokens Are Invalidated By The Migration

The migration MUST clear every pre-existing cleartext token rather than converting it. Users
holding an unusable link MUST be able to recover through the existing resend endpoint without
operator involvement.

#### Scenario: Pending links stop working

- GIVEN a user who received a verification link before the migration
- WHEN they click it after the migration
- THEN verification fails, and requesting a new email issues a working link

#### Scenario: Already-verified users are unaffected

- GIVEN a user whose `email_verified` is already `TRUE`
- WHEN the migration runs
- THEN their verified state is unchanged and they are never asked to verify again

### Requirement: The End-To-End Suite Exercises The Real Endpoint

Because the token can no longer be read back from the database, the end-to-end harness MUST
establish a known token by writing its hash through its owner-role connection, and MUST then call
the real `GET /auth/verify-email` endpoint with the corresponding cleartext. It MUST NOT mock,
bypass, or stub the verification endpoint, and MUST NOT require any production-reachable surface
that discloses a token.

#### Scenario: Verification flow is covered without a token oracle

- GIVEN the end-to-end suite runs with verification required
- WHEN a test user must be verified
- THEN the harness seeds a known token's hash directly in the database and calls the real endpoint,
  and no API response or environment flag ever returns a token

#### Scenario: No test-only surface ships

- GIVEN the application code after this change
- WHEN it is inspected for ways to obtain a verification token
- THEN none exists outside the outbound email and the harness's direct database write
