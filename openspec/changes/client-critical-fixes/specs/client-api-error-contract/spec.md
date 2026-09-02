# Client API Error Contract Specification

## Purpose

Defines how a failed HTTP request becomes a React Query error, what shape that error has, when a
failure logs the user out, and how failures are retried. Covers audit findings CLI-03, CLI-04, and
the query-key and transport parts of CLI-07.

Out of scope: polling intervals and `refetchInterval` tuning (CLI-08, deferred), and server-side
error envelopes.

## Requirements

### Requirement: Every Query Failure Surfaces As An Error

Every query hook MUST throw on failure, unconditionally, regardless of the thrown value's type. A
query hook MUST NOT resolve with `undefined` when its request failed. The thrown value MUST be
produced by the shared `parseApiError` normalizer, so that a failure carries the server's message,
its `errorCode` and its `data` payload rather than only a status-derived name.

This applies both to hooks that currently rethrow only for `AxiosError` and to hooks that currently
have no error handling at all.

#### Scenario: A non-Axios failure becomes an error, not a success

- GIVEN a query hook whose request handler throws a value that is not an `AxiosError`
- WHEN the query settles
- THEN the query reports `isError`, and it does not report success with `data` undefined

#### Scenario: Server error detail is preserved

- GIVEN a request that fails with a server envelope carrying a message and an `errorCode`
- WHEN the query error is inspected
- THEN it carries that message and that `errorCode`, not only a generic status-derived name

#### Scenario: Every query hook uses the same normalizer

- GIVEN the client's hooks directory
- WHEN it is inspected
- THEN no hook branches on `instanceof AxiosError`, and every request failure path routes through
  the shared normalizer

### Requirement: Screens Do Not Assert On Page Data

Consumers of paginated queries MUST NOT use non-null assertions to reach into a page's payload.
Because a failed query now throws, page objects are non-nullable and the assertions MUST be removed
rather than left in place.

#### Scenario: A failed listing search shows an error state instead of crashing

- GIVEN the listings request fails
- WHEN the search screen renders
- THEN it renders its error state, and no exception is thrown while reading page data

#### Scenario: A failed conversation list shows an error state instead of crashing

- GIVEN the chats request fails
- WHEN the messages screen renders
- THEN its `isError` branch renders, and no exception is thrown while reading page data

### Requirement: Logout Only On An Authenticated Session Failure

The client MUST log the user out on a 401 only when both conditions hold: the failed request
carried an `Authorization` header, and its path is not under `/auth/`. A 401 on any other request
MUST leave the session untouched.

#### Scenario: A wrong password does not destroy an existing session

- GIVEN a signed-in user
- WHEN a login attempt is submitted with an incorrect password and the server answers 401
- THEN an error is shown and the user remains signed in

#### Scenario: A 401 from an anonymous request is ignored

- GIVEN a request that carried no `Authorization` header
- WHEN it fails with 401
- THEN the session is not cleared

#### Scenario: A genuinely expired session still logs out

- GIVEN a signed-in user whose token has expired
- WHEN an authenticated request to a non-`/auth/` path fails with 401
- THEN the session is cleared, the query cache is emptied and the community theme is reset

#### Scenario: A re-authentication failure by a signed-in user does not log them out

- GIVEN a signed-in user whose request to `/auth/login` carries an `Authorization` header
- WHEN that request fails with 401
- THEN the session is not cleared

### Requirement: Retry Policy Is Explicit

The client MUST define its own default query retry policy rather than relying on the library
default. An unauthorized failure MUST NOT be retried, so that session expiry is detected without
delay. Other failures MAY be retried a bounded number of times.

#### Scenario: An unauthorized failure is not retried

- GIVEN an authenticated request that fails with 401
- WHEN the query settles
- THEN no retry is attempted and the logout happens on the first failure

#### Scenario: A transient failure is retried a bounded number of times

- GIVEN a request that fails with a network error
- WHEN the query settles
- THEN it is retried at most twice before reporting `isError`

### Requirement: Cache Invalidation Keys Match Their Queries

An invalidation key MUST be structurally identical to the key of the query it intends to
invalidate. Screens MUST NOT rely on remounting to mask a key that matches nothing.

#### Scenario: Editing a listing invalidates its detail query

- GIVEN a listing detail query registered under its scalar identifier
- WHEN that listing is edited and saved
- THEN the invalidation matches that exact query and the detail screen shows the edited values
  without depending on navigation to remount it

### Requirement: The API Client Sends No Ambient Credentials

The HTTP client MUST NOT send cookies or other ambient credentials. Authentication MUST travel only
in the `Authorization` header set per request.

#### Scenario: No credentialed cross-origin requests

- GIVEN any request issued by the API client
- WHEN it is inspected
- THEN it does not request ambient credentials, and authentication is carried solely by the
  `Authorization` header when a session exists
