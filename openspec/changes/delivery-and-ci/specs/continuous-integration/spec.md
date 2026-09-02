# Continuous Integration Specification

## Purpose

Defines the automated verification gates for the repository. `.github/` does not exist, so nothing
runs lint, typecheck, the SQL arity check, unit tests, the RLS suite, or the Playwright E2E suite
on any change. This capability also covers making the server test suite green and hermetic, because
a pipeline that runs a failing suite is not a gate.

Scope note: `client/package.json:11`'s `test` script is owned by block `client-critical-fixes`.
This capability specifies only that CI MUST NOT depend on it.

## Requirements

### Requirement: The Server Test Suite Is Green and Hermetic

The `server/api` Jest suite MUST pass with no failing tests and MUST NOT, outside an explicitly
database-dependent project, open a network listener, construct a database connection pool, or
require a reachable database.

`server/api/src/tests/setupAfterEnv.ts` imports `src/index.ts`, whose module body binds a real
listener (`index.ts:128-130`) and constructs two `pg` pools (`services/postgresClient.ts:53,61`).
This side-effecting setup MUST NOT run for unit or integration tests.

Tests that assert against a running server and a seeded database MUST NOT live in the Jest suite;
that responsibility belongs to `e2e/`. The following MUST be removed or migrated, each of which
fails by construction today:

- `users.test.ts:3-4` — asserts `200` on `GET /users` with no token, while `index.ts:90` and
  `routes/users.ts:9` both apply `tokenMiddleware`, which returns `401`
  (`middlewares/parseToken.ts:51-53`).
- `roles.test.ts:3` — requests `GET /roles`; no `routes/roles.ts` exists and `index.ts:74-99` never
  mounts `/roles`.
- `schools.test.ts:6` — asserts a collection length against an unseeded database.
- `auth.test.ts:4-14` — contains no assertion at all and passes on any response status.

The suite MUST report coverage; `server/api/jest.config.js` has no `collectCoverage` today.

#### Scenario: The unit project passes with no external dependencies

- GIVEN no database is reachable and no port is free
- WHEN `npx jest --ci --selectProjects unit` is run in `server/api`
- THEN every test passes and no connection or listen error occurs

#### Scenario: No handles leak after the suite finishes

- GIVEN the unit project has completed
- WHEN Jest is run with `--detectOpenHandles`
- THEN no open handle is reported and the process exits without needing to be forced

#### Scenario: The suite terminates in a non-interactive runner

- GIVEN a CI runner with no TTY
- WHEN the server test command is invoked
- THEN the process exits with a status code rather than entering watch mode

#### Scenario: The self model unit tests execute rather than skip

- GIVEN `server/api/src/models/self.test.ts`, whose mock at `:1-8` currently supplies only
  `dbConnection` while `models/self.ts:4` imports `withClient` and `inCommunity` (real exports at
  `services/postgresClient.ts:151` and `:198`)
- WHEN the unit project runs
- THEN the previously skipped blocks at `:47`, `:54`, `:68` and `:84` execute and pass, and no
  `TypeError: withClient is not a function` is raised

### Requirement: Database-Dependent Tests Run in a Dedicated Project Against a Real Database

`server/api/src/tests/rls.test.ts` MUST belong to a Jest project separate from the unit project,
selectable by name, and MUST NOT trigger the server-booting setup file. It remains guarded by
`RUN_DB_TESTS === "1"` (`rls.test.ts:30-31`), and CI MUST set that variable so the suite actually
executes rather than skipping.

#### Scenario: RLS tests execute in CI

- GIVEN a `postgres:16` service that has had `server/database_creation.sql` and
  `server/create_categories.sql` applied and all migrations run
- WHEN `RUN_DB_TESTS=1 npx jest --ci --selectProjects integration` is run
- THEN all eight assertions at `rls.test.ts:118-184` execute and pass, and none is reported as
  skipped

#### Scenario: RLS tests skip cleanly outside CI

- GIVEN `RUN_DB_TESTS` is unset and no database is reachable
- WHEN the full Jest suite is run
- THEN the RLS tests are skipped, no connection is attempted, and the run exits `0`

### Requirement: Every Change Is Linted and Typechecked

CI MUST run ESLint and `tsc --noEmit` for `server/api`, `client` and `adminClient` on every pull
request and on every push to the default branch, and MUST fail the change when either reports an
error.

Root `npm run lint` currently exits non-zero with real findings (formatting and unused variables),
not with a module-resolution failure. Those findings MUST be resolved before lint becomes a gate,
otherwise the pipeline is red on arrival.

CI MUST also run the SQL arity check, invoked as `npm run check-sql` from `server/api`
(`server/api/package.json:22`), which resolves `../scripts/check-sql-arity.py`. This check exists
because `DatabaseClient.query` accepts `unknown[]`, so a mismatch between a query's `$n`
placeholders and its argument array is invisible to TypeScript.

#### Scenario: A lint violation blocks a pull request

- GIVEN a pull request introducing an unused variable not prefixed with `_`
- WHEN CI runs
- THEN the lint job fails and the change is not mergeable

#### Scenario: A type error blocks a pull request

- GIVEN a pull request introducing a type error in any of the three packages
- WHEN CI runs
- THEN the corresponding matrix leg fails

#### Scenario: A SQL arity mismatch is caught

- GIVEN a query whose `$n` placeholder count no longer matches its call site's argument array
- WHEN CI runs the SQL arity check
- THEN the job fails and names the offending query

#### Scenario: Lint passes on the unchanged baseline

- GIVEN the branch immediately after this change is applied and before any further edits
- WHEN root lint runs
- THEN it exits `0`

### Requirement: End-to-End Tests Run on Every Change

CI MUST execute the Playwright suite via `bash scripts/run-e2e.sh`, which brings up the
self-contained stack in `docker-compose.e2e.yml` (disposable database, schema and category
bootstrap, migrations, API) and runs `npx playwright test --project=e2e`
(`scripts/run-e2e.sh:30`). CI MUST NOT reference Playwright projects named `api`, `admin` or
`fullstack`; `e2e/playwright.config.ts:20-24` defines exactly one project, named `e2e`.

#### Scenario: The E2E suite gates a pull request

- GIVEN a pull request that breaks an end-to-end flow
- WHEN CI runs the E2E job
- THEN the job fails and the stack is torn down, leaving no residual volumes

### Requirement: Dependency Audit Runs Without Blocking

CI MUST run `npm audit --audit-level=high` for each package and surface the result, but MUST NOT
fail the change on its outcome. Advisories with no non-breaking fix — notably the `expo`/`metro`
chain, which is only resolved in Expo 57 — must not make the pipeline permanently red.

#### Scenario: A high-severity advisory is reported but does not block

- GIVEN a package with an unresolved high-severity advisory
- WHEN CI runs
- THEN the audit step reports the advisory, the step is marked as non-blocking, and the overall
  run's success is decided only by the other jobs

### Requirement: The Pipeline Is Reproducible and Pinned

Every job MUST install dependencies with `npm ci` from a committed lockfile, MUST use a single
pinned Node major version matching the production runtime, and MUST reference third-party GitHub
Actions by a pinned version rather than a floating branch.

Every command referenced by the workflow MUST exist and exit `0` on the branch where the workflow
is introduced.

#### Scenario: A dependency drift breaks the build loudly

- GIVEN a `package.json` change that was not reflected in its lockfile
- WHEN CI runs `npm ci`
- THEN the install fails with an explicit lockfile-mismatch error rather than silently resolving a
  different tree

#### Scenario: No job references a non-existent command

- GIVEN the workflow file as introduced
- WHEN each referenced npm script and file path is resolved against the repository
- THEN every one of them exists
