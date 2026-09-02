# Tasks: API Security and Configuration Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1400 (single PR) |
| Session review budget | 800 lines (configured, **informative only** for this change) |
| 400-line budget risk | High (against both the 400 skill default and the 800 session budget) |
| Chained PRs recommended | No |
| Suggested split | None — single PR on `fix/auditoria-2026-09` |
| Delivery strategy | single-pr / exception-ok (budget exceeded by explicit session policy) |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

**Why one PR despite the size.** The three largest files in this change — `server/api/src/config.ts`,
`server/api/src/index.ts` and `server/api/src/services/validations.ts` — are each touched by four or
more of the audit ids in scope. Slicing by id would mean rewriting the same three files three or four
times, and the env schema (SEC-01) is a hard prerequisite for SEC-02, SEC-03 and SEC-04, so the
slices could not even be reviewed independently. The budget is treated as informative per the session
delivery settings.

### Suggested Work Units

Phases below are **commit** boundaries inside one PR, not separate pull requests.

| Unit | Goal | Branch | Focused check | Runtime harness | Rollback boundary |
|------|------|--------|---------------|-----------------|-------------------|
| 1 | Env schema + config plumbing | `fix/auditoria-2026-09` | `cd server/api && npx jest env` + `npm run check-types` | Boot the dev stack; confirm it still starts | Revert restores today's defaults; nothing else depends on it yet |
| 2 | Secret separation (JWT) | same | `npx jest jwt` | Log in as user and as admin in the dev stack | Revert restores the single secret; invalidates admin sessions again |
| 3 | Transport + rate limiting | same | `npx jest rateLimit` | `npm run test:e2e` — the limiter must not trip | `RATE_LIMIT_ENABLED=false` neutralizes without a revert |
| 4 | Login uniformity + Google audience | same | `npx jest auth` | Manual timing check; real Google sign-in | Revert restores distinguishable codes |
| 5 | Input validation (self + admin + pagination) | same | `npx jest validations` + `npm run check-sql` | Admin panel: credits, reset password, schools | Per-endpoint; each schema is independent |
| 6 | Small defects (push, SQL, trim, errors, logs) | same | `npx jest` + `npm run check-sql` | `npm run test:e2e` | Each is independently revertible |
| 7 | Env plumbing, templates, compose, admin client | same | `npx jest envTemplate` | Full `npm run test:e2e` + dev stack boot | Revert restores today's templates |

**Environment**: there is no CI (`.github/` does not exist), so every gate is local. The `server/api`
Jest integration project is known stale/red (INF-06, owned by `delivery-and-ci`) — **do not try to fix
it here**. All new tests must be pure/hermetic unit tests or `supertest` against a throwaway express
app, so they pass regardless of that suite's state. The regression gate is
`npm run test:e2e` (40 tests) plus `npm run check-types`, `npm run lint` and `npm run check-sql`.

**Line-number provenance**: every `file:line` below was read against the working tree at planning
time (branch `fix/auditoria-2026-09`, HEAD `7acced3`). `server/api/src/config.ts` and
`server/api/src/package.json` were observed being modified by another process *during* planning — if a
cited line does not match, locate the symbol by name rather than trusting the number, and reconcile
with task 1.1.

---

## Phase 1: Environment Schema — the prerequisite for phases 2–4

- [ ] 1.1 **Reconcile concurrent edits first.** `server/api/src/config.ts` was modified during planning
      (a `POSTGRES_PORT: DB_PORT_RAW` destructure and an exported `DB_PORT` citing INF-11 were added),
      and a `lint` script was added to `server/api/package.json`. Diff against `7acced3`, confirm with
      the author whether these are intended, and fold them into this change rather than duplicating
      them in task 7.2. — *runtime-configuration: Environment Schema*
- [ ] 1.2 Add `helmet@^8` and `express-rate-limit@^8` to `server/api/package.json` dependencies
      (verified compatible: `express-rate-limit` peers `express >= 4.11`, `helmet` needs Node ≥18; repo
      is Express 5.1.0 on Node 24). Run `npm install` in `server/api`.
- [ ] 1.3 Create `server/api/src/env.ts` with the Zod schema of design D1: three tiers (required in
      production / typed-with-default / optional). Required in production:
      `JWT_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_PASS_TOKEN`, `DB_APP_PASSWORD`, `DB_UNSCOPED_PASSWORD`,
      `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `WEB_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID`.
      — *runtime-configuration: Environment Schema, Production Startup Contract*
- [ ] 1.4 In `env.ts`, add the `superRefine` that rejects the dev sentinel values themselves in
      production, so `JWT_SECRET=jwt_secret_dev_only` is treated as unset. — *runtime-configuration:
      "Dev sentinel values are rejected in production"*
- [ ] 1.5 In `env.ts`, coerce numerics: `PORT`, `POSTGRES_PORT`, `TOKEN_EXP`, `ADMIN_TOKEN_EXP` via
      `z.coerce.number().int()` with bounds. This is the fix for the `TOKEN_EXP` string/number trap.
      — *runtime-configuration: Numeric Environment Variables*
- [ ] 1.6 In `env.ts`, add `RATE_LIMIT_ENABLED` as `z.enum(["true","false"])` (**not**
      `z.coerce.boolean()` — `Boolean("false")` is `true`), defaulting to `"true"`, and reject `false`
      in production via `superRefine`. — *api-surface-hardening: Rate Limiting*
- [ ] 1.7 In `env.ts`, on failure in production: collect **all** issues, print one line per missing or
      invalid variable, and `process.exit(1)`. In dev/test: `console.warn` once per defaulted variable
      and continue. — *runtime-configuration: Production Startup Contract, Development Permissiveness*
- [ ] 1.8 Rewrite `server/api/src/config.ts` to import from `env.ts` and re-export the same names it
      exports today, so the ~40 modules importing `config.js` are untouched. Delete the
      `JWT_SECRET = "jwt_secret_dev"` default (`config.ts:22`) and the
      `process.env.DB_APP_PASSWORD || DB_PASSWORD || "loop_app_dev"` fallback chain (`:74,77`).
      — *runtime-configuration: Environment Schema*
  - **Checkpoint**: `config.ts` is imported by `scripts/migrate.ts` and `scripts/seed.ts`, which run
    with a different variable set. Confirm both still run (`npm run migrate:status`, `npm run seed`)
    — the production abort must live in the API entrypoint, not in `config.ts` import side effects.
- [ ] 1.9 In `server/api/src/index.ts`, invoke the env validation **synchronously before**
      `app.listen` (`index.ts:128`). Also `await` `assertDbHardening()` in production rather than
      leaving it fire-and-forget (`index.ts:120-125`). — *runtime-configuration: Production Startup
      Contract, "Validation completes before the port is bound"*
- [ ] 1.10 [RED→GREEN] `server/api/src/env.test.ts` — parse a synthetic env object: production +
      complete → ok; production − each required var → throws naming that var; production + a dev
      sentinel → throws; development − everything → succeeds with warnings.
      — *runtime-configuration: Environment Schema, Production Startup Contract*
- [ ] 1.11 [RED→GREEN] Extend `env.test.ts` — `TOKEN_EXP="2592000"` (string) parses to the **number**
      `2592000`. — *runtime-configuration: Numeric Environment Variables*
- [ ] 1.12 Run `cd server/api && npm run check-types`; boot `docker-compose.dev.yml` and confirm the
      API still starts with today's dev variables.

**Done condition**: production aborts on any missing secret before binding a port; dev and e2e start
unchanged; `grep -r "jwt_secret_dev" server/api/src` returns nothing.

---

## Phase 2: Secret Separation

- [ ] 2.1 In `server/api/src/services/jwt.ts`, introduce `ADMIN_JWT_SECRET` for admin tokens
      (`:60`), keeping `JWT_SECRET` for user tokens (`:30`). — *authentication-hardening: Signing Key
      Separation*
- [ ] 2.2 Split `parseToken` (`jwt.ts:38`) into `parseToken` (user) and `parseAdminToken` (admin),
      each verifying with its own secret and passing `algorithms: ["HS256"]`.
      — *authentication-hardening: Signing Key Separation, "Algorithm is pinned"*
- [ ] 2.3 Delete the `as number` assertions on `expiresIn` (`jwt.ts:31,61`) — `env.ts` now supplies a
      real number. — *runtime-configuration: Numeric Environment Variables*
- [ ] 2.4 Define `AdminTokenPayload` as a **separate** interface from `UserTokenPayload`
      (`jwt.ts:12-20`), so an admin payload no longer type-checks where a user payload is expected.
- [ ] 2.5 Point `server/api/src/middlewares/parseAdminToken.ts` at the new `parseAdminToken`. Leave its
      community-from-token logic (`:55-77`) untouched — the audit lists it as already correct.
- [ ] 2.6 [RED→GREEN] `jwt.test.ts` — a token signed with `JWT_SECRET` fails `parseAdminToken`; an
      admin token fails `parseToken`; a token with `alg: "none"` is rejected.
      — *authentication-hardening: Signing Key Separation*
- [ ] 2.7 Manually log in as a user and as an admin in the dev stack; confirm both work and that an
      admin cookie cannot be used as a user token or vice versa.

**Done condition**: user and admin tokens no longer verify against each other's secret; `HS256` is
pinned on both verify paths.

---

## Phase 3: Transport Hardening and Rate Limiting

- [ ] 3.1 In `index.ts`, mount `helmet` **first**, before `express.json()`, with
      `contentSecurityPolicy: false` and `crossOriginResourcePolicy: { policy: "cross-origin" }`
      (design D12). — *api-surface-hardening: Security Headers*
  - **Checkpoint (most likely UI break)**: helmet's default `crossOriginResourcePolicy: same-origin`
    blocks every uploaded image in the Expo web client and the admin panel, because uploads are
    served from the API origin (`routes/uploads.ts:17`) and consumed from a different origin. Verify
    an uploaded image renders in both before moving on.
- [ ] 3.2 In `index.ts`, move `cors` **above** `express.json()` (today the body is parsed at `:43`
      before the origin is checked at `:45`), and set `express.json({ limit: "100kb" })` — making the
      existing Express default explicit, not changing it. — *api-surface-hardening: Security Headers,
      Request Body Limit*
- [ ] 3.3 Set `app.set("trust proxy", 1)` — one proxy hop (Caddy), **not** `true`, which would let any
      client spoof `X-Forwarded-For` and forge its own rate-limit key.
      — *api-surface-hardening: "Client IP is derived from a bounded proxy chain"*
- [ ] 3.4 Create `server/api/src/middlewares/rateLimit.ts` exporting a `makeLimiter` factory that
      returns a pass-through when `RATE_LIMIT_ENABLED` is false, and otherwise an
      `express-rate-limit` instance keyed on IP + email (or IP + `userId`), responding 429 with
      `errorCode: "RATE_LIMITED"`. — *api-surface-hardening: Rate Limiting*
- [ ] 3.5 Apply limiters per design D3's table: `POST /auth/login` (15 min / 10),
      `POST /auth/register` (1 h / 5), `POST /auth/resend-verification` (1 h / 3),
      `POST /auth/google-login` (15 min / 20), `POST /admin/login` and `POST /admin/register`
      (15 min / 10), `POST /me/delete-request` (1 h / 3), `POST /messages` (1 min / 30).
      — *api-surface-hardening: Rate Limiting, "Abusable endpoints are limited"*
- [ ] 3.6 Set `RATE_LIMIT_ENABLED: "false"` in the `api` service of `docker-compose.e2e.yml`
      (environment block at `:72-87`). **Required** — the suite is serial, single-worker
      (`e2e/playwright.config.ts:6-7`) and issues hundreds of requests from one container IP, so a
      per-IP limiter would trip it. Note the e2e API runs `NODE_ENV: development` (`:73`), not `test`,
      which is exactly why the flag exists rather than a `NODE_ENV` check.
      — *api-surface-hardening: "Limiting is disabled by an explicit flag, never by NODE_ENV"*
- [ ] 3.7 [RED→GREEN] `rateLimit.test.ts` — mount a limiter on a throwaway express app via
      `supertest`: request N+1 within the window returns 429 with `errorCode: "RATE_LIMITED"`; with
      `RATE_LIMIT_ENABLED=false` it never trips. This is what makes disabling it in e2e cost no
      coverage. — *api-surface-hardening: Rate Limiting*
- [ ] 3.8 Run `npm run test:e2e`; confirm 40/40 still pass.

**Done condition**: security headers present on every response, uploaded images still render in both
clients, limiters return 429 under test, and the e2e suite is unaffected.

---

## Phase 4: Authentication Semantics

- [ ] 4.1 In `server/api/src/services/hash.ts` (`:8-10`), make `comparePasswords` accept
      `hash: string | null` and fall back to a module-level `DUMMY_HASH` of the **same bcrypt cost
      factor** as live hashes. This single change closes both the timing oracle and the
      `comparePasswords(x, null)` → 500 for Google-created admins.
      — *authentication-hardening: Uniform Login Failure, "A password login against a passwordless
      account does not error"*
- [ ] 4.2 In `models/auth.ts:269-279`, move the bcrypt call **before** the branch and collapse
      `USER_NOT_FOUND` (`:270`), `INCORRECT_LOGIN_METHOD` (`:272-274`) and `INVALID_CREDENTIALS`
      (`:278`) into one `UnauthorizedError(INVALID_CREDENTIALS, "INVALID_CREDENTIALS")`.
      — *authentication-hardening: Uniform Login Failure*
  - **Checkpoint**: leave `EMAIL_NOT_VERIFIED` (`:284-286`) distinct — it is only reachable *after*
    the password is proven correct, so it leaks nothing. Do not collapse it.
- [ ] 4.3 In `models/admin.ts:158-171`, apply the same collapse, and change `InvalidInputError`
      (400, `:162,166`) to `UnauthorizedError` (401) so both login endpoints agree. Pass the
      `errorCode` string, which the admin path omits today.
      — *authentication-hardening: Uniform Login Failure*
- [ ] 4.4 In `server/api/src/services/googleOauth.ts`, export
      `END_USER_AUDIENCES = [WEB, ANDROID, IOS].filter(Boolean)` and `ADMIN_AUDIENCES = [ADMIN]`, with
      a guard that `END_USER_AUDIENCES` is non-empty (an empty array makes `indexOf` always fail and
      breaks every Google login). — *authentication-hardening: Google Audience Binding*
- [ ] 4.5 Pass `END_USER_AUDIENCES` at `models/auth.ts:365-368` and `ADMIN_AUDIENCES` at
      `models/admin.ts:216-219`. — *authentication-hardening: Google Audience Binding*
  - **Checkpoint (deviation from the task brief, deliberate)**: do **not** pass the end-user client
    IDs to the admin verifier. Doing so would let an ID token minted for the Expo app authenticate
    against the admin panel with only the email allowlist in the way. See proposal C3.
- [ ] 4.6 [RED→GREEN] `auth.test.ts` via `supertest` — unknown email, Google-only account and wrong
      password produce byte-identical response bodies and the same status.
      — *authentication-hardening: Uniform Login Failure*
- [ ] 4.7 [RED→GREEN] `hash.test.ts` — `DUMMY_HASH`'s cost factor equals what `hashPassword`
      produces. Without this, D5's timing fix silently regresses when the cost factor is tuned.
- [ ] 4.8 Manual timing check: 100 logins against an unknown address vs a known one; medians within
      noise. — *authentication-hardening: "Failure timing does not distinguish the cases"*
- [ ] 4.9 Manual: real Google sign-in still works on web; an ID token with a foreign `aud` is rejected.

**Done condition**: all login failure modes are indistinguishable by code, body, status and timing;
Google audiences are explicit and split by trust boundary.

---

## Phase 5: Input Validation

- [ ] 5.1 In `services/validations.ts:12`, raise `passwordSchema` to `z.string().min(8).max(100)`.
      — *authentication-hardening: Password Policy*
- [ ] 5.2 **Do not raise the minimum on any login schema.** Leave admin login at
      `services/validations.ts:361` on `min(6)` and user login at `:232` minimum-free. Raising the
      admin login minimum would deny login to every admin whose current password is 6–7 characters.
      — *authentication-hardening: Password Policy, "Login minimums are never raised"*
- [ ] 5.3 Point the admin **register** schema (`:371`) at `passwordSchema` so new admin passwords get
      the 8-character minimum.
- [ ] 5.4 Delete the `password` field from `updateSelfSchema` (`:256`). The schema is already
      `.strict()` (`:259`), so `PATCH /me` with `password` now rejects visibly rather than silently
      ignoring. — *authentication-hardening: Password Change Integrity*
- [ ] 5.5 In `models/self.ts:115-118`, delete the fallback expression that silently keeps the old hash
      when password validation fails, now that the field is gone.
      — *authentication-hardening: Password Change Integrity*
- [ ] 5.6 Add `changePasswordSchema` (`oldPassword: z.string().min(1)`, `newPassword: passwordSchema`)
      and validate it in `controllers/self.ts:294-308`, which performs **no** validation today —
      `newPassword: ""` currently reaches `hashPassword("")` at `models/self.ts:470`, and `trimBody`
      turns `"   "` into `""` first. — *authentication-hardening: Password Change Integrity*
- [ ] 5.7 Add `modifyCreditsSchema` (`amount: z.number().int().positive().max(1_000_000)`,
      `positive: z.boolean()`, `meta: z.record(z.string(), z.unknown()).optional()`) and wire it into
      `controllers/admin.ts:177-195`. — *api-surface-hardening: Admin Endpoint Validation*
  - **Checkpoint**: `amount` is untyped `any` today (`:179`); a negative value with `positive: true`
    reaches `increaseUserBalance` (`models/admin.ts:363-367`) and *subtracts*. `positive` must be a
    real boolean because the model truthy-branches on it.
- [ ] 5.8 Add `resetUserPasswordSchema` (`newPassword: passwordSchema`) and wire it into
      `controllers/admin.ts:197-216`, deleting the `// No hay validaciones porque es administrador`
      comment at `:205`. — *api-surface-hardening: Admin Endpoint Validation*
- [ ] 5.9 Add `sendNotificationSchema` as a `z.discriminatedUnion("type", …)` over
      `"mission" | "loop" | "donation" | "admin"` (`shared/types/app.d.ts:13`) with a payload schema
      per type (`app.d.ts:208-249`), plus `userId: z.uuid()`. Wire into `controllers/admin.ts:355-368`.
      — *api-surface-hardening: Admin Endpoint Validation*
  - **Checkpoint**: do **not** reuse the existing union at `services/validations.ts:169-202` — it is a
    *response* validator and it disagrees with `app.d.ts` (expects `missionId`/`mission`/`reward` vs
    `userMissionId`; a nested `target` object vs flat `target` + `referenceId`). Follow `app.d.ts` and
    record the drift as a follow-up.
- [ ] 5.10 Add `createSchoolSchema` / `updateSchoolSchema` (`name: z.string().min(1).max(200)`,
      `mediaId: z.uuid()`) and wire into `controllers/admin.ts:246-261` and `:263-284`. Add the
      `validateId(schoolId)` that `:263-271` omits today.
      — *api-surface-hardening: Admin Endpoint Validation*
- [ ] 5.11 Rewrite `paginatedQuery` (`services/validations.ts:262-268`):
      `page: z.coerce.number().int().min(1).max(10_000).default(1)`,
      `limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE)`, and `.strict()`.
      — *api-surface-hardening: Bounded Pagination*
  - **Checkpoint (the audit has this inverted)**: the audit asks for a max on `page`; the genuinely
    broken field is `limit`, typed `z.string()` at `:264`, unbounded and **never consumed** — page size
    is the constant `PAGE_SIZE = 10`. Also `page` is `z.number()` while query params are strings, so
    `Infinity` currently survives `safeNumber` and reaches `(page - 1) * PAGE_SIZE`
    (`models/listings.ts:65`, `models/admin.ts:312`). Fix both.
- [ ] 5.12 Make `limit` actually honored by the models that currently hardcode `PAGE_SIZE`, and route
      `controllers/admin.ts:167` (`page: page ? Number(page) : 1`, which bypasses Zod entirely) through
      the schema. — *api-surface-hardening: Bounded Pagination*
- [ ] 5.13 Update `adminClient/src/services/validations.ts` and
      `adminClient/src/components/ResetPasswordModal.tsx` from a 6- to an 8-character minimum, or the
      admin panel offers a form the API will reject. — *authentication-hardening: Password Policy*
- [ ] 5.14 [RED→GREEN] `validations.test.ts` — `amount` rejects negative, zero, fractional, string and
      `Infinity`; `positive` rejects non-booleans; `sendNotification` rejects an out-of-enum `type` and
      a payload mismatched to its type; `page`/`limit` coerce from strings and clamp at their maxima.
- [ ] 5.15 Manual: exercise credits, reset-password and school create/update in the admin panel.

**Done condition**: every admin endpoint validates its body; `PATCH /me` cannot set a password;
change-password rejects empty and short values; pagination is bounded and `limit` works.

---

## Phase 6: Small Defects

- [ ] 6.1 In `services/expoNotifications.ts:20`, `await` `sendPushNotificationsAsync`, wrap in
      `try/catch`, and inspect per-ticket `status === "error"` (the SDK resolves successfully while
      reporting per-device errors in tickets). Resolve rather than rethrow — a failed push must not
      fail the business operation. — *api-surface-hardening: Push Notification Failure Isolation*
  - **Checkpoint**: `utils/notifications.ts:55` already `await`s the wrapper, but the await is inert
    today because the inner promise floats. Confirm callers need no change once the wrapper is fixed.
- [ ] 6.2 Stop logging the raw Expo push token at `services/expoNotifications.ts:17` — it is a device
      credential. — *api-surface-hardening: Log Hygiene*
- [ ] 6.3 In `utils/sortOptions.ts`, export `SortColumn = (typeof SORT)[SortOptions]` and
      `SortDirection = "asc" | "desc"`; change the query factories at `services/queries.ts:309,353,530`
      to accept those types instead of bare `string`, so a raw string stops compiling at a future
      fourth call site. — *api-surface-hardening: SQL Construction*
  - **Checkpoint**: no injection is reachable today — `services/validations.ts:13-14` (Zod enums) and
    `utils/sortOptions.ts:14-21` (`getSortValue` falls back to `created_at`, `getOrderValue` collapses
    to `asc`/`desc`) already guard all three sites. This is defence in depth; do not describe it as
    fixing a live vulnerability.
- [ ] 6.4 Create `server/api/src/utils/escapeLike.ts` escaping `\`, `%` and `_` in a single character
      class (backslash must be handled in the same pass, not after), and apply it with `ESCAPE '\'` at
      `services/queries.ts:318-321,339,369-370,543-544` and `models/admin.ts:315` (which builds
      `%${search}%` in JS). — *api-surface-hardening: SQL Construction*
  - Note `searchSchools` (`queries.ts:331-350`) already avoids interpolation with a parameterized
    `CASE WHEN` ordering — leave it alone.
- [ ] 6.5 Make `middlewares/trimBody.ts` recursive per design D16: `Object.entries` instead of
      `for…in` (so inherited properties are not walked), a plain-object prototype check (so
      `Date`/`Buffer` are not mangled), and a depth cap. — *api-surface-hardening: Body Normalization*
- [ ] 6.6 Change `middlewares/errors.ts:44-51` so `StepRequired` returns **409**, keeping `success`,
      `error`, `errorCode` and `data` byte-identical. — *operational-endpoints: Step-Required Status*
  - **Checkpoint**: one throw site only (`models/auth.ts:434-439`, `SCHOOL_IDS_REQUIRED`). This also
    *repairs* a latent client bug: `hooks/useGoogleLogin.ts:10-12` throws a plain object that loses
    `data` (`client/services/errors.ts:78-87`), so `GoogleSignInButton.tsx:96`'s
    `error?.data?.community` is always `undefined` today. A 409 routes through the Axios branch
    (`errors.ts:71-77`), which does return `data`. Verify the school-selection screen still opens.
- [ ] 6.7 In `services/email.ts`, remove the recipient address from `:16` and `:32`, and gate the
      full-verification-link log at `:41` behind `NODE_ENV !== "production"` plus an explicit
      `EMAIL_DEBUG_LINKS` flag. — *api-surface-hardening: Log Hygiene*
  - **Checkpoint**: `:41` is the serious one — its only guard is `RESEND_API_KEY` being falsy (`:6`),
    so a production deploy with a rotated-out key silently writes account-takeover tokens to stdout.
    Dev still needs the link; e2e does **not** (it reads the token from the database), so confirm
    `npm run test:e2e` passes with the flag off.
- [ ] 6.8 Run `npm run check-sql` (query text changed in 6.3–6.4) and `npm run test:e2e`.

**Done condition**: pushes cannot crash the process, SQL construction is type-carried and wildcard-safe,
`StepRequired` is 409, and no PII or token reaches the logs in production.

---

## Phase 7: Operational Endpoints, Env Plumbing and Templates

- [ ] 7.1 Change `/status` (`index.ts:66-68`) to a fixed `"ok"` string, removing the `NODE_ENV` echo.
      Keep the route — `docker-compose.e2e.yml:96` healthchecks it.
      — *operational-endpoints: Status Endpoint*
- [ ] 7.2 Add `GET /health` running `SELECT 1` plus the `relrowsecurity` check over `TENANT_TABLES`,
      reusing the probe `assertDbHardening()` already performs
      (`services/postgresClient.ts:230-233`) so the two cannot drift. Scope it `unscoped("health")` —
      a probe belongs to no community. Return 200 `{status:"ok",db:"up",rls:"on"}`, 503 otherwise, and
      never a version, hostname, driver error or `NODE_ENV`. Not rate-limited.
      — *operational-endpoints: Health Endpoint*
- [ ] 7.3 Read `POSTGRES_PORT` from `env.ts` at `services/postgresClient.ts:47` and
      `scripts/migrate.ts:207` instead of the hardcoded `5432` (default stays 5432, so no behavior
      change unless set). Reconcile with the concurrent edit noted in task 1.1.
      — *runtime-configuration: Numeric Environment Variables*
- [ ] 7.4 Document the `PORT` vs `API_PORT` split rather than renaming: `API_PORT` stays the host-side
      publish variable (already correct at `docker-compose.dev.yml:42`, `"${API_PORT:-3000}:3000"`),
      `PORT` stays the in-container listen port fixed at 3000. Add a comment in both places.
      — *runtime-configuration: Port Configuration*
  - **Checkpoint**: the audit calls this a "reconcile", but the real defect is that nothing anywhere
    sets `PORT` while `API_PORT` is set everywhere and read by nothing — so setting `API_PORT` to a
    non-3000 value silently breaks the host→container mapping instead of moving the port. Renaming was
    rejected because it would touch four compose files and a deployed Coolify configuration.
- [ ] 7.5 Regenerate the root `.env.template` from the `env.ts` schema, adding the variables it lacks
      today: `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `ADMIN_JWT_SECRET`, `PORT`, `TOKEN_EXP`,
      `ADMIN_TOKEN_EXP`, `UPLOAD_DIR`, `RATE_LIMIT_ENABLED`.
      — *runtime-configuration: Environment Template Parity*
- [ ] 7.6 Delete `server/.env.template` (it lacks `DB_APP_*`/`DB_UNSCOPED_*` entirely) and fold it into
      the root template. Update `AGENTS.md`'s "Env files" gotcha, which tells the reader to copy from
      it. — *runtime-configuration: Environment Template Parity*
- [ ] 7.7 [RED→GREEN] `envTemplate.test.ts` — every key the schema declares appears in
      `.env.template`, and every key in the template is declared by the schema. This is the guard that
      stops INF-11 recurring. — *runtime-configuration: Environment Template Parity*
- [ ] 7.8 Update `docker-compose.dev.yml` (api `environment:` at `:49-60`) and `compose.yml`
      (`:22-36`) with the new variables. `compose.yml` must carry real values for the nine
      production-required ones or the container will refuse to start — which is the intended behavior,
      but must not surprise the deploy.
- [ ] 7.9 Update `docker-compose.e2e.yml` api `environment:` (`:72-87`): add `RATE_LIMIT_ENABLED:
      "false"` (task 3.6) and explicit `JWT_SECRET`/`ADMIN_JWT_SECRET` values, so the e2e stack stops
      depending on the dev defaults it currently inherits silently.
- [ ] 7.10 Add `ENV NODE_ENV=production` to the production stage of `Dockerfile.api` (`:68`). Every
      production guard in this change keys on `NODE_ENV`, and the image sets none today — only
      `compose.yml:22` does, so an image run outside that compose file skips all of them.
      — *runtime-configuration: Production Startup Contract*
- [ ] 7.11 `git rm --cached client/.env` and confirm `.gitignore:10` covers it going forward. The file
      is tracked today despite the ignore rule and contains a live Google OAuth client id.
      — *runtime-configuration: Secret Files Are Not Tracked*
  - **Checkpoint**: this only untracks it; the id remains in git history. Note in the PR that
    rotating that OAuth client id is a separate operational decision for the owner.
- [ ] 7.12 Run the full gate: `cd server/api && npm run check-types && npm run lint && npm run
      check-sql`; `cd adminClient && npm run lint && npm run build`; `npm run test:e2e` (40/40).
- [ ] 7.13 Boot `docker-compose.dev.yml` and `compose.yml` (with variables set, then with one removed)
      and confirm the abort behaves as specified. — *runtime-configuration: Production Startup Contract*

**Done condition**: `/health` reports DB and RLS, `/status` leaks nothing, one template matches the
schema under test, all three compose files carry the new variables, and `client/.env` is untracked.

---

## Verification Summary

| Gate | Command | Expected |
|---|---|---|
| Types | `cd server/api && npm run check-types` | clean |
| Lint | `cd server/api && npm run lint`; `cd adminClient && npm run lint` | clean |
| SQL arity | `cd server/api && npm run check-sql` | clean (query text changed in phase 6) |
| Unit | `cd server/api && npx jest env jwt rateLimit auth hash validations envTemplate` | all green |
| E2E | `npm run test:e2e` | 40/40 |
| Admin build | `cd adminClient && npm run build` | succeeds |

The pre-existing `server/api` Jest **integration** project is stale/red (INF-06) and is **not** a gate
for this change; do not attempt to repair it here.
