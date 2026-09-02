# Admin Panel Presentation Specification

## Purpose

Defines pagination correctness, the shared dialog surface, media URL resolution, and document-level
accessibility for the admin panel. Covers ADM-03, ADM-04, ADM-05, and the in-scope subset of ADM-10.

## Requirements

### Requirement: Pagination Derives From the Server's Page Size

The user list MUST compute its page count from the page size the API reports, never from a value
hardcoded in the client. Today the client divides by `20` (`Users.tsx:33`) while the API pages by
`PAGE_SIZE = 10` (`config.ts:156`, applied at `models/admin.ts:312-314`), so the pager reports half the
real page count and the tail of the list is unreachable.

The API MUST include its page size in the paginated users response, which currently carries only
`{ users, total }` (`controllers/admin.ts:171`). It MUST reuse the `PaginatedApiResponse<T>` envelope
that already exists (`shared/types/apiCalls.d.ts:25-27`) and is already used by
`GetAdminInvitationsResponse` (`:741`), rather than introducing a new shape. The addition MUST be
additive: `data.total` MUST be retained so no existing consumer breaks.

The shared response type MUST be updated so the contract cannot drift again. This requires no build
configuration change, because `adminClient` already compiles against `shared/types` as ambient globals
(`adminClient/tsconfig.app.json`).

The client MUST tolerate a response without the pagination field, falling back to a named constant that
documents its server-side source, so the client and server edits remain independently revertible.

(Unit 2 — ADM-03 pagination)

#### Scenario: Every page is reachable

- GIVEN a community with 25 users and a server page size of 10
- WHEN the operator opens the user list
- THEN the pager offers 3 pages and page 3 loads the final 5 users

#### Scenario: Page count follows a server-side change

- GIVEN the server's page size is changed to 25
- WHEN the operator opens a user list of 25 users
- THEN the pager offers 1 page, with no client change

#### Scenario: A response without pagination still renders

- GIVEN an API response carrying only `users` and `total`
- WHEN the user list renders
- THEN the page count is computed from the documented fallback constant and the screen does not error

### Requirement: Dialogs Use the Shared Modal Surface

Every admin dialog MUST render through the shared `ui/Modal` component. The six legacy modals that
hand-roll an overlay with `bg-black bg-opacity-50` MUST be migrated:
`ModifyCreditsModal.tsx:77`, `ResetPasswordModal.tsx:81`, `CreateSchoolModal.tsx:139`,
`EditSchoolModal.tsx:146`, `CategoryFormModal.tsx:150`, `MissionFormModal.tsx:119`.

`bg-opacity-*` was removed in Tailwind v4, and the panel is on v4 css-first with no config file, so
these backdrops currently render fully opaque black and hide the page behind them.

Migrated dialogs MUST match the surface the already-migrated screens use — `ui/Modal`'s own backdrop
(`ui/Modal.tsx:46`), **not** a hand-written `bg-black/50`. Migrated dialogs MUST preserve their existing
submission behaviour despite `ui/Modal` rendering actions in a `footer` outside the form body, and MUST
NOT introduce a second scroll container, since `ui/Modal` already constrains height and scrolls its
body (`ui/Modal.tsx:50`, `:66`).

No `bg-opacity` occurrence MUST remain in `adminClient/src` when this requirement is met.

(Unit 5 — ADM-04 modals and reason)

#### Scenario: The backdrop is translucent

- GIVEN any of the six migrated dialogs is open
- WHEN it renders
- THEN the page behind it is visible through a translucent backdrop, not hidden behind opaque black

#### Scenario: Migrated dialogs still submit

- GIVEN each migrated dialog in turn, filled with valid input
- WHEN the operator submits from the footer control
- THEN the same request is sent and the same success behaviour occurs as before the migration

#### Scenario: No nested scrollbars

- GIVEN the largest migrated dialog on a short viewport
- WHEN its content overflows
- THEN exactly one scroll container is present

#### Scenario: The dead utility is gone

- GIVEN the completed change
- WHEN `adminClient/src` is searched for `bg-opacity`
- THEN there are no matches

### Requirement: Media Filenames Resolve to Absolute URLs

Community logos MUST be resolved through `getUrl` before being used as an image source. The API stores
and returns a bare filename in `media.url` (`models/upload.ts:35`, `utils/parseDb.ts:91-98`,
`database_creation.sql:61-68`), so using it directly resolves against the admin SPA's own origin and the
image never loads. The community screens use it directly (`Communities.tsx:110`,
`CommunityFormModal.tsx:217`) while the school screens already resolve it correctly
(`SchoolsTable.tsx:44`, `EditSchoolModal.tsx:170`).

`getUrl` MUST pass an already-absolute `http`/`https` URL through unchanged, so that resolution is
idempotent and values that are already absolute — as demo and seed data can be — are not corrupted by
the fix.

(Unit 3 — ADM-05 logos)

#### Scenario: A community logo renders

- GIVEN a community whose logo was uploaded through the panel
- WHEN the communities list renders
- THEN its logo image loads successfully

#### Scenario: A freshly uploaded logo previews

- GIVEN an operator uploading a new logo in the community form
- WHEN the upload completes
- THEN the preview image loads successfully

#### Scenario: An absolute URL is not double-prefixed

- GIVEN a community whose media value is already an absolute `https://` URL
- WHEN it is resolved for rendering
- THEN the value is used unchanged and the image loads

### Requirement: Document Language and Identity Are Correct

The admin document MUST declare Spanish as its language, since the entire interface is Spanish; it
declares `lang="en"` today (`index.html:2`). It MUST NOT ship the default Vite scaffold favicon
(`index.html:5`). The document title is already correct (`index.html:7`) and MUST be left unchanged.

(Unit 7 — ADM-10 document)

#### Scenario: The document declares Spanish

- GIVEN the admin panel is loaded
- WHEN the root element is inspected
- THEN its `lang` attribute is `es`

#### Scenario: The scaffold favicon is gone

- GIVEN the admin panel is loaded
- WHEN the favicon is inspected
- THEN it is a Loop-branded icon and not the Vite default

### Requirement: Form Labels Are Associated With Their Controls

Form labels MUST be associated with their controls. Approximately 27 of the 33 `<label>` elements in
`adminClient/src` lack `htmlFor`, and 22 of those sit inside the six dialogs being migrated above, so
association MUST be delivered as part of that migration by using the existing `ui/Field` component,
which already accepts `htmlFor` and renders the label (`ui/Field.tsx:9`, `:19`, `:28`).

Labels outside those six files are a best-effort pass and MUST NOT block this change. `ui/Field`'s
`Toggle` (`ui/Field.tsx:62`) wraps its input inside the label, which is valid implicit association and
MUST be left alone.

(Unit 5 — ADM-04 modals and reason)

#### Scenario: Migrated dialog labels focus their inputs

- GIVEN any of the six migrated dialogs is open
- WHEN the operator clicks a field's label text
- THEN focus moves to that field's control

#### Scenario: Implicit associations are preserved

- GIVEN the completed change
- WHEN `ui/Field.tsx`'s `Toggle` is inspected
- THEN its label still wraps its input and no redundant `htmlFor` was added
