# Design: Delivery Pipeline, CI and Production Observability

## Technical Approach

Three failures compound into one: nothing verifies a change, nothing can deploy a change, and
nothing observes a deployed change. They are treated in that dependency order — make the artifacts
reproducible (lockfiles, pinned runtimes), make the deploy runnable (migrations, compose), then put
CI in front of both, because a pipeline that references commands which do not yet work is worse
than no pipeline.

The guiding constraint is that **CI must be runnable, not aspirational**. Every job below is
authored against a command verified to exist and to exit `0` after the phases preceding it. Where
a command exists but currently fails (root lint), the phase that fixes it precedes the phase that
gates on it.

## Verified Platform Facts

These were read from the repository, not assumed. Several contradict `AUDITORIA-2026-09.md` §5;
those are collected under "Corrections to the audit" below.

- **`migrate.ts` already compiles into the production bundle.** `server/api/tsconfig.prod.json:20-26`
  excludes `src/**/*.test.ts`, `src/tests/**/*.ts`, `src/scripts/seed.ts` and
  `../../shared/demo-data/**/*.ts` — but **not** `src/scripts/migrate.ts`. With
  `rootDir: "../../"` (`tsconfig.prod.json:4`) `tsc` emits `dist/server/api/src/scripts/migrate.js`,
  and `Dockerfile.api:60-63` flattens `./dist/server/api/src/*` to `./dist/`, yielding
  `dist/scripts/migrate.js`.
- **`migrate.ts` already resolves its SQL directory flexibly.** `server/api/src/scripts/migrate.ts:38`
  honours `MIGRATIONS_DIR`; `:41-43` falls back to `../migrations`, `server/migrations` and
  `migrations` relative to `process.cwd()`.
- **`tsx` is a devDependency** (`server/api/package.json:72`) and `migrate`/`migrate:status`
  (`:19-20`) invoke it. The production stage installs `--omit=dev` (`Dockerfile.api:54`), so the
  **`npm run migrate` script cannot run in the production image** — but `node dist/scripts/migrate.js`
  can.
- **The one-shot migrate pattern is already proven.** `docker-compose.e2e.yml:44-64` defines a
  `migrate` service and `:102-104` gates the API on
  `migrate: condition: service_completed_successfully`. `:38-42` gates `migrate` on a
  `pg_isready` healthcheck.
- **`index.ts:120-125`'s `process.exit(1)` is correct, not the bug.** It is fatal only when
  `NODE_ENV === "production"`; `server/api/package.json:14` sets `NODE_ENV=test` for Jest, which is
  why the guard never fires in tests. Once a `migrate` service runs first, the guard becomes a
  correct safety net instead of a crash-loop.
- **The API lockfile already carries the ARM64/musl sharp binaries.** `server/api/package-lock.json`
  contains `@img/sharp-linuxmusl-arm64`, `@img/sharp-linuxmusl-x64`, `@img/sharp-linux-arm64` and
  `@img/sharp-linux-x64`. The production stage is `node:22-alpine` (`Dockerfile.api:49`), so musl
  builds are the ones that matter.
- **The lockfile is ignored twice.** `.gitignore:4` (`/server/**/package-lock.json`) and
  `server/api/.gitignore:3` (`package-lock.json`). Both must change or `npm ci` stays impossible.
- **`check-sql-arity.py` is at `server/scripts/`, not `scripts/`.** It is invoked as
  `server/api/package.json:22` → `"check-sql": "python3 ../scripts/check-sql-arity.py"`, which is
  correct because npm runs with `cwd = server/api`. Nothing automated calls it today.
- **`e2e` Playwright has exactly one project.** `e2e/playwright.config.ts:20-24` defines
  `name: "e2e"`; `scripts/run-e2e.sh:30` invokes `--project=e2e`.
- **Three `publish.js` scripts, none multi-arch.** `server/api/publish.js:23`,
  `client/publish.js:37`, `adminClient/publish.js:41` all use plain `docker build`. Combined with
  root `build:server` (`package.json:27`) and `scripts/docker-build.js:53`, there are **five**
  build paths, two of which point at a file that does not exist.

## Architecture Decisions

### D1 — Migrations ship as compiled JS invoked by `node`, not by `tsx` (phase 2)

`npm run migrate` cannot work in the production image because `tsx` is a devDependency stripped by
`--omit=dev`. Rather than shipping `tsx` into production (which pulls esbuild and a TypeScript
toolchain into a runtime image), the `migrate` service runs the already-compiled
`node dist/scripts/migrate.js`.

Two Dockerfile changes are required, both in the `production` stage:

1. `COPY server/migrations ./migrations` — placing them at `/app/migrations`, which
   `migrate.ts:43`'s `path.resolve(process.cwd(), "migrations")` candidate already finds with
   `WORKDIR /app` (`Dockerfile.api:50`).
2. Nothing else. `dist/scripts/migrate.js` is already present.

`MIGRATIONS_DIR=/app/migrations` is set explicitly on the compose service anyway, so the contract
does not silently depend on `cwd`.

**Rejected:** a separate `Dockerfile.migrate`. It would duplicate the build stage for one `COPY`,
and the migration runner must be byte-identical to the one the API's schema expectations were
compiled against.

### D2 — The `migrate` service is copied from the E2E stack, not designed fresh (phase 2)

`compose.yml` gains a `migrate` service mirroring `docker-compose.e2e.yml:44-64`: same image as
`api` (so the compiled runner matches), `restart: "no"` (one-shot), the owner DB credentials
(`POSTGRES_USER`/`POSTGRES_PASSWORD` — `migrate.ts` connects as the table owner because migrations
need DDL and the app role deliberately lacks it), and `DB_APP_*`/`DB_UNSCOPED_*` because migration
`0007_db_roles_and_rls.sql` raises if those passwords are empty.

`api.depends_on` becomes:

```
depends_on:
  db: { condition: service_healthy }
  migrate: { condition: service_completed_successfully }
```

`db` gains the `pg_isready` healthcheck from `docker-compose.e2e.yml:38-42`. A failing migration
now blocks the deploy — which is the intent, not a regression.

### D3 — Lockfiles are a prerequisite of multi-arch, not a parallel cleanup (phase 1)

`sharp` distributes native binaries as per-platform optional dependencies. Under `npm install`,
resolution happens on the *building* machine, so a `buildx` run can produce a `linux/arm64` image
whose `node_modules` lacks `@img/sharp-linuxmusl-arm64` — failing at the first upload rather than
at build time. `npm ci` from a committed lockfile installs the optional set recorded for the target
platform.

Therefore phase 1 (commit lockfiles, `.nvmrc`, `engines`, `npm ci`) strictly precedes phase 4
(buildx). Verification is explicit: run `node -e "require('sharp')"` inside the built `arm64` image
before it is pushed.

### D4 — One build script, `docker buildx`, replacing five paths (phase 4)

A single `scripts/build-images.sh` builds all three images:

```
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f "$DOCKERFILE" -t "$IMAGE:$VERSION" -t "$IMAGE:latest" \
  --push .
```

Image names stay `ezemastro/loop-{api,web,admin}` — the names `compose.yml:18,46,54` actually
consumes. Versions come from each package's own `package.json` (`loop-api` 1.0.0, `loop-web` 1.2.0,
`loop-admin` 0.3.0), matching what the three `publish.js` scripts already do; the root version
(`1.4.3`) is unrelated and is not used.

Build args are preserved: `Dockerfile.web` needs `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID` (`Dockerfile.web:20-23`); `Dockerfile.admin` needs
`VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` (`Dockerfile.admin:20-23`). The script MUST pass these
as an argv array (following `adminClient/publish.js:36-53`'s `execFileSync` discipline) or, in
bash, quoted — `client/publish.js:38-39` interpolates them unquoted into a shell string, which
breaks on a value containing a space or `;`.

`--push` is required: `buildx` cannot load a multi-platform result into the local daemon.

**Rejected:** keeping `publish.js` and adding `--platform`. That preserves three divergent
env-loading strategies (`client/publish.js:3` even depends on `dotenv`, which is not declared in
`client/package.json`) and three escaping strategies, for no benefit.

### D5 — The stale `api` Jest project is deleted, not repaired (phase 3)

`jest.config.js:4-14` defines an `api` project whose `setupFilesAfterEnv` (`:13`) is
`src/tests/setupAfterEnv.ts`, which at `:2` imports `src/index.ts`. That import has side effects:
`index.ts:128-130` binds a real listener on port 3000, and `postgresClient.ts:53,61` constructs two
real `pg` pools at module load. `teardown.ts` closes the server but never calls the exported
`closePools` (`postgresClient.ts:261`), so handles leak — the reason `test:debug`
(`server/api/package.json:15`) exists.

The tests themselves are dead:

| File | Verdict |
|------|---------|
| `users.test.ts:3-4` | Asserts 200 on `GET /users` with no token. `index.ts:90` and `routes/users.ts:9` both apply `tokenMiddleware`; `middlewares/parseToken.ts:51-53` returns 401. Fails by construction. |
| `roles.test.ts:3` | `GET /roles`. There is no `routes/roles.ts` and `index.ts:74-99` never mounts `/roles`. Express returns 404. Dead endpoint. |
| `schools.test.ts:6` | Asserts `length > 1` against an unseeded database. |
| `auth.test.ts:4-14` | Contains **no `expect` at all** — it passes on any status including 500. Its `:12-13` TODO admits the seeding precondition is missing. |

None of these is a repairable unit test; each needs a seeded database and a real HTTP stack, which
is precisely what `e2e/` already provides. They are deleted, and the coverage they pretended to
give is recorded as the E2E gap it always was. `auth.test.ts` is **not** "the working pattern" the
audit describes — it is the file that asserts nothing.

`rls.test.ts` moves into its own `integration` Jest project so that `setupAfterEnv` no longer boots
a server for it. Today it is matched by the `api` project's `testMatch: **/tests/**/*.test.ts`
(`jest.config.js:11`), so it pays the setup cost even while skipped by its own
`RUN_DB_TESTS === "1"` guard (`rls.test.ts:30-31`).

### D6 — `models/self.test.ts` is fixed by completing the mock, not by rewriting the module (phase 3)

`self.test.ts:1-8` mocks `../services/postgresClient` with a factory returning **only**
`dbConnection`. But `self.ts:4` imports `{ inCommunity, withClient }`, both of which are real
exports (`postgresClient.ts:151` and `:198`). Under the mock they are `undefined`, so every call
site throws `TypeError: withClient is not a function`. The mock is a leftover from before the
`withClient` refactor.

The fix is to extend the factory with `withClient` (invoking its callback with a mock client) and
`inCommunity`, and to unskip the four `it.skip`/`it.skip.each` blocks at `:47, :54, :68, :84`
that the broken mock forced into hiding. `self.ts` itself is not touched — this change owns no
product behavior.

The audit's prescription ("replicate the working `auth.test.ts` pattern") is declined: per D5,
`auth.test.ts` asserts nothing and is being deleted.

### D7 — Caddy: decide by observation, then delete (phase 5)

**Evidence assembled:**

1. `compose.yml` — the production stack — contains **no Caddy service**. Caddy exists only in
   `compose.caddy.yml` and in `server/docker-compose.prod.yml:36-48`, which this change deletes.
2. `compose.caddy.yml` is referenced by **nothing** — no script, no compose `include`, no CI. Its
   only mention in the entire repository is the prose line `AGENTS.md:122`, and `AGENTS.md` is
   itself documented as stale (INF-12).
3. Both Caddy definitions bind host ports **80 and 443** (`compose.caddy.yml:7-8`,
   `server/docker-compose.prod.yml:41-42`). A Coolify host's own proxy already owns 80 and 443.
   Two processes cannot bind them; Caddy could not have started on that host.
4. `Caddyfile:13` routes `admin.loop.reditinere.com` to `admin:3002`, but the admin container
   listens on **80** (`Dockerfile.admin:34`); `compose.yml:57-58`'s `"3002:80"` is a *host* port
   mapping, invisible to a container-network peer. If Caddy were live, the admin subdomain would
   have returned 502 since the day it was written.

**The discriminating observation** (the one external input this change needs): *does
`admin.loop.reditinere.com` serve the admin panel today?*

- **If yes** → Caddy is provably not the active proxy (point 4 makes a working admin subdomain
  impossible under Caddy). Delete `Caddyfile` and `compose.caddy.yml`, and document Coolify as the
  routing owner.
- **If no / unreachable** → Caddy may be live and broken. Then do **not** delete; instead fix
  `Caddyfile:13` to `admin:80` and document the hand-created external `proxy-network`
  (`compose.yml:80-82`).

The task carries both branches. Default expectation, on the strength of points 1–3, is deletion —
but the deletion task may not be checked off without the observation recorded, because
`git revert` is cheap and a dark production proxy is not.

**Uncertainty is stated plainly:** this design cannot reach the host. Coolify's actual routing
configuration lives in Coolify's own database, not in this repository, so no amount of repository
reading can settle it. Point 3 is strong but circumstantial.

### D8 — npm workspaces: **declined**, and isolated if ever reconsidered (phase 6)

The audit suggests workspaces "would fix lint, lockfiles and the misaligned zod versions in one
move". Examined against the repository, it fixes none of the three cleanly and costs a great deal.

**Against:**

- **`shared/` is not a package.** It is two plain source directories (`shared/types/`,
  `shared/demo-data/`) with no `package.json`, consumed through relative TypeScript paths
  (`server/api/tsconfig.json:47` includes `../../shared/**/*.ts`) and through `COPY shared ./shared`
  in all three Dockerfiles. Workspaces would not touch it; making it a real workspace package is a
  separate refactor with its own blast radius.
- **Workspaces do not align versions.** Hoisting is not pinning. The three `zod` ranges
  (`server/api/package.json:38` `4.0.17`, `client/package.json:65` `^4.1.5`,
  `adminClient/package.json:21` `4.3.5`) would still resolve to three trees. Only an explicit
  `overrides` block or a coordinated bump aligns them — and that works today, without workspaces.
- **Every Dockerfile install layer would have to be rewritten.** All three do
  `COPY package*.json ./` + `COPY <pkg>/package*.json ./<pkg>/` + a per-package `npm install`
  (`Dockerfile.api:6-10,27-34`, `Dockerfile.web:6-12`, `Dockerfile.admin:6-12`). Under a single
  root lockfile these become one hoisted install, and the `production` stage's
  `COPY server/api/package*.json ./` + `npm install --omit=dev` (`Dockerfile.api:53-54`) breaks
  outright — a workspace package cannot install standalone from a root lockfile. That is a rewrite
  of the exact file this change is simultaneously fixing to make deploys possible.
- **`adminClient` uses `overrides` to alias `vite` to `rolldown-vite`** (`adminClient/package.json:44-46`).
  Workspace hoisting plus a package-level `overrides` is a known source of surprising resolutions.
- **Sequencing.** Adopting workspaces during the change that first makes production deployable
  means a deploy failure has two candidate causes instead of one.

**For (and how each is obtained more cheaply):**

| Claimed benefit | Obtained instead by |
|---|---|
| Fixes root lint | Root lint already works via the `\|\|` fallback branch (`package.json:23`); it exits 1 on **real** findings, not on module resolution. See "Corrections". Removing the dead `--workspace` prefix is a one-line fix. |
| Fixes lockfiles | Un-ignoring `.gitignore:4` and `server/api/.gitignore:3`, committing the existing API lockfile, generating one for `adminClient`. Phase 1. |
| Aligns `zod` | A coordinated pin to one version across the three `package.json` files. Phase 6, droppable. |

**Decision: do not adopt npm workspaces in this change.** If it is ever reconsidered it belongs in
its own change with its own Docker verification matrix. Phase 6's task list keeps the zod alignment
and lint cleanup as standalone items so nothing here depends on that decision being revisited.

### D9 — Observability is additive and default-off (phase 7)

- **`pino`** replaces `console.*` in `middlewares/errors.ts` and `index.ts`, and subsumes `morgan`
  (today dev-only, `index.ts:59-63`) via `pino-http` so production finally has request logs.
- **Request id**: `pino-http`'s `genReqId`, honouring an inbound `X-Request-Id` when present and
  generating a UUID otherwise, echoed on the response.
- **`/health`**: owned by block `sec-hardening-api`. This change specifies the *observability*
  requirement — that it perform a real `SELECT 1` and report database reachability — and
  contributes only that if the endpoint already exists on apply. It does **not** create a competing
  route. Today's `/status` (`index.ts:65-67`) returns a static string and touches nothing; it is
  left alone because `docker-compose.e2e.yml:90-101` and `run-e2e.sh` depend on its current
  behavior.
- **Sentry**: wired but inert. Initialization is guarded on `SENTRY_DSN` being set; with no DSN the
  SDK is never initialized and no network call is made. The DSN is added to the env template as an
  empty, documented, optional value. Enabling it is an operator decision, not a code change.

### D10 — CI job graph (phase 8, authored last)

One workflow, `.github/workflows/ci.yml`. Action versions are pinned to major tags
(`actions/checkout@v4`, `actions/setup-node@v4`, `docker/setup-buildx-action@v3`,
`docker/setup-qemu-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6`).

| Job | Trigger | Runs |
|---|---|---|
| `lint-typecheck` | PR + push | Matrix over `server/api`, `client`, `adminClient`: `npm ci`, `npx eslint .`, `tsc --noEmit`. Plus one `check-sql` step (`server/api` only, `npm run check-sql`, needs `python3`). |
| `unit` | PR + push | `server/api`: `npx jest --ci --selectProjects unit`. `client`: `npx jest --ci --watchAll=false`. |
| `api-integration` | PR + push | `services: postgres:16` with a health-check; psql `server/database_creation.sql` then `server/create_categories.sql`; `npm run migrate`; then `RUN_DB_TESTS=1 npx jest --ci --selectProjects integration`. |
| `e2e` | PR + push | `bash scripts/run-e2e.sh` (needs Docker; `ubuntu-latest` has it). |
| `audit` | PR + push | `npm audit --audit-level=high` per package, `continue-on-error: true` — informational, never blocking. |
| `docker` | `push` on `v*` tags only | QEMU + buildx, `--platform linux/amd64,linux/arm64`, `--push`; needs `lint-typecheck`, `unit`, `api-integration`. |

Notes that make this runnable rather than aspirational:

- The `client` unit step calls `npx jest --ci --watchAll=false` **directly**, not `npm test`. Block
  `client-critical-fixes` owns `client/package.json:11`; CI must not depend on that landing first.
- `--selectProjects integration` requires D5's new Jest project to exist. Phase 3 precedes phase 8.
- `npm ci` in every job requires phase 1's lockfiles.
- `npm run check-sql` resolves `../scripts/check-sql-arity.py` from `server/api` — correct as-is.
- `e2e` is the slowest job and is not a dependency of `docker`; it gates the PR, not the tag build.

## Corrections to the Audit

`AUDITORIA-2026-09.md` §5 is accurate on severity and direction. Six factual points differ:

1. **INF-01 overstates the migration fix.** It prescribes "compile `migrate.ts` into
   `dist/scripts/`". That already happens — `tsconfig.prod.json:20-26` does not exclude it and
   `Dockerfile.api:60-63` flattens it into place. The real gap is only the missing `COPY` of
   `server/migrations` and the missing compose service. **What the audit missed:** `tsx` is a
   devDependency (`server/api/package.json:72`) stripped by `--omit=dev`, so the `migrate` **script**
   still cannot run in production even after the copy — the service must invoke
   `node dist/scripts/migrate.js` directly.

2. **INF-06 misidentifies the reference test.** It calls `auth.test.ts` the working pattern to
   replicate in `self.test.ts`. `auth.test.ts:4-14` contains no `expect` whatsoever and passes on
   any response, including a 500. It is not a pattern; it is the weakest file in the suite. D5/D6
   substitute a concrete fix.

3. **INF-06 understates `models/self.test.ts`.** The problem is not only the incomplete mock: four
   tests are already `it.skip`/`it.skip.each` (`:47, :54, :68, :84`) and there is stray debug output
   at `:16`. Fixing the mock without unskipping those restores almost no coverage.

4. **INF-12 lists `create_categories.sql` as a loose file to clean up.** It is a live build input:
   `e2e/Dockerfile.db-init:10` copies it to `/docker-entrypoint-initdb.d/02-categories.sql`, and it
   is a semantic contract for `shared/demo-data/catalog.ts:7` and `server/api/src/scripts/seed.ts:76`,
   which resolve categories **by name**. **It must not be deleted.** (`google_oauth_migration.sql` —
   superseded by `server/migrations/0000_baseline_reconcile.sql:22` — and
   `assignMissionsToAllUsers.sql` — zero references anywhere — are genuinely removable.)

5. **INF-12 misstates the root lint failure, and the file has since been renamed.** The audit says
   `eslint.shared.config.js` "imports plugins not installed at the root". The file is now
   `eslint.shared.config.mjs` (renamed in the working tree by a concurrent sibling block during this
   session; `git status` shows `RM eslint.shared.config.js -> eslint.shared.config.mjs`), and the
   `@typescript-eslint/no-unused-vars` rule was extracted into a separately exported
   `typescriptUnusedVars` (`:14-26`) precisely to avoid the plugin-registration failure. It is
   consumed *by each package's* config, where the prettier plugins are installed, so it resolves.
   **Measured, not inferred:** `npm run lint` at root today exits **1 with 25 real findings**
   (prettier formatting and unused-vars), not with a module-resolution crash. The `--workspace`
   prefix in `package.json:23` does fail (`ENOWORKSPACES`), but `2>/dev/null || (...)` routes every
   run to the working fallback. So root lint **runs**; it does not **pass**. Phase 6 must fix the
   25 findings before phase 8 can gate on it.

6. **Two broken scripts the audit does not list.** `package.json:33`
   (`"start": "docker compose -f docker-compose.prod.yml up"`) references a root
   `docker-compose.prod.yml` that **does not exist** — the only such file is
   `server/docker-compose.prod.yml`, which this change deletes. And `server/api/package.json:13`
   (`"start": "... node dist/app.js"`) points at `dist/app.js`, while the real compiled entry is
   `dist/index.js` (`Dockerfile.api:68` uses the correct path). Both are dead and are removed or
   corrected alongside INF-03.

Two further notes, not corrections: `ANALYSIS.md:5.6` claims `publish.js` is duplicated in **four**
packages; there are **three** (`server/api`, `client`, `adminClient`) — the audit's count is right.
And `AUDITORIA-PROGRESO.md`'s row for block F omits **INF-06**, which this change's brief includes;
the row should be updated to list it.

## Data Flow

**Deploy (after this change):**

```
compose up
  └─ db (postgres:16, pinned)         → healthcheck pg_isready
       └─ migrate (loop-api image)    → node dist/scripts/migrate.js
            │                            reads /app/migrations/*.sql
            │                            advisory lock + checksum verify
            └─ exits 0 ────────────── service_completed_successfully
                 └─ api               → node dist/index.js
                      assertDbHardening() now passes; process.exit(1) never fires
                      └─ healthcheck GET /health → SELECT 1
```

**CI:**

```
PR ──┬─ lint-typecheck (matrix: api | client | admin) ─┐
     ├─ unit (api unit project | client) ──────────────┤
     ├─ api-integration (postgres:16 service) ─────────┼─→ required checks
     ├─ e2e (run-e2e.sh) ──────────────────────────────┘
     └─ audit (informational, continue-on-error)

tag v* ──→ docker (needs: lint-typecheck, unit, api-integration)
            buildx --platform linux/amd64,linux/arm64 --push
```

## File Changes

| File | Change | Phase |
|------|--------|-------|
| `.nvmrc` | New — `22` | 1 |
| `.gitignore` | Remove line 4 | 1 |
| `server/api/.gitignore` | Remove line 3 | 1 |
| `server/api/package-lock.json` | Newly tracked | 1 |
| `adminClient/package-lock.json` | New | 1 |
| `package.json`, `server/api/package.json`, `client/package.json`, `adminClient/package.json` | `engines` | 1 |
| `Dockerfile.api` | `COPY server/migrations`; `npm ci`; pin Node 22 across stages | 1, 2 |
| `Dockerfile.web`, `Dockerfile.admin` | `npm ci`; pin Node 22 | 1 |
| `compose.yml` | `migrate` service; healthchecks; `depends_on.condition`; `deploy.resources`; `logging` rotation; pinned tags | 2 |
| `jest.config.js` | Delete `api` project; add `integration` project; `collectCoverage` | 3 |
| `server/api/src/tests/{users,roles,schools,auth}.test.ts`, `setupAfterEnv.ts`, `teardown.ts` | Deleted | 3 |
| `server/api/src/tests/rls.test.ts` | Moved under the `integration` project | 3 |
| `server/api/src/models/self.test.ts` | Mock completed; skips removed | 3 |
| `server/api/package.json` | `"test": "jest --ci"`; `sharp` → `^0.35.4`; fix `start`; drop `deploy` | 3, 4, 6 |
| `scripts/build-images.sh` | New | 4 |
| `scripts/docker-build.js`, `scripts/docker-push.js` | Deleted | 5 |
| `server/api/publish.js`, `client/publish.js`, `adminClient/publish.js` | Deleted | 5 |
| `server/docker-compose.prod.yml` | Deleted | 5 |
| `server/google_oauth_migration.sql`, `server/assignMissionsToAllUsers.sql` | Deleted | 5 |
| `Caddyfile`, `compose.caddy.yml` | Deleted (or `Caddyfile:13` fixed) — per D7 | 5 |
| `package.json` | Drop `build:server`, `docker:*`, `start`; fix `lint` | 5, 6 |
| `client/package.json`, `adminClient/package.json`, `server/api/package.json` | `zod` aligned | 6 |
| `AGENTS.md`, `TODO.md`, `server/README.md` | Rewritten/cleaned | 6 |
| `server/api/src/services/logger.ts` | New — `pino` | 7 |
| `server/api/src/index.ts`, `middlewares/errors.ts` | `pino-http`, request id, optional Sentry | 7 |
| `.github/workflows/ci.yml` | New | 8 |
| `docs/runbook-deploy.md` | New — deploy, migrate, rollback, restore | 2, 9 |

## Testing Strategy

- **Migrations (D1/D2)**: build the production image and assert `dist/scripts/migrate.js` and
  `/app/migrations/0008_email_verification.sql` both exist inside it; then bring up `compose.yml`
  against an empty volume and assert the API reaches healthy without restarting.
- **`sharp` bump**: after upgrading, `POST /uploads` a real JPEG and assert the stored file is
  `.webp` with a non-zero size and the response mimetype is `image/webp`
  (`server/api/src/services/uploads.ts:44-59`). Additionally run
  `node -e "require('sharp')"` inside the built `linux/arm64` image.
- **Server suite**: `npx jest --ci --selectProjects unit` must pass with no open handles
  (`--detectOpenHandles` reports none) and no network access.
- **RLS**: `RUN_DB_TESTS=1 npx jest --ci --selectProjects integration` against a migrated
  `postgres:16`; all 8 `it()` blocks (`rls.test.ts:118-184`) must execute, not skip.
- **Deletions**: for each, `rg -n --hidden -g '!node_modules' -g '!.git' -F '<name>' .` must return
  only documentation hits, recorded in the task.
- **CI**: the workflow is validated by an actual PR run, not by inspection.

## Threat Matrix

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Migration runs with the app role and fails on DDL | Wrong credentials on the `migrate` service | Service uses `POSTGRES_USER` (owner), matching `docker-compose.e2e.yml:52-53` |
| A bad migration bricks the deploy | `service_completed_successfully` gate | Intended. Runbook documents `migrate:status` and manual rollback |
| Secrets leak into image layers | Build args in `Dockerfile.web`/`admin` | These are `EXPO_PUBLIC_*`/`VITE_*` — public by construction. No secret is passed as a build arg |
| `arm64` image ships without `sharp` binaries | `npm install` resolving on the builder's arch | `npm ci` from a committed lockfile + an in-image `require('sharp')` assertion |
| CI pushes images from an untrusted PR | `pull_request` trigger on the docker job | The `docker` job runs **only** on `push` to `v*` tags, never on `pull_request` |
| Registry credentials exposed | `docker/login-action` | GitHub secrets; the job is tag-only |
| Deleting the live proxy | `Caddyfile` removal | D7's discriminating observation is a hard precondition |
| Sentry exfiltrates data by default | Always-on SDK | Init guarded on `SENTRY_DSN`; shipped empty |

## Migration / Rollout

Phases are independently revertible and ordered by dependency: 1 (reproducibility) → 2 (deployable
migrations) → 3 (test suite) → 4 (build) → 5 (deletions) → 6 (cleanup) → 7 (observability) →
8 (CI) → 9 (runbook). Phase 6's zod alignment and phase 8's `docker` job are the only items that
may be dropped without invalidating the rest.

First production rollout after this change must be done against a database snapshot, because the
community migrations (`0001`–`0008`) have — per `MIGRACION-COMUNIDADES.md:6-8` — never been
applied to production. That is the whole point of the runbook.

## Open Questions

1. **Is Caddy the active proxy?** D7's discriminating observation. Blocks task 5.6 only.
2. **Where are images built today?** `AUDITORIA-2026-09.md:129` flags this as unconfirmed. If they
   are built on an arm64 machine, the current `:latest` images may already be arm64-only, which
   would mean the amd64 half of the multi-arch build is new capability rather than a fix.
3. **Does the registry account support multi-arch manifests?** Docker Hub does; if a different
   registry is in use under Coolify, confirm before phase 4.

## Recorded Follow-ups (not fixed here)

- **INF-05** — off-site encrypted backups and a rehearsed restore drill. The runbook documents
  restore; the external destination, encryption and rehearsal need infrastructure this change
  cannot provision.
- **Expo 57** — resolves the `expo`/`metro` advisories and the client's remaining criticals.
- **`shared/` as a real package** — prerequisite to any future workspaces decision (D8).
- **`adminClient` has zero tests** and no test runner (`adminClient/package.json:6-12`). CI cannot
  gate what does not exist; adding a runner is its own change.
- **`react-test-renderer` 19.0.0 vs `react` 19.1.0** skew in `client/package.json:52,84`.
- **`/status` does not touch the database** (`index.ts:65-67`). Left intentionally, because
  `docker-compose.e2e.yml:90-101` depends on its current behavior; `/health` is the replacement.
- **`client/.env` is tracked** despite `.gitignore` — belongs to INF-11 / `sec-hardening-api`.
