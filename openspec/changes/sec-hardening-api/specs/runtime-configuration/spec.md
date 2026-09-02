# Runtime Configuration Specification

## Purpose

Defines the boot-time environment contract for the API: which variables exist, which are required in
which environment, how the process behaves when one is missing, how numeric and port variables are
typed, and how the environment template is kept in step with the schema. This is the prerequisite
capability — `authentication-hardening` and `api-surface-hardening` both depend on the guarantees
established here.

Covers audit ids **SEC-01**, **SEC-14** (by consequence) and **INF-11**.

## Requirements

### Requirement: Environment Schema

The system MUST validate `process.env` against a single declarative schema at startup. The schema
MUST be the only place where a default value for an environment variable is declared, and application
modules MUST read configuration from the parsed result rather than from `process.env` directly.

The schema MUST classify every variable into exactly one of three tiers:

1. **Required in production** — MUST have no default when `NODE_ENV` is `production`.
2. **Typed with a safe default** — MUST be present with a documented default in every environment.
3. **Optional** — MAY be absent in every environment.

The following variables MUST be tier 1: `JWT_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_PASS_TOKEN`,
`DB_APP_PASSWORD`, `DB_UNSCOPED_PASSWORD`, `FRONTEND_URL`, `ADMIN_FRONTEND_URL`,
`WEB_GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_CLIENT_ID`.

The literal default `"jwt_secret_dev"` MUST be removed, and the
`DB_APP_PASSWORD → POSTGRES_PASSWORD → "loop_app_dev"` fallback chain MUST NOT apply in production.

#### Scenario: A production deployment missing a secret does not start

- GIVEN `NODE_ENV=production` and `JWT_SECRET` is unset
- WHEN the API process starts
- THEN validation fails, the process exits with a non-zero code, and no TCP port is bound

#### Scenario: Every missing variable is reported at once

- GIVEN `NODE_ENV=production` and four tier-1 variables are unset
- WHEN the API process starts
- THEN the error output names all four variables in a single report, so the operator does not
  discover them one restart at a time

#### Scenario: Dev sentinel values are rejected in production

- GIVEN `NODE_ENV=production` and `JWT_SECRET` is set to the schema's own development sentinel value
- WHEN the API process starts
- THEN validation fails exactly as if the variable were unset

#### Scenario: The signing secret has no default anywhere in source

- GIVEN the implemented change
- WHEN `server/api/src` is searched for the string `jwt_secret_dev`
- THEN there are zero matches

### Requirement: Production Startup Contract

Environment validation MUST complete before the HTTP server accepts connections. The database
hardening assertion MUST be awaited in production rather than left as an unhandled background
promise.

#### Scenario: Validation completes before the port is bound

- GIVEN `NODE_ENV=production` and a missing tier-1 variable
- WHEN the process starts
- THEN it exits before `app.listen` is called, and no request is ever served by a misconfigured
  process

#### Scenario: Database hardening failure aborts production startup

- GIVEN `NODE_ENV=production` and the connecting role has `BYPASSRLS` or a tenant table lacks RLS
- WHEN the process starts
- THEN startup aborts, rather than the server accepting traffic while the check resolves in the
  background

#### Scenario: The production image declares its own environment

- GIVEN the API production container image
- WHEN it is run without an external `NODE_ENV` value
- THEN `NODE_ENV` is `production`, so the production guards apply even outside the project's compose
  file

### Requirement: Development Permissiveness

Outside production the system MUST start successfully with no environment variables set. Every tier-1
variable that falls back to a development default MUST emit exactly one warning naming the variable.

#### Scenario: The development stack starts unchanged

- GIVEN `NODE_ENV=development` and none of the tier-1 variables set
- WHEN the API starts
- THEN it starts successfully, serves requests, and logs one warning per defaulted variable

#### Scenario: The end-to-end stack is unaffected

- GIVEN the e2e compose stack, which runs the API with `NODE_ENV=development`
- WHEN the suite runs
- THEN the API starts and all 40 tests pass without any new variable being required

### Requirement: Numeric Environment Variables

Variables representing numbers MUST be coerced to numbers by the schema and MUST be range-checked.
Consuming code MUST NOT rely on a type assertion to convert a string.

This applies to `PORT`, `POSTGRES_PORT`, `TOKEN_EXP` and `ADMIN_TOKEN_EXP`.

#### Scenario: A numeric token lifetime is honored as seconds

- GIVEN `TOKEN_EXP` is supplied by the environment as the string `"2592000"`
- WHEN a user token is signed
- THEN the token expires in 30 days, not in 43 minutes

Rationale: an unconverted numeric string reaches `jsonwebtoken` as a string, which parses it as
milliseconds. The defaulted case is a number and expires correctly, so the defect only appears once
the variable is actually configured.

#### Scenario: An out-of-range port is rejected

- GIVEN `PORT` is set to `"70000"` or to `"not-a-number"`
- WHEN the process starts
- THEN validation fails with a message naming `PORT`, rather than silently binding a fallback

#### Scenario: The database port is configurable

- GIVEN `POSTGRES_PORT` is set to a non-default value
- WHEN the API opens a connection pool, and when the migration runner connects
- THEN both use the configured port, rather than a hardcoded `5432`

### Requirement: Port Configuration

The system MUST distinguish the in-container listen port from the host-side published port, and MUST
document which variable governs which.

#### Scenario: The published port and the listen port are documented as distinct

- GIVEN a reader of the environment template
- WHEN they look up how to change the port the API is reachable on
- THEN the template states that the host-side publish variable and the in-container listen variable
  are different, so setting only one does not silently break the mapping

### Requirement: Environment Template Parity

The repository MUST contain exactly one environment template, and its contents MUST correspond
one-to-one with the schema. The template MUST document `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, the
`DB_APP_*` and `DB_UNSCOPED_*` variables, and every tier-1 variable.

#### Scenario: Template and schema cannot drift

- GIVEN the environment template and the schema
- WHEN parity is checked
- THEN every variable declared by the schema appears in the template, and every variable in the
  template is declared by the schema

#### Scenario: A single template

- GIVEN a developer setting the project up
- WHEN they look for the file to copy
- THEN there is one template covering the API, the database roles, the clients and the mail provider,
  not two partially-overlapping templates with different variable sets

### Requirement: Secret Files Are Not Tracked

Environment files containing deployment-specific or credential material MUST NOT be tracked in
version control.

#### Scenario: The client environment file is untracked

- GIVEN the repository after this change
- WHEN the tracked file list is queried for `client/.env`
- THEN it is absent, and the ignore rule that already exists covers it going forward

Note: untracking does not remove the value from history. Rotating any credential previously committed
is an operational decision recorded for the owner, outside this change.
