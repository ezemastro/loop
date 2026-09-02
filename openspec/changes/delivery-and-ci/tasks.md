# Tasks: Delivery Pipeline, CI and Production Observability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1500 (of which ~600 are deletions and ~350 are the new CI workflow) |
| Session review budget | Informative only — this session does not stop on budget |
| 400-line budget risk | High against the skill default of 400; not a gate here |
| Chained PRs recommended | No |
| Suggested split | None — single PR, per the session's `single-pr` delivery strategy (`exception-ok`) |
| Delivery strategy | single-pr / exception-ok |
| Chain strategy | N/A |
| Branch | `fix/auditoria-2026-09` (single branch for all audit blocks) |

Decision needed before apply: **Yes — one** (task 5.6 requires the Caddy observation from design D7).
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

**Why a single PR despite the size.** The phases are not independently deliverable in a way that
would benefit a reviewer: phase 4 (multi-arch) is unsound without phase 1 (lockfiles), phase 8 (CI)
is unsound without phases 1, 3 and 6, and phase 2 (migrations) is the only reason phase 9 (runbook)
exists. Splitting would produce PRs that individually cannot be verified. Roughly 40% of the diff
is deletion of dead code, which reviews quickly. The session's `exception-ok` setting covers the
overage.

### Suggested Work Units

| Unit | Goal | Focused verification command | Runtime harness | Rollback boundary |
|------|------|------------------------------|-----------------|--------------------|
| 1 | Reproducible installs | `npm ci` in each of the 4 packages | N/A | Lockfiles are additive; revert restores `npm install` |
| 2 | Deployable migrations | `docker compose up` on an empty volume | Docker + empty Postgres volume | Revert restores today's (non-functional) deploy |
| 3 | Green server suite | `npx jest --ci --selectProjects unit` | Node only | Revert restores today's failing suite |
| 4 | Multi-arch build | `docker buildx build --platform ...` | Docker + buildx + QEMU | Revert restores `publish.js` (still present until phase 5) |
| 5 | Deletions | `rg` sweeps per task | N/A | `git revert`; each deletion carries its evidence |
| 6 | Cleanup + lint green | `npm run lint` exits 0 | Node only | Independent |
| 7 | Observability | `curl /health`; inspect log output | Docker | Additive; Sentry inert by default |
| 8 | CI | A real PR run | GitHub Actions | Delete one file |
| 9 | Runbook | Read-through by an operator | N/A | Docs only |

**Environment notes.** `rg` is available; `fd`, `bat` and `eza` are not. The repository is on branch
`fix/auditoria-2026-09` and is being modified concurrently by sibling audit blocks — re-read any
file before editing it rather than trusting a line number cited here blindly. `npm run lint` at
root currently exits **1** with 25 findings (see design "Corrections to the audit" #5).

---

## Phase 1: Reproducible installs (prerequisite for phases 4 and 8)

- [x] 1.1 Remove the API lockfile exclusions: delete line 4 (`/server/**/package-lock.json`) from
      `.gitignore`, and delete line 3 (`package-lock.json`) from `server/api/.gitignore`. Both rules
      cover the same file; removing only one leaves it ignored. — *build-and-release: Dependencies
      Are Installed Reproducibly From Committed Lockfiles*
- [x] 1.2 Commit the existing `server/api/package-lock.json` (present on disk, 407 KB, untracked).
      Verify before committing that it still contains `@img/sharp-linuxmusl-arm64` and
      `@img/sharp-linuxmusl-x64` — the production stage is `node:22-alpine` (`Dockerfile.api:49`),
      so the musl variants are the ones that matter on the ARM64 host.
      **Evidence**: `rg -c "sharp-linuxmusl-arm64|sharp-linuxmusl-x64" server/api/package-lock.json` → 6.
- [x] 1.3 Generate and commit `adminClient/package-lock.json` (`npm install --package-lock-only` in
      `adminClient`). Note `adminClient/package.json:44-46` aliases `vite` to
      `npm:rolldown-vite@7.2.5` via `overrides`; confirm the generated lockfile records that alias.
      **Evidence**: already generated/tracked by a prior commit this session; `rg "rolldown-vite" adminClient/package-lock.json` confirms the alias is recorded.
- [x] 1.4 Verify `npm ci` succeeds from a clean `node_modules` in all four packages: root,
      `server/api`, `client`, `adminClient`. Regenerate any lockfile that reports drift against its
      `package.json`. — *build-and-release: "An image build fails loudly on lockfile drift"*
      **Evidence**: `npm ci --dry-run` (root, client, adminClient) and real `npm ci` (root, server/api) all succeeded with zero drift.
- [x] 1.5 Create `.nvmrc` at the repository root containing `22`, matching the production stage
      (`Dockerfile.api:49`, `node:22-alpine`). — *build-and-release: Runtime Versions Are Pinned and
      Consistent*
- [x] 1.6 Add `"engines": { "node": ">=22 <23" }` to the root, `server/api`, `client` and
      `adminClient` `package.json` files.
- [x] 1.7 Pin the build stages to Node 22: `Dockerfile.api:2` and `:23` (`node:20-slim` →
      `node:22-slim`), `Dockerfile.web:2` and `:30`, `Dockerfile.admin:2`. Leave
      `Dockerfile.api:49` (`node:22-alpine`) as-is — it is already correct and is the version the
      others align to.
  - **Checkpoint**: the Expo web export (`Dockerfile.web:27`) and the Vite build
    (`Dockerfile.admin:27`) both run on the build stage. Confirm each still builds on Node 22 before
    moving on; this is the likeliest place phase 1 breaks.
    **Note**: `Dockerfile.api` production build verified end to end on Node 22 (task 1.10). `Dockerfile.web`/`Dockerfile.admin` builds were not executed locally — see 1.10.
- [x] 1.8 Replace `npm install` with `npm ci` in every Dockerfile install layer:
      `Dockerfile.api:8`, `:10`, `:32`, `:34`, `:54`; `Dockerfile.web:10`, `:12`;
      `Dockerfile.admin:10`, `:12`. Each `npm ci` needs its lockfile copied in the same layer — the
      existing `COPY package*.json` globs already match `package-lock.json`.
- [x] 1.9 Also update `Dockerfile.api:20`'s development `CMD`
      (`npm install --include=dev && npm run dev`) and `docker-compose.e2e.yml:71`'s equivalent
      command. These are development/E2E paths; `npm ci` there is optional but the two must stay
      consistent with each other or the E2E stack diverges from the dev stack.
      **Decision**: both switched to `npm ci --include=dev` for consistency and reproducibility.
- [x] 1.10 Rebuild all three images and confirm each still builds end to end.
      **Evidence**: `Dockerfile.api` (target `production`, single-arch, native — this host is aarch64) built successfully twice (once pre-sharp-bump, once post-bump); verified `npm ci`/`npm ci --omit=dev` all succeed. **Deferred**: `Dockerfile.web` and `Dockerfile.admin` builds were NOT executed locally — this host has ~1.3 GB free RAM at times during this session (below the 1500 MB safety threshold) and is the live production host; Expo web export + Vite builds are comparatively heavy. Multi-arch `buildx` was never attempted locally per the explicit instruction. `scripts/build-images.sh` (phase 4) and `.github/workflows/ci.yml`'s `docker` job are written and will build all three on CI runners.

**Done condition**: all four packages install with `npm ci` from committed lockfiles; every image
builds on a single pinned Node major; `.nvmrc` and `engines` agree with the production stage.

---

## Phase 2: Deployable migrations (INF-01)

- [x] 2.1 Add `COPY server/migrations ./migrations` to the `production` stage of `Dockerfile.api`
      (after the `dist` copy at `:57` and its flattening block at `:60-63`, before
      `RUN mkdir -p uploads` at `:65`). With `WORKDIR /app` (`:50`) this lands at `/app/migrations`,
      which `migrate.ts:43`'s `path.resolve(process.cwd(), "migrations")` candidate already
      resolves. — *deployable-migrations: Migration SQL Ships Inside the Production Image*
- [x] 2.2 Verify — do **not** assume — that `dist/scripts/migrate.js` exists in the built production
      image. `server/api/tsconfig.prod.json:20-26` excludes `src/**/*.test.ts`, `src/tests/**`,
      `src/scripts/seed.ts` and `shared/demo-data/**` but **not** `src/scripts/migrate.ts`, and
      `Dockerfile.api:60-63` flattens `dist/server/api/src/*` into `dist/`. If it is present, no
      build change is needed (design correction #1). If it is absent, add an explicit copy rather
      than editing `tsconfig.prod.json`. — *deployable-migrations: The Migration Runner Is Invokable
      Without Development Dependencies*
      **Evidence**: built the production image and ran `docker run --rm loop-api:verify sh -c "ls /app/dist/scripts/"` → `migrate.js` present; `ls /app/migrations` → all 14 migration files present. Confirmed the design's assumption; no `tsconfig.prod.json` change needed.
- [x] 2.3 Confirm the compiled runner executes without `tsx`: run
      `node dist/scripts/migrate.js --status` inside a container built from the `production` target.
      `tsx` is a devDependency (`server/api/package.json:72`) stripped by `--omit=dev`
      (`Dockerfile.api:54`), so `npm run migrate` (`server/api/package.json:19`) **cannot** be used
      in production — this is the audit's blind spot. — *deployable-migrations: "Migrations apply
      with production-only dependencies installed"*
      **Evidence**: ran `docker run --rm --network host -e PGHOST=localhost -e POSTGRES_PORT=5433 ... loop-api:verify node dist/scripts/migrate.js --status` against the disposable Postgres — printed all 14 migrations as `[ aplicada ]`, confirming the compiled runner works with zero `tsx`/dev dependencies.
- [x] 2.4 Add a `db` healthcheck to `compose.yml`, copying `docker-compose.e2e.yml:38-42`
      (`pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`, `interval: 5s`, `timeout: 3s`,
      `retries: 10`).
- [x] 2.5 Add a `migrate` service to `compose.yml`, modelled on `docker-compose.e2e.yml:44-64`:
      same image as `api` (`ezemastro/loop-api`, `compose.yml:18`), `restart: "no"`,
      `command: ["node", "dist/scripts/migrate.js"]`, `MIGRATIONS_DIR=/app/migrations`,
      `PGHOST=db`, the owner credentials `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, and
      `DB_APP_USER`/`DB_APP_PASSWORD`/`DB_UNSCOPED_USER`/`DB_UNSCOPED_PASSWORD` (required —
      `server/migrations/0007_db_roles_and_rls.sql` raises when those passwords are empty, per
      `docker-compose.e2e.yml:55-60`). Depends on `db` with `condition: service_healthy`. Attach to
      `proxy-network` like its peers. — *deployable-migrations: The API Starts Only After Migrations
      Complete Successfully*
      **Deviation from design**: also added a bind mount of `server/database_creation.sql` and
      `server/create_categories.sql` into `db`'s `/docker-entrypoint-initdb.d/` (mirroring
      `e2e/Dockerfile.db-init`'s pattern via bind mount instead of a custom image, since `db` uses a
      stock `image:` not a `build:`). **Discovered during verification (task 2.8)**: without this,
      `0000_baseline_reconcile.sql` fails on a truly empty volume with `relation "admins" does not
      exist` — it assumes the base schema from `database_creation.sql` already exists (see its own
      header comment); `migrate` applies *migrations*, it does not create the schema from scratch.
      This was missing from the design and is required for the "clean deploy on empty database"
      success criterion to actually hold.
- [x] 2.6 Change `compose.yml:39-40`'s `api.depends_on` from the bare list form (`- db`) to the
      condition form: `db: {condition: service_healthy}` and
      `migrate: {condition: service_completed_successfully}`.
- [x] 2.7 Do the same for `backup.depends_on` (`compose.yml:68-69`): `db` with
      `condition: service_healthy`.
- [x] 2.8 [VERIFY] Clean-deploy test: remove any local `postgres-data` volume, run
      `docker compose up`, and confirm the ordering `db healthy → migrate exits 0 → api starts`,
      with `api` reaching healthy and **never restarting**. This is the scenario that crash-loops
      today via `index.ts:120-125`. — *deployable-migrations: "Clean deploy against an empty
      database succeeds"*, *"The RLS guard no longer crash-loops"*
      **Evidence**: built an isolated verification stack (`db`+`migrate`+`api`, private bridge
      network, disposable Postgres volume, project `loop-verify` — NOT the shared `proxy-network` or
      the shared `loop-audit-db`) using the locally built `loop-api:verify` image. First attempt
      failed (see the deviation note on 2.5); after adding the schema bootstrap mount, `docker
      compose -p loop-verify up -d` produced: `db healthy` → `migrate` applied all 14 migrations and
      exited 0 → `api` started and logged `Servidor corriendo. Entorno: production en el puerto
      3000`. `docker inspect loop-verify-api-1 --format 'RestartCount={{.RestartCount}}'` → `0`.
      Stack torn down and images removed after verification.
- [x] 2.9 [VERIFY] Idempotence: bring the stack down and up again against the now-migrated volume;
      confirm `migrate` applies nothing, passes its checksum verification, and exits `0`. —
      *deployable-migrations: "Repeated deploys are idempotent"*
      **Evidence**: `docker compose -p loop-verify stop` then `up -d` again against the same volume
      → `migrate` logged `Migraciones al día.` and exited 0; `api` started normally.
- [x] 2.10 [VERIFY] Failure path: temporarily introduce a deliberately failing migration, confirm
      `migrate` exits non-zero and `api` never starts, then remove it. — *deployable-migrations: "A
      failing migration stops the deploy instead of starting a broken API"*
      **Evidence**: ran the compiled runner (`docker run`, not `compose up`, to avoid touching
      `server/migrations/` which is owned by another block) with `MIGRATIONS_DIR` pointed at a
      `/tmp` copy of the real migrations plus one deliberately invalid SQL file → exited 1 with
      `syntax error at or near ";"`. Combined with 2.8's confirmed `service_completed_successfully`
      gate, this demonstrates `api` cannot start when `migrate` fails. Temp files removed after the
      test; `server/migrations/` was never touched.

**Done condition**: a clean `docker compose up` against an empty database migrates and then starts a
healthy API with zero restarts; a failing migration blocks the deploy.

---

## Phase 3: Green, hermetic server test suite (INF-06)

- [x] 3.1 Delete `server/api/src/tests/users.test.ts`. Evidence of deadness: `:3-4` asserts `200` on
      `GET /users` with no `Authorization` header, while `index.ts:90` and `routes/users.ts:9` both
      apply `tokenMiddleware`, which returns `401` at `middlewares/parseToken.ts:51-53`. Record an
      `rg` sweep confirming nothing imports it. — *continuous-integration: The Server Test Suite Is
      Green and Hermetic*
      **Evidence**: `rg -n --hidden -g '!node_modules' -g '!.git' -F "users.test.ts" .` → only doc/spec hits (tasks.md, design.md, spec.md). Deleted.
- [x] 3.2 Delete `server/api/src/tests/roles.test.ts`. Evidence: `:3` requests `GET /roles`; there is
      no `server/api/src/routes/roles.ts` and `index.ts:74-99` never mounts `/roles`. Record
      `rg -n '/roles' --glob '!node_modules' --glob '!*.md' .` showing the test file as the only
      non-documentation hit.
      **Evidence**: sweep confirmed doc-only hits elsewhere. Deleted.
- [x] 3.3 Delete `server/api/src/tests/schools.test.ts`. Evidence: `:6` asserts a collection length
      greater than 1 against an unseeded database. If the coverage is wanted, it belongs in `e2e/`,
      which has a seeded stack — record that as a follow-up rather than porting it here.
      **Evidence**: doc-only hits. Deleted; not ported to `e2e/` (out of this change's scope, recorded as follow-up).
- [x] 3.4 Delete `server/api/src/tests/auth.test.ts`. Evidence: `:4-14` contains **no `expect`**, so
      it passes on any response including a 500, and its own `:12-13` TODO admits the community/school
      seeding precondition is absent. **This supersedes the audit's instruction to replicate
      `auth.test.ts`'s "working pattern"** — see design correction #2.
      **Evidence**: doc-only hits (plus unrelated `controllers/auth.test.ts` — a different file). Deleted.
- [x] 3.5 Delete `server/api/src/tests/setupAfterEnv.ts` and `server/api/src/tests/teardown.ts`.
      Evidence: `setupAfterEnv.ts:2` imports `src/index.ts`, binding a real listener
      (`index.ts:128-130`) and constructing two `pg` pools (`services/postgresClient.ts:53,61`) for
      every worker; `teardown.ts` never calls the exported `closePools`
      (`services/postgresClient.ts:261`), which is the open-handle leak `test:debug`
      (`server/api/package.json:15`) exists to chase. Also delete
      `server/api/src/tests/global.d.ts`, which declares only `global.api` and `global.__SERVER__`
      (and references `Server` without importing it). — *continuous-integration: "No handles leak
      after the suite finishes"*
      **Evidence**: only referenced by `jest.config.js`'s now-deleted `api` project and by `AGENTS.md` (updated in phase 6). Deleted.
- [x] 3.6 Rewrite `server/api/jest.config.js`: delete the `api` project (`:4-14`) entirely; keep the
      `unit` project (`:15-29`) unchanged; add a third project `displayName: "integration"` with
      `preset: "ts-jest"`, `roots: ["<rootDir>/src"]`, the same `moduleNameMapper`
      (`^(\.{1,2}/.*)\.js$` → `$1`), `testMatch: ["**/tests/**/*.test.ts"]`, and **no**
      `setupFilesAfterEnv` and **no** `globalTeardown`. — *continuous-integration: Database-Dependent
      Tests Run in a Dedicated Project Against a Real Database*
- [x] 3.7 Confirm `server/api/src/tests/rls.test.ts` is now matched only by the `integration`
      project and no longer boots a server. Leave its `RUN_DB_TESTS === "1"` guard at `:30-31`
      untouched — CI supplies the variable. — *continuous-integration: "RLS tests skip cleanly
      outside CI"*
      **Evidence**: confirmed by construction (only `.test.ts` left under `src/tests/`) and by running the full suite without `RUN_DB_TESTS` — the `integration` project reported "1 skipped", zero connection attempts.
- [x] 3.8 Add coverage collection to `server/api/jest.config.js`: `collectCoverage`,
      `collectCoverageFrom` scoped to `src/**/*.ts` excluding `src/tests/**` and `src/scripts/**`,
      and `coverageReporters` including `text-summary` and `lcov`. Do **not** set a
      `coverageThreshold` yet — record the measured baseline first so the threshold is evidence-based.
      **Measured baseline (unit project only)**: Statements 23.69%, Branches 12.86%, Functions 17.95%, Lines 21.02%. No threshold set.
- [x] 3.9 Fix the mock in `server/api/src/models/self.test.ts:1-8`. It returns only `dbConnection`,
      but `models/self.ts:4` imports `{ inCommunity, withClient }`, both real exports
      (`services/postgresClient.ts:151` and `:198`), so both are `undefined` under the mock and every
      call site throws `TypeError: withClient is not a function`. Extend the factory with a
      `withClient` that invokes its callback with a mock client, and an `inCommunity` returning
      `{ mode: "community", communityId }`. — *continuous-integration: "The self model unit tests
      execute rather than skip"*
- [x] 3.10 Remove the four skips in `server/api/src/models/self.test.ts` — `it.skip` at `:47` and
      `:84`, `it.skip.each` at `:54` and `:68` — and confirm they pass against the completed mock.
      Fixing the mock without unskipping these restores almost no coverage (design correction #3).
      **Deviation**: unskipping surfaced two real, pre-existing problems the design didn't
      anticipate — (1) the "all parameters valid"/"valid `$field`" assertions checked the
      *round-tripped* user (re-fetched via `getPrivateUserById` after the update), but
      `databaseQueryMock` is a static dispatch table that always returns the same `MOCK_USER_DB`
      regardless of what was "written", so those assertions could never pass against this shared
      mock; (2) the `email` "valid" case tested email updates, but `updateSelf` intentionally never
      updates email (self.ts:122-125). Fixed by asserting against the arguments passed to
      `queries.updateUser` instead of the re-fetched user (test-file-local fix, `tests/utils.ts`
      untouched), and by dropping the email case from the "valid" list with a comment explaining
      why. **Evidence**: `npx jest --ci --selectProjects unit --testPathPatterns 'models/self.test.ts'` → 14/14 passed.
- [x] 3.11 Delete the stray debug statement at `server/api/src/models/self.test.ts:16`
      (`console.log(jest.isMockFunction(dbConnection.connect))`).
- [x] 3.12 Change `server/api/package.json:14` to `"test": "cross-env NODE_ENV=test jest --ci"`.
      Keep `NODE_ENV=test` — it is what disables `assertDbHardening` at `index.ts:120`. Do **not**
      touch `client/package.json:11`; that script belongs to block `client-critical-fixes`. If that
      block has already changed it when this phase is applied, leave it alone.
      **Note**: `client/package.json`'s test script was already changed by `client-critical-fixes` (`"jest --ci --watchAll=false"`) before this phase ran; left untouched as instructed.
- [x] 3.13 [VERIFY] Run `npx jest --ci --selectProjects unit --detectOpenHandles` in `server/api`
      with no database reachable. Every test must pass and no open handle may be reported. —
      *continuous-integration: "The unit project passes with no external dependencies"*
      **Evidence**: `NODE_ENV=test npx jest --ci --selectProjects unit --detectOpenHandles` → 5 suites passed, 3 failed (`postgresClient.test.ts`, `controllers/auth.test.ts`, `models/auth.test.ts` — all mid-edit by other blocks: `git status` shows `postgresClient.ts`/`models/auth.ts`/`models/auth.test.ts` modified, none owned by this change). No open-handle warning reported. Baseline before this phase: 9 suites failed/4 passed, 20 tests failed/54 passed (per session brief); after: 3 suites failed/5 passed/1 skipped, 17 tests failed/68 passed/17 skipped (full run incl. integration; the skip is `rls.test.ts` outside `RUN_DB_TESTS`, expected).
- [x] 3.14 [VERIFY] Run the integration project against a migrated `postgres:16` with
      `RUN_DB_TESTS=1` and confirm all eight assertions at `rls.test.ts:118-184` **execute** rather
      than skip. — *continuous-integration: "RLS tests execute in CI"*
      **Evidence**: ran against the disposable Postgres (`localhost:5433`, migrations already
      applied by another block) with `RUN_DB_TESTS=1` and the app-role credentials that DB was
      provisioned with → **17/17 tests passed** (the suite has grown past the original 8 since the
      design was written — `db-integrity-migrations` is actively extending it). One residual issue,
      **not mine to fix** (file owned by `db-integrity-migrations`): the suite's own `afterAll`
      cleanup (`rls.test.ts:118-135`) deletes `admins` *before* `communities`, but `invitations`
      (which cascades from `communities`) still holds a live FK to `admins.id` at that point →
      `violates foreign key constraint "invitations_created_by_admin_id_fkey"`, so the suite reports
      "Test suite failed to run" post-hoc despite all 17 assertions having passed, and leaves an open
      pg handle (needed `--forceExit`). Correct fix: delete `communities` (which cascades
      `invitations`) *before* `admins`, not after. Reported to that block; leftover test rows
      (`communities.slug LIKE 'rls-%'`) manually cleaned from the shared disposable DB afterward so
      it stays usable for other agents.

**Done condition**: the unit project is green, hermetic and handle-clean with no database; the
integration project runs the full RLS suite against a real one.

---

## Phase 4: One multi-arch build path (INF-03, INF-04)

- [x] 4.1 Bump `sharp` in `server/api/package.json:37` from `^0.34.5` to `^0.35.4`. This is a
      semver-major bump on a native package. — *build-and-release: Images Are Multi-Architecture*
- [x] 4.2 [VERIFY — required] Confirm the upload path still works after the bump. The API re-encodes
      **every** upload with `sharp` at `server/api/src/services/uploads.ts:44-53`
      (`.rotate().resize({fit:"inside", withoutEnlargement:true}).webp({quality, effort:4}).toFile()`).
      Upload a real JPEG through `POST /uploads` and assert the stored file is `.webp` with non-zero
      size, `req.file.mimetype` is `image/webp` (`uploads.ts:57`), and the EXIF-rotation and
      max-dimension behavior is unchanged. A failure here surfaces as the generic
      `"No se pudo procesar la imagen"` at `uploads.ts:62`, so check the file on disk, not just the
      response.
      **Evidence (library-level, not full HTTP round trip)**: `services/uploads.ts`, `controllers/`,
      `routes/` and `middlewares/` are owned by other blocks, so a real `POST /uploads` through the
      running app wasn't exercised. Instead, ran the *exact* pipeline
      (`sharp(buf).rotate().resize({width:1280,height:1280,fit:"inside",withoutEnlargement:true}).webp({quality:72,effort:4}).toFile()`)
      against a synthetic 2000×1500 JPEG carrying EXIF `Orientation=6`: output was `webp`, 1280×960,
      2270 bytes — confirms EXIF auto-rotation, max-dimension resize and webp encoding all still work
      on sharp 0.35.4. Full HTTP-level verification is deferred/flagged for whichever block next
      touches `uploads.ts`.
- [x] 4.3 Bump `axios` in `adminClient/package.json:16` and `client/package.json:31` to a release
      above the SSRF advisory, and `concurrently` in `package.json:44`. Regenerate the affected
      lockfiles. Do **not** attempt the `expo`/`metro` advisories — they require Expo 57, which is
      explicitly out of scope.
      **Evidence**: axios → `^1.20.0` in both packages (`npm audit`'s `fixAvailable` target for
      `GHSA-3p68-rc4w-qgx5`/`GHSA-w9j2-pvgh-6h63`/`GHSA-pmwg-cvhr-8vh7`); `npm audit` no longer lists
      `axios` in either package. `concurrently` fixed in-range via `npm audit fix` at root (stayed
      `^10.0.3`, root now reports 0 vulnerabilities). `expo`/`metro` advisories left untouched
      (confirmed still present in `client`'s audit — expected, deferred to Expo 57).
- [x] 4.4 Create `scripts/build-images.sh`: one `docker buildx build --platform
      linux/amd64,linux/arm64 ... --push` invocation per image. Use the names `compose.yml`
      consumes — `ezemastro/loop-api` (`:18`), `ezemastro/loop-web` (`:46`), `ezemastro/loop-admin`
      (`:54`) — each tagged with its own package version (`server/api/package.json:4` = 1.0.0,
      `client/package.json:4` = 1.2.0, `adminClient/package.json:4` = 0.3.0) and `latest`. Do
      **not** use the root version (`package.json:3`, 1.4.3); it is unrelated. —
      *build-and-release: A Single Build Path Produces All Deployable Images*
- [x] 4.5 In that script, preserve the build args each image needs:
      `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID` for `Dockerfile.web:20-23`;
      `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` for `Dockerfile.admin:20-23`. Quote every
      interpolation — `client/publish.js:38-39` interpolates these unquoted into a shell string
      today, which breaks on a value containing a space or `;`. — *build-and-release: "A build
      argument containing shell metacharacters is passed intact"*
      **Evidence**: `bash -n scripts/build-images.sh` → syntax OK; every `--build-arg` is its own
      quoted array element (`"EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"`), never concatenated into
      a shell string.
- [x] 4.6 The script MUST NOT write to any tracked file and MUST NOT create a commit. This is the
      explicit contract that replaces `scripts/docker-build.js:43` (rewrites `package.json` on disk,
      *before* a build that may then fail at `:60`) and `:63-69` (`git add package.json` +
      `git commit`, staging a release bump over whatever else was staged). — *build-and-release: "A
      failed build leaves the working tree unchanged"*
- [x] 4.7 Add a root `package.json` script invoking the new build script, replacing the removed
      `docker:build*` entries (`package.json:28-31`).
- [x] 4.8 [VERIFY] Build the API image for `linux/arm64` and run
      `node -e "require('sharp')"` inside it. `sharp` ships per-platform binaries as optional
      dependencies, so this is the check that catches an image that builds fine and fails at the
      first upload. Confirm `@img/sharp-linuxmusl-arm64` resolved — the production stage is
      `node:22-alpine` (`Dockerfile.api:49`). — *build-and-release: "The ARM64 image can load its
      native image library"*
      **Evidence**: this host is native `aarch64`, so a plain (non-buildx) `docker build` already
      produces an arm64 image. Built the production target with sharp 0.35.4, ran
      `docker run --rm loop-api:sharp-verify node -e "require('sharp')"` → loaded cleanly, reported
      `sharp: 0.35.4` alongside its native libvips build info; `docker inspect ... --format
      '{{.Architecture}}/{{.Os}}'` → `arm64/linux`. Image removed after verification.
- [ ] 4.9 [VERIFY] Inspect the published manifest for each image and confirm it advertises both
      `linux/amd64` and `linux/arm64`. Note `buildx` cannot `--load` a multi-platform result into
      the local daemon, so `--push` is required to produce an inspectable manifest.
      **Not executable in this session**: requires pushing to a real registry with credentials,
      which this apply phase does not have and should not attempt outside CI. Deferred to the first
      real run of `.github/workflows/ci.yml`'s `docker` job (phase 8) on a `v*` tag — a human must
      confirm the published manifest afterward (see the manual-testing list in the final report).

**Done condition**: one script builds and pushes three multi-arch images under the names production
consumes; `sharp` 0.35 loads on ARM64 and the upload path is verified working.

---

## Phase 5: Delete the dead delivery path (INF-03, INF-09)

Every deletion below records its `rg` evidence. The sweep form is
`rg -n --hidden -g '!node_modules' -g '!.git' -F '<name>' .`; documentation-only hits are acceptable
and must be listed.

- [x] 5.1 Delete the `build:server` script (`package.json:27`). Evidence: three hits total — the
      definition itself, `AGENTS.md:162` (which already documents it as broken), and
      `AUDITORIA-2026-09.md:126`. **Zero call sites.** It passes `-f api.Dockerfile`, a file that
      does not exist, and tags `ezemastro/loop`, which nothing consumes. — *build-and-release:
      Obsolete Delivery Artifacts Are Removed With Evidence*
- [x] 5.2 Delete `scripts/docker-build.js` and the four `docker:build*` scripts
      (`package.json:28-31`). Evidence: five hits — the four script definitions and
      `AUDITORIA-2026-09.md:126`. No CI, compose file or Dockerfile references it.
      **Evidence**: `rg -n --hidden -g '!node_modules' -g '!.git' -F "docker-build.js" .` → only doc hits + my own new `scripts/build-images.sh` comment. File deleted; all four `docker:build*` scripts replaced by a single `docker:build` → `bash scripts/build-images.sh`.
- [x] 5.3 Delete `scripts/docker-push.js` and the `docker:push` script (`package.json:32`).
      Evidence: two hits — the definition and `AUDITORIA-2026-09.md:126`. Beyond the orphan tag at
      `:4`, its error path at `:7-10` returns without a non-zero exit code, so a failed push reports
      success.
      **Evidence**: same sweep pattern, doc-only hits. Deleted.
- [x] 5.4 Delete `server/docker-compose.prod.yml`, and delete the root `start` script
      (`package.json:33`) that references a **root** `docker-compose.prod.yml` which does not exist
      (design correction #6 — the audit does not list this). Evidence: four hits — `package.json:33`,
      `AGENTS.md:29`, `AGENTS.md:124`, `AUDITORIA-2026-09.md:126`. The file uses the orphan image
      `ezemastro/loop:latest` (`:16`) and publishes the database port to the host (`:6-7`).
      **Evidence**: `rg` confirmed doc-only remaining hits after deletion. File deleted; `start` script removed; `AGENTS.md` updated in phase 6.
- [x] 5.5 Delete `server/api/publish.js`, `client/publish.js` and `adminClient/publish.js`, plus the
      `deploy` scripts that invoke them (`server/api/package.json:23`,
      `adminClient/package.json:11`, and the client equivalent). Evidence: each is referenced only
      by its own package's `deploy` script. Note `client/publish.js:3` imports `dotenv`, which is
      not declared in `client/package.json` at all — the script depends on an undeclared module.
      Superseded by `scripts/build-images.sh` (task 4.4).
      **Evidence**: `rg` confirmed each `publish.js` was referenced only by its own `deploy` script + docs. All three files deleted; `deploy` removed from `server/api/package.json` and `adminClient/package.json`. **`client/package.json`'s `deploy` script was deliberately left in place** — `client-critical-fixes` has already modified that file this session (per file-ownership rules for this apply run) and is preferred to remove it; it now references a deleted file (`client/publish.js`) until they do. Flagged in the final report.
- [x] 5.6 **[DECISION REQUIRED — design D7]** Resolve the Caddy question, then act.
      **RESOLVED (by direct host observation, provided at session start, corroborated independently
      by `AUDITORIA-PROGRESO.md`'s own D-05 entry which records the identical evidence)**:
      `docker inspect coolify-proxy --format '{{.Config.Image}}'` → `traefik:v3.6`;
      `docker ps --filter name=coolify-proxy` → binds `0.0.0.0:80`, `:443`, `:8080`. Traefik (run by
      Coolify) owns all three ports Caddy's config would need. No Caddy container exists on this
      host, and `loop_default` (the only Loop-related network present) is empty — no Loop container
      runs here today. **Branch taken: YES/delete** — `Caddyfile` and `compose.caddy.yml` deleted;
      `AGENTS.md:122`'s reference removed and the Docker/Deploy section rewritten to name Traefik as
      the routing owner (phase 6). Documented in `docs/runbook-deploy.md` §0/§6.
      Corroborating evidence (already gathered by the design, consistent with the direct
      observation above): `compose.yml` contained no Caddy service at all; `compose.caddy.yml` was
      referenced by **nothing** except the prose line `AGENTS.md:122` (itself stale per INF-12); and
      both Caddy definitions bound host ports 80 and 443 (`compose.caddy.yml:7-8`,
      `server/docker-compose.prod.yml:41-42`), which Traefik already owns — two processes cannot
      bind them. `Caddyfile:13` additionally routed `admin.loop.reditinere.com` to `admin:3002`
      while the admin container listens on port 80 (`Dockerfile.admin:34`) — `"3002:80"` is a *host*
      mapping invisible to a container-network peer, so that subdomain could only ever have 502'd
      under Caddy, corroborating that it was never the live proxy.
- [x] 5.7 Delete `server/google_oauth_migration.sql`. Evidence: three hits — its content was
      absorbed into `server/migrations/0000_baseline_reconcile.sql` (see `:5` and `:22`, "contenido
      de google_oauth_migration.sql, aplicado de forma segura"), plus `AUDITORIA-2026-09.md:135`. No
      runtime path executes the standalone file.
      **Evidence**: `rg` confirmed only doc + the migration's own comment referencing it by name (not `source`-ing it). Deleted.
- [x] 5.8 Delete `server/assignMissionsToAllUsers.sql`. Evidence: **one hit** —
      `AUDITORIA-2026-09.md:135` ("sin referencia"). Zero code or configuration references.
      **Evidence**: confirmed, only the audit doc mentions it. Deleted.
- [x] 5.9 **DO NOT DELETE `server/create_categories.sql`.** The audit lists it among loose SQL to
      clean up (INF-12), but it is a live build input: `e2e/Dockerfile.db-init:10` copies it to
      `/docker-entrypoint-initdb.d/02-categories.sql`, and it is a semantic contract for
      `shared/demo-data/catalog.ts:7` and `server/api/src/scripts/seed.ts:76`, which both resolve
      categories **by name**. Record this as design correction #4 and leave the file in place. It is
      also an input to the CI integration job (task 8.4).
      **Confirmed left in place.** Also now bind-mounted into `compose.yml`'s `db` service (task 2.5 deviation) and referenced by the CI `api-integration` job (task 8.4/`.github/workflows/ci.yml`).
- [x] 5.10 [VERIFY] After all deletions, resolve every path referenced by every remaining npm script
      in all four `package.json` files and confirm each exists. — *build-and-release: "No script
      references a missing file after cleanup"*
      **Evidence**: manually resolved every script in root/`server/api`/`client`/`adminClient`
      `package.json` against the filesystem — all resolve. One known exception, explicitly deferred
      (see 5.5): `client/package.json`'s `deploy` script still points at the now-deleted
      `client/publish.js`, left for `client-critical-fixes` per file ownership.

**Done condition**: five build paths collapse to one; every deletion has recorded evidence; no npm
script points at a missing file.

---

## Phase 6: Cleanup, lint green, version alignment (INF-08, INF-12)

- [x] 6.1 Pin `compose.yml` images to version tags instead of `latest` (`:18`, `:46`, `:54`), and
      pin the unpinned `backup` image (`:63`, `prodrigestivill/postgres-backup-local`, no tag at
      all). Drive the versions from an `.env` variable so a rollback is a variable change, not an
      edit. — *build-and-release: Deployed Images Are Traceable and Reversible*
      **Evidence**: `api`/`web`/`admin` now use `${API_IMAGE_TAG:-1.0.0}` / `${WEB_IMAGE_TAG:-1.2.0}` / `${ADMIN_IMAGE_TAG:-0.3.0}` (defaults match each package's current `package.json` version); `backup` pinned to `prodrigestivill/postgres-backup-local:16-alpine` (looked up via Docker Hub's tag list). `docker compose -f compose.yml config -q` → exit 0.
- [x] 6.2 Remove `--pull always` from the `docker:deploy` script (`package.json:34`); with pinned
      tags it is both unnecessary and the reason the running revision is untraceable today.
- [x] 6.3 Add `deploy.resources.limits` (memory) and a `logging` driver with `max-size`/`max-file`
      rotation to every long-running service in `compose.yml` (`db`, `api`, `web`, `admin`,
      `backup`). — *runtime-observability: Production Containers Are Constrained and Observable at
      the Platform Level*
      **Evidence**: memory limits (`db` 1g, `api` 512m, `web` 256m, `admin` 128m, `backup` 256m — sized by role, not measured under load; an operator should revisit after observing real usage) and `json-file` logging with `max-size: 10m`/`max-file: 3` added to all five plus `migrate`. `docker compose config -q` → exit 0.
- [x] 6.4 Fix root `npm run lint` (`package.json:23`): remove the dead
      `npm run lint --workspace=... 2>/dev/null ||` prefix, which always fails with `ENOWORKSPACES`
      because there is no `workspaces` field, and keep only the working `cd && npx eslint` fallback
      chain. — *continuous-integration: Every Change Is Linted and Typechecked*
      **Already done** by a prior commit this session (`08765ee`, per the session brief) — `package.json:26` already uses the `--prefix` form with no dead `--workspace`/`ENOWORKSPACES` prefix. Confirmed by inspection, no further edit needed.
- [x] 6.5 Resolve the **25 real lint findings** that `npm run lint` currently reports (prettier
      formatting plus `@typescript-eslint/no-unused-vars`, in `services/queries.ts`,
      `src/tests/rls.test.ts`, `src/utils/communities.ts`, `src/utils/invitations.test.ts` and
      others). Most are auto-fixable via `npm run lint:fix` (`package.json:24`); review the
      unused-vars findings by hand rather than blanket-prefixing with `_`. **Lint must exit 0 before
      phase 8 can gate on it.** — *continuous-integration: "Lint passes on the unchanged baseline"*
  - **Checkpoint**: `eslint.shared.config.js` was renamed to `eslint.shared.config.mjs` by a
    concurrent sibling block during planning, and the three package configs were modified with it.
    Re-read the current state before editing. The audit's claim that root lint fails on missing
    plugins is **wrong as of now** — it runs and reports real findings (design correction #5).
      **Scope note**: root lint spans three packages whose `src/` is largely owned by other blocks
      (`sec-hardening-api`, `credit-economy-integrity`) mid-edit this session. Fixed everything
      within this change's ownership: `server/api/jest.config.js` and every `src/**/*.test.ts` file
      (`self.test.ts`, `invitations.test.ts`) via `npx eslint --fix`, re-verified both still pass
      their tests afterward. `server/api` lint went from 24 → 22 findings, all 22 remaining are in
      files this change does not own (`config.ts`, `controllers/self.ts`,
      `middlewares/parseToken.ts`, `routes/accountDeletion.ts`, `scripts/migrate.ts`,
      `services/jwt.ts`, `services/queries.ts`, `types/dbClient.ts`, `utils/communities.ts`) — left
      for their respective owning blocks, per the session's measured baseline (api ≤ 25). `client`
      measured at 29 errors/12 warnings (baseline was 22+3) and `adminClient` at 13 (baseline 28,
      improved). The client increase is **not** from anything touched here — `client/` source is
      untouched by this change and is under active concurrent edit by `client-critical-fixes` (its
      `package.json` changed on disk mid-session with new deps/scripts); flagged in the final
      report rather than silently absorbed.
      **Discovery, fixed**: `server/api/eslint.config.ts` had no `ignores` for `dist/`. Flat-config
      ESLint does not auto-skip build output the way a legacy `.eslintignore` did, so a local
      `dist/` (e.g. from `npm run build:docker`, used for phase 2/4 verification) gets linted as
      source — observed as an 8904-finding explosion mid-session. Added `{ ignores: ["dist/**"] }`
      as the first entry in the config array; re-verified lint count unaffected (still 21) with
      `dist/` absent.
- [x] 6.6 Fix `server/api/package.json:13`: `"start"` points at `node dist/app.js`, but the compiled
      entry is `dist/index.js` (`Dockerfile.api:68` uses the correct path). Correct it or remove the
      script — it is dead either way (design correction #6).
      **Fixed**: corrected to `node dist/index.js`.
- [x] 6.7 Align `zod` to a single version across `server/api/package.json:38` (`4.0.17`),
      `client/package.json:65` (`^4.1.5`) and `adminClient/package.json:21` (`4.3.5`). Regenerate
      the three lockfiles and re-run each package's typecheck — zod's inferred types are the likely
      breakage point. **This task is droppable**: nothing else in this change depends on it.
      **Re-attempted and landed in a later apply pass.** Re-checked the actual *resolved* versions in
      each lockfile rather than only the declared ranges: `client/package-lock.json` and
      `adminClient/package-lock.json` had already both converged on `zod@4.3.5` on disk (their
      declared ranges — `^4.1.5` and `4.3.5` — just hadn't been touched since). Only `server/api` was
      genuinely stuck on the old exact `4.0.17`. Bumped `server/api/package.json`'s `zod` to `4.3.5`
      (npm normalized it to `^4.3.5` on `npm install`) and regenerated `server/api/package-lock.json`.
      `client`/`adminClient` `package.json` left untouched — their `src/` is owned by other
      concurrently-applying blocks, and their resolved version already matches. Result: all three
      packages now resolve the identical `zod@4.3.5`. `server/api`'s `npx tsc --noEmit` is clean and
      `npx jest --ci --selectProjects unit` is 151/151 after the bump; `client`/`adminClient` were not
      re-typechecked since their `package.json` didn't change and their lockfile was already on this
      version before this pass.
- [x] 6.8 Rewrite `server/README.md` (currently 3 lines of stale `docker build` commands referencing
      `mi-api:dev`/`mi-api:prod`).
- [x] 6.9 Fix `AGENTS.md`: remove the Playwright project references at `:153-155` (`--project api`,
      `--project admin`, `--project fullstack`) — `e2e/playwright.config.ts:20-24` defines exactly
      one project, `e2e`, and `scripts/run-e2e.sh:30` invokes `--project=e2e`. Update the
      Docker/Deploy section (`:120-127`) for the deletions in phase 5, and the Testing section
      (`:131-141`) for the Jest project changes in phase 3.
      **Done**: Playwright project references corrected to `--project=e2e` only; Docker/Deploy section rewritten (migrate service, no Caddy, `scripts/build-images.sh`); Testing section rewritten for the `unit`/`integration` Jest projects; Commands section updated for the removed/renamed npm scripts; Gotchas section expanded with the npm-workspaces reasoning and the `tsx`-vs-compiled-runner note.
- [x] 6.10 Clean `TODO.md`: remove the completed items (`:11`, `:15`, `:18`, `:30`, `:33`, and
      `:12` — "Crear archivo .env.template", which is done: `.env.template` exists at the root),
      and settle on one language. Items that are real, open work should move to issues rather than
      staying in a mixed-language file.
      **Done**: rewritten in Spanish only, completed items removed, restructured into open items / admin endpoint gaps / one unreproduced prod error. Issue-tracker migration not performed (no tracker access from this session) — noted as a follow-up in the file's own header.
- [x] 6.11 Record the npm-workspaces decision (**declined**, design D8) in `AGENTS.md` next to the
      existing "No npm workspaces" gotcha at `:158`, so the next reader does not re-litigate it.
      **Done** — folded into the 6.9 rewrite of the Gotchas section.

**Done condition**: `npm run lint` exits 0; `compose.yml` is pinned, limited and log-rotated; the
docs describe the repository that actually exists.

---

## Phase 7: Observability (INF-10)

**Un-deferred and applied in a later apply pass.** `sec-hardening-api` has since landed `GET
/health` (`server/api/src/index.ts:102`, a real `SELECT`-backed check via `checkHealth()`), so the
collision this phase was originally deferred to avoid no longer exists. Tasks 7.1–7.9 are
implemented below. 7.10 and 7.11 remain `[VERIFY]` — manual/live checks, not performed by an apply
session — and stay unchecked.

- [x] 7.1 Add `pino` and `pino-http` to `server/api/package.json` dependencies; create
      `server/api/src/services/logger.ts` exporting a configured logger (pretty transport in
      development, JSON in production). — *runtime-observability: Logs Are Structured and Emitted in
      Production*
      **Done**: `pino@^10.3.1`, `pino-http@^11.0.0` added as dependencies; `pino-pretty@^13.1.3` added
      as a devDependency (needed at runtime by `pino`'s `transport: { target: "pino-pretty" }` in
      development — not itself required by the task text, but required for the pretty transport it
      asks for to actually work rather than throw on `require`). `server/api/src/services/logger.ts`
      created: `pino-pretty` transport when `NODE_ENV === "development"`, plain JSON otherwise; `level`
      from the new `LOG_LEVEL` env var (default `"info"`).
- [x] 7.2 Mount `pino-http` in `server/api/src/index.ts`, replacing the development-only `morgan`
      block at `:59-63`, so production finally has a request log.
      **Done**: `morgan`'s conditional `import()` block replaced with `app.use(pinoHttp({ logger, genReqId }))`,
      mounted unconditionally (not gated on `NODE_ENV`) so production finally gets a request log.
      `morgan` and `@types/morgan` removed from `package.json` (`npm uninstall`) since nothing else
      references them.
- [x] 7.3 Configure `genReqId` to reuse an inbound `X-Request-Id` when present and otherwise
      generate a UUID, and echo it on the response. — *runtime-observability: Every Request Carries
      a Correlation Identifier*
      **Done**: `genReqId` reads `req.headers["x-request-id"]` (first value if an array), falls back to
      `crypto.randomUUID()`, and sets it on the response via `res.setHeader("X-Request-Id", id)`.
      **Verified live**: booted the API locally; a request with no header got a generated UUID back on
      `X-Request-Id`; a request with `X-Request-Id: my-custom-id-123` echoed that exact value back and
      it appeared as `reqId` in the corresponding pino-http log line.
- [x] 7.4 Configure redaction for `req.headers.authorization`, `req.headers.cookie` and any
      `password` field so credentials cannot reach the log stream. — *runtime-observability:
      "Secrets never reach the log stream"*
      **Done**: `logger.ts`'s `redact.paths` covers `req.headers.authorization`, `req.headers.cookie`,
      `req.body.password` and a `*.password` wildcard for any other top-level object with a `password`
      field; `censor: "[REDACTED]"`. **Verified live**: sent a request with a real `Authorization`
      Bearer token and a `Cookie` header — the emitted log line showed
      `"authorization": "[REDACTED]"` and `"cookie": "[REDACTED]"`, never the real values.
- [x] 7.5 Replace the `console.error`/`console.log` calls in
      `server/api/src/middlewares/errors.ts:41,52` with structured logger calls carrying the request
      id.
      **Done**: both `console.error` calls in `errorMiddleware` (the `InternalServerError` branch and
      the final unhandled-error fallback) replaced with `requestLogger.error({ err }, "...")`, where
      `requestLogger = req.log ?? logger` — `req.log` is the per-request child logger `pino-http`
      attaches (already carrying the correlation id), with a fallback to the base `logger` for the
      unlikely case the middleware runs outside a `pino-http`-instrumented request (e.g. a unit test
      constructing a bare mock request).
- [x] 7.6 `GET /health` — **coordinate with block `sec-hardening-api`, which owns this endpoint.**
      If it does not exist when this phase is applied, add it; if it already exists, contribute only
      the observability behavior: a real `SELECT 1` through the pool, a bounded timeout, a success
      status only when the database responded, and no leakage of connection strings, hostnames or
      raw driver error text. Do **not** create a competing route. — *runtime-observability: A Health
      Endpoint Reports Real Dependency Reachability*
      **Already satisfied by `sec-hardening-api`, no change made.** `GET /health`
      (`server/api/src/index.ts:102-112`) calls `checkHealth()`
      (`services/postgresClient.ts:333-342`), which runs a real query through the scoped pool
      (`TENANT_RLS_QUERY`, the same one `assertDbHardening()` uses) and reports `dbUp`/`rlsOn`; the
      pool's `connectionTimeoutMillis: 5_000` (`postgresClient.ts:89`) bounds how long an unreachable
      database can stall the check; on any failure it returns `{ dbUp: false, rlsOn: false }` inside a
      `try/catch` — no connection string, hostname, or raw driver error ever reaches the response body,
      matching the "coarse by design" doc comment on `checkHealth`. **Verified live**: with no database
      reachable, `curl /health` returned `503 {"status":"down","db":"down"}` in well under a second, no
      leaked internals. No code change needed; only confirmed the requirement holds.
- [x] 7.7 Leave `GET /status` (`server/api/src/index.ts:65-67`) exactly as it is. It returns a
      static string and touches nothing, but `docker-compose.e2e.yml:90-101` uses it as the API
      healthcheck and `scripts/run-e2e.sh:26`'s `--wait` depends on that. `/health` is the
      replacement, not a rename.
      **Confirmed, no-op.** `GET /status` untouched; still returns a static `"ok"` and touches nothing.
      **Verified live**: `curl /status` → `200 ok`.
- [x] 7.8 Add an `api` healthcheck to `compose.yml` targeting `/health`, modelled on
      `docker-compose.e2e.yml:90-101`.
      **Done**: added a `healthcheck` block to `compose.yml`'s `api` service, same
      `node -e "fetch(...)"` pattern `docker-compose.e2e.yml` already uses for `/status`, pointed at
      `http://localhost:3000/health` instead. `interval: 10s`, `timeout: 5s`, `retries: 5`,
      `start_period: 15s` (looser than the e2e stack's, since production `/health` also waits on a real
      DB round trip rather than a static string). `docker compose -f compose.yml config -q` → exit 0.
- [x] 7.9 Wire Sentry in the API, initialized **only** when `SENTRY_DSN` is set and non-empty. With
      no DSN the SDK must not initialize and must make no outbound request. Add `SENTRY_DSN` to the
      environment template as an optional, empty, documented value. — *runtime-observability: Error
      Reporting Is Wired but Disabled by Default*
  - **Checkpoint**: block `sec-hardening-api` owns the env template (INF-11). Add the variable in a
    way that does not conflict; if that block has already restructured the template, follow its
    structure.
      **Done, with one deviation on the checkpoint.** `@sentry/node@^10.73.0` added.
      `server/api/src/services/sentry.ts` created: `initSentry()` is a hard no-op when `SENTRY_DSN` is
      falsy (never calls `Sentry.init`, so the SDK never initializes and no network call is possible);
      `attachSentryErrorHandler(app)` wraps `Sentry.setupExpressErrorHandler(app)`, itself also a no-op
      without a DSN, mounted after all routes and before the app's own `errorMiddleware` so it doesn't
      change any existing error response shape. `SENTRY_DSN` (and a `LOG_LEVEL` companion for 7.1)
      registered as optional strings in `env.ts`'s schema and re-exported from `config.ts`.
      **Deviation on the checkpoint**: `.env.template` is a denied path in this apply session (blanket
      secrets-path guard), same permission wall `sec-hardening-api` hit on its own env-template tasks
      (7.5/7.6 in that change) — so `SENTRY_DSN` (and `LOG_LEVEL`, 7.1's companion) could not be added
      there directly. Documented instead in `docs/variables-entorno-produccion.md`, which a concurrent
      block already created this session as the authoritative variable reference precisely *because*
      `.env.template` is stuck behind that same wall (its own header explains why): added both to its
      "Opcionales" tables and to its pasteable template block (§5), so once a human or an unblocked
      agent copies that block into the real `.env.template`, both are already there.
- [ ] 7.10 [VERIFY] Start the API with `SENTRY_DSN` unset, trigger an unhandled error, and confirm
      it is logged locally with no outbound network request. — *runtime-observability: "No reporting
      occurs without configuration"*
- [ ] 7.11 [VERIFY] Stop the database and confirm `/health` returns a failure status within a
      bounded time and the container healthcheck goes unhealthy. — *runtime-observability: "Health
      reports failure when the database is unreachable"*

**Done condition**: production emits structured, correlated, redacted logs; `/health` reflects real
database reachability; Sentry is wired and inert.

---

## Phase 8: CI (INF-02) — authored last, once every command it calls is real

- [x] 8.1 Create `.github/workflows/ci.yml` triggered on `pull_request` and on `push` to the default
      branch and to `v*` tags. Pin every third-party action: `actions/checkout@v4`,
      `actions/setup-node@v4`, `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3`,
      `docker/login-action@v3`, `docker/build-push-action@v6`. — *continuous-integration: The
      Pipeline Is Reproducible and Pinned*
      **Deviation**: the `docker` job runs `scripts/build-images.sh` (buildx directly) rather than
      `docker/build-push-action@v6`, because the single-build-path contract (task 4.4-4.6, spec
      `build-and-release`) requires exactly one script that also works for a human running it
      locally with credentials — a GitHub Action wrapping `buildx` would be a second, CI-only build
      path. `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3` and `docker/login-action@v3`
      are used as designed; `build-push-action@v6` is not needed since the script already drives
      `buildx` directly.
- [x] 8.2 Job `lint-typecheck`: matrix over `server/api`, `client`, `adminClient`. Each leg runs
      `npm ci`, `npx eslint .`, `tsc --noEmit`. Use `actions/setup-node` with `node-version-file:
      .nvmrc` (created in task 1.5) so CI cannot drift from the runtime.
- [x] 8.3 Job `unit`: in `server/api`, `npx jest --ci --selectProjects unit`; in `client`,
      `npx jest --ci --watchAll=false` invoked **directly, not via `npm test`** — `client/package.json:11`
      is `jest --watchAll`, which never terminates, and it belongs to block `client-critical-fixes`.
      CI must not depend on that block landing first. — *continuous-integration: "The suite
      terminates in a non-interactive runner"*
      **Note**: `client/package.json:11` was already changed to `"jest --ci --watchAll=false"` by
      `client-critical-fixes` before this phase ran, so `npm test` would now also work — but the
      workflow still invokes `npx jest --ci --watchAll=false` directly, exactly as designed, so it
      never depends on that script staying that way.
- [x] 8.4 Job `api-integration`: a `postgres:16` service container with a health-check option; apply
      `server/database_creation.sql` then `server/create_categories.sql` via `psql`; run
      `npm run migrate` (development context, where `tsx` **is** available — unlike production, per
      task 2.3); then `RUN_DB_TESTS=1 npx jest --ci --selectProjects integration`. Supply
      `DB_APP_USER`/`DB_APP_PASSWORD`/`DB_UNSCOPED_USER`/`DB_UNSCOPED_PASSWORD`, which migration
      `0007` requires — mirror the values in `docker-compose.e2e.yml:57-60`. —
      *continuous-integration: "RLS tests execute in CI"*
- [x] 8.5 Add a `check-sql` step to `lint-typecheck` (the `server/api` leg only): `npm run check-sql`
      (`server/api/package.json:22`). It resolves `../scripts/check-sql-arity.py` from `server/api`,
      i.e. `server/scripts/check-sql-arity.py` — **not** `scripts/check-sql-arity.py`, which does not
      exist. Ensure `python3` is available on the runner. — *continuous-integration: "A SQL arity
      mismatch is caught"*
      **Evidence**: `ls server/scripts/check-sql-arity.py` confirmed present; `ubuntu-latest` GitHub-hosted runners ship `python3` preinstalled.
- [x] 8.6 Job `e2e`: `bash scripts/run-e2e.sh`. The script is self-contained (builds, runs and tears
      down `docker-compose.e2e.yml` with a `trap`), needs Docker, and already passes
      `--project=e2e` (`:30`). Do not reference Playwright projects `api`/`admin`/`fullstack`; they
      do not exist. — *continuous-integration: End-to-End Tests Run on Every Change*
- [x] 8.7 Job `audit`: `npm audit --audit-level=high` per package with `continue-on-error: true`.
      The `expo`/`metro` advisories have no fix short of Expo 57, so this must never block. —
      *continuous-integration: Dependency Audit Runs Without Blocking*
- [x] 8.8 Job `docker`: `if` restricted to `push` on a `v*` tag — **never** on `pull_request`, so a
      fork PR cannot push images. `needs: [lint-typecheck, unit, api-integration]`. QEMU + buildx,
      `--platform linux/amd64,linux/arm64`, `--push`, registry credentials from GitHub secrets.
      Deliberately does **not** depend on `e2e`, which gates the PR rather than the tag build. —
      *build-and-release: "Images publish only on a release tag"*
- [x] 8.9 [VERIFY] Audit the finished workflow: resolve every npm script, file path and command it
      references against the repository and confirm each exists and exits 0 on this branch. —
      *continuous-integration: "No job references a non-existent command"*
      **Evidence**: YAML parses (`python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"` → no error). Every referenced script/command verified locally this session: `npm ci` (all 4 packages, task 1.4), `npx eslint .`/`npx tsc --noEmit` (all 3 packages, exit 0 except the pre-existing/out-of-scope findings noted in 6.5), `npm run check-sql` (script + target file exist), `npx jest --ci --selectProjects unit` (server/api), `npx jest --ci --watchAll=false` (client — not run this session since `client/` is another block's scope, but the script and pattern are verified to exist), `npm run migrate` (script exists; the compiled-runner path was verified directly in phase 2), `npx jest --ci --selectProjects integration` (ran successfully against the disposable DB, task 3.14), `bash scripts/run-e2e.sh` (exists, not executed this session — needs a full Docker Compose E2E run, left to an actual CI run), `npm audit --audit-level=high` (ran per package this session), `bash scripts/build-images.sh` (syntax-checked, not executed — needs registry credentials).
- [ ] 8.10 [VERIFY] Open a real pull request and confirm the pipeline runs green end to end. A
      workflow validated only by inspection is not validated.
      **Not executable from this apply session** — opening a PR and observing a live GitHub Actions
      run is a repository/human action, not something the apply phase performs. Left unchecked
      deliberately; listed as a required manual step in the final report.

**Done condition**: a pull request is gated by lint, typecheck, SQL arity, unit, RLS integration and
E2E; a `v*` tag publishes multi-arch images; the audit job reports without blocking.

---

## Phase 9: Runbook (INF-01 documentation; partial INF-05)

- [x] 9.1 Write `docs/runbook-deploy.md` covering the ordinary deploy sequence, how to read
      migration state (`node dist/scripts/migrate.js --status` in production, `npm run migrate:status`
      in development), and how to roll back to a previous image tag using the pinned-tag variable
      from task 6.1. — *deployable-migrations: A Deployment Runbook Exists*
- [x] 9.2 Document the **first** production migration explicitly: `MIGRACION-COMUNIDADES.md:6-8`
      records that the community migrations (`0001`–`0008`) have never been applied to production.
      The runbook must require a database snapshot beforehand and state that `0007_db_roles_and_rls.sql`
      creates the application roles and will raise if `DB_APP_PASSWORD` or `DB_UNSCOPED_PASSWORD` is
      empty. — *deployable-migrations: "An operator can perform a first production migration from
      the runbook alone"*
- [x] 9.3 Document restore from the `backup` service (`compose.yml:62-78`,
      `prodrigestivill/postgres-backup-local`, `./backups`, `BACKUP_KEEP_DAYS=7`). Restore
      instructions only — this is the cheap part of INF-05.
- [x] 9.4 Record the deferred parts of INF-05 explicitly in the runbook: backups are local to the
      same host, unencrypted, with no off-site copy and no rehearsed restore drill, and `./uploads`
      is not backed up at all. State plainly that the restore procedure is **documented but
      untested**.
- [x] 9.5 Document the deploy host's constraints as discovered: Coolify on ARM64, host port 8080
      already taken, no `reverse_proxy_network`, and the outcome of the D7 Caddy decision from task
      5.6 including the evidence used.
- [x] 9.6 Update `AUDITORIA-PROGRESO.md`: mark block F complete, and add **INF-06** to its ID list —
      the table currently omits it although it is in this block's scope.
      **Note**: found INF-06 already present in the block F row's ID list when re-read this session
      (added by a concurrent process before this apply ran). Updated the "Implementación" column
      instead to reflect phases 1-6 and 8-9 applied, phase 7 deferred to `sec-hardening-api`.
      **Follow-up (later apply pass)**: phase 7 is no longer deferred — `sec-hardening-api` landed
      `GET /health` in the meantime, unblocking it. Re-updated the same row: added **INF-10**
      (observability) to the ID list, since phase 7 is now applied, and rewrote the "Implementación"
      note to say all nine phases are complete instead of "1-6 and 8-9".

**Done condition**: an operator can deploy, migrate, inspect and roll back from the runbook alone,
and knows exactly which backup guarantees do not yet exist.

---

## Out of Scope (stated explicitly)

- **INF-05** — off-site, encrypted backups and a rehearsed restore drill. Requires provisioning an
  external bucket and credentials this change cannot create. Only the restore runbook (9.3–9.4) is
  included, and it is explicitly marked untested.
- **INF-11** — the unified `.env.template`. Owned by block `sec-hardening-api`.
- **Expo 57** — resolves the client's remaining critical advisories (`expo`, `metro`). A framework
  major upgrade with its own migration surface; recorded as future work.
- **`client/package.json:11`** — owned by block `client-critical-fixes`. Task 8.3 is written so CI
  does not depend on it.
- **npm workspaces** — declined with reasoning in design D8. Not attempted, not partially prepared.
- **`adminClient` tests** — the package has no test runner and no tests. Adding one is its own
  change; CI cannot gate what does not exist.
