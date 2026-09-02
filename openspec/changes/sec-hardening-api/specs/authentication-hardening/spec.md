# Authentication Hardening Specification

## Purpose

Defines how the API signs and verifies tokens, how it answers a failed login, how it binds Google
identity assertions to this application's OAuth clients, and what a password must satisfy. This
capability depends on `runtime-configuration`: several requirements here are only enforceable because
the environment schema guarantees the relevant secrets exist.

Covers audit ids **SEC-02**, **SEC-03** (authentication portion), **SEC-04**, **SEC-06** (partial) and
**SEC-16** (passwordless-account portion).

## Requirements

### Requirement: Signing Key Separation

User tokens and administrator tokens MUST be signed with distinct secrets. Verification of a token of
one kind MUST use only that kind's secret. The separation MUST NOT depend on a claim inside the
payload.

Token verification MUST pin the accepted algorithm to an explicit allowlist.

#### Scenario: An administrator token cannot be forged from the user secret

- GIVEN an attacker who knows `JWT_SECRET`
- WHEN they craft a token carrying `isAdmin: true` and `adminRole: "super_admin"` and present it to an
  administrator route
- THEN verification fails, because administrator tokens are verified only against `ADMIN_JWT_SECRET`

#### Scenario: A user token is not accepted as an administrator token

- GIVEN a valid user token issued by the system
- WHEN it is presented to an administrator route
- THEN verification fails

#### Scenario: An administrator token is not accepted as a user token

- GIVEN a valid administrator token issued by the system
- WHEN it is presented to a user route
- THEN verification fails

#### Scenario: Algorithm is pinned

- GIVEN a token whose header declares `alg: "none"` or an algorithm other than the configured one
- WHEN it is verified
- THEN verification fails

#### Scenario: The two payload shapes are not interchangeable

- GIVEN the token payload type definitions
- WHEN a user payload is used where an administrator payload is expected
- THEN the code does not compile, rather than relying on an optional claim being present at runtime

### Requirement: Uniform Login Failure

Every failed login MUST be indistinguishable from every other failed login on the same endpoint. The
response status, body, and error code MUST be identical whether the account does not exist, exists
with no password, or exists with a different password.

A password comparison MUST be performed on every attempt, including attempts against an address that
does not exist, so that the work performed does not distinguish the cases.

Both the user login endpoint and the administrator login endpoint MUST satisfy this, and MUST agree
on the status code they use.

#### Scenario: An unknown address is indistinguishable from a wrong password

- GIVEN an address that is not registered
- WHEN a login is attempted with it
- THEN the response has the same status, body and error code as a login with a correct address and an
  incorrect password

#### Scenario: A passwordless account is indistinguishable from a wrong password

- GIVEN an account created through Google sign-in, which has no password
- WHEN a password login is attempted against it
- THEN the response is identical to a wrong-password response, and does not reveal that the account
  uses a different sign-in method

#### Scenario: Failure timing does not distinguish the cases

- GIVEN a series of login attempts, half against registered addresses and half against unregistered
  ones
- WHEN response times are compared
- THEN the two groups are not separable by timing, because a password comparison of equal cost runs
  in both cases

#### Scenario: A password login against a passwordless account does not error

- GIVEN an administrator account created through Google sign-in, which has a null password hash
- WHEN a password login is attempted against it
- THEN the response is the uniform authentication failure, and MUST NOT be a server error

#### Scenario: Both login endpoints agree on the status class

- GIVEN a failed user login and a failed administrator login
- WHEN their responses are compared
- THEN both use the same status code and both carry an error code

#### Scenario: Post-authentication conditions remain distinguishable

- GIVEN an account whose password is correct but whose email address is not yet verified
- WHEN a login is attempted
- THEN the response distinguishes this case, because it is only reachable after the password has
  already been proven and therefore reveals nothing to an attacker who does not know it

### Requirement: Google Audience Binding

Google identity assertions MUST be verified against an explicit, non-empty list of this
application's OAuth client identifiers. The list MUST NOT be permitted to become undefined or empty
at runtime.

The end-user authentication path and the administrator authentication path MUST use disjoint
audience lists.

#### Scenario: A token minted for a foreign OAuth client is rejected

- GIVEN a validly Google-signed identity token whose audience is an OAuth client not belonging to this
  application
- WHEN it is presented to the end-user Google sign-in endpoint
- THEN authentication fails

Rationale: the verification library skips the audience check entirely when the audience argument is
undefined or null. An unset client-id variable therefore silently disables this check, which is why
`runtime-configuration` makes those variables required in production.

#### Scenario: An end-user token cannot authenticate against the administrator panel

- GIVEN a validly Google-signed identity token whose audience is the end-user web, Android or iOS
  client
- WHEN it is presented to the administrator Google sign-in endpoint
- THEN authentication fails, because the administrator path accepts only the administrator client
  identifier

#### Scenario: Mobile clients authenticate

- GIVEN an identity token minted for the configured Android or iOS client
- WHEN it is presented to the end-user Google sign-in endpoint
- THEN the audience check passes

#### Scenario: An empty audience list fails closed at startup

- GIVEN a configuration in which no end-user client identifier is available
- WHEN the audience list is constructed
- THEN the condition is detected explicitly rather than producing an empty list that would reject
  every login with an unexplained failure

### Requirement: Password Policy

Passwords MUST be at least 8 characters when they are created or changed.

The minimum MUST NOT be raised on any login schema, because doing so would deny authentication to
existing accounts whose passwords predate the policy.

Client-side validation in the administrator panel MUST match the server-side minimum.

#### Scenario: A short password is rejected at registration

- GIVEN a registration request with a 7-character password
- WHEN it is submitted
- THEN it is rejected

#### Scenario: An existing short password still authenticates

- GIVEN an administrator account whose password is 6 characters, created before this change
- WHEN they log in with that password
- THEN authentication succeeds, because login schemas do not enforce the creation minimum

#### Scenario: The administrator panel does not offer a rejected form

- GIVEN an administrator using the password reset form
- WHEN they enter a 7-character password
- THEN the panel rejects it locally, rather than submitting a request the API will refuse

### Requirement: Password Change Integrity

A password MUST NOT be changeable through a general profile-update endpoint. A password change MUST
validate the new password against the password policy, and MUST reject an empty or whitespace-only
value.

A failed password validation MUST surface as an error and MUST NOT silently leave the stored password
unchanged.

#### Scenario: The profile update endpoint rejects a password field

- GIVEN an authenticated user
- WHEN they submit a profile update containing a password field
- THEN the request is rejected, rather than the field being silently accepted or silently ignored

#### Scenario: An empty new password is rejected

- GIVEN an authenticated user with a correct current password
- WHEN they submit a password change whose new password is an empty string
- THEN the request is rejected and the stored password is unchanged

#### Scenario: A whitespace-only new password is rejected

- GIVEN an authenticated user with a correct current password
- WHEN they submit a password change whose new password is only spaces
- THEN the request is rejected, including after body normalization trims it to an empty string

#### Scenario: The current password is still required

- GIVEN an authenticated user
- WHEN they submit a password change with an incorrect current password
- THEN the request is rejected

Note: invalidating outstanding sessions on password change is deliberately **not** required by this
capability. It needs a persisted password epoch, which requires a database migration owned by another
change. Until then a stolen token remains valid for its full lifetime after a password change; this is
recorded as a known limitation rather than silently implied to be fixed.
