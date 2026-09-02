# Design: Public Legal Routes, Password Reset and Signed Media URLs

## Technical Approach

Three loosely-related audit findings share one delivery because they share surfaces and one
release gate (store submission). The legal pages are Expo Router routes declared outside every
`Stack.Protected`, backed by a serving-layer fix that makes the already-prerendered HTML actually
reach the browser. Terms acceptance moves from a device-local flag to a server column. Password
reset mirrors the existing email-verification flow while fixing its two structural weaknesses
(unhashed, non-expiring). Media authorisation is an HMAC signature injected at the single
serialization choke point, chosen specifically because `<img>` and `Image` cannot send headers.

## Verified Platform Facts

Read in this repository and in `node_modules`, not assumed. Each drives a decision below.

| # | Fact | Evidence |
|---|---|---|
| F1 | `expo export --platform web` prerenders one real `.html` per route; `output` is already `static` | `client/app.json:36`; `client/node_modules/@expo/cli/build/src/export/exportStaticAsync.js:331` |
| F2 | The auth guard is not a redirect — a failing `Stack.Protected` guard **removes** the screen from the navigator | `client/app/_layout.tsx:76-94`; `client/node_modules/expo-router/build/useScreens.js:123`; `withLayoutContext.js:60-62,80-85` |
| F3 | `client/app/debug.tsx` is the working anonymous-route precedent — declared at `_layout.tsx:93`, outside every guard | `client/app/_layout.tsx:93`; `client/components/screens/Debug.tsx:33-36` (in-code comment: *"`/debug` es una ruta pública"*) |
| F4 | `serve --single` **prepends** a `**` → `/index.html` rewrite to any `serve.json` rewrites | `serve@14` `build/main.js:539-548` |
| F5 | `serve-handler` skips the `cleanUrls` `.html` candidate list whenever **any** rewrite matched | `serve-handler@6.1.7` `src/index.js:282` (`const possible = rewrittenPath ? [rewrittenPath] : getPossiblePaths(relativePath, '.html')`) |
| F6 | `serve-handler` stats the literal path first **only** when the request has a file extension | `serve-handler@6.1.7` `src/index.js:608` (`if (path.extname(relativePath) !== '')`) |
| F7 | `serve` loads `serve.json` from the **served directory**, not the cwd | `serve@14` `build/main.js:434-439` (`resolvePath(directoryToServe2, file)`) |
| F8 | **F4+F5+F6 ⇒ today `GET /privacidad` returns `dist/index.html`, not `dist/privacidad.html`** | derived; `Dockerfile.web:42` (`serve -s dist`) |
| F9 | `client/public/` is copied verbatim into `dist/` by the Expo web export | `client/public/manifest.json`, `sw.js`, `icons/` ship today and are referenced at `Dockerfile.web:38` |
| F10 | `parseMediaFromDb` is the **single** DB-row → API `Media` mapper; 6 call sites | `server/api/src/utils/parseDb.ts:101-108`; callers `utils/helpersDb.ts:56,68,129`, `utils/communities.ts:38`, `models/auth.ts:55`, `models/admin.ts:423` |
| F11 | Client and admin both build media URLs by **plain concatenation** of whatever string the API returned | `client/services/getUrl.ts:6-11`; `adminClient/src/services/getUrl.ts:3-5`; `client/config.ts:43` / `adminClient/src/config.ts:4` (`FILE_BASE_URL = API_URL + "/uploads/"`) |
| F12 | `GET /uploads/*` is unauthenticated `express.static`; `POST /uploads` is not | `server/api/src/routes/uploads.ts:12` (`tokenMiddleware`) vs `:17` (`express.static(UPLOAD_DIR)`) |
| F13 | Upload filenames are `randomUUID()` — CSPRNG, not enumerable | `server/api/src/services/uploads.ts:41` |
| F14 | `media.community_id` is **nullable on purpose** (shared resources), and RLS special-cases NULL | `server/migrations/0002_add_community_id_nullable.sql:29`; `server/migrations/0007_db_roles_and_rls.sql:97-101` |
| F15 | `POST /me/delete-request` is public by construction, mounted **before** the `/me` router | `server/api/src/index.ts:72` vs `:89` |
| F16 | `GET /communities/:slug` is public and exposes only `id/slug/name/theme/media/active` | `server/api/src/index.ts:78`; `routes/communities.ts:8`; `controllers/communities.ts:12-21` |
| F17 | The email-verification token is stored **unhashed** and has **no expiry** | `server/migrations/0008_email_verification.sql:8-10`; `server/api/src/services/queries.ts:68-74` |
| F18 | The API already serves plain HTML from Express, with an escaped-entity Spanish template | `server/api/src/controllers/auth.ts:130-141,187-232` (`verificationPage({icon,title,body})`) |
| F19 | Migrations are alphabetically ordered, checksum-immutable, and run in their own transaction | `server/api/src/scripts/migrate.ts:63-78,224-233,239-251` |
| F20 | The client has **no i18n layer**; all copy is hardcoded Rioplatense Spanish (voseo) | verified absence of `i18n`/`intl` imports; `client/components/screens/Landing.tsx:33-44` (`"Publicá"`, `"Ganá loopies"`, `"Canjeá"`) |
| F21 | Community name is available client-side only **after** login, via `user.community.name`; `previewCommunity` populates only after an email is typed in register | `client/stores/session.ts:36-38,63,85`; `client/stores/theme.ts:10,12` |

## Decisions

### D1 — Host the legal pages as Expo Router routes, not a new landing package

**Decision.** Three files under `client/app/` (`privacidad.tsx`, `terminos.tsx`,
`borrar-cuenta.tsx`), each declared in `client/app/_layout.tsx` as a sibling of the existing
`<Stack.Screen name="debug" />` at `:93` — outside every `Stack.Protected`.

**Why.** F1 means the static HTML a store reviewer needs already comes out of the existing build.
F3 gives a working precedent in-repo. Re-adding an Astro package (the audit's "or a minimal
landing" alternative) would mean a second build, a second Dockerfile, a second deploy target and a
duplicated theme — for three text pages. Rejected (proposal C9).

**Consequence — and it is a hard rule.** If any of the three ends up inside a
`Stack.Protected`, F2 applies: the prerendered HTML paints, then hydration deletes the route and
the visitor is bounced to `(auth)`. A store reviewer would see the login screen. Task 1.4 asserts
placement with a source guard test, not by inspection.

### D2 — Fix the serving layer with `serve.json`, drop `-s`

**Decision.** Add `client/public/serve.json` (F9 puts it in `dist/`, F7 makes `serve` read it) and
change `Dockerfile.web:42` to `CMD ["serve", "dist", "-l", "3000"]`:

```json
{
  "rewrites": [
    { "source": "/privacidad", "destination": "/privacidad.html" },
    { "source": "/terminos", "destination": "/terminos.html" },
    { "source": "/borrar-cuenta", "destination": "/borrar-cuenta.html" },
    { "source": "**", "destination": "/index.html" }
  ]
}
```

**Why this exact shape.** `applyRewrites` returns on the **first** matching rule
(`serve-handler@6.1.7 src/index.js:91-115`), so specific rules must precede the catch-all. Keeping
`-s` would defeat this entirely: F4 shows `--single` *prepends* its `**` rule, so it would always
win. Dropping `-s` while keeping the `**` rule **last** preserves today's SPA fallback for
`/listing/<id>` and every other dynamic route, so this is behaviour-preserving everywhere except
the three legal paths.

**Why not just serve `.html` URLs.** F6 means `/privacidad.html` works today with no change at
all — the literal path is stat'd before any rewrite. But `https://loop.reditinere.com/privacidad.html`
in a store listing is worse than the clean URL, and the underlying defect (F8) would remain for
every other route. Rejected; kept as the documented emergency fallback if the Dockerfile change
is blocked (see D3 fallback ladder).

**Verification is mandatory, not optional.** Task 1.5 requires building the image and `curl`-ing
each of `/`, `/privacidad`, `/terminos`, `/borrar-cuenta`, `/terms`, `/debug`, `/listing/<uuid>`
and asserting status and a body marker. F8 was derived from reading two `node_modules` packages;
it must be confirmed against the real image before the change is called done.

### D3 — Fallback ladder if D2 cannot land

Stated explicitly because the constraint was to verify rather than promise:

1. **Preferred** — D2 as written. Clean URLs, real prerendered HTML, no JS required for first paint.
2. **If the Dockerfile CMD change is rejected** — keep `serve -s` and publish
   `/privacidad.html`, `/terminos.html`, `/borrar-cuenta.html`. Works today unmodified (F6),
   requires only that the store listing use the `.html` URLs.
3. **If the Expo web deploy is unavailable or the SPA shell is judged too fragile** — serve the
   three pages from Express as plain HTML, reusing the `verificationPage` template already in the
   API (F18), and route the three paths to the `api` container in `Caddyfile:2-4`. Zero JS,
   community name straight from the DB. Heavier operationally (a Caddy path split), which is why
   it is third and not first.

Ladder position is a delivery decision, not a spec change: `public-legal-pages` requires the URLs
to answer anonymously with the right content, and all three rungs satisfy that.

### D4 — One terms document, community name injected

**Decision.** `client/content/legal/termsDocument.ts` exports
`TERMS_VERSION` and `buildTermsSections(communityName: string): Section[]`, reusing the existing
`Section` shape at `client/components/screens/Terms.tsx:9-12`. Both the in-app screen and the
public `/terminos` route render it.

- In-app: `communityName = user.community.name` (F21).
- Public `/terminos?c=<slug>`: resolved through the already-public `GET /communities/:slug` (F16).
- Public `/terminos` with no `?c=`: a neutral fallback label (`"tu comunidad"`), because F21 means
  there is genuinely no community signal for an anonymous visitor and inventing one would be a lie.

**Why not fetch the community by hostname.** All communities share `loop.reditinere.com`
(`Caddyfile:2-4`); there is no per-community subdomain to read.

**`TERMS_VERSION` is a deliberate constant**, not derived from a file hash. Bumping it re-prompts
every user (D5), so it must be a conscious edit. Format: `YYYY-MM-DD`.

### D5 — Terms acceptance is a server fact

**Decision.** `users.terms_accepted_at TIMESTAMPTZ` + `users.terms_version TEXT`, written by
`POST /me/terms-acceptance` (behind `tokenMiddleware` on the existing `/me` router,
`server/api/src/index.ts:89`) and returned on `PrivateUser`. The client derives
`hasAcceptedTerms` as `user.termsVersion === TERMS_VERSION`.

**Why a version and not a boolean.** Republishing the terms after legal review (proposal task 6.6)
must re-prompt. A boolean cannot express that. Storing the accepted version makes
"re-prompt on change" a comparison rather than a migration.

**Migration.** `ADD COLUMN IF NOT EXISTS`, both nullable, no backfill. A NULL
`terms_version` means "never accepted under the tracked regime" and re-prompts once — which is the
correct and legally safer default given C6 (today's flag is device-local and untrustworthy).

**Degradation.** If `POST /me/terms-acceptance` fails, the client keeps the local flag for the
session and retries on next launch. A network failure must not lock a user out of the app.

### D6 — Password-reset token: hashed, expiring, single-use

**Decision.** Mirror the verification flow's plumbing, not its weaknesses (F17).

| Aspect | Email verification (today) | Password reset (this change) |
|---|---|---|
| Generation | `crypto.randomBytes(32).toString("hex")` (`models/auth.ts:173`) | same |
| Storage | plaintext in `email_verification_token` | **`sha256` hex digest** in `password_reset_token_hash` |
| Expiry | none (C5) | **`password_reset_expires_at TIMESTAMPTZ`**, default TTL 1 hour |
| Lookup | plaintext equality (`queries.ts:68-74`) | equality on the digest, `AND password_reset_expires_at > NOW()` |
| Consumption | single `UPDATE ... RETURNING` | same — atomic, clears hash + expiry in the same statement |
| Scope | `unscoped("token-lookup")` | same; the token is the credential |
| Response | always 200 (`controllers/auth.ts:147-162`) | always 200, identical shape |

`sha256` rather than bcrypt: the token is 32 bytes of CSPRNG entropy, so it is not
brute-forceable and does not need a slow KDF; a fast digest keeps the lookup indexable
(`CREATE INDEX ... WHERE password_reset_token_hash IS NOT NULL`, mirroring
`server/migrations/0008_email_verification.sql:16-18`). Confirmed consistent with
`db-integrity-migrations`, whose task 4.2 uses the same `*_token_hash` + `*_expires_at` shape and
whose tasks 4.3-4.4 compute the digest **in PostgreSQL** with `encode(sha256($2::bytea), 'hex')`
— a built-in, explicitly not `pgcrypto`. This block adopts that SQL-side form so both token flows
read identically. Migration numbers are `0014` and `0015`; that block holds `0009`-`0013`.

**Endpoints.** `POST /auth/forgot-password { email }` → always 200. `POST /auth/reset-password
{ token, newPassword }` → validates `passwordSchema` (`services/validations.ts:12`), consumes the
token, sets the bcrypt hash via the existing `hashPassword` (`services/hash.ts`). Both on the
public `authRouter` (`server/api/src/index.ts:75`). Neither is rate limited here — that is the
`sec-hardening-api` hand-off and a stated release blocker.

**Side effect.** A successful reset sets `email_verified = TRUE`: control of the mailbox was just
proven, and leaving a user unable to log in after a successful reset would be a support trap.

### D7 — Uploads: signed URLs with bucketed expiry, signed at `parseMediaFromDb`

**This is the crux of the change. The constraint drives the answer.**

Both consumers render media URLs directly in tags that cannot carry headers:

- `client/components/cards/Listing.tsx:70,111`, `ImageGallery.tsx:51`, `ProfileImage.tsx:152`,
  `Chat.tsx:122`, `cards/School.tsx:24`, `cards/User.tsx:30`, `cards/ChatCard.tsx:39`,
  `AllowedDomainsNotice.tsx:67` — all `<Image source={{ uri: getUrl(...) }} />`.
- `adminClient/src/components/SchoolsTable.tsx:43-44`, `EditSchoolModal.tsx:169-170`,
  `CreateSchoolModal.tsx:171`, `CommunityFormModal.tsx:216`, `pages/Communities.tsx:109` —
  plain `<img src={getUrl(...)}>`.

**Decision: HMAC-signed URLs with an expiry, generated inside `parseMediaFromDb`
(`server/api/src/utils/parseDb.ts:101-108`), verified by a handler that replaces
`express.static` at `server/api/src/routes/uploads.ts:17`.**

`media.url` changes from `"<uuid>.webp"` to `"<uuid>.webp?exp=<unix>&sig=<hex>"`. Because of F11,
`getUrl` concatenates and the resulting absolute URL is correct — **zero changes in
`client/` and zero in `adminClient/`.** F10 means one function covers all six serialization paths.

**Signature payload.** `HMAC-SHA256(MEDIA_SIGNING_SECRET, "<filename>|<exp>")`, hex, compared with
`crypto.timingSafeEqual`. Bound to the filename, so a leaked URL leaks exactly one image — not the
community's media, and not a bearer capability.

**Bucketed expiry.** `exp = ceil(now / BUCKET) * BUCKET + TTL`, with `BUCKET` = 1 hour and TTL
24 hours by default. Without bucketing every API response would emit a different `exp` and every
image would cache-miss on every render — a real performance regression on a listing grid. With
bucketing the URL is byte-identical for all users for an hour, so browser and RN image caches hit,
while a leaked URL still dies within ~25 hours. This directly answers SEC-08's "forever".

**Why not the audit's first option (`tokenMiddleware` on the static route).** Structurally
impossible. `react-native-web`'s `Image` ignores `source.headers`, and `<img>` has no header
mechanism at all. Adopting it would require rewriting every one of the 14 call sites above to
fetch-then-blob-URL, losing native image caching, progressive decode and `resizeMode` behaviour.
Rejected on the constraint, not on taste.

**Why not cookies.** A `SameSite=None; Secure; Path=/uploads` cookie would work in a browser, but
the API and web client are different origins (`Caddyfile:2-4` vs `config.ts:39`
`BASE_URL`), React Native's cookie jar differs per platform and is unreliable for `Image`
requests, and dev runs over plain HTTP where `Secure` cookies are dropped. Rejected as fragile
across exactly the platforms this app ships to.

**Why not a client-held media token appended by `getUrl`.** Considered seriously: it is a
two-line client change. Rejected because it needs a new issuing endpoint, refresh logic and
storage; a mid-session expiry breaks every image at once with no recovery path; and the token is a
**bearer capability for the whole community's media**, which is a strictly weaker security
property than a per-file signature.

**Why not verify `media.community_id` per request.** F14 says it is nullable for shared
resources, so the check would need a NULL carve-out, and it would add a DB round trip to every
image request on a static-file path. It is also redundant: a signature is only ever minted by
`parseMediaFromDb`, which is only reached through queries already scoped by
`client.communityId` (`services/queries.ts:156-169`). Community scoping is enforced at mint time,
which is cheaper and equally sound. A defence-in-depth `community_id` claim inside the signature
payload is recorded as a deferred follow-up.

**Rollout safety.** `MEDIA_URL_SIGNING_ENABLED` gates both minting and verification, default
`false`. Phase 4 enables minting and verification together only after 4.7 confirms every surface
renders. Rotation accepts a previous secret (`MEDIA_SIGNING_SECRET_PREVIOUS`) during a TTL window
so cached URLs do not break.

**Non-goal.** This does not stop an authorised community member from resharing an image within
the TTL. That is unsolvable without per-user tokens and is out of scope for SEC-08, which is about
indefinite external reachability.

### D8 — `/borrar-cuenta` reuses the existing public endpoint

**Decision.** The form POSTs `{ email, reason }` to `POST /me/delete-request` — unchanged, already
public (F15), already idempotent per pending request
(`server/api/src/services/queries.ts:753-760`), already always-204 to avoid being an enumeration
oracle. This restores the exact contract the deleted
`landing/src/pages/borrar-cuenta.astro` used, so the endpoint stops being consumerless without any
API change.

Two adjustments: `reason` is currently accepted and dropped by the controller — this change either
persists it or removes it from the form rather than silently discarding user input (task 2.5); and
the dead `catch` at `server/api/src/controllers/accountDeletion.ts:21-23` (C8) is fixed so a
malformed address gets feedback instead of a silent 204.

**Copy is voseo**, matching F20 and the app: `"Enviá esta solicitud…"`, `"Contanos por qué querés
borrar la cuenta"`. The deleted Astro page mixed registers (`"Cuéntanos"` at
`landing/src/pages/borrar-cuenta.astro`); that inconsistency is not carried forward.

### D9 — Store metadata

`client/app.json` gains the legal URLs in the web block and, where the platform supports it, the
native config. The store listings themselves are filled in by a human — the artifact records the
exact URLs to paste. `EXPO_PUBLIC_LEGAL_BASE_URL` defaults to the production host so in-app links
to the legal pages resolve identically on native and web.

## Architecture Notes

**Community scoping (`openspec/config.yaml` requires this be explicit).**

| Surface | Scope | Rationale |
|---|---|---|
| `GET /privacidad`, `/terminos`, `/borrar-cuenta` | unscoped | Public by requirement; no session exists |
| `/terminos?c=<slug>` | reads one community by slug | Already-public data (F16) |
| `POST /auth/forgot-password` / `reset-password` | `unscoped("token-lookup")` | The token is the credential; mirrors `models/auth.ts:305-320` |
| `POST /me/terms-acceptance` | `inCommunity(req.communityId)` | Authenticated write to the caller's own row |
| Media signature minting | inherits the caller's scope | Minted only inside `parseMediaFromDb`, reached only via community-scoped queries |
| `GET /uploads/*` verification | unscoped | Stateless HMAC check; scoping was enforced at mint |

**Migration rationale (`openspec/config.yaml` requires this).** Two additive migrations,
`ADD COLUMN IF NOT EXISTS`, no backfill, each in its own transaction per F19. Numbering is
`0009`/`0010` **subject to task 1.1's re-check** of `openspec/changes/db-integrity-migrations/` —
migrations are checksum-immutable once applied (F19), so a collision must be resolved before the
first `npm run migrate`, never after.

## File Changes

| File | Change | Phase |
|---|---|---|
| `client/public/serve.json` | New — ordered rewrites (D2) | 1 |
| `Dockerfile.web:38-39,42` | Drop `-s`; widen the PWA/`lang` `sed` to every `dist/*.html` | 1 |
| `client/app/privacidad.tsx`, `terminos.tsx`, `borrar-cuenta.tsx` | New route files (D1) | 1 |
| `client/app/_layout.tsx:93` | Declare the three screens outside all guards (D1) | 1 |
| `client/content/legal/privacyPolicy.ts`, `termsDocument.ts` | New — template + placeholders + `LEGAL-REVIEW-REQUIRED` banner | 2 |
| `client/components/screens/legal/*.tsx` | New — three presentational screens | 2 |
| `client/components/screens/Terms.tsx:9-12,30-78,24-28` | Consume shared document; drop constants; fix web reject (C7) | 3 |
| `server/migrations/0014_terms_acceptance.sql` | New (D5) | 3 |
| `server/migrations/0015_password_reset.sql` | New (D6) | 5 |
| `server/api/src/routes/self.ts` | `POST /me/terms-acceptance` | 3 |
| `server/api/src/routes/auth.ts:6-14` | Two public reset routes | 5 |
| `server/api/src/services/email.ts` | `sendPasswordResetEmail` | 5 |
| `server/api/src/services/mediaSigning.ts` | New — sign/verify (D7) | 4 |
| `server/api/src/utils/parseDb.ts:101-108` | Sign at the choke point (D7) | 4 |
| `server/api/src/routes/uploads.ts:17` | Verifying handler replaces `express.static` (D7) | 4 |
| `server/api/src/controllers/upload.ts:34-35` | Sign the upload response URL | 4 |
| `server/api/src/controllers/accountDeletion.ts:21-23` | Fix dead catch (C8) | 2 |
| `client/app.json:34-48` | Legal URLs (D9) | 6 |

## Open Questions

- **Does `db-integrity-migrations` use `sha256` or bcrypt for SEC-10?** Task 1.1 resolves by
  reading that block. If it diverges, this block conforms to it.
- **Is `reason` on the deletion form worth a column?** Task 2.5 decides: persist it in
  `account_deletion_requests` or drop the field. Silently discarding it is not an option.
- **Who signs off the legal template?** Task 6.6 blocks on a named human. Not resolvable here.
