# Design: API Security and Configuration Hardening

## Technical Approach

One new module (`server/api/src/env.ts`) becomes the single source of environment truth: a Zod schema
that parses `process.env` once, aborts the process in production when a required secret is missing,
and warns-and-defaults everywhere else. `config.ts` keeps its public surface and re-exports from it,
so no call site churns. Everything else is applied in place: one new middleware
(`middlewares/rateLimit.ts`), two new dependencies (`helmet`, `express-rate-limit`), new schemas in
the existing `services/validations.ts`, and small surgical edits across eleven existing files.
Delivered as a single PR on `fix/auditoria-2026-09`.

## Verified Platform Facts

These were read in the repository and in `server/api/node_modules`, not assumed. They drive six
decisions below.

| Fact | Evidence |
|---|---|
| `google-auth-library` skips the `aud` check entirely when `audience` is `undefined` or `null`, but fails closed on `""` | `node_modules/google-auth-library/build/src/auth/oauth2client.js:775` (`typeof requiredAudience !== 'undefined' && requiredAudience !== null`), array branch `:780-782`, throw `:787` |
| `verifyIdToken` requires only `idToken`; a missing `audience` is not an error | `oauth2client.js:536-543` |
| `jsonwebtoken` routes a **string** `expiresIn` through `ms`, whose default unit is **milliseconds** | `node_modules/jsonwebtoken/lib/timespan.js:6-13`; `node_modules/ms/index.js:53,60` |
| `TOKEN_EXP` is a `number` when defaulted and a `string` when supplied by env, and `jwt.ts` hides this behind `as number` | `config.ts:23` (`= 30*24*60*60`) vs `services/jwt.ts:31` (`expiresIn: (TOKEN_EXP as number)`) |
| The e2e stack runs the API as `NODE_ENV: development`, not `test`; `run-e2e.sh` exports nothing | `docker-compose.e2e.yml:73`; `scripts/run-e2e.sh` (30 lines, no `export`) |
| The e2e suite is serial and single-worker, all traffic from one container IP | `e2e/playwright.config.ts:6-7` (`fullyParallel:false`, `workers:1`), `:9` `retries:0`; `docker-compose.e2e.yml:115` `API_URL: http://api:3000` |
| `assertDbHardening()` is fire-and-forget; `app.listen` runs regardless | `index.ts:120-125` (`.catch`, not awaited) vs `index.ts:128` |
| `sort`/`order` already pass **two** allowlist layers, so no injection is reachable today | `services/validations.ts:13-14` (Zod enums) + `utils/sortOptions.ts:14-21` (`getSortValue` falls back to `created_at`; `getOrderValue` collapses to `asc`/`desc`) |
| The query factories type `sort` as a bare `string`, so a fourth caller could bypass both layers and still compile | `services/queries.ts:309`, `:353` |
| `StepRequired` has exactly one throw site | `models/auth.ts:434-439` (`SCHOOL_IDS_REQUIRED`); mapped at `middlewares/errors.ts:44-51` |
| The client's non-Axios error branch drops `data`; the Axios branch preserves it | `client/services/errors.ts:78-87` (no `data`) vs `:71-77` (`data: tryParseJson(err.response?.data)?.data`) |
| Only one of three `comparePasswords` call sites is unguarded against a `null` hash | guarded: `models/auth.ts:272-274`, `models/self.ts:462-465`; **unguarded**: `models/admin.ts:161-164`; definition `services/hash.ts:8-10` |
| Admin **login** uses a `min(6)` password schema, so raising the global minimum would lock admins out | `services/validations.ts:361,371`; user login is already minimum-free at `:232` |
| Express's default JSON body limit is already 100kb | `index.ts:43` calls `express.json()` with no options |
| The production image sets no `NODE_ENV`; only `compose.yml` does | `Dockerfile.api:68` (`CMD ["node", "dist/index.js"]`) vs `compose.yml:22` |

Consequence of facts 1–2: **SEC-04 is a symptom of SEC-01.** The `audience` argument is present; it
is the unvalidated env var behind it that can silently become `undefined`. D4 fixes both ends.

Consequence of facts 5–6: **the rate limiter cannot be gated on `NODE_ENV`** (D3).

## Architecture Decisions

### D1 — `env.ts`: one schema, three requirement tiers, fail-fast only in production

A new `server/api/src/env.ts` owns the contract. `config.ts` imports from it and re-exports the same
names it exports today, so the ~40 modules importing `config.js` are untouched.

```ts
// server/api/src/env.ts
const isProd = process.env.NODE_ENV === "production";

/** Required in production, warned-and-defaulted elsewhere. */
const prodSecret = (devDefault: string) =>
  isProd ? z.string().min(1) : z.string().min(1).default(devDefault);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  TOKEN_EXP: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
  ADMIN_TOKEN_EXP: z.coerce.number().int().positive().default(30 * 60),

  JWT_SECRET: prodSecret("jwt_secret_dev_only"),
  ADMIN_JWT_SECRET: prodSecret("admin_jwt_secret_dev_only"),
  ADMIN_PASS_TOKEN: prodSecret("admin_pass_token_dev_only"),
  DB_APP_PASSWORD: prodSecret("loop_app_dev"),
  DB_UNSCOPED_PASSWORD: prodSecret("loop_unscoped_dev"),
  FRONTEND_URL: isProd ? z.url() : z.url().default("http://localhost:8081"),
  ADMIN_FRONTEND_URL: isProd ? z.url() : z.url().default("http://localhost:5173"),
  WEB_GOOGLE_CLIENT_ID: prodSecret("web-google-client-id-dev"),
  ADMIN_GOOGLE_CLIENT_ID: prodSecret("admin-google-client-id-dev"),

  ANDROID_GOOGLE_CLIENT_ID: z.string().optional(),
  IOS_GOOGLE_CLIENT_ID: z.string().optional(),
  RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  // …optional remainder
});
```

Three tiers, deliberately:

| Tier | Behavior in production | Behavior in dev/test |
|---|---|---|
| Required secret (9 vars) | `z.string().min(1)` — parse fails, process aborts | defaulted, one `console.warn` per defaulted var |
| Typed with a safe default | coerced, bounded | identical |
| Optional | `undefined` allowed | identical |

**Production additionally rejects the dev sentinels themselves** via a `superRefine`: a deployment
that literally sets `JWT_SECRET=jwt_secret_dev_only` is treated as unset. This is what makes the
`jwt_secret_dev` class of defect unrepeatable rather than merely renamed.

Failure reports **every** missing variable at once and exits non-zero *before* `app.listen`:

```
[env] Configuración inválida para NODE_ENV=production:
  - JWT_SECRET: requerido en producción
  - FRONTEND_URL: requerido en producción
```

**Rejected**: validating inside `config.ts` — it is imported by `scripts/migrate.ts` and
`scripts/seed.ts`, which legitimately run with a different variable set; a separate module lets the
API entrypoint opt in and the scripts opt out. **Rejected**: `envalid` — one more dependency when
Zod 4.0.17 is already present (`server/api/package.json:39`).

`RATE_LIMIT_ENABLED` is `z.enum(["true","false"])` rather than `z.coerce.boolean()` because
`Boolean("false")` is `true`; a typo must fail loudly, not silently enable.

### D2 — `ADMIN_JWT_SECRET`: two secrets, two verify functions, explicit algorithm

`services/jwt.ts` today signs both token kinds with `JWT_SECRET` (`:30`, `:60`) and exposes one
`parseToken` that verifies with it (`:38`). The separation is currently carried only by the
`isAdmin` claim, and `UserTokenPayload` (`:12-20`) makes the admin fields optional on the same type,
so the two are structurally interchangeable.

```ts
const signOpts = { algorithm: "HS256" as const };
const verifyOpts = { algorithms: ["HS256" as const] };

export const generateToken = (…) => jwt.sign(payload, env.JWT_SECRET,
  { ...signOpts, expiresIn: env.TOKEN_EXP });
export const parseToken = (t: string) =>
  jwt.verify(t, env.JWT_SECRET, verifyOpts) as UserTokenPayload;

export const generateAdminToken = (…) => jwt.sign(payload, env.ADMIN_JWT_SECRET,
  { ...signOpts, expiresIn: env.ADMIN_TOKEN_EXP });
export const parseAdminToken = (t: string) =>
  jwt.verify(t, env.ADMIN_JWT_SECRET, verifyOpts) as AdminTokenPayload;
```

`expiresIn` now receives a **number** from D1's `z.coerce.number()`, which closes the
milliseconds-vs-seconds trap (fact 3) without any call site knowing about it. The `as number`
assertions at `jwt.ts:31,61` are deleted, not kept — they were hiding the bug.

`AdminTokenPayload` becomes a **separate** interface from `UserTokenPayload`, so a user payload no
longer type-checks where an admin payload is expected. `middlewares/parseAdminToken.ts` switches to
`parseAdminToken`. Its existing behavior of deriving the community from the token, never the body
(`parseAdminToken.ts:55-77`), is preserved untouched — that is one of the things the audit lists as
already correct.

Deploying this invalidates live admin sessions. Admin tokens last 30 minutes (`config.ts:25`), so the
blast radius is one deploy window; no migration or grace path is warranted.

**Rejected**: deriving the admin secret as `HMAC(JWT_SECRET, "admin")`. It removes the second
variable but keeps one root secret, so a `JWT_SECRET` leak still yields admin forgery — which is the
exact property SEC-02 exists to break.

### D3 — Rate limiting gated on an explicit flag, never on `NODE_ENV`

The e2e API runs as `development` (fact 5), so `NODE_ENV`-based gating either exempts e2e by accident
(leaving the limiter untested and silently disabled in every dev environment) or throttles a serial
suite issuing hundreds of requests from one IP (fact 6). Neither is acceptable, so the switch is
explicit:

```ts
// server/api/src/middlewares/rateLimit.ts
export const makeLimiter = (opts: { windowMs: number; max: number; name: string }) => {
  if (!env.RATE_LIMIT_ENABLED) return (_q, _s, next: NextFunction) => next();
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => `${opts.name}:${ipKeyGenerator(req)}:${emailOf(req.body)}`,
    handler: (_q, res) => res.status(429).json({ success: false,
      error: "Demasiados intentos. Probá de nuevo en unos minutos.",
      errorCode: "RATE_LIMITED" }),
  });
};
```

`RATE_LIMIT_ENABLED` defaults to `true` and is set to `false` only in `docker-compose.e2e.yml`. D1
forbids `false` in production via `superRefine`, so it cannot be used to disable protection on a real
deployment.

| Route | Window | Max | Key |
|---|---|---|---|
| `POST /auth/login` | 15 min | 10 | IP + email |
| `POST /auth/register` | 1 h | 5 | IP |
| `POST /auth/resend-verification` | 1 h | 3 | IP + email |
| `POST /auth/google-login` | 15 min | 20 | IP |
| `POST /admin/login`, `POST /admin/register` | 15 min | 10 | IP + email |
| `POST /me/delete-request` | 1 h | 3 | IP + email |
| `POST /messages` | 1 min | 30 | IP + `userId` |

The email component is what makes this useful: a per-IP-only limit is trivially evaded from a
botnet, and a per-email-only limit lets one attacker lock out a victim. Both keys together bound
credential stuffing without turning into an account-lockout denial of service — there is no lockout
state, only a rolling window.

The two mail-sending paths (`register`, `resend-verification`) get the tightest limits because they
spend a third-party quota (Resend) rather than only CPU.

`app.set("trust proxy", …)` must be set for the IP key to be meaningful behind Caddy
(`compose.caddy.yml`). It is set to `1` (one proxy hop) rather than `true`, because `true` lets any
client spoof `X-Forwarded-For` and forge its own rate-limit key.

**Rejected**: a global `app.use(limiter)`. `/listings` and `/messages` polling would trip it, and a
blanket limit invites a number so high it protects nothing.

### D4 — Google `audience`: explicit arrays, split by trust boundary

Both verifiers already pass `audience` (fact 1), so the change is what they pass and the guarantee
that it is never `undefined`:

```ts
// services/googleOauth.ts
export const END_USER_AUDIENCES = [
  env.WEB_GOOGLE_CLIENT_ID,
  env.ANDROID_GOOGLE_CLIENT_ID,
  env.IOS_GOOGLE_CLIENT_ID,
].filter((v): v is string => !!v);

export const ADMIN_AUDIENCES = [env.ADMIN_GOOGLE_CLIENT_ID];
```

`models/auth.ts:365-368` passes `END_USER_AUDIENCES`; `models/admin.ts:216-219` passes
`ADMIN_AUDIENCES`. The library's array branch (`oauth2client.js:780-782`) does an `indexOf`, so an
array is directly supported.

**The two lists are deliberately disjoint.** Passing the end-user IDs to the admin verifier would let
an ID token minted for the Expo app authenticate against the admin panel, leaving only the email
allowlist between an ordinary user and the admin surface. That is why the proposal's C3 departs from
the task's "pass all four to both".

`.filter(Boolean)` handles the android/ios IDs being optional (D1 tier 3) — but a guard asserts the
end-user list is **non-empty**, because an empty array would make `indexOf` always fail and break
every Google login rather than fail open. This finally gives `ANDROID_GOOGLE_CLIENT_ID` /
`IOS_GOOGLE_CLIENT_ID` (`config.ts:29-30`) their first consumer.

### D5 — Uniform login: one error, one cost

Three outcomes are observable today on the user path — `USER_NOT_FOUND` (`models/auth.ts:270`),
`INCORRECT_LOGIN_METHOD` (`:272-274`) and `INVALID_CREDENTIALS` (`:278`) — plus a timing oracle,
because bcrypt at `:276` runs only when the user exists. `models/admin.ts:161-166` has the same two
codes and additionally throws `InvalidInputError` (400) where the user path throws
`UnauthorizedError` (401).

```ts
// services/hash.ts — cost must match the live hashes
const DUMMY_HASH = "$2b$10$…";                    // bcrypt of a fixed string, same cost factor
export const comparePasswords = async (password: string, hash: string | null) =>
  bcrypt.compare(password, hash ?? DUMMY_HASH);   // null-safe (fact 12) and constant-cost
```

```ts
// models/auth.ts and models/admin.ts, both paths
const ok = await comparePasswords(password, userDb?.password ?? null);
if (!userDb || !userDb.password || !ok) {
  throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
}
```

The bcrypt call moves **before** the branch, so all three failure modes execute the same work and
return the same 401 with the same `errorCode`. This single edit closes SEC-03's enumeration, SEC-03's
timing oracle, and SEC-16's `comparePasswords(x, null)` 500 (fact 12) at once. `DUMMY_HASH`'s cost
factor must equal the live one or the timing oracle reopens; a test asserts it.

`EMAIL_NOT_VERIFIED` (`auth.ts:284-286`) stays distinct on purpose: it is only reachable *after* the
password has been proven correct, so it tells an attacker nothing they did not already know. The
audit itself lists that ordering as already-correct behavior.

**Rejected**: keeping distinct codes and adding an artificial delay. Fixed delays are still
distinguishable statistically, and a random delay only widens the distribution.

### D6 — Password minimum 8 on creation paths only

`passwordSchema` (`services/validations.ts:12`) goes `min(6)` → `min(8)`. But the admin **login**
schemas at `:361,371` inline `z.string().min(6).max(100)`, and raising those denies login to every
admin whose password is 6–7 characters (fact 13).

| Schema | Site | Change |
|---|---|---|
| `passwordSchema` | `:12` | `min(6)` → `min(8)` |
| `registerSchema.password` | `:220` | inherits 8 |
| `updateSelfSchema.password` | `:256` | **removed entirely** (D7) |
| new `changePasswordSchema.newPassword` | new | `passwordSchema` (8) |
| new `resetUserPasswordSchema.newPassword` | new | `passwordSchema` (8) |
| admin **register** | `:371` | → `passwordSchema` (8) |
| admin **login** | `:361` | **unchanged at `min(6)`** — never raise a login minimum |
| user **login** | `:232` | unchanged (`max(100)`, no minimum) |

`adminClient/src/services/validations.ts` and `ResetPasswordModal.tsx` move 6 → 8 in the same PR, or
the admin panel offers a form the API will reject. The Expo client has no explicit minimum, so it
needs no change; its API error is already mapped through `client/services/errorMapping.ts`.

### D7 — Password change: remove the silent path, validate the loud one

Two separate defects share one root — a password can be written without proving the old one, and
without validating the new one.

`updateSelfSchema.password` (`:256`) is deleted. The schema is already `.strict()` (`:259`), so
`PATCH /me` with a `password` field now **rejects** rather than silently ignoring — the failure is
visible, which is the point. `models/self.ts:115-118` loses its fallback expression, which today
silently keeps the old hash when validation fails:

```ts
password = password && (await safeValidatePassword(password)).success
  ? await hashPassword(password)
  : (user.password ?? undefined);      // ← deleted along with the schema field
```

`controllers/self.ts:294-308` gains the validation it has never had — `newPassword` reaches
`hashPassword("")` today (`models/self.ts:470`), and `trimBody` turns `"   "` into `""` first
(`middlewares/trimBody.ts:7`), so an all-whitespace password is currently storable.

```ts
const { oldPassword, newPassword } = await validateChangePassword(req.body);
```

`POST /me/change-password` keeps its existing `oldPassword` verification (`models/self.ts:466-469`),
which is already correct.

**Session invalidation is deliberately not done here.** It needs `password_changed_at` (a migration,
owned by `db-integrity-migrations`) plus a token-payload epoch compared in
`middlewares/parseToken.ts`. That file contains a legacy branch (`:69-86`) that silently re-issues a
fresh 30-day token to any holder of a `communityId`-less token; adding epoch logic beside it risks
either logging out every user or failing to log out any. Recorded as a follow-up.

### D8 — Admin endpoint schemas

Five endpoints accept `req.body` unvalidated. `controllers/admin.ts:205` carries the literal comment
`// No hay validaciones porque es administrador`.

```ts
// services/validations.ts
const modifyCreditsSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
  positive: z.boolean(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).strict();

const notificationTypeSchema = z.enum(["mission", "loop", "donation", "admin"]);
const sendNotificationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mission"),  payload: missionPayloadSchema }),
  z.object({ type: z.literal("loop"),     payload: loopPayloadSchema }),
  z.object({ type: z.literal("donation"), payload: donationPayloadSchema }),
  z.object({ type: z.literal("admin"),    payload: adminPayloadSchema }),
]).and(z.object({ userId: z.uuid() }));
```

`amount` as `z.number().int().positive()` is the whole SEC-07 credit fix: today `amount` is untyped
`any` (`controllers/admin.ts:179`), and a negative value with `positive: true` reaches
`increaseUserBalance` (`models/admin.ts:363-367`) and *subtracts* — arbitrary balance manipulation.
`positive: z.boolean()` matters just as much, because the model truthy-branches on it. The
`max(1_000_000)` bound is a blast-radius cap on a typo, not a security boundary.

`meta` stays a permissive record: it is `JSON.stringify`'d into the wallet transaction
(`models/admin.ts:359`) and its shape is genuinely open-ended. Bounding it to an object at least stops
a scalar or array from being stored where a ledger reader expects a map.

The notification discriminated union is keyed on `NotificationType` from
`shared/types/app.d.ts:13`. Per-type payload shapes come from `app.d.ts:208-249`. **Note the drift**:
the existing Zod union at `services/validations.ts:169-202` disagrees with `app.d.ts` (it expects
`missionId`/`mission`/`reward` where the type says `userMissionId`, and a nested `target` object where
the type says a flat `target` + `referenceId`). That union is a **response** validator
(`validateNotification`, `:204`) and is not reused; the new input schemas follow `app.d.ts`, and the
discrepancy is recorded as a follow-up rather than reconciled here.

`createSchool`/`updateSchool` get `name: z.string().min(1).max(200)` and `mediaId: z.uuid()`, plus the
`validateId` on `schoolId` that `controllers/admin.ts:263-271` currently omits.

### D9 — Pagination: bound it, and make `limit` real

`services/validations.ts:262-268` is wrong in a way the audit inverts (proposal C5):

```ts
const paginatedQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  sort: sortSchema.optional(),
  order: orderSchema.optional(),
}).strict();
```

`z.coerce.number()` also fixes a live defect: `page` is declared `z.number()` today while Express
query params are strings, so validation depended entirely on the upstream `safeNumber`
(`utils/safeNumber.ts:1-4`) conversion. `Infinity` survives both today and reaches
`(page - 1) * PAGE_SIZE` at `models/listings.ts:65` and `models/admin.ts:312`; `.int()` rejects it.
`limit` becomes an actual number that the models consume instead of the hardcoded `PAGE_SIZE`, and
`controllers/admin.ts:167` (`page: page ? Number(page) : 1`, bypassing Zod entirely) is routed through
the schema.

### D10 — SQL: constants by type, wildcards by helper

No injection is reachable today (fact 8), so this is defence in depth against a fourth call site
(fact 9). The fix is to make the compiler carry the guarantee that convention carries now:

```ts
// utils/sortOptions.ts
export type SortColumn = (typeof SORT)[SortOptions];   // "created_at" | …
export type SortDirection = "asc" | "desc";
```

The three factories at `services/queries.ts:309,353,530` change their parameter types from `string` to
`SortColumn` / `SortDirection`. The interpolation at `:327`, `:387`, `:568` stays textually similar but
can now only receive a value that originated in the `SORT` map, and a raw string stops compiling.

`LIKE` wildcards get one shared helper applied at `:318-321`, `:339`, `:369-370`, `:543-544` and at
`models/admin.ts:315` (which builds `%${search}%` in JS):

```ts
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);
```

with `ESCAPE '\'` added to each `LIKE` clause. Backslash is escaped first by including it in the same
character class — escaping `%` and `_` with a backslash while leaving literal backslashes untouched
would corrupt the pattern. A search for `%` becomes a search for a literal percent sign rather than a
full-table scan.

`searchSchools` (`queries.ts:331-350`) already avoids interpolation with a parameterized
`CASE WHEN` ordering and is left alone.

### D11 — `/health` and `/status`

`/status` (`index.ts:66-68`) echoes `NODE_ENV` to any unauthenticated caller. It becomes a fixed
string, because the e2e healthcheck (`docker-compose.e2e.yml:96`) depends on the route existing:

```ts
app.get("/status", (_q, res) => res.status(200).send("ok"));
```

`/health` is new and is the one that touches the database:

```ts
app.get("/health", async (_q, res) => {
  try {
    const [{ rls_enabled }] = await withClient(
      async (c) => c.query(HEALTH_QUERY, []),
      { scope: unscoped("health") },
    );
    if (!rls_enabled) return res.status(503).json({ status: "degraded", db: "up", rls: "off" });
    return res.status(200).json({ status: "ok", db: "up", rls: "on" });
  } catch {
    return res.status(503).json({ status: "down", db: "down" });
  }
});
```

The RLS probe reuses the `TENANT_TABLES` / `relrowsecurity` check that `assertDbHardening()` already
performs (`services/postgresClient.ts:230-233`), so the two cannot drift. The body is deliberately
coarse — `up`/`down`/`on`/`off`, never a version, hostname, driver error or `NODE_ENV` — because this
endpoint is unauthenticated by necessity.

It also runs `unscoped("health")`, which is the correct scope per `AGENTS.md`: a health probe belongs
to no community, so `inCommunity(id)` has no meaningful argument.

`/health` is **not** rate-limited (an uptime monitor polls it) but is exempted from `helmet`'s
`noCache` only insofar as it sets `Cache-Control: no-store` itself.

### D12 — `helmet` with two explicit overrides

Defaults are taken except where they would break this specific app:

```ts
app.use(helmet({
  contentSecurityPolicy: false,          // API returns JSON; CSP belongs on the web/admin origins
  crossOriginResourcePolicy: { policy: "cross-origin" },  // uploads are read cross-origin
}));
```

`contentSecurityPolicy` is disabled rather than configured because a JSON API's CSP protects nothing
and helmet's default `default-src 'self'` would apply to the statically served uploads
(`routes/uploads.ts:17`). `crossOriginResourcePolicy` must be `cross-origin` or helmet's default
`same-origin` blocks every uploaded image in the Expo web client and the admin panel — this is the
single most likely way this change breaks the UI, so it is set explicitly rather than left to a
default.

`helmet` mounts **first**, before `express.json()`, so headers are present on parser errors too. This
also fixes the existing ordering oddity where CORS is mounted *after* the body parser
(`index.ts:43` vs `:45`), by moving `cors` above `express.json()`.

`express.json({ limit: "100kb" })` makes the existing default explicit (fact 14) — no behavior change,
but the value stops being invisible.

### D13 — `sendPushNotification`: await, catch, and stop logging the token

`services/expoNotifications.ts:20` floats its promise, so a rejection is an unhandled rejection.
Worse, `utils/notifications.ts:55` *does* `await` the wrapper — but the wrapper has already returned,
so the await is inert and the caller believes it succeeded.

```ts
try {
  const tickets = await expo.sendPushNotificationsAsync([{ to, title, body, categoryId }]);
  const failed = tickets.filter((t) => t.status === "error");
  if (failed.length) console.error("[push] envío rechazado", failed.map((f) => f.details?.error));
} catch (err) {
  console.error("[push] error enviando notificación", err instanceof Error ? err.message : err);
}
```

The function still resolves rather than rethrowing: a failed push must never fail the business
operation that triggered it (accepting an offer, completing a mission). Expo's per-ticket `status`
is checked too, because the SDK resolves successfully while reporting per-device errors in the
tickets — an awaited call alone would still swallow those.

`expoNotifications.ts:17` stops logging the raw push token (a device credential) and logs only that
an invalid token was rejected.

### D14 — `StepRequired` → 409

`middlewares/errors.ts:44-51` returns HTTP 200 for a failure. It becomes 409, which per fact 11 is
observed by exactly one client branch, and per fact 11's client rows actually *repairs* it: today
`hooks/useGoogleLogin.ts:10-12` throws a plain `{ message, errorCode }` that loses `data`, so
`GoogleSignInButton.tsx:96`'s `error?.data?.community` is always `undefined`. A 409 makes axios throw,
routing through `parseApiError`'s Axios branch (`client/services/errors.ts:71-77`), which does return
`data`.

409 over 400 because `client/services/errors.ts:8-13` maps 409 → `ConflictError` and 400 →
`InvalidInputError`; keeping "you must complete a step" distinct from "your input was malformed"
preserves the client's ability to tell them apart. `success: false`, `error`, `errorCode` and `data`
keep their exact shapes, so only the status line changes.

### D15 — Env plumbing: `PORT`, `POSTGRES_PORT`, and one template

Three separate drifts (proposal C9):

- **`POSTGRES_PORT`** is documented in both templates and all compose files but hardcoded `5432` at
  `services/postgresClient.ts:47` and `scripts/migrate.ts:207`. Both read `env.POSTGRES_PORT`
  (default 5432 — no behavior change unless set).
- **`PORT` vs `API_PORT`**: the app listens on `PORT` (`config.ts:21`, `index.ts:128`) which nothing
  sets, while `API_PORT` is set everywhere and read by nothing. Resolution: **`API_PORT` stays the
  host-side publish variable** (it is already correct in that role at `docker-compose.dev.yml:42`,
  `"${API_PORT:-3000}:3000"`) and `PORT` stays the in-container listen port, fixed at 3000. Both
  templates document the distinction in a comment. This is chosen over renaming because renaming
  would touch four compose files and a deployed Coolify configuration for no functional gain.
- **One template**: `server/.env.template` (which lacks `DB_APP_*`/`DB_UNSCOPED_*` entirely) is
  deleted and folded into the root `.env.template`, which gains `FRONTEND_URL`, `ADMIN_FRONTEND_URL`,
  `ADMIN_JWT_SECRET`, `PORT`, `TOKEN_EXP`, `ADMIN_TOKEN_EXP`, `UPLOAD_DIR` and `RATE_LIMIT_ENABLED`.
  A test asserts template ↔ schema parity so they cannot drift again.

`config.ts:4-12` loads dotenv from `path.resolve(process.cwd(), "../../.env")` — the repo root — and
that stays, but `env.ts` must not assume it succeeded: it is a `require()` in a silent `try/catch` of
a package that is only a devDependency.

`Dockerfile.api` gains `ENV NODE_ENV=production` in its production stage (`:68`), because every
production guard in this change keys on it and the image currently sets nothing (fact 15).

### D16 — `trimBody` recursion

`middlewares/trimBody.ts:3-12` walks only top-level keys with `for…in` (which also traverses
inherited enumerable properties).

```ts
const deepTrim = (value: unknown, depth = 0): unknown => {
  if (depth > 10) return value;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((v) => deepTrim(v, depth + 1));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepTrim(v, depth + 1)]),
    );
  }
  return value;
};
```

`Object.entries` replaces `for…in` so inherited properties are not walked, the prototype check avoids
mangling `Date`/`Buffer`, and the depth cap bounds a hostile deeply-nested body. Note this makes
`trimBody` strictly stronger at turning `"   "` into `""` in nested fields — which is exactly why D7's
`newPassword` validation must land in the same change.

### D17 — Log hygiene in `services/email.ts`

Three sites leak PII, unconditionally and with no `NODE_ENV` guard:

| Site | Today | Becomes |
|---|---|---|
| `:16` | warns with the recipient address | logs that a send was skipped, no address |
| `:32` | logs recipient + Resend message id | logs the Resend id only |
| `:41` | logs the **full verification URL including the raw token** whenever `RESEND_API_KEY` is unset | logs that verification mail could not be sent |

`:41` is the serious one: the only guard is `RESEND_API_KEY` being falsy (`:6`), so a production
deploy with a rotated-out key silently writes account-takeover tokens to stdout.

Dev and e2e currently *depend* on that link being printed. So the log is retained **only** when
`NODE_ENV !== "production"`, behind an explicit `EMAIL_DEBUG_LINKS` flag defaulting to on outside
production — the e2e suite reads the token from the database rather than the log
(`docker-compose.e2e.yml:87` sets `REQUIRE_EMAIL_VERIFICATION: "true"` and the suite queries it), so
nothing in the automated path regresses.

## Data Flow

```
process.env
   │
   ▼
env.ts  ── Zod parse ──► production? ── missing/sentinel secret ──► print all, exit(1)
   │                          │
   │                          └── dev/test ──► warn per var, use marked default
   ▼
config.ts (re-export, unchanged public surface)
   │
   ├─► jwt.ts        JWT_SECRET → user tokens │ ADMIN_JWT_SECRET → admin tokens   (D2)
   ├─► googleOauth   END_USER_AUDIENCES [web,android,ios] │ ADMIN_AUDIENCES [admin] (D4)
   ├─► rateLimit.ts  RATE_LIMIT_ENABLED → real limiter | pass-through             (D3)
   ├─► postgresClient / migrate   POSTGRES_PORT                                    (D15)
   └─► index.ts      PORT → listen                                                 (D15)

index.ts middleware order (new):
   helmet → cors → express.json({limit}) → cookieParser → per-route limiters → routes → errors
```

## File Changes

| File | Action | Decision |
|---|---|---|
| `server/api/src/env.ts` | Create — Zod env schema, production abort | D1 |
| `server/api/src/config.ts` | Modify — re-export; drop `:22` default and `:74,77` fallbacks | D1 |
| `server/api/src/index.ts` | Modify — helmet/cors/json order, limiters, `/status`, `/health`, await validation before `:128` | D3, D11, D12 |
| `server/api/src/middlewares/rateLimit.ts` | Create — limiter factory + bypass | D3 |
| `server/api/src/services/jwt.ts` | Modify — two secrets, two verifies, `algorithms`, drop `as number` | D2 |
| `server/api/src/middlewares/parseAdminToken.ts` | Modify — use `parseAdminToken` | D2 |
| `server/api/src/services/googleOauth.ts` | Modify — audience arrays | D4 |
| `server/api/src/models/auth.ts` | Modify — uniform login `:269-279`; audiences `:365-368` | D4, D5 |
| `server/api/src/models/admin.ts` | Modify — uniform login `:158-171`; audiences `:216-219`; `escapeLike` at `:315` | D4, D5, D10 |
| `server/api/src/services/hash.ts` | Modify — null-safe + dummy hash | D5 |
| `server/api/src/services/validations.ts` | Modify — `:12` min 8; drop `:256`; `:262-268`; admin schemas | D6, D7, D8, D9 |
| `server/api/src/controllers/admin.ts` | Modify — wire schemas at `:167,177,197,246,263,355` | D8, D9 |
| `server/api/src/controllers/self.ts` | Modify — validate `newPassword` `:294-308` | D7 |
| `server/api/src/models/self.ts` | Modify — drop fallback `:115-118` | D7 |
| `server/api/src/services/queries.ts` | Modify — typed sort, `ESCAPE` clauses | D10 |
| `server/api/src/utils/sortOptions.ts` | Modify — export constant types | D10 |
| `server/api/src/utils/escapeLike.ts` | Create | D10 |
| `server/api/src/services/expoNotifications.ts` | Modify — await/catch, drop token log | D13 |
| `server/api/src/middlewares/trimBody.ts` | Modify — recursive | D16 |
| `server/api/src/middlewares/errors.ts` | Modify — `:44-51` → 409 | D14 |
| `server/api/src/services/email.ts` | Modify — `:16,32,41` | D17 |
| `server/api/src/services/postgresClient.ts` | Modify — `:47` port; export health probe | D11, D15 |
| `server/api/src/scripts/migrate.ts` | Modify — `:207` port | D15 |
| `server/api/package.json` | Modify — add `helmet`, `express-rate-limit` | — |
| `.env.template` | Modify — regenerated | D15 |
| `server/.env.template` | Delete — folded into root | D15 |
| `docker-compose.dev.yml` | Modify — new vars | D15 |
| `docker-compose.e2e.yml` | Modify — `RATE_LIMIT_ENABLED=false`, secrets | D3, D15 |
| `compose.yml` | Modify — new required vars | D15 |
| `Dockerfile.api` | Modify — `ENV NODE_ENV=production` | D15 |
| `adminClient/src/services/validations.ts`, `components/ResetPasswordModal.tsx` | Modify — min 8 | D6 |

## Testing Strategy

`openspec/config.yaml:14` records `strict_tdd: false` and notes the `server/api` Jest suite is known
stale/red (INF-06, owned by `delivery-and-ci`). So the strategy is: **new tests are pure and
hermetic**, added as unit tests that do not need the broken integration harness, plus the e2e suite
as the regression gate.

| Layer | What | Approach |
|---|---|---|
| Unit (pure) | Env schema | Parse a synthetic `process.env` object: production + complete → ok; production − each required var → throws naming it; production + dev sentinel → throws; development − everything → succeeds with warnings |
| Unit (pure) | Template ↔ schema parity | Every key the schema declares appears in `.env.template`, and vice versa. This is the guard that stops INF-11 recurring |
| Unit (pure) | `TOKEN_EXP` coercion | `TOKEN_EXP="2592000"` (string) yields the number `2592000`, and a token signed with it expires in 30 days, not 43 minutes (fact 3) |
| Unit (pure) | JWT separation | A token signed with `JWT_SECRET` fails `parseAdminToken`; an admin token fails `parseToken`; a token with `alg: none` is rejected |
| Unit (pure) | `escapeLike` | `%`, `_`, `\` and combinations; `\` escaped before `%`/`_` |
| Unit (pure) | `deepTrim` | Nested objects, arrays, `Date`/`Buffer` untouched, depth cap, no prototype walking |
| Unit (pure) | Admin schemas | `amount` rejects negative, zero, fractional, string, `Infinity`; `positive` rejects non-boolean; `sendNotification` rejects an out-of-enum `type` and a payload mismatched to its type |
| Unit (pure) | Pagination | `page`/`limit` coerce from strings, reject `Infinity`, `0`, `-1`, and clamp at their maxima |
| Unit (supertest) | Rate limiter | Limiter mounted on a throwaway express app: request N+1 in the window returns 429 with `errorCode: "RATE_LIMITED"`; with `RATE_LIMIT_ENABLED=false` it never trips. This is why disabling it in e2e costs no coverage |
| Unit (supertest) | Uniform login | Unknown email, Google-only account and wrong password produce byte-identical bodies and the same status |
| Unit (pure) | Dummy-hash cost | `DUMMY_HASH`'s bcrypt cost factor equals the one `hashPassword` produces — otherwise D5's timing fix silently regresses |
| Manual | Timing | 100 logins against an unknown vs a known address; medians within noise |
| Manual | helmet/CORP | Load an uploaded image in the Expo web client and the admin panel — the single most likely UI break (D12) |
| Manual | Google signup | Real Google account with no schools chosen → 409 → school-selection screen still opens (D14) |
| Regression | E2E | `npm run test:e2e` — 40 tests, must stay 40/40 |
| Regression | Types/lint | `npm run check-types` and `npm run lint` in `server/api`; `npm run lint` and `npm run build` in `adminClient` |
| Regression | SQL arity | `npm run check-sql` — D10 changes query text, and this script cross-checks parameter counts |

There is no CI (`.github/` does not exist), so all of the above is run locally before the PR.

## Threat Matrix

| Boundary | Change | Residual risk |
|---|---|---|
| Token forgery | `JWT_SECRET` default removed; admin key separated; `algorithms` pinned | A leaked `ADMIN_JWT_SECRET` still yields admin forgery — mitigated only by rotation |
| Account enumeration | Uniform 401 + constant-cost bcrypt on both login paths | Registration still answers distinguishably on a duplicate email (SEC-05, block `db-integrity-migrations`) |
| Google token substitution | Explicit disjoint audience arrays; env schema guarantees non-`undefined` | Google-login still links by email to a password account and marks it verified — pre-existing, recorded |
| Credential stuffing / mail-quota abuse | Per-route IP+email limiters | `trust proxy: 1` assumes exactly one proxy hop; a misconfigured deployment weakens the IP key |
| Privilege escalation via admin body | Zod schemas on all five admin endpoints | Admin authorization itself is unchanged (`resolveAdminGrant`) |
| Credit manipulation | `amount` integer-positive, `positive` boolean | The read-calculate-write race (ECO-01) is untouched — block `credit-economy-integrity` |
| SQL injection | Sort/order carried by types, `LIKE` wildcards escaped | None known; no injection was reachable before either |
| Secret disclosure via logs | Verification link and recipient removed | Other `console.*` sites across the API are not audited here (INF-10) |
| Unauthenticated info disclosure | `/status` fixed string; `/health` coarse | `/health` still confirms the service exists and whether the DB is up — accepted, it is the point of the endpoint |
| Uploaded-object access | **Unchanged** — still public | SEC-08, block `legal-public-routes` |

RLS and multi-tenancy are **not** touched: no query gains or loses a `community_id` predicate, and
the only new query (`/health`) runs `unscoped("health")`, which is correct for a probe that belongs to
no community. `openspec/config.yaml:18-19` asks that any change touching multi-tenancy or the credits
ledger be flagged high-risk — this change touches neither, and D8's credit validation constrains
inputs without altering balance arithmetic.

## Migration / Rollout

No database migration. Rollout is ordered because the env schema gates everything else:

1. Set the new variables in the deployment environment (`ADMIN_JWT_SECRET`, `FRONTEND_URL`,
   `ADMIN_FRONTEND_URL`, plus real values for the two Google client IDs) **before** deploying.
   Deploying first means the container refuses to start — by design, but avoidable.
2. Deploy. Live admin sessions end (30-minute tokens); user sessions are unaffected because
   `JWT_SECRET` keeps its value.
3. Verify `/health` returns `{"status":"ok","db":"up","rls":"on"}`.

Rollback is a single revert; the two behavior switches (`RATE_LIMIT_ENABLED`, and simply setting the
new variables) let the operational impact be neutralized without one.

## Open Questions

- [ ] None blocking. `RATE_LIMIT_ENABLED` window/max values in D3 are starting points chosen to be
      comfortably above normal use; they are configuration, tunable after observation.

## Recorded Follow-ups (not fixed here)

- **Session invalidation on password change** — needs `password_changed_at` plus a token epoch;
  hand to `db-integrity-migrations` (D7).
- **Notification schema drift** — the response validator at `services/validations.ts:169-202`
  disagrees with `shared/types/app.d.ts:208-249` on the `mission` and `admin` payload shapes (D8).
- **`NOTIFICATIONS_CATEGORIES` has a fifth value** (`MESSAGE: "message"`, `config.ts:233`) that is not
  in `NotificationType` (`app.d.ts:13`), and `ADMIN_NOTIFICATION` push texts are commented out
  (`config.ts:213-218`), so an admin-sent notification has no push-text path.
- **`hooks/useGoogleLogin.ts:10-12` drops `data`** when throwing on a `success: false` body. D14 makes
  this path unreachable for `SCHOOL_IDS_REQUIRED`, but the pattern remains for any future non-2xx-less
  error — block `client-critical-fixes`.
- **`middlewares/parseToken.ts:69-86`** silently re-issues a fresh 30-day token to any holder of a
  legacy token, with no retirement date.
- **`admin_valid_emails` seeds a hardcoded personal address** (`database_creation.sql:160`).
- **`cookieOptions.maxAge` is hardcoded to 30 days** (`config.ts:143`) regardless of `TOKEN_EXP`, so
  cookie and token lifetimes can disagree.
- **`server/api/src/tests/rls.test.ts:35`** hardcodes port 5432 and is skipped unless `RUN_DB_TESTS=1`
  (INF-06).
- **A `lint` script was added to `server/api/package.json`** during this planning session by something
  other than this change; it is unrelated to these artifacts and should be confirmed or reverted by
  the author before the PR.
