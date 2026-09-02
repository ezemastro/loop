# API Surface Hardening Specification

## Purpose

Defines what the API does at its untrusted edge: the response headers it sets, the request rate it
accepts, how it validates bodies and query parameters on privileged endpoints, how it constructs SQL
from caller-influenced values, how it normalizes bodies, and what it is permitted to write to logs.

Covers audit ids **SEC-03** (transport and rate-limiting portion), **SEC-07**, **SEC-12**, **SEC-13**
and **SEC-16** (pagination and logging portions).

## Requirements

### Requirement: Security Headers

The system MUST set standard HTTP security response headers on every response. The header middleware
MUST be mounted before the body parser so that headers are present on parser error responses.

Cross-origin resource policy MUST be configured to permit the clients to read statically served
uploads, because the API origin differs from the client origins.

The CORS middleware MUST be mounted before the body parser, so a request body is not parsed before
its origin is evaluated.

#### Scenario: Headers are present on a normal response

- GIVEN any API endpoint
- WHEN it returns a successful response
- THEN standard security headers are present

#### Scenario: Headers are present on a malformed-body response

- GIVEN a request whose body is not valid JSON
- WHEN the body parser rejects it
- THEN the error response still carries the security headers

#### Scenario: Uploaded images still render in both clients

- GIVEN an uploaded image served by the API
- WHEN it is loaded by the Expo web client and by the administrator panel, each on a different origin
- THEN the image renders, and is not blocked by a same-origin resource policy

### Requirement: Request Body Limit

The system MUST declare the maximum accepted JSON request body size explicitly rather than relying on
an implicit framework default.

#### Scenario: The limit is explicit

- GIVEN the body parser configuration
- WHEN it is read
- THEN the maximum body size is stated as a value in the source, not inherited silently

#### Scenario: An oversized body is rejected

- GIVEN a JSON request body larger than the configured limit
- WHEN it is submitted
- THEN the request is rejected before the route handler runs

### Requirement: Rate Limiting

The system MUST limit the request rate on endpoints that are unauthenticated, that verify
credentials, or that consume a third-party quota. At minimum: user login, user registration,
verification-email resend, Google sign-in, administrator login, administrator registration, account
deletion request, and message creation.

Limits MUST be keyed on a combination of client address and a per-account discriminator, so that
neither a distributed attacker nor a single attacker targeting one victim can evade or weaponize the
limit.

Exceeding a limit MUST produce a distinct, machine-readable response.

The client address MUST be derived from a bounded proxy chain.

#### Scenario: Repeated failed logins are throttled

- GIVEN more login attempts against one address from one client than the configured maximum for the
  window
- WHEN the next attempt is made within the window
- THEN it is rejected with a rate-limit status and a machine-readable rate-limit error code

#### Scenario: Mail-sending endpoints carry the tightest limits

- GIVEN the registration and verification-resend endpoints, which each cause a third-party email send
- WHEN their configured limits are compared with the other limited endpoints
- THEN they permit fewer requests per window, because abuse there spends an external quota

#### Scenario: Client IP is derived from a bounded proxy chain

- GIVEN a request carrying a forwarded-for header with several entries
- WHEN the rate-limit key is computed
- THEN the address is taken from the configured number of trusted proxy hops, so a client cannot
  choose its own key by adding entries

#### Scenario: Limiting is disabled by an explicit flag, never by NODE_ENV

- GIVEN the end-to-end stack, which runs the API with `NODE_ENV` set to `development`
- WHEN the suite issues several hundred requests from a single container address
- THEN no request is rate-limited, because limiting is disabled by a dedicated flag set for that
  stack — and consequently the limiter is still active in ordinary development

#### Scenario: The disable flag cannot be used in production

- GIVEN `NODE_ENV=production` and the rate-limit flag set to disabled
- WHEN the process starts
- THEN startup fails, so protection cannot be switched off on a real deployment

#### Scenario: The limiter is covered by tests despite being disabled end-to-end

- GIVEN the limiter is disabled in the end-to-end stack
- WHEN the test suite runs
- THEN a dedicated test exercises the limiter directly and asserts both the throttled and the
  disabled behavior, so disabling it end-to-end costs no coverage

### Requirement: Admin Endpoint Validation

Every administrator endpoint that accepts a request body MUST validate it against a declared schema
before the body reaches a model. Path identifiers MUST be validated as identifiers.

At minimum this applies to: credit modification, user password reset, notification sending, school
creation and school update.

#### Scenario: A negative credit amount is rejected

- GIVEN an administrator submitting a credit modification with a negative amount and the direction
  flag set to positive
- WHEN the request is processed
- THEN it is rejected, and no balance is modified

Rationale: without a schema, a negative amount combined with the positive direction flag reaches the
increase path and subtracts, which is arbitrary balance manipulation.

#### Scenario: A non-integer or non-numeric credit amount is rejected

- GIVEN a credit modification whose amount is fractional, a string, or non-finite
- WHEN the request is processed
- THEN it is rejected

#### Scenario: A non-boolean direction flag is rejected

- GIVEN a credit modification whose direction flag is a string or a number
- WHEN the request is processed
- THEN it is rejected, rather than being interpreted by truthiness

#### Scenario: An unvalidated administrative password reset is no longer possible

- GIVEN an administrator resetting a user's password
- WHEN the new password is absent, empty, or shorter than the policy minimum
- THEN the request is rejected, rather than reaching the hashing function

#### Scenario: An out-of-enum notification type is rejected

- GIVEN a notification send request whose type is not one of the defined notification types
- WHEN it is processed
- THEN it is rejected with a validation error, rather than reaching the database and failing there

#### Scenario: A notification payload must match its type

- GIVEN a notification send request whose type is valid but whose payload does not match the shape
  defined for that type
- WHEN it is processed
- THEN it is rejected, so arbitrary caller-supplied structures are not persisted and later served to
  a user's client

#### Scenario: School mutations validate their inputs

- GIVEN a school creation or update request
- WHEN the name is empty or over-long, or the media identifier is not a valid identifier, or the path
  identifier is not a valid identifier
- THEN the request is rejected

### Requirement: Bounded Pagination

Pagination parameters MUST be coerced from their transport representation, MUST be integers, and MUST
be bounded above and below. A page-size parameter, if accepted, MUST be honored by the query rather
than declared and ignored.

Every list endpoint MUST use the shared pagination schema, with no endpoint parsing these parameters
independently.

#### Scenario: Page size is bounded

- GIVEN a request asking for a page size far above the configured maximum
- WHEN it is processed
- THEN the request is rejected or the size is clamped to the maximum, and the database is not asked
  for an unbounded result set

#### Scenario: A non-finite page number is rejected

- GIVEN a request whose page parameter resolves to a non-finite value
- WHEN it is processed
- THEN it is rejected, and the value never reaches offset arithmetic

#### Scenario: String query parameters are accepted

- GIVEN a page parameter arriving as a string, as all query parameters do
- WHEN it is validated
- THEN it is coerced to a number and accepted, rather than failing a numeric type check

#### Scenario: No endpoint bypasses the shared schema

- GIVEN the administrator user-listing endpoint, which parses its page parameter independently today
- WHEN it is reviewed after this change
- THEN it uses the shared pagination schema

### Requirement: SQL Construction

Values that influence SQL structure rather than SQL data — sort column and sort direction — MUST be
carried by a type that only permits values originating from a fixed mapping. A caller MUST NOT be able
to pass an arbitrary string to a query factory and have it compile.

Pattern-matching search terms MUST have their wildcard and escape characters escaped, and the
corresponding clause MUST declare its escape character.

#### Scenario: A raw sort string does not compile

- GIVEN a new call site passing a caller-supplied string as the sort column to a query factory
- WHEN the project is type-checked
- THEN compilation fails

Rationale: two allowlist layers already prevent injection at the three existing call sites. This
requirement moves the guarantee from convention into the type system so a fourth call site cannot
omit it.

#### Scenario: A wildcard search term matches literally

- GIVEN a search term consisting of a single percent character
- WHEN a search is performed
- THEN it matches records containing a literal percent character, rather than matching every record

#### Scenario: An underscore in a search term matches literally

- GIVEN a search term containing an underscore
- WHEN a search is performed
- THEN the underscore matches a literal underscore, not any single character

#### Scenario: A backslash in a search term is handled

- GIVEN a search term containing a backslash together with a wildcard character
- WHEN the term is escaped
- THEN the resulting pattern is well-formed, because the backslash is escaped in the same pass as the
  wildcards rather than afterward

### Requirement: Body Normalization

String trimming of request bodies MUST apply to nested structures, not only to top-level properties.
Normalization MUST NOT traverse inherited properties, MUST NOT corrupt non-plain objects, and MUST be
bounded in depth.

#### Scenario: A nested string is trimmed

- GIVEN a request body containing an object or array whose nested property is a padded string
- WHEN the body is normalized
- THEN the nested string is trimmed

#### Scenario: Non-plain values are preserved

- GIVEN a request body value that is a date or binary buffer
- WHEN the body is normalized
- THEN the value is passed through unchanged rather than being converted to a plain object

#### Scenario: Deep nesting is bounded

- GIVEN a request body nested far beyond any legitimate depth
- WHEN it is normalized
- THEN traversal stops at a bounded depth rather than recursing without limit

### Requirement: Push Notification Failure Isolation

Asynchronous push delivery MUST be awaited and MUST have its failures handled and logged. A delivery
failure MUST NOT terminate the process and MUST NOT fail the business operation that triggered the
notification.

Per-message delivery errors reported by the provider MUST be detected, not only transport-level
rejections.

#### Scenario: A rejected push does not crash the process

- GIVEN a push send that rejects
- WHEN a notification is triggered
- THEN the rejection is caught and logged, and the process continues running

#### Scenario: The triggering operation still succeeds

- GIVEN a business operation that sends a notification as a side effect
- WHEN push delivery fails
- THEN the business operation still completes successfully

#### Scenario: Per-device delivery errors are observed

- GIVEN a push send that resolves successfully but reports an error status for the target device
- WHEN the result is processed
- THEN the error is logged, rather than being treated as a successful delivery

#### Scenario: A caller's await is meaningful

- GIVEN a caller that awaits the notification helper
- WHEN the helper returns
- THEN delivery has actually been attempted, rather than the helper having returned before the send
  began

### Requirement: Log Hygiene

The system MUST NOT write personally identifying information or credential material to logs in
production. Specifically it MUST NOT log email recipient addresses, email verification links or
tokens, or device push tokens.

A development affordance that logs a verification link MUST be unavailable in production and MUST be
governed by an explicit flag rather than by the incidental absence of a mail provider key.

#### Scenario: A verification link is never logged in production

- GIVEN `NODE_ENV=production` and the mail provider key unset or rotated out
- WHEN a verification email cannot be sent
- THEN the failure is logged without the verification URL or token

Rationale: the current guard is the absence of the provider key alone, so a production deployment with
a rotated-out key silently writes account-takeover-grade tokens to standard output.

#### Scenario: Recipient addresses are not logged

- GIVEN any email send, successful or skipped
- WHEN the event is logged
- THEN the log line does not contain the recipient address

#### Scenario: Device tokens are not logged

- GIVEN a push send to an invalid device token
- WHEN the rejection is logged
- THEN the log line does not contain the token value

#### Scenario: Local development keeps its affordance

- GIVEN a developer running the stack locally without a mail provider key
- WHEN a verification email would be sent
- THEN the link is still available to them through the explicit development flag, so the local signup
  flow remains usable
