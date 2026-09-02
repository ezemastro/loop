# Proposal: Delivery Pipeline, CI and Production Observability

## Intent

Loop has no automated verification and no runnable production deploy path. `.github/` does not
exist, so nothing ever runs lint, typecheck, `check-sql-arity.py`, unit tests, the RLS suite or the
Playwright E2E suite. At the same time a clean production deploy cannot succeed: the API's
`production` image cannot apply migrations (`server/migrations/*.sql` is never copied into it,
`Dockerfile.api:49-68`) while `server/api/src/index.ts:120-125` calls `process.exit(1)` in
production when RLS is not active — so a fresh host crash-loops instead of migrating.
`MIGRACION-COMUNIDADES.md:6-8` states outright that none of the community migration has ever been
run in production.

This change makes deployment mechanically possible and puts a gate in front of `main`. It is
infrastructure, delivery, tests-as-infrastructure, and observability wiring — no product behavior
changes.

## Scope

### In Scope

- **INF-01** — production-runnable migrations: copy `server/migrations` into the image, add a
  `migrate` service to `compose.yml` gated by `service_completed_successfully`, write the runbook.
- **INF-02** — the minimum CI pipeline from `AUDITORIA-2026-09.md` §5.2: lint+typecheck matrix,
  unit tests, an `api-integration` job with a `postgres:16` service running the real RLS suite, an
  `e2e` job, a `docker` buildx job pushing only on `v*` tags, and informational `npm audit`.
- **INF-03** — collapse the duplicated, broken build path onto a single `docker buildx` script;
  delete `build:server`, `scripts/docker-build.js`, `scripts/docker-push.js`,
  `server/docker-compose.prod.yml` and the per-package `publish.js` duplicates.
- **INF-04** — multi-arch images (`linux/amd64,linux/arm64`); the deploy host is ARM64.
- **INF-06** — make the server test suite green and hermetic; delete or migrate the stale `api`
  Jest project, fix `models/self.test.ts`, run the RLS suite under `RUN_DB_TESTS=1` in CI.
- **INF-07** — dependency remediation: `sharp`, `axios`, `concurrently`; a lockfile for
  `adminClient`. The `sharp` bump is semver-major and the API re-encodes every upload with it
  (`server/api/src/services/uploads.ts:44-53`), so the upload path MUST be re-verified.
- **INF-08** — production hardening: healthchecks, `depends_on.condition`, resource limits, log
  rotation, pinned image tags, `.nvmrc` at 22, `engines`, `npm ci`, committed lockfiles.
- **INF-09** — resolve the `Caddyfile` question against the Coolify/ARM64 host: determine whether
  Caddy is the active proxy at all and delete it if it is not.
- **INF-10** — observability: `pino` with a request id, a DB-touching `/health`, and Sentry wiring
  that is configurable and **off by default**.
- **INF-12** — documentation and repository cleanup; an explicit, reasoned decision on npm
  workspaces.

### Out of Scope

- **INF-05** (off-site backups + rehearsed restore drill). Provisioning an external bucket, its
  credentials and a restore rehearsal requires infrastructure this change cannot create. A
  written restore runbook is included only because it is cheap; the off-site destination,
  encryption and the drill itself are deferred.
- **INF-11** (the unified `.env.template`). Owned by block `sec-hardening-api`.
- **Expo 57.** The `expo`/`metro` advisories in the client are only fixed in Expo 57, which is a
  framework major upgrade with its own migration surface. Recorded as future work, not attempted.
- `client/package.json`'s `test` script (`jest --watchAll`). Claimed by block
  `client-critical-fixes`; this change consumes whatever that block lands and does not edit it.
- `GET /health`'s existence. Claimed by block `sec-hardening-api`; this change specifies the
  requirement and contributes only the observability parts if the endpoint already exists.
- Any product, API-surface, schema or client behavior change.

## Capabilities

### New Capabilities

- `deployable-migrations`: the contract that a production image can apply its own migrations and
  that the API only starts after they have completed.
- `continuous-integration`: the required verification gates, their inputs and their triggers.
- `build-and-release`: one build path, multi-arch images, traceable tags, pinned runtimes.
- `runtime-observability`: structured logging, request correlation, a liveness/readiness signal,
  and opt-in error reporting.

### Modified Capabilities

- None. `openspec/specs/` is empty; every other audit block is unarchived and untouched here.

## Approach

**Migrations — narrower than the audit states.** `server/api/tsconfig.prod.json:20-26` excludes
`src/tests/**` and `src/scripts/seed.ts` but **not** `src/scripts/migrate.ts`, so the runner
already compiles into the production bundle. `migrate.ts:38-43` already resolves its SQL directory
from `MIGRATIONS_DIR` or a `cwd`-relative fallback list. The actual gap is therefore two lines of
Dockerfile and one compose service — no application code has to change. See "Corrections to the
audit" in `design.md`.

**The `migrate` service is a copy, not an invention.** `docker-compose.e2e.yml:44-64,102-104`
already runs exactly this pattern (a one-shot `migrate` service, then
`api.depends_on.migrate.condition: service_completed_successfully`). Production adopts the shape
that is already proven in E2E, which is why `index.ts:120-125`'s `process.exit(1)` becomes correct
behavior rather than a crash-loop: by the time the API starts, RLS is guaranteed active.

**Lockfiles gate multi-arch.** `.gitignore:4` (`/server/**/package-lock.json`) keeps the API
lockfile out of the repository, and `adminClient` has none. `sharp` ships its native binaries as
per-platform optional dependencies and the production stage is `node:22-alpine`, so an unpinned
`npm install` resolving on one architecture can produce an `arm64` image with no usable `sharp`.
Committing lockfiles is therefore a **prerequisite** of the buildx work, not a parallel cleanup.
The existing on-disk `server/api/package-lock.json` already contains
`@img/sharp-linuxmusl-arm64` and `@img/sharp-linuxmusl-x64`, so the required binaries are
available once the file is tracked.

**npm workspaces: declined.** Reasoned in `design.md` (D8) and isolated in its own droppable task
phase if it is ever reconsidered. Summary: `shared/` is not an npm package (it is two plain source
directories consumed through relative TypeScript paths and `COPY shared ./shared` in all three
Dockerfiles), so workspaces would not deduplicate it; workspaces do not by themselves align the
three divergent `zod` versions; and adopting them forces a rewrite of every Dockerfile install
layer including the `--omit=dev` production stage, during the same change that first makes deploys
work. The two concrete benefits (working root lint, present lockfiles) are obtainable directly and
far more cheaply.

**Caddy is treated as unproven, not as truth.** `compose.yml` — the production stack — does not
contain a Caddy service at all; Caddy appears only in `compose.caddy.yml` and in the
to-be-deleted `server/docker-compose.prod.yml`. Both bind host ports 80 and 443, which a Coolify
host's own proxy already owns. The decision procedure and its single discriminating observation
are in `design.md` (D7); the task carries both branches so it stays honest either way.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | New | The whole pipeline; pinned action versions |
| `Dockerfile.api` | Modified | Copy `server/migrations`; pin Node; `npm ci`; healthcheck deps |
| `Dockerfile.web`, `Dockerfile.admin` | Modified | Pin Node; `npm ci` |
| `compose.yml` | Modified | `migrate` service, healthchecks, `depends_on.condition`, limits, log rotation, pinned tags |
| `scripts/build-images.sh` (or `.js`) | New | The single `docker buildx --platform ... --push` path |
| `scripts/docker-build.js`, `scripts/docker-push.js` | Deleted | Reference a non-existent `api.Dockerfile`; self-commit `package.json` |
| `server/docker-compose.prod.yml` | Deleted | Wrong image name; exposes 5432 |
| `*/publish.js` | Deleted | Duplicated, no `--platform` |
| `package.json` (root) | Modified | Drop `build:server`; fix lint; add `engines` |
| `.nvmrc` | New | `22`, matching the production stage |
| `.gitignore` | Modified | Stop excluding the API lockfile (line 4) |
| `server/api/package-lock.json`, `adminClient/package-lock.json` | New (tracked) | Required for `npm ci` and multi-arch |
| `server/api/package.json` | Modified | `sharp` bump; `"test": "jest --ci"` |
| `server/api/src/tests/`, `models/self.test.ts` | Modified/Deleted | Stale suite removed or migrated to `e2e/` |
| `server/api/src/index.ts`, `middlewares/`, `services/logger.ts` | Modified/New | `pino`, request id, `/health`, optional Sentry |
| `Caddyfile`, `compose.caddy.yml` | Deleted or Fixed | Per the D7 decision procedure |
| `AGENTS.md`, `TODO.md`, `server/README.md`, loose `server/*.sql` | Modified/Deleted | Doc and repository cleanup |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `sharp` 0.35 breaks the upload re-encode path | Med | Dedicated verification task against a real image through `POST /uploads`; the API's `sharp` calls are the stable `rotate/resize/webp/toFile` surface |
| Multi-arch image lacks native binaries for `arm64` | Med | Commit lockfiles first (hard prerequisite); assert `sharp` loads inside the built `arm64` image before pushing |
| Deleting the Caddy files removes the live proxy | Low | D7's discriminating observation is required before the deletion task may be checked off; both branches are written |
| The `migrate` service blocks every deploy on a bad migration | Med | Intended: a failed migration must stop the deploy. Runbook documents `migrate:status` and the rollback |
| CI is written against commands that do not exist | Med | Every referenced command is verified present after this change; the pipeline is authored last, once its inputs are real |
| `npm ci` fails where `npm install` silently repaired drift | Med | Regenerate each lockfile against its `package.json` in the same task that commits it |
| Deleting a still-referenced script breaks a workflow | Low | Every deletion task records an `rg` sweep for the filename across the repo as its evidence |
| The RLS integration job is flaky against a service container | Med | `pg_isready` gate before migrating, mirroring `docker-compose.e2e.yml:38-42` |

## Rollback Plan

Every phase is an independent revert. The migration and compose work (phase 2) is the only phase
that changes production runtime behavior; reverting it restores today's (non-functional) deploy.
CI (phase 6) is additive and can be disabled by deleting one file. Deletions (phase 5) are
recoverable from git history and each carries its evidence sweep, so a wrong call is cheap to undo.

## Dependencies

- Block `sec-hardening-api` owns `GET /health` and `INF-11`; this change coordinates rather than
  competes.
- Block `client-critical-fixes` owns `client/package.json:11`'s test script.
- The single confirming observation for D7 (Caddy) is the one external input this change needs.

## Success Criteria

- [ ] A clean `docker compose up` on an empty database migrates, then starts the API, without a
      crash-loop.
- [ ] `.github/workflows/ci.yml` runs and passes on a pull request: lint+typecheck, unit,
      api-integration (real Postgres, `RUN_DB_TESTS=1`), and e2e.
- [ ] `docker buildx` produces `linux/amd64` **and** `linux/arm64` images for api, web and admin,
      pushed only on a `v*` tag.
- [ ] `sharp` is at 0.35.4+ and an uploaded image is still re-encoded to `.webp`.
- [ ] `npm ci` succeeds in all four packages from committed lockfiles.
- [ ] The server Jest suite is green with no network or database access outside the tagged
      integration project.
- [ ] `/health` reports database reachability; logs are structured and carry a request id.
- [ ] `rg` finds zero references to every deleted file.
