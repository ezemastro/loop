# Admin Session Lifecycle Specification

## Purpose

Defines how an admin session ends — deliberately or by expiry — and what the admin panel is permitted
to persist in browser storage. Covers ADM-06 and the `localStorage` PII portion of ADM-08.

## Requirements

### Requirement: Server-Side Session Termination

The API MUST expose `POST /admin/logout`, which clears the `admin_token` cookie. The clear MUST mirror
the options the cookie was set with (`config.ts:146-151`) on `httpOnly`, `secure`, `sameSite` and
`path`, because a browser silently refuses a removal whose attributes do not match — which is exactly
the failure this requirement exists to prevent. `maxAge` MUST be omitted from the clear.

The route MUST NOT require a valid admin token. Its purpose is to end a session that may already be
unusable; placing it behind `adminTokenMiddleware` would make an expired cookie 401, which the 401
handler below would answer by calling logout, producing a loop. The handler MUST read no session data,
MUST perform no database access, and MUST return a constant success response, so being unauthenticated
discloses nothing.

Logging out MUST be idempotent: calling it without a cookie, or twice, MUST succeed.

(Unit 4 — ADM-06 session)

#### Scenario: Logout revokes the cookie

- GIVEN an operator with a valid `admin_token` cookie
- WHEN they choose "Cerrar sesión"
- THEN `POST /admin/logout` is called, the `admin_token` cookie is removed from the browser, and a
  subsequent authenticated admin request responds 401

#### Scenario: Logout works without a session

- GIVEN a browser with no `admin_token` cookie
- WHEN `POST /admin/logout` is called
- THEN it responds 200 and does not respond 401

#### Scenario: Local session is cleared even if the server is unreachable

- GIVEN the API is unreachable
- WHEN the operator chooses "Cerrar sesión"
- THEN the local session state is still cleared and the panel still navigates to `/login`

### Requirement: Expired Session Detection

The admin API client MUST install a response interceptor that, on any `401`, clears local session state
and redirects to `/login`. Without it, an expired cookie leaves the panel believing it is logged in
(`isLoggedIn` is persisted) while every request fails silently.

The interceptor MUST NOT act on the authentication routes themselves — `POST /admin/login`,
`POST /admin/register`, `POST /admin/google-login` and `POST /admin/logout`. Acting on login would
replace a legible "wrong credentials" message with a redirect to the page the operator is already on,
which is worse than the current behaviour; acting on logout would let the interceptor re-enter itself.

The interceptor MUST re-reject the error so per-screen error handling continues to work.

(Unit 4 — ADM-06 session)

#### Scenario: Expired cookie sends the operator to login

- GIVEN an operator whose `admin_token` has expired
- WHEN the panel makes any authenticated admin request
- THEN local session state is cleared and the browser navigates to `/login`

#### Scenario: A failed login shows an error instead of redirecting

- GIVEN an operator on `/login` submitting an incorrect password
- WHEN the API responds 401
- THEN the login screen renders its credentials error and the interceptor performs no redirect

#### Scenario: A 401 from logout does not loop

- GIVEN the logout request itself responds 401 for any reason
- WHEN the interceptor observes it
- THEN no further logout call and no redirect are triggered by the interceptor

### Requirement: No Personal Data Persisted in Browser Storage

The session store MUST persist only `isLoggedIn`, `role` and `communityId` via a `partialize`
projection. The operator's `email`, `fullName` and `communityName` MUST NOT be written to
`localStorage` (`stores/session.ts:41-47` currently persists the entire store).

The persisted `version` MUST be incremented so previously-stored blobs containing personal data are
discarded on first load rather than lingering.

It is ACCEPTED that the sidebar shows its existing fallbacks for operator name and community until the
next successful login; correctness of storage takes priority over that cosmetic detail.

(Unit 4 — ADM-06 session)

#### Scenario: Stored session contains no personal data

- GIVEN an operator who has just logged in successfully
- WHEN `localStorage` key `session-storage` is inspected
- THEN it contains `isLoggedIn`, `role` and `communityId`, and contains no `email`, `fullName` or
  `communityName`

#### Scenario: A pre-existing stored session with personal data is discarded

- GIVEN a browser holding a session blob written by the previous version, containing an email
- WHEN the panel loads
- THEN the stored blob is not reused and the operator is treated as logged out

#### Scenario: Role-dependent navigation still renders correctly after reload

- GIVEN a `super_admin` who reloads the panel
- WHEN the sidebar renders before any API response
- THEN super-admin-only navigation is shown, because `role` is still persisted

### Requirement: No Diagnostic Logging of Personal Data

The admin panel MUST NOT log user records or configuration to the browser console. Specifically
`console.log(response)` in the users screen (`Users.tsx:27`), which prints names, emails and credit
balances on every page and search change, and `console.log(API_URL)` at module scope
(`api/loop.ts:10`) MUST be removed. Existing `console.error` calls in failure branches are out of scope
and MUST be left in place.

(Unit 4 — ADM-06 session)

#### Scenario: Loading the user list prints nothing

- GIVEN an operator browsing the users screen and paging through results
- WHEN the browser console is inspected
- THEN no user records have been logged

#### Scenario: No stray logs remain

- GIVEN the completed change
- WHEN `adminClient/src` is searched for `console.log`
- THEN there are no matches
