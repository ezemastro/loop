# Terms Acceptance Specification

## Purpose

Defines how Loop records that a user accepted a specific version of the terms, and how the terms
document adapts to the community the reader belongs to. Replaces a device-local boolean
(`client/stores/session.ts:88-89`) that is destroyed on logout (`:69`) and never reaches the server.

## Requirements

### Requirement: Acceptance Is Persisted Server-Side

Accepting the terms MUST write `users.terms_accepted_at` and `users.terms_version` for the
authenticated user. Acceptance MUST NOT be represented only in client storage. Both columns MUST
be added by an additive migration using `ADD COLUMN IF NOT EXISTS`, with no backfill: a NULL
`terms_version` means the user has never accepted under the tracked regime and MUST be re-prompted
once.

(Phase 3 — terms acceptance)

#### Scenario: Acceptance is recorded

- GIVEN an authenticated user who has never accepted the terms
- WHEN they press "Aceptar" on the terms screen
- THEN `POST /me/terms-acceptance` is called and their `users.terms_accepted_at` is set to the
  current time and `users.terms_version` to the current `TERMS_VERSION`

#### Scenario: Acceptance survives logout

- GIVEN a user who accepted the current terms version
- WHEN they log out and log back in on the same or a different device
- THEN they are not prompted for the terms again

#### Scenario: Pre-existing users are prompted once

- GIVEN a user row created before this change, with `terms_version` NULL
- WHEN they next open the app
- THEN they are shown the terms screen exactly once, and accepting records the current version

### Requirement: Version Change Re-Prompts

The client MUST treat the terms as accepted only when the stored `terms_version` equals the
current `TERMS_VERSION` constant. When `TERMS_VERSION` changes, every user MUST be prompted again.
`TERMS_VERSION` MUST be an explicit constant, not derived from a file hash, so that re-prompting
every user is always a deliberate act.

#### Scenario: Bumping the version re-prompts

- GIVEN a user whose `terms_version` is `2026-09-02`
- WHEN `TERMS_VERSION` is changed to `2026-10-01` and they open the app
- THEN they are shown the terms screen again

#### Scenario: Matching version does not re-prompt

- GIVEN a user whose `terms_version` equals the current `TERMS_VERSION`
- WHEN they open the app
- THEN they go straight to the main navigator

### Requirement: Community Name Is Dynamic

The terms body MUST take the community name from the community, never from a constant. The
literal string `"La Red Itinere"` MUST NOT appear in
`client/components/screens/Terms.tsx` (today at `:37` and `:76`) nor in the shared terms document
module. The document MUST expose a `{{COMMUNITY_NAME}}` placeholder filled at render time.

#### Scenario: In-app terms show the user's community

- GIVEN an authenticated user whose `user.community.name` is `"Colegio San Martín"`
- WHEN the terms screen renders
- THEN the document reads `"Colegio San Martín"` wherever the community is named

#### Scenario: No hardcoded community name remains

- GIVEN the client source tree
- WHEN `client/components/screens/Terms.tsx` and `client/content/legal/termsDocument.ts` are searched
- THEN neither contains the literal `"Red Itinere"`

#### Scenario: Public terms resolve the community from the URL

- GIVEN an anonymous visitor requesting `/terminos?c=red-itinere`
- WHEN the page resolves the slug through the public `GET /communities/:slug`
- THEN the document renders that community's `name`

#### Scenario: Public terms without a community use a neutral label

- GIVEN an anonymous visitor requesting `/terminos` with no `c` parameter
- WHEN the page renders
- THEN a neutral label is used in place of a community name, and no community is invented

#### Scenario: Unknown slug does not break the page

- GIVEN a request for `/terminos?c=does-not-exist`
- WHEN `GET /communities/:slug` returns 404
- THEN the page still renders with the neutral label and does not show an error screen

### Requirement: Acceptance Failure Must Not Lock Users Out

If `POST /me/terms-acceptance` fails, the client MUST fall back to treating the terms as accepted
for the current session and retry on next launch. A network or server failure MUST NOT leave a
user unable to enter the app.

#### Scenario: Server unreachable during acceptance

- GIVEN a user who presses "Aceptar" while the API is unreachable
- WHEN the request fails
- THEN they enter the app, and the acceptance is retried on the next launch

### Requirement: Rejection Behaves on Every Platform

Rejecting the terms MUST produce a defined outcome on web as well as native. Today
`client/components/screens/Terms.tsx:24-28` calls `BackHandler.exitApp()`, which is a no-op in
`react-native-web`, leaving a browser user stranded with no feedback.

#### Scenario: Rejecting on web

- GIVEN a user on the terms screen in a browser
- WHEN they press "Rechazar"
- THEN they are returned to a signed-out state with an explanatory message, rather than remaining
  on the terms screen with no feedback
