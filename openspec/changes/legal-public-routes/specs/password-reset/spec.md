# Password Reset Specification

## Purpose

Defines a self-service password reset by email. Today the only reset is
`POST /admin/users/:userId/reset-password` (`server/api/src/routes/admin.ts:32-36`), which requires
an admin and carries the new password in cleartext in the request body. A user who forgets their
password has no path at all.

## Requirements

### Requirement: Public Request Endpoint

`POST /auth/forgot-password` MUST accept `{ email }`, MUST be public (mounted on the existing
`authRouter`, `server/api/src/index.ts:75`), and MUST always answer HTTP 200 with an identical
body regardless of whether an account exists, whether it is verified, or whether the mail was
sent. This mirrors `POST /auth/resend-verification`
(`server/api/src/controllers/auth.ts:147-162`) and prevents the endpoint becoming an
email-enumeration oracle.

Mail delivery MUST NOT fail the HTTP request, consistent with the existing fire-and-forget send
(`server/api/src/models/auth.ts:250-253`).

(Phase 5 — password reset)

#### Scenario: Existing account receives a link

- GIVEN an account `ana@colegio.edu`
- WHEN `POST /auth/forgot-password { "email": "ana@colegio.edu" }` is called
- THEN the response is 200, and a reset email containing a single-use link is sent to that address

#### Scenario: Unknown address is indistinguishable

- GIVEN no account for `nadie@colegio.edu`
- WHEN `POST /auth/forgot-password` is called with that address
- THEN the response is 200 with a body byte-identical to the existing-account case, and no mail is
  sent

#### Scenario: Mail provider failure does not surface

- GIVEN `RESEND_API_KEY` is unset or the provider errors
- WHEN `POST /auth/forgot-password` is called for an existing account
- THEN the response is still 200 and the request does not error

### Requirement: Token Is Hashed At Rest

The value emailed to the user MUST be `crypto.randomBytes(32).toString("hex")`, matching the
existing verification-token generation (`server/api/src/models/auth.ts:173`). The database MUST
store only its `sha256` hex digest in `users.password_reset_token_hash`. The emailed value MUST
NOT be recoverable from the database.

#### Scenario: Emailed value never appears in the database

- GIVEN a reset was requested and the emailed token is `T`
- WHEN `users.password_reset_token_hash` is read for that user
- THEN it equals `sha256(T)` and does not equal `T`

#### Scenario: Lookup is by digest

- GIVEN a reset request arrives carrying token `T`
- WHEN the server looks the user up
- THEN it matches on `sha256(T)`, never on `T`

### Requirement: Token Expires

`users.password_reset_expires_at` MUST be set when the token is issued and MUST be checked in the
same statement that consumes the token. An expired token MUST be rejected. The default TTL MUST be
one hour.

This closes the gap in the email-verification flow, whose token has no expiry at all
(`server/migrations/0008_email_verification.sql:8-10`).

#### Scenario: Token works inside the window

- GIVEN a token issued 10 minutes ago with a 1-hour TTL
- WHEN it is submitted with a valid new password
- THEN the password is changed and the response is 200

#### Scenario: Token is rejected after expiry

- GIVEN a token issued 2 hours ago with a 1-hour TTL
- WHEN it is submitted
- THEN the response is an error, the password is unchanged, and no information about the account
  is disclosed

### Requirement: Token Is Single-Use And Consumed Atomically

Consuming the token MUST clear both `password_reset_token_hash` and `password_reset_expires_at` in
the same `UPDATE ... WHERE ... RETURNING` statement that matches it, so two concurrent submissions
cannot both succeed. Requesting a new reset MUST invalidate any previous outstanding token for
that user.

#### Scenario: Second use fails

- GIVEN a token that was successfully used once
- WHEN it is submitted again
- THEN the response is an error and the password is unchanged

#### Scenario: Concurrent submissions

- GIVEN two simultaneous requests carrying the same valid token
- WHEN both are processed
- THEN exactly one succeeds and the other is rejected

#### Scenario: New request invalidates the old token

- GIVEN an outstanding token `T1`
- WHEN a second reset is requested and token `T2` is issued
- THEN `T1` is rejected and `T2` is accepted

### Requirement: New Password Is Validated And Hashed

`POST /auth/reset-password` MUST accept `{ token, newPassword }` and MUST validate `newPassword`
against the existing `passwordSchema` (`server/api/src/services/validations.ts:12`, min 6,
max 100) before use. The stored value MUST be produced by the existing `hashPassword`
(`server/api/src/services/hash.ts`). An empty or absent `newPassword` MUST be rejected before it
reaches the hashing function.

#### Scenario: Too-short password is rejected

- GIVEN a valid token
- WHEN `POST /auth/reset-password` is called with a 3-character password
- THEN the response is a validation error, the token is not consumed, and the password is unchanged

#### Scenario: Absent password is rejected

- GIVEN a valid token
- WHEN the body omits `newPassword`
- THEN the response is a validation error and nothing reaches `hashPassword`

#### Scenario: Password is stored hashed

- GIVEN a successful reset with password `P`
- WHEN `users.password` is read
- THEN it is a bcrypt hash and `comparePasswords(P, hash)` is true

### Requirement: Successful Reset Verifies The Email

A successful reset MUST set `users.email_verified = TRUE`. Control of the mailbox was just proven,
and login is blocked for unverified accounts (`server/api/src/models/auth.ts:284-285`), so leaving
the flag false would strand the user immediately after a successful reset.

#### Scenario: Unverified user can log in after resetting

- GIVEN an account with `email_verified = FALSE`
- WHEN the user completes a password reset
- THEN `email_verified` is TRUE and they can log in with the new password

### Requirement: Rate Limiting Is Required Before Release

`POST /auth/forgot-password` and `POST /auth/reset-password` MUST be rate limited before this
change reaches production. Rate limiting is implemented by the `sec-hardening-api` change, not
here; this specification records the requirement and the reason.

Without a limit, `forgot-password` is an email-bombing and provider-cost amplification vector — the
send is fire-and-forget so nothing back-pressures it — and `reset-password` performs a bcrypt hash
per call, making it a CPU-exhaustion vector.

#### Scenario: Release gate

- GIVEN this change is being prepared for a production release
- WHEN the release checklist is evaluated
- THEN both endpoints are covered by a rate limiter, or the release is blocked
