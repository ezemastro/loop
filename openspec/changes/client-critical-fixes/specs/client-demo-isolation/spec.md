# Client Demo Isolation Specification

## Purpose

Defines the boundary between the demo module and application code, and the guarantees the demo mode
must keep while the rest of this change moves session storage, error handling and logout behaviour
underneath it. Covers audit finding CLI-06.

Demo mode is a **shipped production feature**, reached from a link on the landing screen and
documented in `DEMO.md`. This specification therefore constrains how the demo is referenced, not
whether it ships.

## Requirements

### Requirement: Application Code Does Not Reference The Demo Credential

Application code outside the demo module MUST NOT import or reference the demo account password.
The demo module MAY continue to contain it, because the shared demo dataset defines it and the
dataset is deliberately public.

This is possible because the demo login handler ignores the submitted password entirely, so passing
it from application code achieves nothing.

#### Scenario: No application module imports the demo password

- GIVEN the client source tree outside the demo module
- WHEN it is searched for the demo password identifier or its literal value
- THEN there are no matches

#### Scenario: The demo entry point still works without it

- GIVEN a visitor on the landing screen
- WHEN they follow the "explore the demo" link
- THEN demo mode activates and they are signed in as the showcase account, exactly as before

### Requirement: The Demo Adapter Never Reaches The Network

While demo mode is active, no client request may leave the device through the API client. A route
without a demo handler MUST fail visibly rather than fall through to the real API.

This requirement is unchanged by this change and is restated because several fixes here touch the
API client and the session store.

#### Scenario: An unmocked route fails loudly

- GIVEN demo mode is active
- WHEN a request is issued to a path that has no demo handler
- THEN the demo adapter answers with a not-found error and the request does not reach the network

#### Scenario: The scoped logout change does not open a network path

- GIVEN demo mode is active
- WHEN a demo response carries a 401
- THEN the new logout predicate is evaluated against the demo response and no request escapes to the
  real API as a result

### Requirement: Demo Mode Activation Ordering Is Preserved

Demo mode MUST be enabled in the same synchronous turn in which a persisted demo session becomes
available, and MUST be disabled last during logout, after the theme and the query cache have been
cleared.

Moving the session to encrypted storage MUST NOT introduce an interval in which a demo token is
loaded while demo mode is still off.

#### Scenario: Rehydration enables demo mode in the same turn

- GIVEN a device with a persisted demo session
- WHEN the session store rehydrates from the encrypted store
- THEN demo mode is enabled before any request can be issued with the rehydrated token

#### Scenario: Logout disables demo mode last

- GIVEN an active demo session
- WHEN the user logs out
- THEN the community theme is cleared, then the query cache is cleared, then demo mode is disabled

#### Scenario: Entering demo mode clears prior state

- GIVEN a device that previously held a real session's cached data and community theme
- WHEN demo mode is entered
- THEN the query cache and the theme are cleared before the demo session is established

### Requirement: Demo Read-Only Enforcement Is Unchanged

Write requests that the demo does not permit MUST continue to be rejected with the demo read-only
error, and that rejection MUST continue to surface to the user through the global error path.

#### Scenario: A blocked write still notifies the user

- GIVEN demo mode is active
- WHEN the user attempts a write that the demo does not permit
- THEN the request is rejected with the demo read-only error and the user sees the demo notice

### Requirement: Demo Bundle Inclusion Is Recorded, Not Silently Accepted

The demo module ships in every production bundle because the bundler performs no tree-shaking and
the demo is a production feature. This change MUST NOT remove it, and MUST record the residual cost
so it is not rediscovered as a new finding.

#### Scenario: Removing the demo is not attempted here

- GIVEN this change's diff
- WHEN it is reviewed
- THEN the demo module's imports remain, the production demo link still works, and the bundle-size
  reduction is recorded as a follow-up requiring a separate entry point
