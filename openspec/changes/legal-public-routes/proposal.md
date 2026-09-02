# Proposal: Public Legal Routes, Password Reset and Signed Media URLs

## Intent

Loop cannot be published. Commit `b1bd13f` deleted the Astro landing that served
`landing/src/pages/politica-privacidad.astro` and `landing/src/pages/borrar-cuenta.astro`, and
nothing replaced them. Both the App Store and Google Play **require** a publicly reachable
privacy-policy URL and a publicly reachable account-deletion path; with minors in the user base
this is also a legal obligation, not only a store rule. `POST /me/delete-request`
(`server/api/src/index.ts:72`) is deliberately public and still works — it simply has no consumer
left. Meanwhile the in-app terms hardcode a single community name (`client/components/screens/Terms.tsx:37,76`)
in a product whose isolation unit is the community (`shared/types/app.d.ts:57`), and acceptance
is stored only in a device-local Zustand store (`client/stores/session.ts:88-89`) that is wiped on
logout (`client/stores/session.ts:69`) — so there is no traceability of who accepted what, when.

Two adjacent audit findings ride along because they share the same surfaces: there is no
self-service password reset (SEC-11), and uploaded media is served by a bare `express.static`
mount with no authorisation at all (SEC-08).

## Scope

### In Scope

- **ADM-01 / PROD-05** — public web routes `/privacidad`, `/terminos`, `/borrar-cuenta` served by
  the Expo web client, reachable with no session, plus the serving-layer fix that makes
  per-route prerendered HTML actually reach the browser (see "Corrections to the audit", C4).
- Legal copy as a **clearly-marked template with placeholders** — structure only, not
  lawyer-reviewed text (see "Legal-text limit" below).
- `terms_accepted_at` + `terms_version` persisted per user (migration + API + client wiring).
- Community name rendered dynamically in the terms instead of the `Terms.tsx:37,76` constant.
- Store-listing wiring: `expo.web` / `app.json` metadata pointing at the published URLs.
- **SEC-11** — self-service password reset by email, with a **hashed, expiring** token, reusing
  `server/api/src/services/email.ts`.
- **SEC-08** — authorisation for `GET /uploads/*`, currently unauthenticated at
  `server/api/src/routes/uploads.ts:17`.

### Out of Scope

- Env validation, `helmet`, rate limiting and the admin Zod schemas — owned by `sec-hardening-api`.
  This change **hands off** two new endpoints that need rate limiting (see Dependencies).
- Hashing the **email-verification** token (SEC-10) — owned by `db-integrity-migrations`.
  This change adds its own, different token and follows the same shape so the two stay consistent.
- Hardening `POST /admin/users/:userId/reset-password`. Its complete absence of validation
  (`server/api/src/controllers/admin.ts:205`) is recorded in "Corrections to the audit" (C3) and
  handed to `sec-hardening-api`, which owns the admin Zod schemas.
- Rewriting the marketing landing page (`/`). Only the three legal routes are added.
- Migrating uploads to object storage / a CDN. Signed URLs are designed to survive that move.
- Any i18n layer. The client has none (verified: no `i18n`/`intl` imports anywhere in `client/`).

### Legal-text limit (explicit)

The privacy policy and terms shipped by this change are a **template**, not legal advice, and are
not fit to publish as-is. Every artifact and every rendered page MUST carry a visible
`REVISIÓN LEGAL PENDIENTE` marker and the file MUST carry a `LEGAL-REVIEW-REQUIRED` banner
comment. The template supplies the *structure* and named placeholders only:

`{{DATOS_RECOLECTADOS}}`, `{{FINALIDAD}}`, `{{BASE_LEGAL}}`, `{{CONSERVACION}}`,
`{{TERCEROS}}`, `{{MENORES}}`, `{{DERECHOS}}`, `{{CONTACTO}}`, `{{JURISDICCION}}`,
`{{VIGENCIA}}`, `{{COMMUNITY_NAME}}`.

A human — a lawyer, or the operator accepting the risk in writing — MUST fill and review those
placeholders before the pages are published or the store listing is submitted. Task 6.6 is the
gate: the change is not deliverable to a store until it is signed off. `MENORES` is the
highest-risk placeholder: the product is used by school families, so a minors clause is
mandatory, and the drafting of it is explicitly not something this change performs.

## Capabilities

### New Capabilities

- `public-legal-pages` — anonymous reachability, URL contract, and rendering guarantees for
  `/privacidad`, `/terminos`, `/borrar-cuenta`.
- `terms-acceptance` — server-side record of which terms version a user accepted and when, and
  the multi-community rendering rule for the terms body.
- `password-reset` — self-service reset with a hashed, single-use, expiring token.
- `media-access-control` — authorisation contract for `GET /uploads/*`.

### Modified Capabilities

- None. `openspec/specs/` is empty; `sec-hardening-api` and `db-integrity-migrations` are
  unarchived siblings on the same branch and are not edited here.

## Approach

**Hosting — Expo Router, and it genuinely works.** `client/app.json:36` already sets
`"output": "static"`, so `expo export --platform web` prerenders one real HTML file per route
(`client/node_modules/@expo/cli/build/src/export/exportStaticAsync.js:331` — `const filePath = filePathLocation + '.html'`).
The auth guard is not a redirect: `client/app/_layout.tsx:76-94` uses `Stack.Protected`, and a
failing guard *deletes* the screen from the navigator
(`client/node_modules/expo-router/build/useScreens.js:123`). `client/app/debug.tsx` is the working
precedent for an anonymous route — it is declared at `client/app/_layout.tsx:93`, outside every
`Stack.Protected`. The three legal routes follow that exact shape.

**But the serving layer currently defeats it — and that is a pre-existing defect (C4).**
`Dockerfile.web:42` runs `serve -s dist`. `-s` *prepends* a `**` → `/index.html` rewrite
(`serve@14 build/main.js:539-548`), and `serve-handler@6.1.7 src/index.js:282` skips the
`cleanUrls` `.html` candidate list whenever any rewrite matched. So today **every** extensionless
deep link is served `dist/index.html` and the correct page only appears after the JS bundle
hydrates. The fix is a `client/public/serve.json` with explicit rewrites ordered before the
catch-all, and dropping `-s`. This keeps dynamic deep links (`/listing/<id>`) working while
serving real prerendered HTML for the legal routes — which is exactly what a store reviewer
opening the URL in a plain browser needs.

**Terms text.** One shared data module holds the section array with `{{COMMUNITY_NAME}}`.
`client/components/screens/Terms.tsx` interpolates `user.community.name`; the public
`/terminos` page interpolates the community resolved from `?c=<slug>` via the already-public
`GET /communities/:slug` (`server/api/src/routes/communities.ts:8`), falling back to a neutral
label when absent. This removes the `Terms.tsx:37,76` constants without inventing a session.

**Password reset.** Mirrors the email-verification flow (`server/api/src/models/auth.ts:173-175`,
`341`) but fixes its two weaknesses: the reset token is stored **sha256-hashed** and carries
`password_reset_expires_at`. Same `crypto.randomBytes(32)` generation, same
`unscoped("token-lookup")` scope, same always-200 anti-enumeration response shape as
`resendVerification` (`server/api/src/controllers/auth.ts:147-162`).

**Uploads.** Signed URLs with expiry, generated at the single serialization choke point
`server/api/src/utils/parseDb.ts:101` (`parseMediaFromDb`). Rationale and rejected alternatives are
in `design.md` D7 — the short version is that both the client and the admin render these URLs in
`Image`/`<img>` tags, so an `Authorization` header is structurally impossible, and signing at
`parseMediaFromDb` requires **zero** client and admin changes because
`client/services/getUrl.ts:6` and `adminClient/src/services/getUrl.ts:3` simply concatenate
whatever string the API returned.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/app/privacidad.tsx`, `terminos.tsx`, `borrar-cuenta.tsx` | New | The three public routes |
| `client/app/_layout.tsx:93` | Modified | Declare the three screens outside every `Stack.Protected` |
| `client/components/screens/legal/` | New | `PrivacyPolicy`, `TermsDocument`, `DeleteAccountForm` |
| `client/content/legal/` | New | Template copy + placeholders, `LEGAL-REVIEW-REQUIRED` banner |
| `client/components/screens/Terms.tsx:30-78` | Modified | Consume the shared document; drop the `:37,76` constants |
| `client/public/serve.json` | New | Ordered rewrites so prerendered HTML is served |
| `Dockerfile.web:38-39,42` | Modified | Drop `-s`; stop `sed`-ing only `dist/index.html` |
| `client/app.json:34-48` | Modified | Legal URLs in web metadata |
| `client/stores/session.ts:88-89` | Modified | Terms acceptance sourced from the server |
| `server/migrations/0014_terms_acceptance.sql` | New | `terms_accepted_at`, `terms_version` |
| `server/migrations/0015_password_reset.sql` | New | Hashed token + `expires_at` + partial index |
| `server/api/src/routes/auth.ts` | Modified | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| `server/api/src/routes/self.ts` | Modified | `POST /me/terms-acceptance` |
| `server/api/src/services/email.ts` | Modified | `sendPasswordResetEmail` |
| `server/api/src/services/mediaSigning.ts` | New | HMAC sign/verify with bucketed expiry |
| `server/api/src/utils/parseDb.ts:101-108` | Modified | Sign `media.url` at the single choke point |
| `server/api/src/routes/uploads.ts:17` | Modified | Signature-verifying handler replaces bare static |
| `server/api/src/controllers/upload.ts:34-35` | Modified | Sign the upload response URL too |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Legal template published without human review | **High** | Visible `REVISIÓN LEGAL PENDIENTE` marker on-page; task 6.6 is a hard gate; proposal states the limit |
| Dropping `serve -s` 404s a route that used to fall back | Med | `**` catch-all stays last in `serve.json`; task 1.5 enumerates and curls every existing top-level route |
| Signed URLs break every image at once | **High impact** | `MEDIA_URL_SIGNING_ENABLED` env flag, default off until 4.7 passes; verify-then-enable ordering in phase 4 |
| Signed URLs bust the browser/image cache on every response | Med | Expiry is bucketed (D7), so the URL is byte-identical within a window and caches still hit |
| `MEDIA_SIGNING_SECRET` rotation invalidates cached URLs mid-session | Low | Accept two secrets (current + previous) during rotation; documented in D7 |
| Password-reset endpoint becomes an email-bombing vector | **High** | Always-200 response; hand-off to `sec-hardening-api` for rate limiting is a **release blocker**, recorded in Dependencies |
| Migration numbering collides with `db-integrity-migrations` | Med | Migrations are checksum-immutable (`server/api/src/scripts/migrate.ts:224-233`); task 1.1 re-reads the sibling block's directory and renumbers before writing |
| Terms version bump silently re-prompts every user | Med | `TERMS_VERSION` is an explicit constant; changing it is a deliberate act, documented in D4 |
| Community `?c=<slug>` becomes a community-enumeration oracle | Low | `GET /communities/:slug` is already public and already exposes only `id/slug/name/theme/media/active` (`server/api/src/controllers/communities.ts:12-21`) |
| Prerendered legal HTML ships without the PWA/`lang` tags | Low | `Dockerfile.web:38-39` currently `sed`s only `dist/index.html`; task 1.6 widens it to every `dist/*.html` |

## Rollback Plan

- **Serving layer** — delete `client/public/serve.json` and restore `-s` in `Dockerfile.web:42`.
  One image rebuild; reverts to today's hydrate-then-route behaviour.
- **Signed URLs** — set `MEDIA_URL_SIGNING_ENABLED=false`. `parseMediaFromDb` returns the bare
  filename and `routes/uploads.ts` skips verification. No data migration, no redeploy of clients.
- **Migrations** — both are additive `ADD COLUMN IF NOT EXISTS`. Rollback is leaving the columns
  in place unused; never edit an applied migration (`server/api/src/scripts/migrate.ts:224-233`).
- **Public routes** — deleting the three files under `client/app/` and their `_layout.tsx`
  declarations restores the previous route table exactly.
- **Terms acceptance** — the client falls back to the local `hasAcceptedTerms` flag if
  `POST /me/terms-acceptance` fails, so a server rollback degrades to today's behaviour.

## Dependencies

### Hand-offs to `sec-hardening-api` (that block implements, this one does not)

1. **`POST /auth/forgot-password` MUST be rate limited** — per-IP and per-email. Unlimited, it is
   an email-bombing and cost amplification vector against Resend, and mail send is
   fire-and-forget (`server/api/src/models/auth.ts:250-253`) so nothing back-pressures it.
   **This is a release blocker: the endpoint must not ship to production unrated-limited.**
2. **`POST /auth/reset-password` MUST be rate limited** — per-IP, to blunt token brute force.
   The token is 32 random bytes so brute force is not the primary threat, but the endpoint
   performs a bcrypt hash per call and is therefore a CPU-exhaustion vector.
3. `POST /me/terms-acceptance` and `POST /me/delete-request` SHOULD be included in the general
   authenticated/public limiter tiers respectively.
4. `POST /admin/users/:userId/reset-password` needs a Zod body schema — see C3. Today
   `newPassword` reaches `hashPassword` completely unvalidated.

### Relationship to `db-integrity-migrations`

That block hashes the **email-verification** token (SEC-10). This block's **password-reset**
token is a different credential in a different column. `openspec/changes/db-integrity-migrations/`
did not exist when this was planned, so the pattern here is derived from
`server/migrations/0008_email_verification.sql` directly:

- `crypto.randomBytes(32).toString("hex")` sent to the user, `sha256` hex digest stored.
- A companion `*_expires_at TIMESTAMPTZ` column, checked in the same `UPDATE ... WHERE ... RETURNING`.
- A partial index on the hash column, `WHERE <col> IS NOT NULL`.

Task 1.1 requires re-reading that block's artifacts before writing, and adopting its column
naming and hash algorithm if they differ. If the two blocks disagree, `db-integrity-migrations`
wins and this block conforms.

### Environment / operational

- New env vars: `MEDIA_SIGNING_SECRET` (required when signing is on),
  `MEDIA_URL_SIGNING_ENABLED`, `MEDIA_URL_TTL_SECONDS`, `TERMS_VERSION`,
  `EXPO_PUBLIC_LEGAL_BASE_URL`. Registering them in the env-validation schema is
  `sec-hardening-api`'s job; declaring and defaulting them is this block's.
- `RESEND_API_KEY` must be set in production or password reset silently no-ops
  (`server/api/src/services/email.ts:15-18` warns and returns `null`).
- Migrations run via `npm run migrate` from `server/api/` (`server/api/package.json:19`).

## Size Forecast and Delivery

Forecast **~1300 changed lines**, above the 800-line session budget. Session preflight selected
`single-pr` / `exception-ok`, so this ships as **one PR on `fix/auditoria-2026-09`** under that
exception rather than as a chain. The justification is coupling, not size: the store submission is
a single atomic deliverable — a privacy URL without a deletion URL is still a rejected build — and
the signed-URL work shares `parseMediaFromDb` and `routes/uploads.ts` with nothing else in the
audit. The six phases in `tasks.md` are ordered so each is independently revertible, which
recovers most of the reviewability a chain would have bought.

## Success Criteria

- [ ] `curl -sS https://loop.reditinere.com/privacidad` returns HTTP 200 with the privacy page's
      own `<title>` in the raw HTML body, with no cookie, no token, and no JavaScript executed.
- [ ] The same holds for `/terminos` and `/borrar-cuenta`.
- [ ] `/borrar-cuenta` submits an email to `POST /me/delete-request` and a row appears in
      `account_deletion_requests` (`server/migrations/0006_admins_invitations_deletion.sql:86-96`).
- [ ] `curl https://loop.reditinere.com/listing/<uuid>` still returns 200 (no regression from
      dropping `serve -s`).
- [ ] Every rendered legal page shows a `REVISIÓN LEGAL PENDIENTE` marker until 6.6 is signed off.
- [ ] `/terminos?c=red-itinere` renders "Red Itínere"; `/terminos?c=<other>` renders that
      community's name; `grep -c "Red Itinere" client/components/screens/Terms.tsx` returns 0.
- [ ] Accepting the terms in-app writes `users.terms_accepted_at` and `users.terms_version`;
      logging out and back in does not re-prompt.
- [ ] A password-reset link works exactly once, is rejected after `PASSWORD_RESET_TTL`, and the
      DB column never contains the value that was emailed.
- [ ] `GET /uploads/<uuid>.webp` with no signature returns 403; with a valid signature returns the
      image; with an expired signature returns 403.
- [ ] Every image in the client and the admin still renders with `MEDIA_URL_SIGNING_ENABLED=true`.
- [ ] `cd server/api && npm run test` shows no new failures versus the pre-change baseline
      (the suite is known partially red — see `openspec/config.yaml`, INF-06).
- [ ] `cd server/api && npm run check-types` is clean.

## Corrections to the audit

**C1 — `express.static` is not at `index.ts:97`.** `server/api/src/index.ts:97` is
`app.use("/uploads", trimBody, uploadsRouter)`. The unauthenticated static mount is
`server/api/src/routes/uploads.ts:17` (`uploadsRouter.use("/", express.static(UPLOAD_DIR))`).
The finding is correct; the citation is off by one file.

**C2 — upload filenames are not guessable.** `server/api/src/services/uploads.ts:41` uses
`randomUUID()` from `node:crypto` and always re-encodes to `.webp`. The exposure is therefore
**leaked or shared URLs, plus cross-community access by anyone who obtains a filename** — not
enumeration. SEC-08's severity as written ("any leaked URL is reachable from outside the
community, forever") is accurate; the "forever" is the operative word and is what expiry fixes.

**C3 — the admin password reset is worse than described.** SEC-11 says it "sets the password in
cleartext via the request body". True, but `server/api/src/controllers/admin.ts:205` carries the
comment `// No hay validaciones porque es administrador` and applies **no schema at all** — not
even `passwordSchema` (min 6), which exists at `server/api/src/services/validations.ts:12`. An
`undefined` or empty `newPassword` reaches `hashPassword` (`server/api/src/models/admin.ts:396`).
Any community admin, not only a super admin, can invoke it. Handed to `sec-hardening-api`.

**C4 — new finding, not in the audit: `serve -s` shadows every prerendered route.**
`client/app.json:36` is `"output": "static"`, so `expo export` already produces
`dist/privacidad.html`-style files — but `Dockerfile.web:42`'s `-s` flag prepends a `**` →
`/index.html` rewrite (`serve@14 build/main.js:539-548`), and `serve-handler@6.1.7 src/index.js:282`
skips `cleanUrls` resolution whenever a rewrite matched. **Today every extensionless deep link is
served `dist/index.html`.** Without fixing this, "the legal page is an Expo route" would be true
in the router and false in the browser's first paint. This is a pre-existing production defect
that also affects `/listing/<id>` SEO and share previews.

**C5 — new finding: the email-verification token has no expiry.**
`server/migrations/0008_email_verification.sql:8-10` adds `email_verification_token TEXT` with no
companion timestamp, and `server/api/src/services/queries.ts:68-74` matches it in plaintext with
no time bound. `db-integrity-migrations` owns hashing it (SEC-10); the **missing expiry** appears
to be owned by nobody. Flagged for that block.

**C6 — new finding: `hasAcceptedTerms` is destroyed on logout.**
`client/stores/session.ts:88` defaults it to `false` and `:69` resets it on logout. There is no
`partialize` on the store, so it persists with the session and dies with it. Every logout re-prompts
the terms. Fixed as a side effect of moving acceptance to the server.

**C7 — new finding: rejecting the terms does nothing on web.**
`client/components/screens/Terms.tsx:24-28` calls `BackHandler.exitApp()`, which is a no-op in
`react-native-web`. A user who presses "Rechazar" in a browser stays on the terms screen with no
feedback. Fixed in task 3.6.

**C8 — new finding: dead error branch in the deletion controller.**
`server/api/src/controllers/accountDeletion.ts:21-23` wraps `safeValidateEmail` in `try/catch`,
but `safeValidateEmail` uses `safeParseAsync` and never throws
(`server/api/src/services/validations.ts:17-22`). The `InvalidInputError` is unreachable and a
malformed email flows into the model. Harmless today (the lookup misses) but it means
`/borrar-cuenta` will get a 204 for a typo'd address with no feedback. Fixed in task 2.4.

**C9 — the audit's fix suggestion "or a minimal landing" is not needed.** The Expo web client
already builds static per-route HTML. Re-adding an Astro package would duplicate the build,
the theme and the deploy. Rejected in D1.
