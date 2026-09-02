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

- [ ] 1.1 Remove the API lockfile exclusions: delete line 4 (`/server/**/package-lock.json`) from
      `.gitignore`, and delete line 3 (`package-lock.json`) from `server/api/.gitignore`. Both rules
      cover the same file; removing only one leaves it ignored. — *build-and-release: Dependencies
      Are Installed Reproducibly From Committed Lockfiles*
- [ ] 1.2 Commit the existing `server/api/package-lock.json` (present on disk, 407 KB, untracked).
      Verify before committing that it still contains `@img/sharp-linuxmusl-arm64` and
      `@img/sharp-linuxmusl-x64` — the production stage is `node:22-alpine` (`Dockerfile.api:49`),
      so the musl variants are the ones that matter on the ARM64 host.
- [ ] 1.3 Generate and commit `adminClient/package-lock.json` (`npm install --package-lock-only` in
      `adminClient`). Note `adminClient/package.json:44-46` aliases `vite` to
      `npm:rolldown-vite@7.2.5` via `overrides`; confirm the generated lockfile records that alias.
- [ ] 1.4 Verify `npm ci` succeeds from a clean `node_modules` in all four packages: root,
      `server/api`, `client`, `adminClient`. Regenerate any lockfile that reports drift against its
      `package.json`. — *build-and-release: "An image build fails loudly on lockfile drift"*
- [ ] 1.5 Create `.nvmrc` at the repository root containing `22`, matching the production stage
      (`Dockerfile.api:49`, `node:22-alpine`). — *build-and-release: Runtime Versions Are Pinned and
      Consistent*
- [ ] 1.6 Add `"engines": { "node": ">=22 <23" }` to the root, `server/api`, `client` and
      `adminClient` `package.json` files.
- [ ] 1.7 Pin the build stages to Node 22: `Dockerfile.api:2` and `:23` (`node:20-slim` →
      `node:22-slim`), `Dockerfile.web:2` and `:30`, `Dockerfile.admin:2`. Leave
      `Dockerfile.api:49` (`node:22-alpine`) as-is — it is already correct and is the version the
      others align to.
  - **Checkpoint**: the Expo web export (`Dockerfile.web:27`) and the Vite build
    (`Dockerfile.admin:27`) both run on the build stage. Confirm each still builds on Node 22 before
    moving on; this is the likeliest place phase 1 breaks.
- [ ] 1.8 Replace `npm install` with `npm ci` in every Dockerfile install layer:
      `Dockerfile.api:8`, `:10`, `:32`, `:34`, `:54`; `Dockerfile.web:10`, `:12`;
      `Dockerfile.admin:10`, `:12`. Each `npm ci` needs its lockfile copied in the same layer — the
      existing `COPY package*.json` globs already match `package-lock.json`.
- [ ] 1.9 Also update `Dockerfile.api:20`'s development `CMD`
      (`npm install --include=dev && npm run dev`) and `docker-compose.e2e.yml:71`'s equivalent
      command. These are development/E2E paths; `npm ci` there is optional but the two must stay
      consistent with each other or the E2E stack diverges from the dev stack.
- [ ] 1.10 Rebuild all three images and confirm each still builds end to end.

**Done condition**: all four packages install with `npm ci` from committed lockfiles; every image
builds on a single pinned Node major; `.nvmrc` and `engines` agree with the production stage.

---

## Phase 2: Deployable migrations (INF-01)

- [ ] 2.1 Add `COPY server/migrations ./migrations` to the `production` stage of `Dockerfile.api`
      (after the `dist` copy at `:57` and its flattening block at `:60-63`, before
      `RUN mkdir -p uploads` at `:65`). With `WORKDIR /app` (`:50`) this lands at `/app/migrations`,
      which `migrate.ts:43`'s `path.resolve(process.cwd(), "migrations")` candidate already
      resolves. — *deployable-migrations: Migration SQL Ships Inside the Production Image*
- [ ] 2.2 Verify — do **not** assume — that `dist/scripts/migrate.js` exists in the built production
      image. `server/api/tsconfig.prod.json:20-26` excludes `src/**/*.test.ts`, `src/tests/**`,
      `src/scripts/seed.ts` and `shared/demo-data/**` but **not** `src/scripts/migrate.ts`, and
      `Dockerfile.api:60-63` flattens `dist/server/api/src/*` into `dist/`. If it is present, no
      build change is needed (design correction #1). If it is absent, add an explicit copy rather
      than editing `tsconfig.prod.json`. — *deployable-migrations: The Migration Runner Is Invokable
      Without Development Dependencies*
- [ ] 2.3 Confirm the compiled runner executes without `tsx`: run
      `node dist/scripts/migrate.js --status` inside a container built from the `production` target.
      `tsx` is a devDependency (`server/api/package.json:72`) stripped by `--omit=dev`
      (`Dockerfile.api:54`), so `npm run migrate` (`server/api/package.json:19`) **cannot** be used
      in production — this is the audit's blind spot. — *deployable-migrations: "Migrations apply
      with production-only dependencies installed"*
- [ ] 2.4 Add a `db` healthcheck to `compose.yml`, copying `docker-compose.e2e.yml:38-42`
      (`pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`, `interval: 5s`, `timeout: 3s`,
      `retries: 10`).
- [ ] 2.5 Add a `migrate` service to `compose.yml`, modelled on `docker-compose.e2e.yml:44-64`:
      same image as `api` (`ezemastro/loop-api`, `compose.yml:18`), `restart: "no"`,
      `command: ["node", "dist/scripts/migrate.js"]`, `MIGRATIONS_DIR=/app/migrations`,
      `PGHOST=db`, the owner credentials `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, and
      `DB_APP_USER`/`DB_APP_PASSWORD`/`DB_UNSCOPED_USER`/`DB_UNSCOPED_PASSWORD` (required —
      `server/migrations/0007_db_roles_and_rls.sql` raises when those passwords are empty, per
      `docker-compose.e2e.yml:55-60`). Depends on `db` with `condition: service_healthy`. Attach to
      `proxy-network` like its peers. — *deployable-migrations: The API Starts Only After Migrations
      Complete Successfully*
- [ ] 2.6 Change `compose.yml:39-40`'s `api.depends_on` from the bare list form (`- db`) to the
      condition form: `db: {condition: service_healthy}` and
      `migrate: {condition: service_completed_successfully}`.
- [ ] 2.7 Do the same for `backup.depends_on` (`compose.yml:68-69`): `db` with
      `condition: service_healthy`.
- [ ] 2.8 [VERIFY] Clean-deploy test: remove any local `postgres-data` volume, run
      `docker compose up`, and confirm the ordering `db healthy → migrate exits 0 → api starts`,
      with `api` reaching healthy and **never restarting**. This is the scenario that crash-loops
      today via `index.ts:120-125`. — *deployable-migrations: "Clean deploy against an empty
      database succeeds"*, *"The RLS guard no longer crash-loops"*
- [ ] 2.9 [VERIFY] Idempotence: bring the stack down and up again against the now-migrated volume;
      confirm `migrate` applies nothing, passes its checksum verification, and exits `0`. —
      *deployable-migrations: "Repeated deploys are idempotent"*
- [ ] 2.10 [VERIFY] Failure path: temporarily introduce a deliberately failing migration, confirm
      `migrate` exits non-zero and `api` never starts, then remove it. — *deployable-migrations: "A
      failing migration stops the deploy instead of starting a broken API"*

**Done condition**: a clean `docker compose up` against an empty database migrates and then starts a
healthy API with zero restarts; a failing migration blocks the deploy.

---

## Phase 3: Green, hermetic server test suite (INF-06)

- [ ] 3.1 Delete `server/api/src/tests/users.test.ts`. Evidence of deadness: `:3-4` asserts `200` on
      `GET /users` with no `Authorization` header, while `index.ts:90` and `routes/users.ts:9` both
      apply `tokenMiddleware`, which returns `401` at `middlewares/parseToken.ts:51-53`. Record an
      `rg` sweep confirming nothing imports it. — *continuous-integration: The Server Test Suite Is
      Green and Hermetic*
- [ ] 3.2 Delete `server/api/src/tests/roles.test.ts`. Evidence: `:3` requests `GET /roles`; there is
      no `server/api/src/routes/roles.ts` and `index.ts:74-99` never mounts `/roles`. Record
      `rg -n '/roles' --glob '!node_modules' --glob '!*.md' .` showing the test file as the only
      non-documentation hit.
- [ ] 3.3 Delete `server/api/src/tests/schools.test.ts`. Evidence: `:6` asserts a collection length
      greater than 1 against an unseeded database. If the coverage is wanted, it belongs in `e2e/`,
      which has a seeded stack — record that as a follow-up rather than porting it here.
- [ ] 3.4 Delete `server/api/src/tests/auth.test.ts`. Evidence: `:4-14` contains **no `expect`**, so
      it passes on any response including a 500, and its own `:12-13` TODO admits the community/school
      seeding precondition is absent. **This supersedes the audit's instruction to replicate
      `auth.test.ts`'s "working pattern"** — see design correction #2.
- [ ] 3.5 Delete `server/api/src/tests/setupAfterEnv.ts` and `server/api/src/tests/teardown.ts`.
      Evidence: `setupAfterEnv.ts:2` imports `src/index.ts`, binding a real listener
      (`index.ts:128-130`) and constructing two `pg` pools (`services/postgresClient.ts:53,61`) for
      every worker; `teardown.ts` never calls the exported `closePools`
      (`services/postgresClient.ts:261`), which is the open-handle leak `test:debug`
      (`server/api/package.json:15`) exists to chase. Also delete
      `server/api/src/tests/global.d.ts`, which declares only `global.api` and `global.__SERVER__`
      (and references `Server` without importing it). — *continuous-integration: "No handles leak
      after the suite finishes"*
- [ ] 3.6 Rewrite `server/api/jest.config.js`: delete the `api` project (`:4-14`) entirely; keep the
      `unit` project (`:15-29`) unchanged; add a third project `displayName: "integration"` with
      `preset: "ts-jest"`, `roots: ["<rootDir>/src"]`, the same `moduleNameMapper`
      (`^(\.{1,2}/.*)\.js$` → `$1`), `testMatch: ["**/tests/**/*.test.ts"]`, and **no**
      `setupFilesAfterEnv` and **no** `globalTeardown`. — *continuous-integration: Database-Dependent
      Tests Run in a Dedicated Project Against a Real Database*
- [ ] 3.7 Confirm `server/api/src/tests/rls.test.ts` is now matched only by the `integration`
      project and no longer boots a server. Leave its `RUN_DB_TESTS === "1"` guard at `:30-31`
      untouched — CI supplies the variable. — *continuous-integration: "RLS tests skip cleanly
      outside CI"*
- [ ] 3.8 Add coverage collection to `server/api/jest.config.js`: `collectCoverage`,
      `collectCoverageFrom` scoped to `src/**/*.ts` excluding `src/tests/**` and `src/scripts/**`,
      and `coverageReporters` including `text-summary` and `lcov`. Do **not** set a
      `coverageThreshold` yet — record the measured baseline first so the threshold is evidence-based.
- [ ] 3.9 Fix the mock in `server/api/src/models/self.test.ts:1-8`. It returns only `dbConnection`,
      but `models/self.ts:4` imports `{ inCommunity, withClient }`, both real exports
      (`services/postgresClient.ts:151` and `:198`), so both are `undefined` under the mock and every
      call site throws `TypeError: withClient is not a function`. Extend the factory with a
      `withClient` that invokes its callback with a mock client, and an `inCommunity` returning
      `{ mode: "community", communityId }`. — *continuous-integration: "The self model unit tests
      execute rather than skip"*
- [ ] 3.10 Remove the four skips in `server/api/src/models/self.test.ts` — `it.skip` at `:47` and
      `:84`, `it.skip.each` at `:54` and `:68` — and confirm they pass against the completed mock.
      Fixing the mock without unskipping these restores almost no coverage (design correction #3).
- [ ] 3.11 Delete the stray debug statement at `server/api/src/models/self.test.ts:16`
      (`console.log(jest.isMockFunction(dbConnection.connect))`).
- [ ] 3.12 Change `server/api/package.json:14` to `"test": "cross-env NODE_ENV=test jest --ci"`.
      Keep `NODE_ENV=test` — it is what disables `assertDbHardening` at `index.ts:120`. Do **not**
      touch `client/package.json:11`; that script belongs to block `client-critical-fixes`. If that
      block has already changed it when this phase is applied, leave it alone.
- [ ] 3.13 [VERIFY] Run `npx jest --ci --selectProjects unit --detectOpenHandles` in `server/api`
      with no database reachable. Every test must pass and no open handle may be reported. —
      *continuous-integration: "The unit project passes with no external dependencies"*
- [ ] 3.14 [VERIFY] Run the integration project against a migrated `postgres:16` with
      `RUN_DB_TESTS=1` and confirm all eight assertions at `rls.test.ts:118-184` **execute** rather
      than skip. — *continuous-integration: "RLS tests execute in CI"*

**Done condition**: the unit project is green, hermetic and handle-clean with no database; the
integration project runs the full RLS suite against a real one.

---

## Phase 4: One multi-arch build path (INF-03, INF-04)

- [ ] 4.1 Bump `sharp` in `server/api/package.json:37` from `^0.34.5` to `^0.35.4`. This is a
      semver-major bump on a native package. — *build-and-release: Images Are Multi-Architecture*
- [ ] 4.2 [VERIFY — required] Confirm the upload path still works after the bump. The API re-encodes
      **every** upload with `sharp` at `server/api/src/services/uploads.ts:44-53`
      (`.rotate().resize({fit:"inside", withoutEnlargement:true}).webp({quality, effort:4}).toFile()`).
      Upload a real JPEG through `POST /uploads` and assert the stored file is `.webp` with non-zero
      size, `req.file.mimetype` is `image/webp` (`uploads.ts:57`), and the EXIF-rotation and
      max-dimension behavior is unchanged. A failure here surfaces as the generic
      `"No se pudo procesar la imagen"` at `uploads.ts:62`, so check the file on disk, not just the
      response.
- [ ] 4.3 Bump `axios` in `adminClient/package.json:16` and `client/package.json:31` to a release
      above the SSRF advisory, and `concurrently` in `package.json:44`. Regenerate the affected
      lockfiles. Do **not** attempt the `expo`/`metro` advisories — they require Expo 57, which is
      explicitly out of scope.
- [ ] 4.4 Create `scripts/build-images.sh`: one `docker buildx build --platform
      linux/amd64,linux/arm64 ... --push` invocation per image. Use the names `compose.yml`
      consumes — `ezemastro/loop-api` (`:18`), `ezemastro/loop-web` (`:46`), `ezemastro/loop-admin`
      (`:54`) — each tagged with its own package version (`server/api/package.json:4` = 1.0.0,
      `client/package.json:4` = 1.2.0, `adminClient/package.json:4` = 0.3.0) and `latest`. Do
      **not** use the root version (`package.json:3`, 1.4.3); it is unrelated. —
      *build-and-release: A Single Build Path Produces All Deployable Images*
- [ ] 4.5 In that script, preserve the build args each image needs:
      `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID` for `Dockerfile.web:20-23`;
      `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` for `Dockerfile.admin:20-23`. Quote every
      interpolation — `client/publish.js:38-39` interpolates these unquoted into a shell string
      today, which breaks on a value containing a space or `;`. — *build-and-release: "A build
      argument containing shell metacharacters is passed intact"*
- [ ] 4.6 The script MUST NOT write to any tracked file and MUST NOT create a commit. This is the
      explicit contract that replaces `scripts/docker-build.js:43` (rewrites `package.json` on disk,
      *before* a build that may then fail at `:60`) and `:63-69` (`git add package.json` +
      `git commit`, staging a release bump over whatever else was staged). — *build-and-release: "A
      failed build leaves the working tree unchanged"*
- [ ] 4.7 Add a root `package.json` script invoking the new build script, replacing the removed
      `docker:build*` entries (`package.json:28-31`).
- [ ] 4.8 [VERIFY] Build the API image for `linux/arm64` and run
      `node -e "require('sharp')"` inside it. `sharp` ships per-platform binaries as optional
      dependencies, so this is the check that catches an image that builds fine and fails at the
      first upload. Confirm `@img/sharp-linuxmusl-arm64` resolved — the production stage is
      `node:22-alpine` (`Dockerfile.api:49`). — *build-and-release: "The ARM64 image can load its
      native image library"*
- [ ] 4.9 [VERIFY] Inspect the published manifest for each image and confirm it advertises both
      `linux/amd64` and `linux/arm64`. Note `buildx` cannot `--load` a multi-platform result into
      the local daemon, so `--push` is required to produce an inspectable manifest.

**Done condition**: one script builds and pushes three multi-arch images under the names production
consumes; `sharp` 0.35 loads on ARM64 and the upload path is verified working.

---

## Phase 5: Delete the dead delivery path (INF-03, INF-09)

Every deletion below records its `rg` evidence. The sweep form is
`rg -n --hidden -g '!node_modules' -g '!.git' -F '<name>' .`; documentation-only hits are acceptable
and must be listed.

- [ ] 5.1 Delete the `build:server` script (`package.json:27`). Evidence: three hits total — the
      definition itself, `AGENTS.md:162` (which already documents it as broken), and
      `AUDITORIA-2026-09.md:126`. **Zero call sites.** It passes `-f api.Dockerfile`, a file that
      does not exist, and tags `ezemastro/loop`, which nothing consumes. — *build-and-release:
      Obsolete Delivery Artifacts Are Removed With Evidence*
- [ ] 5.2 Delete `scripts/docker-build.js` and the four `docker:build*` scripts
      (`package.json:28-31`). Evidence: five hits — the four script definitions and
      `AUDITORIA-2026-09.md:126`. No CI, compose file or Dockerfile references it.
- [ ] 5.3 Delete `scripts/docker-push.js` and the `docker:push` script (`package.json:32`).
      Evidence: two hits — the definition and `AUDITORIA-2026-09.md:126`. Beyond the orphan tag at
      `:4`, its error path at `:7-10` returns without a non-zero exit code, so a failed push reports
      success.
- [ ] 5.4 Delete `server/docker-compose.prod.yml`, and delete the root `start` script
      (`package.json:33`) that references a **root** `docker-compose.prod.yml` which does not exist
      (design correction #6 — the audit does not list this). Evidence: four hits — `package.json:33`,
      `AGENTS.md:29`, `AGENTS.md:124`, `AUDITORIA-2026-09.md:126`. The file uses the orphan image
      `ezemastro/loop:latest` (`:16`) and publishes the database port to the host (`:6-7`).
- [ ] 5.5 Delete `server/api/publish.js`, `client/publish.js` and `adminClient/publish.js`, plus the
      `deploy` scripts that invoke them (`server/api/package.json:23`,
      `adminClient/package.json:11`, and the client equivalent). Evidence: each is referenced only
      by its own package's `deploy` script. Note `client/publish.js:3` imports `dotenv`, which is
      not declared in `client/package.json` at all — the script depends on an undeclared module.
      Superseded by `scripts/build-images.sh` (task 4.4).
- [ ] 5.6 **[DECISION REQUIRED — design D7]** Resolve the Caddy question, then act.
      **The single discriminating observation**: does `admin.loop.reditinere.com` serve the admin
      panel today?
      - **If YES** → Caddy is provably not the active proxy, because `Caddyfile:13` routes that host
        to `admin:3002` while the admin container listens on port **80**
        (`Dockerfile.admin:34`) — `compose.yml:57-58`'s `"3002:80"` is a *host* mapping invisible to
        a container-network peer, so under Caddy that subdomain could only ever have returned 502.
        Delete `Caddyfile` and `compose.caddy.yml`, and remove `AGENTS.md:122`'s reference.
      - **If NO / unreachable** → do **not** delete. Fix `Caddyfile:13` to `admin:80` and document
        the externally hand-created `proxy-network` (`compose.yml:80-82`).
      Supporting evidence for the delete branch, already gathered: `compose.yml` contains no Caddy
      service at all; `compose.caddy.yml` is referenced by **nothing** except the prose line
      `AGENTS.md:122` (itself stale per INF-12); and both Caddy definitions bind host ports 80 and
      443 (`compose.caddy.yml:7-8`, `server/docker-compose.prod.yml:41-42`), which a Coolify host's
      own proxy already owns — two processes cannot bind them.
      **This task may not be checked off without the observation recorded in the apply notes.**
- [ ] 5.7 Delete `server/google_oauth_migration.sql`. Evidence: three hits — its content was
      absorbed into `server/migrations/0000_baseline_reconcile.sql` (see `:5` and `:22`, "contenido
      de google_oauth_migration.sql, aplicado de forma segura"), plus `AUDITORIA-2026-09.md:135`. No
      runtime path executes the standalone file.
- [ ] 5.8 Delete `server/assignMissionsToAllUsers.sql`. Evidence: **one hit** —
      `AUDITORIA-2026-09.md:135` ("sin referencia"). Zero code or configuration references.
- [ ] 5.9 **DO NOT DELETE `server/create_categories.sql`.** The audit lists it among loose SQL to
      clean up (INF-12), but it is a live build input: `e2e/Dockerfile.db-init:10` copies it to
      `/docker-entrypoint-initdb.d/02-categories.sql`, and it is a semantic contract for
      `shared/demo-data/catalog.ts:7` and `server/api/src/scripts/seed.ts:76`, which both resolve
      categories **by name**. Record this as design correction #4 and leave the file in place. It is
      also an input to the CI integration job (task 8.4).
- [ ] 5.10 [VERIFY] After all deletions, resolve every path referenced by every remaining npm script
      in all four `package.json` files and confirm each exists. — *build-and-release: "No script
      references a missing file after cleanup"*

**Done condition**: five build paths collapse to one; every deletion has recorded evidence; no npm
script points at a missing file.

---

## Phase 6: Cleanup, lint green, version alignment (INF-08, INF-12)

- [ ] 6.1 Pin `compose.yml` images to version tags instead of `latest` (`:18`, `:46`, `:54`), and
      pin the unpinned `backup` image (`:63`, `prodrigestivill/postgres-backup-local`, no tag at
      all). Drive the versions from an `.env` variable so a rollback is a variable change, not an
      edit. — *build-and-release: Deployed Images Are Traceable and Reversible*
- [ ] 6.2 Remove `--pull always` from the `docker:deploy` script (`package.json:34`); with pinned
      tags it is both unnecessary and the reason the running revision is untraceable today.
- [ ] 6.3 Add `deploy.resources.limits` (memory) and a `logging` driver with `max-size`/`max-file`
      rotation to every long-running service in `compose.yml` (`db`, `api`, `web`, `admin`,
      `backup`). — *runtime-observability: Production Containers Are Constrained and Observable at
      the Platform Level*
- [ ] 6.4 Fix root `npm run lint` (`package.json:23`): remove the dead
      `npm run lint --workspace=... 2>/dev/null ||` prefix, which always fails with `ENOWORKSPACES`
      because there is no `workspaces` field, and keep only the working `cd && npx eslint` fallback
      chain. — *continuous-integration: Every Change Is Linted and Typechecked*
- [ ] 6.5 Resolve the **25 real lint findings** that `npm run lint` currently reports (prettier
      formatting plus `@typescript-eslint/no-unused-vars`, in `services/queries.ts`,
      `src/tests/rls.test.ts`, `src/utils/communities.ts`, `src/utils/invitations.test.ts` and
      others). Most are auto-fixable via `npm run lint:fix` (`package.json:24`); review the
      unused-vars findings by hand rather than blanket-prefixing with `_`. **Lint must exit 0 before
      phase 8 can gate on it.** — *continuous-integration: "Lint passes on the unchanged baseline"*
  - **Checkpoint**: `eslint.shared.config.js` was renamed to `eslint.shared.config.mjs` by a
    concurrent sibling block during planning, and the three package configs were modified with it.
    Re-read the current state before editing. The audit's claim that root lint fails on missing
    plugins is **wrong as of now** — it runs and reports real findings (design correction #5).
- [ ] 6.6 Fix `server/api/package.json:13`: `"start"` points at `node dist/app.js`, but the compiled
      entry is `dist/index.js` (`Dockerfile.api:68` uses the correct path). Correct it or remove the
      script — it is dead either way (design correction #6).
- [ ] 6.7 Align `zod` to a single version across `server/api/package.json:38` (`4.0.17`),
      `client/package.json:65` (`^4.1.5`) and `adminClient/package.json:21` (`4.3.5`). Regenerate
      the three lockfiles and re-run each package's typecheck — zod's inferred types are the likely
      breakage point. **This task is droppable**: nothing else in this change depends on it.
- [ ] 6.8 Rewrite `server/README.md` (currently 3 lines of stale `docker build` commands referencing
      `mi-api:dev`/`mi-api:prod`).
- [ ] 6.9 Fix `AGENTS.md`: remove the Playwright project references at `:153-155` (`--project api`,
      `--project admin`, `--project fullstack`) — `e2e/playwright.config.ts:20-24` defines exactly
      one project, `e2e`, and `scripts/run-e2e.sh:30` invokes `--project=e2e`. Update the
      Docker/Deploy section (`:120-127`) for the deletions in phase 5, and the Testing section
      (`:131-141`) for the Jest project changes in phase 3.
- [ ] 6.10 Clean `TODO.md`: remove the completed items (`:11`, `:15`, `:18`, `:30`, `:33`, and
      `:12` — "Crear archivo .env.template", which is done: `.env.template` exists at the root),
      and settle on one language. Items that are real, open work should move to issues rather than
      staying in a mixed-language file.
- [ ] 6.11 Record the npm-workspaces decision (**declined**, design D8) in `AGENTS.md` next to the
      existing "No npm workspaces" gotcha at `:158`, so the next reader does not re-litigate it.

**Done condition**: `npm run lint` exits 0; `compose.yml` is pinned, limited and log-rotated; the
docs describe the repository that actually exists.

---

## Phase 7: Observability (INF-10)

- [ ] 7.1 Add `pino` and `pino-http` to `server/api/package.json` dependencies; create
      `server/api/src/services/logger.ts` exporting a configured logger (pretty transport in
      development, JSON in production). — *runtime-observability: Logs Are Structured and Emitted in
      Production*
- [ ] 7.2 Mount `pino-http` in `server/api/src/index.ts`, replacing the development-only `morgan`
      block at `:59-63`, so production finally has a request log.
- [ ] 7.3 Configure `genReqId` to reuse an inbound `X-Request-Id` when present and otherwise
      generate a UUID, and echo it on the response. — *runtime-observability: Every Request Carries
      a Correlation Identifier*
- [ ] 7.4 Configure redaction for `req.headers.authorization`, `req.headers.cookie` and any
      `password` field so credentials cannot reach the log stream. — *runtime-observability:
      "Secrets never reach the log stream"*
- [ ] 7.5 Replace the `console.error`/`console.log` calls in
      `server/api/src/middlewares/errors.ts:41,52` with structured logger calls carrying the request
      id.
- [ ] 7.6 `GET /health` — **coordinate with block `sec-hardening-api`, which owns this endpoint.**
      If it does not exist when this phase is applied, add it; if it already exists, contribute only
      the observability behavior: a real `SELECT 1` through the pool, a bounded timeout, a success
      status only when the database responded, and no leakage of connection strings, hostnames or
      raw driver error text. Do **not** create a competing route. — *runtime-observability: A Health
      Endpoint Reports Real Dependency Reachability*
- [ ] 7.7 Leave `GET /status` (`server/api/src/index.ts:65-67`) exactly as it is. It returns a
      static string and touches nothing, but `docker-compose.e2e.yml:90-101` uses it as the API
      healthcheck and `scripts/run-e2e.sh:26`'s `--wait` depends on that. `/health` is the
      replacement, not a rename.
- [ ] 7.8 Add an `api` healthcheck to `compose.yml` targeting `/health`, modelled on
      `docker-compose.e2e.yml:90-101`.
- [ ] 7.9 Wire Sentry in the API, initialized **only** when `SENTRY_DSN` is set and non-empty. With
      no DSN the SDK must not initialize and must make no outbound request. Add `SENTRY_DSN` to the
      environment template as an optional, empty, documented value. — *runtime-observability: Error
      Reporting Is Wired but Disabled by Default*
  - **Checkpoint**: block `sec-hardening-api` owns the env template (INF-11). Add the variable in a
    way that does not conflict; if that block has already restructured the template, follow its
    structure.
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

- [ ] 8.1 Create `.github/workflows/ci.yml` triggered on `pull_request` and on `push` to the default
      branch and to `v*` tags. Pin every third-party action: `actions/checkout@v4`,
      `actions/setup-node@v4`, `docker/setup-qemu-action@v3`, `docker/setup-buildx-action@v3`,
      `docker/login-action@v3`, `docker/build-push-action@v6`. — *continuous-integration: The
      Pipeline Is Reproducible and Pinned*
- [ ] 8.2 Job `lint-typecheck`: matrix over `server/api`, `client`, `adminClient`. Each leg runs
      `npm ci`, `npx eslint .`, `tsc --noEmit`. Use `actions/setup-node` with `node-version-file:
      .nvmrc` (created in task 1.5) so CI cannot drift from the runtime.
- [ ] 8.3 Job `unit`: in `server/api`, `npx jest --ci --selectProjects unit`; in `client`,
      `npx jest --ci --watchAll=false` invoked **directly, not via `npm test`** — `client/package.json:11`
      is `jest --watchAll`, which never terminates, and it belongs to block `client-critical-fixes`.
      CI must not depend on that block landing first. — *continuous-integration: "The suite
      terminates in a non-interactive runner"*
- [ ] 8.4 Job `api-integration`: a `postgres:16` service container with a health-check option; apply
      `server/database_creation.sql` then `server/create_categories.sql` via `psql`; run
      `npm run migrate` (development context, where `tsx` **is** available — unlike production, per
      task 2.3); then `RUN_DB_TESTS=1 npx jest --ci --selectProjects integration`. Supply
      `DB_APP_USER`/`DB_APP_PASSWORD`/`DB_UNSCOPED_USER`/`DB_UNSCOPED_PASSWORD`, which migration
      `0007` requires — mirror the values in `docker-compose.e2e.yml:57-60`. —
      *continuous-integration: "RLS tests execute in CI"*
- [ ] 8.5 Add a `check-sql` step to `lint-typecheck` (the `server/api` leg only): `npm run check-sql`
      (`server/api/package.json:22`). It resolves `../scripts/check-sql-arity.py` from `server/api`,
      i.e. `server/scripts/check-sql-arity.py` — **not** `scripts/check-sql-arity.py`, which does not
      exist. Ensure `python3` is available on the runner. — *continuous-integration: "A SQL arity
      mismatch is caught"*
- [ ] 8.6 Job `e2e`: `bash scripts/run-e2e.sh`. The script is self-contained (builds, runs and tears
      down `docker-compose.e2e.yml` with a `trap`), needs Docker, and already passes
      `--project=e2e` (`:30`). Do not reference Playwright projects `api`/`admin`/`fullstack`; they
      do not exist. — *continuous-integration: End-to-End Tests Run on Every Change*
- [ ] 8.7 Job `audit`: `npm audit --audit-level=high` per package with `continue-on-error: true`.
      The `expo`/`metro` advisories have no fix short of Expo 57, so this must never block. —
      *continuous-integration: Dependency Audit Runs Without Blocking*
- [ ] 8.8 Job `docker`: `if` restricted to `push` on a `v*` tag — **never** on `pull_request`, so a
      fork PR cannot push images. `needs: [lint-typecheck, unit, api-integration]`. QEMU + buildx,
      `--platform linux/amd64,linux/arm64`, `--push`, registry credentials from GitHub secrets.
      Deliberately does **not** depend on `e2e`, which gates the PR rather than the tag build. —
      *build-and-release: "Images publish only on a release tag"*
- [ ] 8.9 [VERIFY] Audit the finished workflow: resolve every npm script, file path and command it
      references against the repository and confirm each exists and exits 0 on this branch. —
      *continuous-integration: "No job references a non-existent command"*
- [ ] 8.10 [VERIFY] Open a real pull request and confirm the pipeline runs green end to end. A
      workflow validated only by inspection is not validated.

**Done condition**: a pull request is gated by lint, typecheck, SQL arity, unit, RLS integration and
E2E; a `v*` tag publishes multi-arch images; the audit job reports without blocking.

---

## Phase 9: Runbook (INF-01 documentation; partial INF-05)

- [ ] 9.1 Write `docs/runbook-deploy.md` covering the ordinary deploy sequence, how to read
      migration state (`node dist/scripts/migrate.js --status` in production, `npm run migrate:status`
      in development), and how to roll back to a previous image tag using the pinned-tag variable
      from task 6.1. — *deployable-migrations: A Deployment Runbook Exists*
- [ ] 9.2 Document the **first** production migration explicitly: `MIGRACION-COMUNIDADES.md:6-8`
      records that the community migrations (`0001`–`0008`) have never been applied to production.
      The runbook must require a database snapshot beforehand and state that `0007_db_roles_and_rls.sql`
      creates the application roles and will raise if `DB_APP_PASSWORD` or `DB_UNSCOPED_PASSWORD` is
      empty. — *deployable-migrations: "An operator can perform a first production migration from
      the runbook alone"*
- [ ] 9.3 Document restore from the `backup` service (`compose.yml:62-78`,
      `prodrigestivill/postgres-backup-local`, `./backups`, `BACKUP_KEEP_DAYS=7`). Restore
      instructions only — this is the cheap part of INF-05.
- [ ] 9.4 Record the deferred parts of INF-05 explicitly in the runbook: backups are local to the
      same host, unencrypted, with no off-site copy and no rehearsed restore drill, and `./uploads`
      is not backed up at all. State plainly that the restore procedure is **documented but
      untested**.
- [ ] 9.5 Document the deploy host's constraints as discovered: Coolify on ARM64, host port 8080
      already taken, no `reverse_proxy_network`, and the outcome of the D7 Caddy decision from task
      5.6 including the evidence used.
- [ ] 9.6 Update `AUDITORIA-PROGRESO.md`: mark block F complete, and add **INF-06** to its ID list —
      the table currently omits it although it is in this block's scope.

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
