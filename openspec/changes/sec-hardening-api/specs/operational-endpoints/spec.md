# Operational Endpoints Specification

## Purpose

Defines the unauthenticated endpoints an operator or orchestrator may call to determine whether the
service is alive and healthy, what those endpoints are permitted to disclose, and the HTTP status
contract for a request that fails because a prerequisite step has not been completed.

Covers audit id **SEC-15**.

## Requirements

### Requirement: Status Endpoint

The system MUST expose a liveness endpoint that answers without touching the database, so that
container orchestration can distinguish "the process is up" from "the dependencies are healthy".

This endpoint MUST NOT disclose the deployment environment, the software version, the hostname, or
any other deployment detail.

#### Scenario: The environment name is not disclosed

- GIVEN an unauthenticated caller
- WHEN they request the status endpoint
- THEN the response body does not contain the deployment environment name

#### Scenario: Liveness does not depend on the database

- GIVEN the database is unreachable
- WHEN the status endpoint is requested
- THEN it still answers successfully, because it reports process liveness only

#### Scenario: The existing healthcheck keeps working

- GIVEN the end-to-end stack, whose container healthcheck polls the status endpoint
- WHEN the stack starts
- THEN the healthcheck passes and the stack becomes ready

### Requirement: Health Endpoint

The system MUST expose a health endpoint that verifies database connectivity and confirms that
row-level security is active on the tenant tables.

The endpoint MUST report an unhealthy status when the database is unreachable, and MUST report a
degraded status when the database is reachable but row-level security is not active.

The response MUST be coarse. It MUST NOT disclose the software version, hostname, driver error text,
connection string, or deployment environment.

The health check MUST run without a community scope, because a health probe belongs to no tenant.

#### Scenario: A healthy service reports healthy

- GIVEN the database is reachable and row-level security is active on the tenant tables
- WHEN the health endpoint is requested
- THEN it returns a success status indicating the database is up and row-level security is on

#### Scenario: An unreachable database reports unhealthy

- GIVEN the database is unreachable
- WHEN the health endpoint is requested
- THEN it returns an unhealthy status, distinguishable from a healthy one by status code

#### Scenario: Disabled row-level security reports degraded

- GIVEN the database is reachable but a tenant table does not have row-level security enabled
- WHEN the health endpoint is requested
- THEN it returns a non-success status, because the multi-tenant isolation guarantee is not being
  enforced even though the service can serve queries

#### Scenario: Failure detail is not disclosed

- GIVEN the database is unreachable due to an authentication failure
- WHEN the health endpoint is requested
- THEN the response does not contain the driver error text, the connection string, or credentials

#### Scenario: The health probe shares its definition with the startup assertion

- GIVEN the row-level-security check performed at startup and the one performed by the health endpoint
- WHEN both are reviewed
- THEN they derive from the same definition, so the two cannot drift apart

#### Scenario: The health endpoint is not rate-limited

- GIVEN an uptime monitor polling the health endpoint on a short interval
- WHEN it polls
- THEN it is never throttled

### Requirement: Step-Required Status

A response indicating that the caller must complete a prerequisite step before the operation can
proceed MUST use a client-error status code, not a success status code.

The response body MUST retain its existing shape, including its machine-readable error code and any
accompanying contextual data, so that existing clients keying on the error code continue to work.

#### Scenario: An incomplete signup is not reported as success

- GIVEN a Google sign-in for a new account that has not yet selected its schools
- WHEN the request is processed
- THEN the response uses a client-error status code, not a success status code

#### Scenario: The client still routes to the completion screen

- GIVEN the Expo client performing a Google sign-in that requires school selection
- WHEN it receives the response
- THEN it recognizes the error code and navigates to the school-selection screen, exactly as before

#### Scenario: The contextual payload survives

- GIVEN a step-required response carrying the server-resolved community
- WHEN the client extracts the contextual data from the error
- THEN the community is present

Rationale: with a success status the client's own handling converts the body into a plain error object
that discards the contextual data, so this data is silently lost today. A client-error status routes
the response through the client's transport-error path, which preserves it.

#### Scenario: The status is distinguishable from a malformed request

- GIVEN a step-required response and an ordinary input-validation failure
- WHEN a client maps each status to an error class
- THEN the two map to different classes, so a caller can tell "you must finish a step" apart from
  "your input was invalid"

#### Scenario: Monitoring sees a non-success response

- GIVEN log-based or proxy-based alerting that counts non-success responses
- WHEN a step-required response is returned
- THEN it is counted as a client error rather than being invisible among successful responses
