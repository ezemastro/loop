# Client Credential Storage Specification

## Purpose

Defines where the Expo client is allowed to keep the session JWT and the Google OAuth credential,
per platform, and what must happen to an existing user's session when that location changes.
Covers audit findings CLI-01.

Out of scope: server-side session handling, token lifetime, refresh strategy, and the
`x-refreshed-token` rotation header — those belong to `sec-hardening-api`.

## Requirements

### Requirement: Session Token Storage by Platform

The client MUST persist the session token in the platform's encrypted credential store on native
targets, and MUST NOT persist it in plaintext `AsyncStorage` there. On web the client MAY continue
to use `AsyncStorage` (`localStorage`), because `expo-secure-store` has no web implementation and
the browser's origin isolation is the effective boundary.

The storage backend MUST be selected in one place, and the session store MUST NOT be split across
two backends.

#### Scenario: Token is written to the encrypted store on native

- GIVEN the app is running on iOS or Android
- WHEN a user signs in successfully
- THEN the session token is readable through `expo-secure-store` and is absent from `AsyncStorage`

#### Scenario: Web behaviour is unchanged

- GIVEN the app is running on web
- WHEN a user signs in successfully
- THEN the session persists exactly as it did before this change, and a page reload keeps the user signed in

#### Scenario: Token and demo flag rehydrate together

- GIVEN a device with a persisted demo session
- WHEN the store rehydrates from disk
- THEN the session token and the `demoMode` flag become available in the same turn, and no instant
  exists in which the token is loaded while `demoMode` is still `false`

### Requirement: Persisted Payload Is Bounded

The client MUST persist only the session token and the session flags. It MUST NOT persist the full
user record. The serialized persisted value MUST stay within the platform credential store's
per-value size limit.

#### Scenario: Only token and flags reach disk

- GIVEN a signed-in user belonging to a themed community and several schools
- WHEN the persisted value is inspected
- THEN it contains exactly the session token, the terms-accepted flag, the has-token flag and the
  demo-mode flag, and contains no user profile, community, school or media record

#### Scenario: Persisted value fits the native size limit

- GIVEN the largest realistic persisted payload
- WHEN it is serialized
- THEN it is under 2048 bytes, the Android per-value limit above which the credential store warns or fails

#### Scenario: Dropping the user record does not break community theming

- GIVEN a user whose community carries a custom palette
- WHEN the app is relaunched and the user record is re-fetched
- THEN the community theme is applied before any themed screen renders, exactly as before this change

### Requirement: Existing Sessions Survive the Upgrade

The client MUST migrate an existing plaintext session into the encrypted store on first launch of
the new build. Users MUST NOT be signed out by the upgrade. The migration MUST be idempotent and
MUST remove the plaintext copy once it has been migrated.

#### Scenario: A signed-in user is not logged out by the upgrade

- GIVEN a user signed in on the previous build, with the session in `AsyncStorage`
- WHEN they launch the new build for the first time
- THEN they remain signed in, and the session is now in the encrypted store

#### Scenario: The plaintext copy is removed

- GIVEN the migration has run once
- WHEN `AsyncStorage` is inspected
- THEN the legacy session key is gone

#### Scenario: Migration is idempotent

- GIVEN the migration has already run
- WHEN the app is relaunched any number of times
- THEN the session is read from the encrypted store and the migration performs no further work

### Requirement: OAuth Credential Is Never Persisted

The client MUST NOT write the raw Google ID token credential to any persistent storage. It MAY hold
the credential in memory for the duration of the two-step Google registration flow. Non-credential
context needed by the second step MAY continue to be persisted.

#### Scenario: Credential does not reach disk

- GIVEN a user signs in with Google
- WHEN persistent storage is inspected at any point during or after the flow
- THEN no entry contains the raw Google credential

#### Scenario: Two-step registration still completes

- GIVEN a Google sign-in that the server answers with `SCHOOL_IDS_REQUIRED`
- WHEN the user is routed to school selection and submits it
- THEN the second step resends the identical credential from memory and registration completes

#### Scenario: Non-credential context survives a cold start

- GIVEN a Google registration interrupted before school selection
- WHEN the app is relaunched
- THEN the invitation token and the resolved community are still available, the credential is not,
  and the user is asked to sign in again rather than shown a broken second step
