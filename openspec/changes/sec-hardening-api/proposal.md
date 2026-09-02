# Proposal: API Security and Configuration Hardening

## Intent

The API ships a public default signing secret (`config.ts:22`, `JWT_SECRET = "jwt_secret_dev"`), signs
user and admin tokens with that same secret (`services/jwt.ts:30,60`), validates no environment
variable at boot, rate-limits nothing, and answers login with three distinguishable outcomes that
enumerate accounts. A deploy that forgets one variable starts silently and anyone can forge an
`admin_token` carrying `adminRole: "super_admin"`.

This change closes the production-hardening front of `AUDITORIA-2026-09.md` §3: it makes the process
refuse to start in production without its secrets, separates the admin signing key, puts `helmet` and
per-route rate limiting in front of the abusable endpoints, removes the account-enumeration oracles,
adds the missing Zod schemas on the unvalidated admin endpoints, and cleans a set of small
low-risk defects (unawaited push notifications, `ORDER BY` interpolation, PII in logs, `StepRequired`
answering `200`).

It consolidates audit roadmap items §9 Fase 0.1, 0.4 and 0.7 into one change on one branch, because
they share the same files (`config.ts`, `index.ts`, `services/validations.ts`) and splitting them
would mean three sequential rewrites of the same three files.

## Scope

### In Scope

Audit IDs **SEC-01, SEC-02, SEC-03, SEC-04, SEC-06 (partial), SEC-07, SEC-12, SEC-13, SEC-15,
SEC-16, INF-11**.

- **SEC-01** — Zod schema over `process.env`, evaluated synchronously before `app.listen`. Production
  aborts on missing `JWT_SECRET`, `ADMIN_JWT_SECRET`, `DB_APP_PASSWORD`, `DB_UNSCOPED_PASSWORD`,
  `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `WEB_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID`. The
  `jwt_secret_dev` default and the `DB_PASSWORD` → `"loop_app_dev"` fallback chain are removed from
  the production path. Dev and test stay permissive with warned defaults.
- **SEC-02** — `ADMIN_JWT_SECRET`, distinct from `JWT_SECRET`, with separate sign/verify functions
  and an explicit `algorithms: ["HS256"]` allowlist on verify.
- **SEC-03** — `helmet`; `express-rate-limit` on `/auth/*`, `/admin/login`, `/admin/register`,
  `/me/delete-request`, `/messages`; one uniform `INVALID_CREDENTIALS` answer for every login failure
  mode, with a dummy bcrypt comparison so the miss path costs the same as the hit path; password
  minimum 8 **on password-creation paths only**.
- **SEC-04** — Google `audience` becomes an explicit array of the configured client IDs, and the
  env schema guarantees it is never `undefined` in production (see Corrections — this is not the
  defect the audit describes).
- **SEC-06 (partial)** — remove `password` from `updateSelfSchema`; validate `newPassword` with
  `passwordSchema` in change-password. Session invalidation is **out of scope** (see below).
- **SEC-07** — Zod schemas for `modifyUserCredits`, `resetUserPassword`, `sendNotification`,
  `createSchool`, `updateSchool`.
- **SEC-12** — `await` + `try/catch` + log in `sendPushNotification`.
- **SEC-13** — `ORDER BY` built from SQL constants instead of string interpolation; `%`/`_` escaped
  in `LIKE`; `trimBody` made recursive.
- **SEC-15** — `StepRequired` answers `409`; `GET /health` doing `SELECT 1` plus an RLS check;
  explicit `limit` on `express.json()`; `/status` stops echoing `NODE_ENV`.
- **SEC-16** — PII removed from `services/email.ts` logs (never the recipient, never the verification
  link); bounded `page`/`limit`; `comparePasswords` guarded for the Google-created admin;
  `TOKEN_EXP`/`ADMIN_TOKEN_EXP` coerced to numbers.
- **INF-11** — one complete root `.env.template` generated from the SEC-01 schema; `FRONTEND_URL`,
  `ADMIN_FRONTEND_URL`, `DB_APP_*`, `DB_UNSCOPED_*` documented; `PORT`/`API_PORT` reconciled;
  `POSTGRES_PORT` actually honored; `git rm --cached client/.env`.

### Out of Scope

Explicitly owned by other blocks of `AUDITORIA-PROGRESO.md`:

- **SEC-05** (`users.email` UNIQUE), **SEC-09** (`REVOKE` on non-RLS tables), **SEC-10** (hashed +
  expiring email-verification token) — block `db-integrity-migrations`. All three need a migration
  under `server/migrations/`, and this change adds none.
- **SEC-08** (authenticated uploads) and **SEC-11** (forgot-password flow) — block
  `legal-public-routes`.
- **SEC-14** — covered by SEC-01 here; the `sameSite: "lax"` evaluation it also suggests is not taken
  up, because front and API do not share a site today.
- Every ECO, CLI, ADM and remaining INF id.

Deliberately excluded from this change even though adjacent:

- **Session invalidation on password change (the rest of SEC-06).** It needs a `password_changed_at`
  column — that is a migration, and migrations belong to `db-integrity-migrations`. It also needs the
  token payload to carry a password epoch, which means changing `middlewares/parseToken.ts:69-86`,
  the branch that today silently re-issues a fresh 30-day token to any holder of a legacy token. A
  mistake there logs out or fails to log out every user at once. Judged **not** low-risk, so it is
  recorded as a follow-up for `db-integrity-migrations` rather than smuggled in here.
- **Uploads access control**, **`admin_valid_emails` hardcoded personal address**
  (`database_creation.sql:160`), and the **v1 token fallback retirement date**
  (`parseToken.ts:20-45`) — recorded, not fixed.
- **Fixing the client-side (Expo) password minimum.** Block `client-critical-fixes` owns it; the API
  answers `400` with a mapped message in the meantime.

## Corrections to the Audit

Every claim below was read in the code. Where the audit is wrong, the specs follow the code.

### C1 — Three cited paths do not exist as written

`validations.ts`, `queries.ts` and `postgresClient.ts` are under `server/api/src/services/`, not
`server/api/src/`. Every **line number** the audit cites is correct; only the directory is wrong.

### C2 — SEC-04 is materially misstated: `audience` is already passed

The audit says "Verificación de Google sin `audience`". It is passed, at `models/auth.ts:365-368`
and `models/admin.ts:216-219`. The real defect is conditional and was confirmed in the installed
library (`google-auth-library` 10.5.0,
`server/api/node_modules/google-auth-library/build/src/auth/oauth2client.js:775`):

```js
if (typeof requiredAudience !== 'undefined' && requiredAudience !== null) {
```

- `audience: undefined` or `null` → the `aud` check is **skipped entirely**; any Google-signed ID
  token from any OAuth client in the world verifies.
- `audience: ""` → **fails closed** (`""` is neither `undefined` nor `null`, so it reaches the strict
  compare at `:784` and throws at `:787`).

So the vulnerability is not a missing argument, it is that `WEB_GOOGLE_CLIENT_ID` (`config.ts:31`)
and `ADMIN_GOOGLE_CLIENT_ID` (`config.ts:28`) have no default and no startup assertion. **SEC-04 is
therefore mostly a consequence of SEC-01**, and the primary fix is the env schema. Signature and
issuer checks always run, so this permits token *substitution*, not forgery.

### C3 — Passing all four client IDs to both verifiers would create a privilege escalation

The task framing says to pass "web, admin, android, ios" as `audience`. Doing that on the **admin**
verifier (`models/admin.ts:218`) would let an ID token minted for the *end-user* Expo app authenticate
against the admin panel, with only the email allowlist left as a barrier. The specs therefore split
the audiences:

- `/auth/google-login` accepts `[WEB, ANDROID, IOS]` — the three end-user clients.
- Admin Google login accepts `[ADMIN]` only.

This also finally gives `ANDROID_GOOGLE_CLIENT_ID` / `IOS_GOOGLE_CLIENT_ID` a consumer; the audit
correctly notes at `config.ts:29-30` that they are read and never used.

### C4 — The login enumeration has a third oracle the audit does not list

Besides `USER_NOT_FOUND` (`models/auth.ts:270`) and `INVALID_CREDENTIALS` (`:278`), there is
`INCORRECT_LOGIN_METHOD` at `:272-274`, which tells an unauthenticated caller that the address exists
*and* is a Google-only account. Additionally `models/admin.ts:162,166` throws `InvalidInputError`
(HTTP 400) where `models/auth.ts` throws `UnauthorizedError` (401), and passes no `errorCode` at all.
All three outcomes are unified, on both endpoints.

### C5 — SEC-16's `page` claim is inverted

The audit asks for a maximum on `page` (`services/validations.ts:263`). The schema is
`page: z.number().min(1).optional()` — unbounded above, correct. The genuinely broken field is the
next line, `limit: z.string().min(1).optional()` (`:264`): it is typed as a **string**, has no bound,
and is **never consumed** — page size is the constant `PAGE_SIZE = 10` (`config.ts:156`). Also,
`page` arrives through `safeNumber` (`utils/safeNumber.ts:1-4`), so `Infinity` passes both
`safeNumber` and `z.number().min(1)` and reaches `(page - 1) * PAGE_SIZE` at `models/listings.ts:65`
and `models/admin.ts:312`. And `controllers/admin.ts:167` bypasses Zod entirely with
`page: page ? Number(page) : 1`. The spec bounds `page`, makes `limit` a coerced bounded integer that
is actually honored, rejects non-finite values, and routes the admin path through the schema.

### C6 — SEC-13 cites one wrong line and overstates the risk

`queries.ts:840` is a `LIKE` site (`adminSearchUsers`), not an `ORDER BY` site. The three
interpolation sites are `:327`, `:387`, `:568`. The risk is also lower than "SQL injection": there are
already **two** allowlist layers — the Zod enums at `services/validations.ts:13-14` and the map lookup
in `utils/sortOptions.ts:14-21`, where `getSortValue` falls back to `created_at` and `getOrderValue`
collapses to the literals `asc`/`desc`. No injection is reachable today. The change is defence in
depth: the guarantee currently lives in three separate call sites (`models/listings.ts:53-55`,
`models/self.ts:170-173`, `models/users.ts:29-32`) and a fourth caller passing a raw string would
compile fine, because the query factories type `sort` as a bare `string` (`:309`, `:353`).

### C7 — SEC-15's `express.json()` limit is explicitness, not a hole

`index.ts:43` calls `express.json()` with no options, so Express's **default 100kb** limit already
applies. Setting it explicitly is worth doing, but no unbounded-body vulnerability exists today. The
audit's phrasing implies otherwise.

### C8 — SEC-16's two "(a confirmar)" items are both confirmed, with exact mechanisms

- **`comparePasswords(x, null)` → 500: confirmed, and narrower than stated.**
  `services/hash.ts:8-10` has no null guard, but two of the three call sites already guard it
  (`models/auth.ts:272-274`, `models/self.ts:462-465`). Only `models/admin.ts:161-164` is unguarded,
  so a Google-created admin attempting password login gets a 500. The fix is one call site plus a
  defensive guard in `hash.ts`.
- **`TOKEN_EXP` as a numeric string: confirmed, and it is a live 30-day → 43-minute bug.**
  `config.ts:23` defaults to the **number** `2592000`, but any env-supplied value is a **string**.
  `services/jwt.ts:31` passes it as `expiresIn` behind an `as number` type assertion that converts
  nothing. `jsonwebtoken` 9.0.2 (`lib/timespan.js:6-13`) routes strings through `ms` 2.1.3, whose unit
  defaults to **milliseconds** (`ms/index.js:60`). So `TOKEN_EXP=2592000` yields 43.2 minutes, not 30
  days, and fails silently. `ADMIN_TOKEN_EXP` has the identical trap. Separately,
  `config.ts:143` hardcodes the cookie `maxAge` to 30 days regardless of `TOKEN_EXP`, so the cookie
  and the token can already disagree.

### C9 — INF-11's `PORT` vs `API_PORT` is not a naming nit

The API listens on `PORT` (`config.ts:21`, `index.ts:128`), and **nothing in the repository ever sets
`PORT`**. `API_PORT` appears in both templates and all four compose files and is never read by
application code. So the API always binds the `config.ts:21` default of 3000, and setting `API_PORT`
to anything else only remaps the host side of the publish while the container side stays pinned at
3000 — silently breaking the mapping rather than moving the port. "Reconcile" therefore means
choosing one variable and making the compose port and the listen port move together.

### C10 — The SEC-01 required-variable list is incomplete, and production `NODE_ENV` is not guaranteed

`ADMIN_PASS_TOKEN` (`config.ts:24`) is a fourth secret the audit's list omits. Separately, the whole
production abort is conditioned on `NODE_ENV === "production"`, but `Dockerfile.api:68`
(`CMD ["node", "dist/index.js"]`) sets **no `NODE_ENV`**; only `compose.yml:22` does. An image run
outside that compose file would skip every production guard. The spec pins `ENV NODE_ENV=production`
in the image's production stage.

### C11 — `assertDbHardening()` does not actually gate startup

`index.ts:120-125` calls it fire-and-forget (`.catch(...)`, not awaited) while `index.ts:128` calls
`app.listen` unconditionally, so the server accepts traffic before the check resolves and
`process.exit(1)` lands late. The new env validation must be **synchronous and before `listen`**, and
this change also awaits the DB hardening check in production.

### C12 — Changing `StepRequired` to a 4xx repairs a latent client bug

`StepRequired` has exactly one throw site, `models/auth.ts:434-439` (`SCHOOL_IDS_REQUIRED`), and
`middlewares/errors.ts:44-51` answers it with HTTP 200. On the client,
`hooks/useGoogleLogin.ts:10-12` detects `success: false` and throws `{ message, errorCode }` —
**dropping `data`**. That plain object takes the non-Axios branch of `parseApiError`
(`client/services/errors.ts:78-87`), which returns no `data` field, so
`GoogleSignInButton.tsx:96`'s `error?.data?.community` is **already always `undefined`** and the
server-resolved community is silently discarded today.

Answering `409` instead moves the response to the Axios branch
(`client/services/errors.ts:71-77`), which does return
`data: tryParseJson(err.response?.data)?.data`. So the fix preserves the `SCHOOL_IDS_REQUIRED`
branch, keeps `parseErrorName` working (`errors.ts:8-13` maps 409 → `ConflictError`), and restores
the community pre-resolution as a side effect. `409` is chosen over `400` so the case stays
distinguishable from ordinary form-validation errors. No `adminClient` or `e2e` code references
`STEP_REQUIRED`, so nothing else observes the change.

### C13 — A blanket password minimum of 8 would lock existing admins out

`services/validations.ts:361,371` applies `z.string().min(6).max(100)` to the admin **login** schema.
Raising that to 8 would deny login to every admin whose current password is 6 or 7 characters. The
user login schema is already correct in this respect (`:232`, `z.string().max(100)`, no minimum). The
spec therefore raises the minimum on password-**creation** paths only — registration, change-password,
admin register, admin reset — and explicitly forbids raising it on any login schema.

### C14 — Block ownership in `AUDITORIA-PROGRESO.md` is incomplete

`AUDITORIA-PROGRESO.md:11` lists block A without **SEC-04**, which this change implements, and
**SEC-08** is assigned to no block at all in that table (the roadmap defers it to Fase 5). Worth
reconciling when the block is closed.

## Capabilities

### New Capabilities

`openspec/specs/` is empty, so all four are new.

- `runtime-configuration`: the boot-time environment contract — what is required where, what may
  default, how the process refuses to start, and how numeric and port variables are handled.
- `authentication-hardening`: key separation, token issuance/verification, uniform login responses,
  Google audience binding, and password policy.
- `api-surface-hardening`: transport headers, rate limiting, input validation at the untrusted edge,
  SQL construction, and log hygiene.
- `operational-endpoints`: `/health`, `/status`, and the HTTP status contract for `StepRequired`.

### Modified Capabilities

- None.

## Approach

**Env validation — one schema, three severities.** A new `server/api/src/env.ts` holds a Zod schema
over `process.env` and exports a parsed, typed object. `config.ts` re-exports from it so no call site
churns. Variables fall into three classes: *always required* (a handful with safe defaults),
*required in production only* (the eight secrets and URLs), and *optional*. In production a failure
throws before `app.listen`; in dev and test the same failure logs one warning per variable and uses a
clearly-marked default, so `docker-compose.dev.yml` and `docker-compose.e2e.yml` keep working
untouched in that respect. `.env.template` is generated from the same schema so it cannot drift.

**Rate limiting must not key on `NODE_ENV`.** The e2e stack runs the API with
`NODE_ENV: development` (`docker-compose.e2e.yml:73`), not `test` — there is no test flag anywhere,
and `scripts/run-e2e.sh` exports no environment at all. So gating the limiter on `NODE_ENV` would
either leave it untested or break the suite. Instead an explicit `RATE_LIMIT_ENABLED` variable
(default `true`, and `true` in production regardless) is set to `false` in `docker-compose.e2e.yml`.
The suite is serial (`playwright.config.ts:6-7`, `workers: 1`) and issues on the order of hundreds of
requests from a single container IP, so a per-IP limiter would otherwise trip it. A dedicated
unit test exercises the limiter directly so turning it off in e2e costs no coverage.

**Uniform login.** Both `models/auth.ts:259-296` and `models/admin.ts:158-171` collapse
`USER_NOT_FOUND`, `INCORRECT_LOGIN_METHOD` and `INVALID_CREDENTIALS` into a single
`UnauthorizedError(INVALID_CREDENTIALS)`. On the miss path a bcrypt comparison runs against a
module-level dummy hash of the same cost factor, so the timing oracle closes with the code oracle.
`EMAIL_NOT_VERIFIED` (`auth.ts:284-286`) is kept distinct deliberately — it is only reachable after
the password has already been proven correct, so it leaks nothing.

**SQL constants.** `utils/sortOptions.ts` already maps to fixed column names; the query factories
change to accept the mapped constant type rather than `string`, so the compiler rejects a raw string
at a fourth call site. `LIKE` terms get `%`, `_` and `\` escaped in one shared helper used by all
four search queries.

**Reuse.** Zod 4.0.17 is already a dependency (`server/api/package.json:38`) and
`services/validations.ts` is the established home for schemas, so SEC-01 and SEC-07 add no
dependency. Only `helmet` and `express-rate-limit` are new.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/api/src/env.ts` | New | Zod env schema, parse, production abort |
| `server/api/src/config.ts` | Modified | Re-export from `env.ts`; drop `jwt_secret_dev` (`:22`) and the DB password fallbacks (`:74,77`); coerce `TOKEN_EXP`/`ADMIN_TOKEN_EXP` (`:23,25`) |
| `server/api/src/index.ts` | Modified | `helmet`, rate limiters, `express.json({ limit })` (`:43`), `/status` (`:66-68`), `/health`, await env validation before `listen` (`:128`) |
| `server/api/src/services/jwt.ts` | Modified | `ADMIN_JWT_SECRET`, split verify, `algorithms` allowlist (`:30,38,60`) |
| `server/api/src/middlewares/rateLimit.ts` | New | Limiter factory + `RATE_LIMIT_ENABLED` bypass |
| `server/api/src/models/auth.ts` | Modified | Uniform login (`:269-279`), Google audience array (`:365-368`) |
| `server/api/src/models/admin.ts` | Modified | Uniform login + null-hash guard (`:158-171`), admin-only audience (`:216-219`) |
| `server/api/src/services/hash.ts` | Modified | Null-hash guard (`:8-10`) |
| `server/api/src/services/validations.ts` | Modified | `passwordSchema` min 8 (`:12`); drop `password` from `updateSelfSchema` (`:256`); bound pagination (`:262-268`); new admin schemas |
| `server/api/src/controllers/admin.ts` | Modified | Wire schemas into `:177`, `:197`, `:246`, `:263`, `:355`; route `:167` through Zod |
| `server/api/src/controllers/self.ts` | Modified | Validate `newPassword` (`:294-308`) |
| `server/api/src/models/self.ts` | Modified | Remove the silent password fallback (`:115-118`) |
| `server/api/src/services/expoNotifications.ts` | Modified | `await` + `try/catch` (`:20`); stop logging the raw token (`:17`) |
| `server/api/src/services/queries.ts` | Modified | `ORDER BY` constants (`:327,387,568`); escaped `LIKE` (`:318-321,339,369-370,543-544,840`) |
| `server/api/src/utils/sortOptions.ts` | Modified | Export branded constant types |
| `server/api/src/middlewares/trimBody.ts` | Modified | Recursive trim |
| `server/api/src/middlewares/errors.ts` | Modified | `StepRequired` → 409 (`:44-51`) |
| `server/api/src/services/email.ts` | Modified | Remove recipient and verification link from logs (`:16,32,41`) |
| `server/api/src/services/postgresClient.ts` | Modified | Honor `POSTGRES_PORT` (`:47`); `/health` RLS probe |
| `server/api/src/scripts/migrate.ts` | Modified | Honor `POSTGRES_PORT` (`:207`) |
| `.env.template` | Modified | Regenerated from the schema; adds `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `ADMIN_JWT_SECRET`, `PORT`, `TOKEN_EXP`, `UPLOAD_DIR` |
| `server/.env.template` | Deleted | Folded into the root template (it lacks `DB_APP_*`/`DB_UNSCOPED_*` today) |
| `docker-compose.dev.yml`, `docker-compose.e2e.yml`, `compose.yml` | Modified | New required vars; `RATE_LIMIT_ENABLED=false` in e2e; `POSTGRES_PORT` wiring |
| `Dockerfile.api` | Modified | `ENV NODE_ENV=production` in the production stage (`:68`) |
| `adminClient/src/services/validations.ts`, `ResetPasswordModal.tsx` | Modified | Password minimum 6 → 8, to match the API |
| `client/.env` | Untracked | `git rm --cached` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rate limiting breaks the e2e suite | High | `RATE_LIMIT_ENABLED=false` in `docker-compose.e2e.yml`; limiter covered by a unit test instead |
| A production deploy missing a variable now fails to start instead of starting broken | High (intended) | This is the point of SEC-01. `.env.template` is regenerated from the schema and the abort message names every missing variable at once, not one per restart |
| Removing DB password fallbacks breaks dev | Med | Fallbacks are kept in dev/test with a warning; `docker-compose.dev.yml:55,57` already passes both explicitly |
| `StepRequired` → 409 breaks Google signup | Med | Traced end to end (C12): the client branch keys on `errorCode`, and 409 restores `data` that is dropped today. One throw site only |
| Password minimum 8 locks out existing accounts | Med | Applied to creation paths only, never to a login schema (C13). Existing e2e and demo passwords are 12 characters |
| Uniform login responses break a client error branch | Med | `client/services/errorMapping.ts` maps by `errorCode`; the removed codes had no dedicated UI branch. Verified before merge |
| `ADMIN_JWT_SECRET` invalidates live admin sessions | Low | Admin tokens last 30 minutes (`config.ts:25`); the window is one deploy |
| `helmet` defaults break the Expo web client or admin panel | Low | `crossOriginResourcePolicy` and `contentSecurityPolicy` are the two that touch this app; both explicitly configured, not left default |
| `POSTGRES_PORT` change breaks connections | Low | Default stays `5432`; only the hardcoded literal becomes a variable |

## Rollback Plan

One branch, one PR, revertible as a unit. Within it, the two behavior-visible switches are isolated:
`RATE_LIMIT_ENABLED=false` disables all limiting without a code change, and the env schema's
production branch is a single guard — setting the change's new variables makes the abort inert. No
migration is added, so there is no data to roll back. `git rm --cached client/.env` is reversed with
`git add -f client/.env`.

## Dependencies

- New: `helmet@^8` (8.3.0 current) and `express-rate-limit@^8` (8.7.0 current). Both verified
  compatible: `express-rate-limit` peers `express >= 4.11`, `helmet` needs Node ≥ 18; the repo is
  Express 5.1.0 (`server/api/package.json:31`) on Node 24.
- Existing: Zod 4.0.17 (`server/api/package.json:38`) — no new validation dependency.
- `dotenv` is currently a **devDependency** (`server/api/package.json:60`) loaded through `require()`
  inside a silent `try/catch` (`config.ts:4-12`). That is acceptable because it is only loaded when
  `NODE_ENV !== "production"`, but the new schema must not depend on it having succeeded.
- No dependency on `db-integrity-migrations`; this change adds no migration.

## Size Forecast and Delivery

Forecast **~1200–1400 changed lines**, above the 800-line session budget. Per the session's delivery
settings this ships as a **single PR on `fix/auditoria-2026-09`** with the budget treated as
informative; chained PRs are explicitly **not** recommended, because the change's three largest files
(`config.ts`, `index.ts`, `services/validations.ts`) are touched by nearly every audit id in scope and
slicing would mean rewriting them repeatedly.

## Success Criteria

- [ ] With `NODE_ENV=production` and any one of the eight required variables unset, the process exits
      non-zero before binding a port, naming every missing variable.
- [ ] `grep -r "jwt_secret_dev" server/api/src` returns nothing.
- [ ] An `admin_token` signed with `JWT_SECRET` is rejected; user and admin tokens no longer verify
      against each other's secret.
- [ ] `POST /auth/login` returns the same status, body and `errorCode` for an unknown address, a
      Google-only account and a wrong password, within timing noise.
- [ ] `POST /auth/google-login` rejects an ID token whose `aud` is not one of the three end-user
      client IDs; admin Google login rejects any `aud` that is not the admin client ID.
- [ ] `PATCH /me` with a `password` field is rejected; `POST /me/change-password` rejects `""`.
- [ ] `POST /admin/users/:id/credits` rejects a negative, zero, fractional or non-numeric `amount`.
- [ ] `GET /health` returns 200 with DB and RLS status; `GET /status` no longer contains `NODE_ENV`.
- [ ] `SCHOOL_IDS_REQUIRED` is returned as 409 and the Expo client still routes to school selection.
- [ ] `npm run test:e2e` passes 40/40 with the change applied.
- [ ] `npm run check-types` and `npm run lint` pass in `server/api` and `adminClient`.
- [ ] `.env.template` contains every variable the schema declares, verified by a test.
- [ ] `git ls-files client/.env` returns nothing.
