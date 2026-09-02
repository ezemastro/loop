# Deployable Migrations Specification

## Purpose

Defines the contract that a production deployment can apply its own database migrations before the
API accepts traffic. Today it cannot: `Dockerfile.api:49-68` builds a `production` stage that
copies only `dist/` and installs `--omit=dev`, `server/migrations/*.sql` never enters the image,
and `compose.yml` has no migration step — while `server/api/src/index.ts:120-125` calls
`process.exit(1)` in production when row-level security is not active. A clean host therefore
crash-loops. `MIGRACION-COMUNIDADES.md:6-8` records that the community migrations have never been
applied to production at all.

This capability covers the migration path only. It does not change migration SQL, the runner's
logic, or any application behavior.

## Requirements

### Requirement: Migration SQL Ships Inside the Production Image

The production image MUST contain every file in `server/migrations/`. The image MUST expose the
directory at a path the runner resolves without relying on an implicit working directory, and the
`MIGRATIONS_DIR` environment variable MUST be set explicitly on the migration service rather than
depending on the `process.cwd()` fallback chain at `server/api/src/scripts/migrate.ts:41-43`.

The build MUST NOT copy `server/migrations` into the `production` stage by way of `dist/`; the SQL
files are data, not compiled output.

#### Scenario: Migration files are present in the built image

- GIVEN the `production` target of `Dockerfile.api` has been built
- WHEN the image is inspected for `/app/migrations`
- THEN every file present in `server/migrations/` (currently `0000_baseline_reconcile.sql` through
  `0008_email_verification.sql`) is present with identical contents

#### Scenario: The runner locates migrations without a cwd assumption

- GIVEN a container started from the production image with `MIGRATIONS_DIR=/app/migrations`
- WHEN the migration runner starts from any working directory
- THEN it reads the migration set from `/app/migrations` and does not fall back to a relative path

### Requirement: The Migration Runner Is Invokable Without Development Dependencies

The production image installs with `--omit=dev` (`Dockerfile.api:54`), and `tsx` — which
`server/api/package.json:19-20`'s `migrate` and `migrate:status` scripts invoke — is a
devDependency (`server/api/package.json:72`). The migration runner MUST therefore be invoked in
production as compiled JavaScript through `node`, and MUST NOT require `tsx`, `ts-node`, or a
TypeScript toolchain at runtime.

The production build MUST continue to emit the compiled runner; `server/api/tsconfig.prod.json:20-26`
MUST NOT be changed to exclude `src/scripts/migrate.ts`.

#### Scenario: The compiled runner exists at a stable path

- GIVEN the `production` target has been built
- WHEN `/app/dist/scripts/migrate.js` is checked
- THEN the file exists, having been emitted by `tsc -p tsconfig.prod.json` and relocated by the
  `dist/server/api/src` flattening at `Dockerfile.api:60-63`

#### Scenario: Migrations apply with production-only dependencies installed

- GIVEN a container from the production image, where `tsx` is absent
- WHEN `node dist/scripts/migrate.js` is executed against a reachable, empty database
- THEN every pending migration is applied and the process exits `0`

#### Scenario: Status can be inspected without applying anything

- GIVEN a database in any migration state
- WHEN `node dist/scripts/migrate.js --status` is executed
- THEN the applied and pending migrations are listed and no migration is applied

### Requirement: The API Starts Only After Migrations Complete Successfully

`compose.yml` MUST define a one-shot `migrate` service, and the `api` service MUST declare
`depends_on.migrate.condition: service_completed_successfully`. The `migrate` service MUST use the
same image as `api`, so the runner and the application are built from the same source revision. It
MUST NOT restart on completion.

The `migrate` service MUST connect with the database owner credentials (`POSTGRES_USER` /
`POSTGRES_PASSWORD`), not the application role, because migrations require DDL that the application
role deliberately lacks. It MUST also receive `DB_APP_USER`, `DB_APP_PASSWORD`, `DB_UNSCOPED_USER`
and `DB_UNSCOPED_PASSWORD`, because `server/migrations/0007_db_roles_and_rls.sql` raises when those
passwords are empty.

The `db` service MUST declare a healthcheck, and `migrate` MUST depend on it with
`condition: service_healthy`.

#### Scenario: Clean deploy against an empty database succeeds

- GIVEN a host with no existing Postgres volume
- WHEN `docker compose up` is run against `compose.yml`
- THEN `db` becomes healthy, `migrate` applies all migrations and exits `0`, and only then does
  `api` start — and `api` reaches a healthy state without any restart

#### Scenario: The RLS guard no longer crash-loops

- GIVEN `NODE_ENV=production` and a database that has just been migrated by the `migrate` service
- WHEN the API process starts and evaluates `assertDbHardening()` at `index.ts:120-125`
- THEN row-level security is active, the guard passes, and `process.exit(1)` is not reached

#### Scenario: A failing migration stops the deploy instead of starting a broken API

- GIVEN a migration that fails to apply
- WHEN `docker compose up` is run
- THEN the `migrate` service exits non-zero, the `api` service is never started, and the failure is
  visible in the `migrate` service's logs

#### Scenario: Repeated deploys are idempotent

- GIVEN a database already at the latest migration
- WHEN the stack is brought up again
- THEN `migrate` applies nothing, verifies checksums of the already-applied migrations, and exits
  `0`, and `api` starts normally

#### Scenario: Concurrent starts do not race

- GIVEN two containers running the migration runner against the same database simultaneously
- WHEN both attempt to apply the same pending migration
- THEN the runner's advisory lock serializes them and the migration is applied exactly once

### Requirement: A Deployment Runbook Exists

The repository MUST contain a written runbook covering: a first-time deployment against a database
that has never had the community migrations applied; the ordinary deploy sequence; how to inspect
migration state; how to roll back an image to a previously published tag; and how to restore the
database from a `backup` service dump.

The runbook MUST state explicitly that the community migrations have never been applied in
production and that the first rollout requires a database snapshot taken beforehand.

#### Scenario: An operator can perform a first production migration from the runbook alone

- GIVEN an operator with host access and no prior knowledge of this change
- WHEN they follow the runbook
- THEN they can take a snapshot, deploy, confirm migration status, and roll back to the previous
  image tag without reading source code
