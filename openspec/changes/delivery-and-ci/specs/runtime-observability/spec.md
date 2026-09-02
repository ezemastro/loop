# Runtime Observability Specification

## Purpose

Defines what a running production deployment must reveal about itself. Today it reveals almost
nothing: logging is `console.*` (`middlewares/errors.ts:41,52`), `morgan` is mounted only when
`NODE_ENV === "development"` (`index.ts:59-63`) so production has no request log at all, there is
no request correlation identifier, no error reporting, no metrics, and `/status`
(`index.ts:65-67`) returns a static string without touching the database — so it reports "running"
for an API that cannot serve a single query.

Scope note: the existence of `GET /health` is owned by block `sec-hardening-api`. This capability
specifies the observability behavior that endpoint must have; if the endpoint already exists when
this change is applied, only the observability parts are contributed and no competing route is
created.

## Requirements

### Requirement: Logs Are Structured and Emitted in Production

The API MUST emit structured, machine-parseable log records in all environments, replacing direct
`console.*` calls in request handling and error middleware. Request logging MUST be active in
production, not only in development.

Log records MUST include at minimum a severity level, a timestamp, and — for request-scoped records
— the HTTP method, path, response status and duration.

Log output MUST NOT include credentials, authorization headers, session tokens, or password fields.

#### Scenario: Production emits a request log record

- GIVEN the API running with `NODE_ENV=production`
- WHEN any HTTP request is handled
- THEN a structured record is emitted containing the method, path, status and duration

#### Scenario: Errors are logged with structure rather than free text

- GIVEN a request that reaches the error middleware
- WHEN the error is logged
- THEN the record is structured, carries an error level, and includes the error's type and message

#### Scenario: Secrets never reach the log stream

- GIVEN a request carrying an `Authorization` header and a body containing a password field
- WHEN the request is logged
- THEN neither the header value nor the password value appears in any emitted record

### Requirement: Every Request Carries a Correlation Identifier

The API MUST assign a unique identifier to each request. When the caller supplies an inbound
correlation header the API MUST reuse that value; otherwise it MUST generate one. The identifier
MUST appear on every log record emitted while handling that request, and MUST be returned to the
caller on the response so a user-reported failure can be traced to its log records.

#### Scenario: A generated identifier ties a request's records together

- GIVEN a request arriving with no correlation header
- WHEN it is handled and produces both a request record and an error record
- THEN both records carry the same generated identifier, and that identifier is present on the
  response

#### Scenario: An inbound identifier is preserved

- GIVEN a request arriving with a correlation header set by an upstream proxy
- WHEN it is handled
- THEN the supplied value is used rather than a newly generated one

### Requirement: A Health Endpoint Reports Real Dependency Reachability

The system MUST expose a health endpoint that verifies database reachability by executing a
trivial query, rather than reporting liveness from process existence alone. It MUST return a
success status only when the database responded, and a failure status otherwise, and MUST respond
within a bounded time rather than hanging on an unreachable dependency.

The endpoint MUST NOT require authentication, and MUST NOT disclose connection strings, credentials,
hostnames, schema details, or internal error text.

`compose.yml` MUST use this endpoint as the `api` service healthcheck.

The existing `/status` endpoint MUST retain its current behavior, because
`docker-compose.e2e.yml:90-101` and the E2E harness depend on it.

#### Scenario: Health reports success when the database is reachable

- GIVEN a running API with a reachable, migrated database
- WHEN the health endpoint is requested
- THEN it responds with a success status and indicates the database is reachable

#### Scenario: Health reports failure when the database is unreachable

- GIVEN a running API whose database has been stopped
- WHEN the health endpoint is requested
- THEN it responds with a failure status within a bounded time, and the container healthcheck
  transitions to unhealthy

#### Scenario: Health does not leak internals

- GIVEN a database failure with a driver error containing a connection string
- WHEN the health endpoint responds
- THEN the response body contains no credentials, hostname, or raw driver error text

### Requirement: Error Reporting Is Wired but Disabled by Default

The API MUST support reporting unhandled errors to an external error-tracking service, configured
through an environment variable. The integration MUST be inert unless that variable is set to a
non-empty value: with no configuration the client MUST NOT initialize and MUST NOT make any
outbound network request.

The configuration variable MUST be documented in the environment template as optional and MUST ship
empty. Enabling reporting MUST be an operator configuration change, never a code change.

Reports MUST NOT include request bodies, authorization headers, or personal data by default.

#### Scenario: No reporting occurs without configuration

- GIVEN the API started with the error-reporting variable unset
- WHEN an unhandled error occurs
- THEN the error is logged locally, the reporting client is not initialized, and no outbound
  network request is made

#### Scenario: Reporting activates on configuration alone

- GIVEN the API started with the error-reporting variable set to a valid value
- WHEN an unhandled error occurs
- THEN the error is reported to the external service, with no change to application code

#### Scenario: A misconfigured reporter does not break request handling

- GIVEN the error-reporting variable set to an unreachable or invalid endpoint
- WHEN requests are handled
- THEN the API continues to serve requests normally and the reporting failure is logged rather than
  propagated to the caller

### Requirement: Production Containers Are Constrained and Observable at the Platform Level

`compose.yml` MUST declare, for each long-running service: a healthcheck, ordering constraints
expressed as `depends_on` conditions rather than bare service names, resource limits, and log
rotation. None of these exist in production today, although healthchecks and `depends_on`
conditions are already used in the development and E2E stacks
(`docker-compose.e2e.yml:38-42,90-104`).

#### Scenario: An unhealthy service is visible to the platform

- GIVEN a service whose dependency has failed
- WHEN the container runtime is queried for service state
- THEN the service reports unhealthy rather than merely running

#### Scenario: Logs cannot exhaust host storage

- GIVEN a service producing continuous log output over a long period
- WHEN host disk usage is inspected
- THEN the log files for that service are bounded by the configured rotation policy

#### Scenario: A runaway service cannot starve its neighbours

- GIVEN a service under memory pressure
- WHEN it exceeds its configured limit
- THEN it is constrained by the platform rather than consuming all host memory
