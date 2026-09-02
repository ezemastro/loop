# Media Access Control Specification

## Purpose

Defines authorisation for `GET /uploads/*`. Today `server/api/src/routes/uploads.ts:17` mounts
`express.static(UPLOAD_DIR)` with no session check, so any URL that leaks — forwarded, pasted,
scraped from a shared screenshot, or captured in a proxy log — remains fetchable by anyone,
from outside the community, indefinitely.

Filenames are `randomUUID()` (`server/api/src/services/uploads.ts:41`), so this is not an
enumeration exposure. The defect is the absence of any expiry or authorisation on a known URL.

## Requirements

### Requirement: Unsigned Requests Are Refused

When media URL signing is enabled, `GET /uploads/<filename>` without a valid signature MUST be
refused with HTTP 403 and MUST NOT return file contents. This MUST hold for a filename that
exists on disk.

(Phase 4 — signed media URLs)

#### Scenario: Bare URL is refused

- GIVEN signing is enabled and `a1b2c3d4-....webp` exists on disk
- WHEN `GET /uploads/a1b2c3d4-....webp` is requested with no query parameters
- THEN the response is 403 and no image bytes are returned

#### Scenario: Tampered signature is refused

- GIVEN a valid signed URL
- WHEN any character of the `sig` parameter is altered
- THEN the response is 403

#### Scenario: Tampered filename is refused

- GIVEN a valid signed URL for file A
- WHEN the filename is swapped for file B while keeping A's `exp` and `sig`
- THEN the response is 403, because the signature is bound to the filename

### Requirement: Signatures Expire

Every signed URL MUST carry an expiry, and a request presenting an expired signature MUST be
refused with HTTP 403. The default lifetime MUST be at most 25 hours, so a leaked URL stops
working within about a day rather than never.

#### Scenario: Valid signature inside the window

- GIVEN a signed URL whose `exp` is in the future
- WHEN it is requested
- THEN the image is returned with HTTP 200

#### Scenario: Expired signature

- GIVEN a signed URL whose `exp` is in the past
- WHEN it is requested
- THEN the response is 403 and no image bytes are returned

### Requirement: Signing Happens At The Single Serialization Point

Signatures MUST be minted inside `parseMediaFromDb` (`server/api/src/utils/parseDb.ts:101-108`),
the sole DB-row-to-`Media` mapper, and additionally where the upload response builds its URL
(`server/api/src/controllers/upload.ts:34-35`). No other code path may emit an unsigned media URL
while signing is enabled.

Because `client/services/getUrl.ts:6-11` and `adminClient/src/services/getUrl.ts:3-5` build URLs
by plain concatenation of whatever string the API returned, this requirement MUST be satisfiable
with **no changes to `client/` or `adminClient/`**.

#### Scenario: Every media-bearing response is signed

- GIVEN signing is enabled
- WHEN a listing, a school, a community, a chat, a user profile or an upload response is fetched
- THEN every `media.url` in the payload carries `exp` and `sig`

#### Scenario: No consumer changes are required

- GIVEN signing is enabled
- WHEN the client and admin are built from unchanged `getUrl` helpers
- THEN every image renders

### Requirement: Header-Based Authorisation Is Not Acceptable

The mechanism MUST NOT require an `Authorization` header on the image request. Both consumers
render these URLs directly in tags that cannot carry headers: `<Image source={{ uri }} />` in the
client (for example `client/components/cards/Listing.tsx:70,111`,
`client/components/ImageGallery.tsx:51`, `client/components/ProfileImage.tsx:152`) and plain
`<img src>` in the admin (for example `adminClient/src/components/SchoolsTable.tsx:43-44`,
`adminClient/src/components/EditSchoolModal.tsx:169-170`).

#### Scenario: Images render without a request header

- GIVEN signing is enabled
- WHEN an `<img>` tag or a React Native `Image` loads a signed URL with no custom headers
- THEN the image renders

### Requirement: Signed URLs Remain Cacheable

For a given file, the signed URL MUST be byte-identical across responses within a bucketing
window, so browser and native image caches continue to hit. A per-response unique expiry would
force a re-download of every image on every render and is not acceptable.

#### Scenario: Same URL within the window

- GIVEN two API responses referencing the same media file, issued minutes apart within one
  bucketing window
- WHEN their `media.url` values are compared
- THEN they are identical, including `exp` and `sig`

#### Scenario: URL rotates across windows

- GIVEN two responses for the same file issued in different bucketing windows
- WHEN their `media.url` values are compared
- THEN they differ, and both are valid at the time they were issued

### Requirement: Rollout Is Reversible Without A Client Release

Signing MUST be controlled by a single configuration flag covering both minting and verification.
Disabling it MUST restore the previous behaviour with no data migration and no client or admin
rebuild.

#### Scenario: Disabling restores previous behaviour

- GIVEN signing was enabled and is then disabled
- WHEN a media URL is fetched
- THEN `media.url` is the bare filename again and `GET /uploads/<filename>` returns the image

#### Scenario: Secret rotation does not break live URLs

- GIVEN the signing secret is rotated while a previous secret is still configured
- WHEN a URL signed with the previous secret is requested within its expiry
- THEN it is accepted

### Requirement: Community Scoping Is Enforced At Mint Time

A signature MUST only be obtainable through an API response the caller was authorised to receive.
`parseMediaFromDb` is reached only via community-scoped queries
(`server/api/src/services/queries.ts:156-169`), so no additional per-request `community_id` check
is required on the static path. `media.community_id` is nullable by design for shared resources
(`server/migrations/0002_add_community_id_nullable.sql:29`), so any future check MUST treat NULL
as permitted.

#### Scenario: Cross-community media is not served to an outsider

- GIVEN a user in community A
- WHEN they request media belonging exclusively to community B through the API
- THEN no signed URL for that media is ever returned to them

#### Scenario: Shared media is still reachable

- GIVEN a media row whose `community_id` is NULL
- WHEN a user in any community fetches a resource referencing it
- THEN a valid signed URL is returned and the image renders
