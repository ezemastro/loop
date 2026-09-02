# Tasks: Public Legal Routes, Password Reset and Signed Media URLs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300 across 6 phases |
| Session review budget | 800 lines/PR (configured) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | None — single PR, six independently revertible phases |
| Delivery strategy | single-pr / exception-ok (session preflight) |
| Chain strategy | N/A |
| Branch | `fix/auditoria-2026-09` |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

**Exception rationale.** The forecast exceeds the 800-line budget, and session preflight selected
`single-pr` with `exception-ok`. The block ships whole because the store submission is one atomic
deliverable: a privacy URL without a deletion URL is still a rejected build, and legal review
(6.6) gates the set, not the parts. The six phases below are ordered so each is independently
revertible, which recovers most of the reviewability a chain would have provided. Reviewers should
take the phases in order; phase 4 is the highest-risk unit and is behind a flag.

### Phase Map

| Phase | Goal | Rollback boundary |
|-------|------|-------------------|
| 1 | Routing and serving layer | Delete `serve.json`, restore `-s` in `Dockerfile.web:42`, delete the three route files |
| 2 | Legal content and the deletion form | Delete `client/content/legal/` and `client/components/screens/legal/` |
| 3 | Terms acceptance (migration + API + client) | Columns stay unused; client falls back to the local flag |
| 4 | Signed media URLs | `MEDIA_URL_SIGNING_ENABLED=false` |
| 5 | Password reset | Unmount the two routes; columns stay unused |
| 6 | Store metadata and the legal-review gate | Revert `app.json` metadata |

**Environment.** API tests: `cd server/api && npm run test` (`server/api/package.json:14`,
`cross-env NODE_ENV=test jest`). The suite is known partially red pre-change
(`openspec/config.yaml`, INF-06) — capture the baseline before starting and compare against it,
never against green. Type check: `cd server/api && npm run check-types`. Migrations:
`cd server/api && npm run migrate` (`package.json:19`). SQL arity check:
`cd server/api && npm run check-sql` (`package.json:22`). Client tests use `--watchAll` and never
terminate — run `cd client && npx jest --ci --watchAll=false`. `npm run lint` is broken
pre-existing under Node 24 (`ERR_UNSUPPORTED_DIR_IMPORT`) — not a gate.

**Tooling.** `rg` is available; `fd`, `bat` and `eza` are not.

**Line numbers are indicative; symbol names are authoritative.** These artifacts were written
while sibling audit blocks were editing the same working tree on `fix/auditoria-2026-09`
(`client/config.ts`, `server/api/src/config.ts`, `server/api/src/utils/parseDb.ts`,
`server/api/src/models/accountDeletion.ts`, `shared/types/*.d.ts` and others already carry
uncommitted modifications). Citations were re-verified at write time, but they will drift again.
Locate every target by its symbol — `parseMediaFromDb`, `CONTACT_EMAIL`, `APP_BASE_URL`,
`safeValidateEmail`, `<Stack.Screen name="debug" />` — and treat a mismatched line number as
drift, not as a missing target. Re-check for conflicts with sibling blocks before editing any
shared file.

---

## Phase 1: Routing and Serving Layer

- [ ] 1.1 **Re-confirm migration numbering before writing any SQL.** As planned,
      `openspec/changes/db-integrity-migrations/tasks.md` claims `0009_unique_user_email`,
      `0010_credit_balance_checks`, `0011_message_listing_on_delete`,
      `0012_verification_token_hash` and `0013_revoke_loop_app_dml` (its tasks 1.1, 2.1, 3.1, 4.1,
      5.1). This block therefore takes **`0014`** and **`0015`**. Both blocks are unarchived and
      still moving, so re-read that directory and renumber if it has grown. Migrations are
      checksum-immutable once applied (`server/api/src/scripts/migrate.ts:224-233`), so a
      collision resolved after the first `npm run migrate` is unrecoverable.
      — *design D6, proposal Dependencies*
- [ ] 1.1b Confirm the token-hashing convention still matches. As planned,
      `db-integrity-migrations` task 4.2 uses `*_token_hash TEXT` + `*_expires_at TIMESTAMPTZ`, a
      partial index `WHERE ... IS NOT NULL`, and computes the digest **in PostgreSQL** via
      `encode(sha256($2::bytea), 'hex')` — a built-in, explicitly **not** `pgcrypto` (its task
      4.3/4.4). Design D6 matches. Adopt its SQL-side digest form rather than hashing in Node, so
      the two token flows read identically. If that block has since diverged, it wins.
      — *design D6*
- [ ] 1.2 Create `client/app/privacidad.tsx`, `client/app/terminos.tsx` and
      `client/app/borrar-cuenta.tsx` as thin wrappers, mirroring the 5-line shape of
      `client/app/terms.tsx:1-5` and `client/app/debug.tsx:1-5`.
      — *public-legal-pages: Anonymous Reachability*
- [ ] 1.3 Declare all three in `client/app/_layout.tsx` as siblings of the existing
      `<Stack.Screen name="debug" />` at `:93`, **outside every `Stack.Protected`**. A guarded
      route is deleted from the navigator on hydration
      (`client/node_modules/expo-router/build/useScreens.js:123`) and would bounce a store
      reviewer to login. — *public-legal-pages: "No legal route sits behind a guard"*
  - **Checkpoint**: `client/app.json:71-73` sets `typedRoutes: true`, so adding routes regenerates
    the typed-route union. Expect churn in generated types; do not hand-edit it.
- [ ] 1.4 [RED→GREEN] Add `client/__tests__/legal-routes.test.ts`: parse
      `client/app/_layout.tsx` and assert each of `privacidad`, `terminos`, `borrar-cuenta`
      appears as a `<Stack.Screen>` whose nearest enclosing element is the root `<Stack>`, not a
      `Stack.Protected`. Reuse the file-walker helper pattern from
      `client/__tests__/brand-palette.test.ts`.
      — *public-legal-pages: "No legal route sits behind a guard"*
- [ ] 1.5 Create `client/public/serve.json` with the four ordered rewrites from design D2 — the
      three legal paths first, `**` → `/index.html` **last**. `client/public/` is copied verbatim
      into `dist/` (it already ships `manifest.json` and `sw.js`), and `serve` reads `serve.json`
      from the served directory (`serve@14 build/main.js:434-439`).
      — *public-legal-pages: Server-Agnostic Rendering, No Regression for Dynamic Routes*
- [ ] 1.6 Change `Dockerfile.web:42` to `CMD ["serve", "dist", "-l", "3000"]` (drop `-s`).
      Keeping `-s` would defeat 1.5 entirely: `--single` *prepends* its `**` rewrite
      (`serve@14 build/main.js:539-548`) and `serve-handler` skips `cleanUrls` whenever any
      rewrite matched (`serve-handler@6.1.7 src/index.js:282`).
      — *public-legal-pages: Server-Agnostic Rendering*
- [ ] 1.7 Widen the PWA/`lang` injection at `Dockerfile.web:38-39` from `dist/index.html` to every
      `dist/*.html`, so the new prerendered legal pages ship with the same `<meta>` tags and
      `lang="es"`. — *proposal Risks*
- [ ] 1.8 **Verification gate — build and curl, do not infer.** Build the web image and, against
      the running container, assert: `/privacidad`, `/terminos`, `/borrar-cuenta` each return 200
      with their own `<title>` in the raw body; `/`, `/terms`, `/debug` return 200 unchanged;
      `/listing/<uuid>` returns 200 serving the SPA shell. Design fact F8 was derived from reading
      two `node_modules` packages and MUST be confirmed against the real image before this phase
      is called done. — *public-legal-pages: all Server-Agnostic and No-Regression scenarios*
  - **If 1.8 fails**: fall back down the D3 ladder — rung 2 (`.html` URLs, works today with no
    Dockerfile change) then rung 3 (serve the pages from Express, reusing `verificationPage` at
    `server/api/src/controllers/auth.ts:187-232`). Record which rung was taken.

**Done condition**: the three URLs answer 200 anonymously with their own prerendered HTML in a
built image, no existing route regressed, and 1.4 passes.

---

## Phase 2: Legal Content and the Deletion Form

- [ ] 2.1 Create `client/content/legal/privacyPolicy.ts` with a `LEGAL-REVIEW-REQUIRED` banner
      comment and the ten named placeholders (`{{DATOS_RECOLECTADOS}}`, `{{FINALIDAD}}`,
      `{{BASE_LEGAL}}`, `{{CONSERVACION}}`, `{{TERCEROS}}`, `{{MENORES}}`, `{{DERECHOS}}`,
      `{{CONTACTO}}`, `{{JURISDICCION}}`, `{{VIGENCIA}}`). Structure only — do **not** write text
      presented as reviewed legal advice. Seed `{{CONTACTO}}` from `CONTACT_EMAIL`
      (`client/config.ts:56`, `loop@reditinere.com`). Use the deleted
      `landing/src/pages/politica-privacidad.astro` section headings as the structural starting
      point. — *public-legal-pages: Template Status Is Visible*
- [ ] 2.2 Create `client/content/legal/termsDocument.ts`: export `TERMS_VERSION` (format
      `YYYY-MM-DD`) and `buildTermsSections(communityName: string): Section[]`, reusing the
      `Section` type at `client/components/screens/Terms.tsx:9-12`. Port the existing section array
      from `Terms.tsx:30-78`, replacing the community constants at `:37` and `:76` with
      `{{COMMUNITY_NAME}}`. — *terms-acceptance: Community Name Is Dynamic*
- [ ] 2.3 Create `client/components/screens/legal/PrivacyPolicy.tsx` and
      `client/components/screens/legal/TermsDocument.tsx`. Both render the visible
      `REVISIÓN LEGAL PENDIENTE` marker while 6.6 is unsigned.
      — *public-legal-pages: Template Status Is Visible*
- [ ] 2.4 Create `client/components/screens/legal/DeleteAccountForm.tsx`: email + optional reason,
      POSTing to `POST /me/delete-request` (public, `server/api/src/index.ts:72`). Copy in voseo
      (`"Enviá esta solicitud…"`, `"Contanos por qué querés borrar la cuenta"`) — the deleted
      Astro page's `"Cuéntanos"` is tuteo and is not carried forward. The success message MUST NOT
      claim the account was found: the endpoint always answers 204 by design.
      — *public-legal-pages: Account Deletion Form, Copy Register*
- [ ] 2.5 **Decide and record**: `reason` is collected by the form but
      `server/api/src/controllers/accountDeletion.ts:18-32` reads only `email` and discards it.
      Either persist it (a column on `account_deletion_requests`,
      `server/migrations/0006_admins_invitations_deletion.sql:86-96`) or remove the field from the
      form. Silently discarding user input is not an option. — *design D8, Open Questions*
- [ ] 2.6 Fix the dead error branch at `server/api/src/controllers/accountDeletion.ts:21-23`:
      `safeValidateEmail` uses `safeParseAsync` (`server/api/src/services/validations.ts:17-22`)
      and never throws, so the `InvalidInputError` is unreachable and a malformed address flows
      into the model. Check the safe-parse result explicitly.
      — *public-legal-pages: "Malformed address gets feedback"* (proposal C8)
- [ ] 2.7 [RED→GREEN] Add a placeholder-completeness test: every one of the ten named placeholders
      is present in the privacy template and `{{MENORES}}` is non-empty.
      — *public-legal-pages: "Every placeholder is present"*
- [ ] 2.8 Manual readback at 375px and 1280px on all three pages: legible, scrollable, marker
      visible, form submits.

**Done condition**: the three pages render real content with visible template markers, the
deletion form records a request end to end, and 2.7 passes.

---

## Phase 3: Terms Acceptance

- [ ] 3.1 Create `server/migrations/0014_terms_acceptance.sql` adding
      `terms_accepted_at TIMESTAMPTZ` and `terms_version TEXT` to `users`, both nullable, via
      `ADD COLUMN IF NOT EXISTS`, with **no backfill**. Mirror the comment style and structure of
      `server/migrations/0008_email_verification.sql`. — *terms-acceptance: Acceptance Is Persisted*
- [ ] 3.2 Add the two fields to `DB_Users` (`server/api/src/types/db.d.ts:65-90`) and expose
      `termsAcceptedAt` / `termsVersion` on `PrivateUser` in `shared/types/app.d.ts`.
- [ ] 3.3 Add an `acceptTerms` query to `server/api/src/services/queries.ts` using the existing
      `q<T>("name", sql)` helper: `UPDATE users SET terms_accepted_at = NOW(), terms_version = $1
      WHERE id = $2 AND community_id = $3`. Run `npm run check-sql` to validate placeholder arity.
- [ ] 3.4 Add `POST /me/terms-acceptance` to `server/api/src/routes/self.ts` — behind the existing
      `tokenMiddleware` mount at `server/api/src/index.ts:89`, scoped
      `inCommunity(req.communityId)` per `openspec/config.yaml`. Validate the body with a new Zod
      schema in `server/api/src/services/validations.ts` following the
      `const xSchema = ...; export const validateX = (d: unknown) => xSchema.parseAsync(d)`
      convention (see `:218-240`). — *terms-acceptance: Acceptance Is Persisted Server-Side*
- [ ] 3.5 Wire `client/stores/session.ts`: derive `hasAcceptedTerms` from
      `user.termsVersion === TERMS_VERSION` rather than the local boolean at `:88-89`. Keep the
      local flag as a session-scoped fallback so a failed POST does not lock the user out
      (`:69` currently resets it on logout — proposal C6).
      — *terms-acceptance: "Acceptance survives logout", "Acceptance Failure Must Not Lock Users Out"*
- [ ] 3.6 Rewrite `client/components/screens/Terms.tsx`: consume `buildTermsSections`, pass
      `user.community.name` (`client/stores/session.ts:36-38`), POST acceptance in `handleAccept`
      (`:17-19`), and replace the `BackHandler.exitApp()` reject path at `:24-28` — it is a no-op
      in `react-native-web`, stranding browser users (proposal C7). Sign the user out with an
      explanatory message instead. — *terms-acceptance: Community Name Is Dynamic, Rejection Behaves*
- [ ] 3.7 Wire `/terminos?c=<slug>` in `client/components/screens/legal/TermsDocument.tsx` to the
      public `GET /communities/:slug` (`server/api/src/routes/communities.ts:8`). No `c`, or an
      unknown slug, falls back to the neutral label without an error screen.
      — *terms-acceptance: "Public terms resolve the community", "Unknown slug does not break the page"*
- [ ] 3.8 [RED→GREEN] Source guard: assert the literal `"Red Itinere"` appears in neither
      `client/components/screens/Terms.tsx` nor `client/content/legal/termsDocument.ts`.
      — *terms-acceptance: "No hardcoded community name remains"*
- [ ] 3.9 [RED→GREEN] API test in `server/api/src/tests/`: accepting sets both columns; a user
      with NULL `terms_version` is treated as not-accepted; a matching version is treated as
      accepted. — *terms-acceptance: Acceptance Is Persisted, Version Change Re-Prompts*
- [ ] 3.10 Run `cd server/api && npm run migrate` against a dev database, then `npm run test` and
      `npm run check-types`; compare against the phase-0 baseline.

**Done condition**: acceptance survives logout, a version bump re-prompts, the community name is
dynamic on both surfaces, and 3.8/3.9 pass.

---

## Phase 4: Signed Media URLs

- [ ] 4.1 Add config to `server/api/src/config.ts`: `MEDIA_URL_SIGNING_ENABLED` (default
      **`false`**), `MEDIA_SIGNING_SECRET`, `MEDIA_SIGNING_SECRET_PREVIOUS`,
      `MEDIA_URL_TTL_SECONDS` (default 86400), `MEDIA_URL_BUCKET_SECONDS` (default 3600). Document
      them in `.env.template`. Registering them in the env-validation schema belongs to
      `sec-hardening-api`. — *media-access-control: Rollout Is Reversible*
- [ ] 4.2 Create `server/api/src/services/mediaSigning.ts`: `signMediaUrl(filename)` returning
      `"<filename>?exp=<unix>&sig=<hex>"` and `verifyMediaSignature(filename, exp, sig)`.
      HMAC-SHA256 over `"<filename>|<exp>"`; compare with `crypto.timingSafeEqual`. `exp` is
      **bucketed** — `ceil(now / BUCKET) * BUCKET + TTL` — so the URL is byte-identical within a
      window and image caches still hit. Verification accepts the previous secret when configured.
      — *media-access-control: Signatures Expire, Signed URLs Remain Cacheable, "Secret rotation"*
- [ ] 4.3 [RED→GREEN] Unit test `server/api/src/services/mediaSigning.test.ts` (the `unit` jest
      project matches `**/services/**/*.test.ts`): valid round-trip; tampered `sig` rejected;
      tampered filename rejected; expired `exp` rejected; two calls inside one bucket produce an
      identical string; calls in different buckets differ; a previous-secret signature verifies.
      — *media-access-control: Unsigned Requests Are Refused, Signatures Expire, Remain Cacheable*
- [ ] 4.4 Modify `server/api/src/utils/parseDb.ts:101-108` (`parseMediaFromDb`) to return
      `url: signMediaUrl(row.url)` when signing is enabled, else `row.url` unchanged. This is the
      single choke point — all six callers (`utils/helpersDb.ts:56,68,129`,
      `utils/communities.ts:38`, `models/auth.ts:55`, `models/admin.ts:423`) inherit it.
      — *media-access-control: Signing Happens At The Single Serialization Point*
- [ ] 4.5 Modify `server/api/src/controllers/upload.ts:34-35` so the upload response's
      `publicUrl` is signed too — it builds its URL independently of `parseMediaFromDb`.
      — *media-access-control: "Every media-bearing response is signed"*
- [ ] 4.6 Replace `express.static(UPLOAD_DIR)` at `server/api/src/routes/uploads.ts:17` with a
      handler that verifies `exp`/`sig` and then streams the file (`res.sendFile`), 403 on any
      failure. Keep `POST /` and its `tokenMiddleware` at `:12` unchanged. When signing is
      disabled the handler passes through to the previous static behaviour.
      — *media-access-control: Unsigned Requests Are Refused, Rollout Is Reversible*
  - **Checkpoint**: preserve `Content-Type` and caching headers; a regression here degrades every
    image load in the app, not just security.
- [ ] 4.7 [RED→GREEN] API test in `server/api/src/tests/`: bare URL → 403; valid signature → 200
      with bytes; tampered sig → 403; filename swap with another file's sig → 403; expired → 403;
      flag off → bare URL returns the image. Also assert the media row whose `community_id` is
      NULL is still reachable (`server/migrations/0002_add_community_id_nullable.sql:29`).
      — *media-access-control: all Requirements*
- [ ] 4.8 **Verification gate before enabling.** With `MEDIA_URL_SIGNING_ENABLED=true` on a dev
      stack, confirm every image surface renders with **no** client or admin code change:
      client `Listing` cards (`client/components/cards/Listing.tsx:70,111`), `ImageGallery`
      (`:51`), `ProfileImage` (`:152`), `Chat` (`:122`), `ChatCard` (`:39`), `School`/`User` cards,
      `AllowedDomainsNotice` (`:67`); admin `SchoolsTable` (`:43-44`), `EditSchoolModal`
      (`:169-170`), `CreateSchoolModal` (`:171`), `CommunityFormModal` (`:216`),
      `Communities` (`:109`). — *media-access-control: "No consumer changes are required"*
- [ ] 4.9 Confirm demo mode is unaffected: `client/services/getUrl.ts:9` returns absolute URLs
      untouched, so demo fixtures bypass signing entirely. Record the check.
- [ ] 4.10 Run `cd server/api && npm run test` and `npm run check-types`; compare against baseline.

**Done condition**: unsigned and expired URLs are refused, every image still renders with the flag
on and no consumer change, URLs are cache-stable within a bucket, and the flag flips both ways
cleanly.

---

## Phase 5: Password Reset

- [ ] 5.1 Create `server/migrations/0015_password_reset.sql` adding
      `password_reset_token_hash TEXT` and `password_reset_expires_at TIMESTAMPTZ` to `users` via
      `ADD COLUMN IF NOT EXISTS`, plus a partial index
      `CREATE INDEX IF NOT EXISTS ... ON users (password_reset_token_hash) WHERE password_reset_token_hash IS NOT NULL`,
      mirroring `server/migrations/0008_email_verification.sql:16-18`. Conform to
      `db-integrity-migrations`' naming and hash algorithm per 1.1.
      — *password-reset: Token Is Hashed At Rest, Token Expires*
- [ ] 5.2 Add the two fields to `DB_Users` (`server/api/src/types/db.d.ts:65-90`) and the two
      request bodies to `shared/types/apiCalls.d.ts`.
- [ ] 5.3 Add queries to `server/api/src/services/queries.ts`: `setPasswordResetToken`
      (sets hash + expiry, overwriting any outstanding token) and `consumePasswordResetToken`
      (`UPDATE users SET password = $1, password_reset_token_hash = NULL,
      password_reset_expires_at = NULL, email_verified = TRUE WHERE password_reset_token_hash = $2
      AND password_reset_expires_at > NOW() RETURNING id`) — a single atomic statement so two
      concurrent submissions cannot both win. Run `npm run check-sql`.
      — *password-reset: Single-Use And Consumed Atomically, Successful Reset Verifies The Email*
- [ ] 5.4 Add Zod schemas to `server/api/src/services/validations.ts` following the file's
      convention: `forgotPasswordSchema { email: emailSchema }` and `resetPasswordSchema
      { token: z.string().min(1).max(200), newPassword: passwordSchema }`. Reuse `passwordSchema`
      (`:12`) and the opaque-token precedent `invitationToken: z.string().min(1).max(200)` (`:225`).
      — *password-reset: New Password Is Validated And Hashed*
- [ ] 5.5 Add `sendPasswordResetEmail({ to, token })` to `server/api/src/services/email.ts`,
      mirroring `sendVerificationEmail` (`:36-62`): inline template literal, subject in voseo
      (`"Restablecé tu contraseña - Loop"`), link built from `APP_BASE_URL`
      (`server/api/src/config.ts:62`), and the no-provider dev path that logs the link
      (`:39-43`). — *password-reset: Public Request Endpoint*
- [ ] 5.6 Add `requestPasswordReset({ email })` and `resetPassword({ token, newPassword })` to
      `server/api/src/models/auth.ts`, both using `withClient(..., { scope: unscoped("token-lookup") })`
      as `verifyEmail` does (`:305-320`). Generate the token with
      `crypto.randomBytes(32).toString("hex")` (`:173`) and store only its `sha256` digest. Send
      fire-and-forget after commit (`:250-253`). Return silently when the account does not exist.
      — *password-reset: Token Is Hashed At Rest, Public Request Endpoint*
- [ ] 5.7 Add `forgotPassword` and `resetPassword` to `server/api/src/controllers/auth.ts`.
      `forgotPassword` MUST always return 200 with a body byte-identical whether or not the
      account exists, mirroring `resendVerification` (`:147-162`).
      — *password-reset: "Unknown address is indistinguishable"*
- [ ] 5.8 Mount `POST /auth/forgot-password` and `POST /auth/reset-password` on
      `server/api/src/routes/auth.ts` (public, `server/api/src/index.ts:75`).
- [ ] 5.9 Add the client "olvidé mi contraseña" entry point from the login screen
      (`client/components/screens/Login.tsx`) and a reset screen. Decide and record whether the
      emailed link opens an app route or an API-rendered HTML page reusing `verificationPage`
      (`server/api/src/controllers/auth.ts:187-232`) — the verification flow already chose HTML so
      it works from a mail client without the app installed; prefer consistency with it.
- [ ] 5.10 [RED→GREEN] API tests in `server/api/src/tests/`: happy path; unknown email returns an
      identical 200; the DB never holds the emailed value; expired token rejected; second use
      rejected; two concurrent uses → exactly one success; a new request invalidates the old
      token; short and absent passwords rejected before hashing; `email_verified` becomes TRUE.
      Note `src/tests/auth.test.ts` has no coverage of `verify-email`/`resend-verification`
      today — do not assume a harness exists for token flows.
      — *password-reset: all Requirements*
- [ ] 5.11 **Record the hand-off explicitly** in the PR description: both endpoints are unrated
      limited and `sec-hardening-api` MUST cover them before production release. This is a release
      blocker, not a nice-to-have. — *password-reset: Rate Limiting Is Required Before Release*
- [ ] 5.12 Run `npm run migrate`, `npm run test`, `npm run check-types`; compare against baseline.

**Done condition**: a user can reset their own password by email; the token is hashed, expiring
and single-use; the hand-off to `sec-hardening-api` is recorded in the PR.

---

## Phase 6: Store Metadata and the Legal-Review Gate

- [ ] 6.1 Add `EXPO_PUBLIC_LEGAL_BASE_URL` to `client/config.ts` (default the production host,
      `Caddyfile:2-4`) and export the three legal URLs as constants.
- [ ] 6.2 Add the privacy-policy and terms URLs to `client/app.json:34-48` web metadata. Note the
      file today has no `associatedDomains`, `intentFilters` or `privacyPolicyUrl` keys — add only
      what the current Expo SDK 54 config schema accepts, and do not invent keys.
- [ ] 6.3 Link the legal pages from inside the app: at minimum from the settings screen
      (`client/app/(main)/settings.tsx`) and the register screen, so the requirement is met
      in-product as well as in the store listing.
- [ ] 6.4 Write `openspec/changes/legal-public-routes/STORE-LISTING.md`: the exact URLs to paste
      into App Store Connect and the Play Console (privacy policy URL, account-deletion URL), plus
      the Play Data Safety questions the privacy template's placeholders answer.
- [ ] 6.5 Re-run the phase-1 verification gate (1.8) against the final built image.
- [ ] 6.6 **LEGAL REVIEW GATE — blocking.** A named human (a lawyer, or the operator accepting the
      risk in writing) fills every placeholder from 2.1/2.2 and signs off. `{{MENORES}}` MUST be
      addressed — the product is used by school families. Only then remove the
      `REVISIÓN LEGAL PENDIENTE` markers and the `LEGAL-REVIEW-REQUIRED` banners. **Until 6.6 is
      signed, the store listing MUST NOT be submitted.** This task cannot be completed by an
      implementing agent. — *public-legal-pages: Template Status Is Visible*

**Done condition**: the URLs are reachable, linked in-app, recorded for the store listing, and
6.6 is either signed off or explicitly flagged as the remaining blocker.

---

## Recorded Follow-ups (explicitly deferred, not fixed here)

- **`sec-hardening-api`**: rate limit `POST /auth/forgot-password` (release blocker),
  `POST /auth/reset-password` (release blocker), `POST /me/delete-request`,
  `POST /me/terms-acceptance`.
- **`sec-hardening-api`**: add a Zod schema to `POST /admin/users/:userId/reset-password`.
  `server/api/src/controllers/admin.ts:205` applies no validation at all — the comment
  `// No hay validaciones porque es administrador` is explicit — so an `undefined` or empty
  `newPassword` reaches `hashPassword` (`server/api/src/models/admin.ts:396`). Any community
  admin, not only a super admin, can invoke it. (Proposal C3.)
- ~~`db-integrity-migrations`: the email-verification token has no expiry.~~ **Withdrawn** — that
  block's task 4.2 already adds `email_verification_expires_at` alongside the hash. No hand-off
  needed. (Proposal C5.)
- Binding `community_id` into the media signature payload as defence in depth. Not needed today —
  scoping is enforced at mint time — but it would survive a future code path that mints outside
  a community-scoped query. (Design D7.)
- Migrating uploads to object storage or a CDN. The signed-URL design is intentionally compatible
  with that move; the signing service is the seam.
- Per-user media tokens so an authorised member cannot reshare an image within its TTL. Explicit
  non-goal of SEC-08, which is about indefinite external reachability. (Design D7.)
- The `/` marketing landing deleted in `b1bd13f` is not restored. Only the three legal routes are
  added; `(auth)/index.tsx` still serves `/`.
- `Dockerfile.web` still bakes `EXPO_PUBLIC_API_URL` at build time, so the legal pages' API host
  is fixed per image. Acceptable for static legal copy; noted for the community-lookup call at 3.7.
