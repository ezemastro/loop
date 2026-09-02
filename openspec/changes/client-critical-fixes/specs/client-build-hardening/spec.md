# Client Build Hardening Specification

## Purpose

Defines what a production client build is allowed to contain, request, or expose: Android
permissions and transport policy, the debug route, service-worker caching, required configuration,
and a test command that terminates. Covers audit findings CLI-02, CLI-09 (debug route and service
worker), CLI-12, and the configuration part of CLI-07.

Out of scope: dependency version alignment and the Expo 57 track (CLI-10, owned by
`delivery-and-ci`). The single dependency addition permitted here is the encrypted storage module
required by `client-credential-storage`.

## Requirements

### Requirement: No Unused Android Permissions

The client MUST NOT declare an Android permission it does not use.

#### Scenario: Microphone permission is not requested

- GIVEN a production Android build
- WHEN its declared permissions are inspected
- THEN `RECORD_AUDIO` is absent

### Requirement: Cleartext Traffic Is Development-Only

The client MUST NOT permit cleartext HTTP traffic in a production Android build. It MUST continue to
permit it in a development build, because the development API is served over plain HTTP on the LAN.
The distinction MUST be expressed in configuration, not by editing a file between builds.

#### Scenario: A production build forbids cleartext

- GIVEN a build produced with the production profile
- WHEN its Android transport policy is inspected
- THEN cleartext traffic is not permitted

#### Scenario: A development build still reaches the LAN API

- GIVEN a build produced with the development profile
- WHEN it issues a request to the plain-HTTP development API
- THEN the request succeeds

#### Scenario: The distinction is declarative

- GIVEN the client's build configuration
- WHEN it is inspected
- THEN the cleartext allowance is derived from the build profile, and the static app manifest
  contains no unconditional cleartext allowance

### Requirement: The Debug Route Is Unreachable In Production

The client MUST NOT expose the debug screen in a production build. The screen MAY remain fully
available in development.

#### Scenario: The debug route does not exist in production

- GIVEN a production build
- WHEN the debug path is requested directly by URL or deep link
- THEN the screen does not render

#### Scenario: The user record is not exposed

- GIVEN a production build
- WHEN any unauthenticated route is reached
- THEN no screen renders the serialized user record

#### Scenario: Development retains the debug screen

- GIVEN a development build
- WHEN the debug path is opened
- THEN the screen renders with its API URL, demo-mode toggle and diagnostics intact

### Requirement: The Service Worker Does Not Cache API Responses

The web service worker MUST NOT apply its cache-first strategy to API requests, and MUST NOT cache
responses to non-`GET` requests. This MUST hold regardless of whether the web app and the API share
an origin.

#### Scenario: API responses are never cached

- GIVEN the web app is served with its service worker active
- WHEN a request whose path is under the API prefix is issued
- THEN the service worker does not serve it from cache and does not store its response

#### Scenario: Same-origin deployment is safe

- GIVEN a hypothetical deployment in which the web app and the API share an origin
- WHEN an authenticated request for the current user's record is issued
- THEN its response is not written to the cache

#### Scenario: Only GET responses are cached

- GIVEN any non-`GET` request
- WHEN it passes through the service worker
- THEN its response is not stored in the cache

### Requirement: Required Configuration Fails Loudly

The client MUST fail rather than start with a missing API URL. A derived URL MUST NOT be built by
concatenating an absent value. The client MUST NOT log configuration values on every launch.

Every build profile that is expected to produce a working artifact MUST define the required value.

#### Scenario: A missing API URL fails the build

- GIVEN a build in which the API URL environment variable is not set
- WHEN the client's configuration module is loaded
- THEN it fails with an explicit error naming the missing variable

#### Scenario: The file base URL never contains a placeholder

- GIVEN any successfully configured build
- WHEN the file base URL is read
- THEN it does not contain the literal text `undefined`

#### Scenario: No configuration is logged at launch

- GIVEN any build
- WHEN the app starts
- THEN it writes no API URL or environment diagnostic to the console

#### Scenario: Every build profile is configured

- GIVEN the set of build profiles that produce artifacts
- WHEN each is inspected
- THEN each defines the API URL the configuration guard requires

### Requirement: The Test Command Terminates

The client's test script MUST exit when the suite finishes. It MUST NOT run in watch mode by
default.

#### Scenario: The test script exits

- GIVEN a clean checkout
- WHEN the client's test script is run
- THEN the suite executes once and the process exits with a status code

### Requirement: Critical Client Units Are Covered By Tests

The change MUST add automated tests for the units it repairs: the API client's logout predicate and
response interceptor, the session store's transitions and persisted shape, and the query hooks'
error contract. Tests MUST follow the repository's existing pure-function and source-guard idiom and
MUST NOT require a new component-rendering dependency.

#### Scenario: The logout predicate is tested directly

- GIVEN the predicate that decides whether a failure clears the session
- WHEN it is exercised over authenticated, anonymous, `/auth/` and non-401 failures
- THEN it returns true only for an authenticated non-`/auth/` 401

#### Scenario: The session store's cleanup ordering is asserted

- GIVEN a signed-in session in demo mode
- WHEN logout runs
- THEN the theme and query cache are cleared before demo mode is disabled, and the assertion fails
  if that order changes

#### Scenario: The persisted shape is asserted

- GIVEN the session store's persistence configuration
- WHEN the persisted value is produced
- THEN it contains exactly the token and the session flags, and its serialized size is asserted

#### Scenario: The existing suite stays green

- GIVEN the pre-change test baseline
- WHEN the full suite runs after the change
- THEN every pre-existing test still passes and no new test dependency has been added beyond the
  encrypted storage module
