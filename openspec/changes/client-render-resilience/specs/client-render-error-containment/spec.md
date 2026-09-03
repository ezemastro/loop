# Client Render Error Containment Specification

## Purpose

Defines where React error boundaries exist in the client, what their fallback MUST offer, and the
explicit limits of what a boundary catches. Closes the containment gap exposed by the 2026-09-03
production incident, where one render-phase throw unmounted the entire application.

Out of scope: list-item-level boundaries (fast-follow), crash-reporting/telemetry sinks, and any
`Platform.OS`-branched global handler for non-render failures.

## Requirements

### Requirement: Root Boundary Contains An Uncaught Render Throw

`client/app/_layout.tsx` MUST export an `ErrorBoundary` component, so that any render-phase throw
not contained by a tab-level boundary is caught at the application root instead of unmounting the
app. The root fallback MUST offer a retry action and MUST offer a reload action, because navigation
itself may be broken when the root boundary is the one that triggered.

#### Scenario: An uncontained render throw does not blank the app

- GIVEN a render-phase throw occurs outside any tab-level boundary
- WHEN the throw propagates
- THEN the root `ErrorBoundary` catches it, the app does not unmount, and the user sees the root
  fallback instead of a blank page

#### Scenario: The root fallback degrades to retry plus reload, not navigation

- GIVEN the root fallback is displayed
- WHEN the user is offered an escape action
- THEN that action reloads the application rather than calling `router.replace`, because
  navigation may itself be part of what is broken

### Requirement: Each Tab Screen Contains Its Own Render Throw

Each tab under `client/app/(main)/(tabs)/` MUST be covered by an exported `ErrorBoundary`
component, so that a render-phase throw inside one tab leaves the other tabs usable and the
application does not unmount.

The 7 single-file tabs (`home`, `myListings`, `notifications`, `profile`, `publish`, `search`,
`wishlist`) each export their own. `messages` is an 8th tab implemented as a directory, so its
coverage MUST come from `messages/_layout.tsx`, which contains `index` and `[userId]` at the same
tab granularity. Without it, a throw in a chat row falls through to the root — the exact shape of
the 2026-09-03 incident.

`(tabs)/_layout.tsx` itself MUST NOT carry a tab-level boundary. It renders the navigator that a
tab fallback's escape action targets, so a boundary there would need root semantics rather than tab
semantics, and the root boundary already covers it.

#### Scenario: A throw in one tab does not affect other tabs

- GIVEN a render-phase throw occurs while a tab screen is rendering
- WHEN the throw propagates
- THEN that tab's `ErrorBoundary` catches it, the other tabs remain navigable, and the application
  does not unmount

### Requirement: The Fallback Offers Retry And An Always-Available Escape Route

Every boundary fallback MUST offer both a retry action and an escape action; neither MAY be
omitted in favor of the other. Before invoking `retry()`, the retry action MUST discard the data
that caused the failure by calling `queryClient.resetQueries()` with NO `type` filter, because
`retry()` alone only clears boundary state (`setState({ error: undefined })`) and re-renders the
same subtree over the same cached data, which throws again immediately. The escape action MUST
remain available and MUST succeed even if retry is invoked repeatedly and keeps failing.

The reset MUST NOT be narrowed with `{ type: "active" }`. That filter provably excludes the one
query that matters. `expo-router`'s `Try.render()` returns the fallback *instead of* `children`
(`client/node_modules/expo-router/build/views/Try.js:63-66`), so the failing subtree unmounts and
its observer count drops to zero; `Query.isActive()` is `this.observers.some(...)`
(`@tanstack/query-core/build/modern/query.js:86-89`), which is then `false`; and `matchQuery`
excludes a non-active query under `type: "active"`
(`@tanstack/query-core/build/modern/utils.js:39-43`). Narrowing the reset would therefore skip
exactly the poisoned query and ship the retry loop this requirement exists to prevent.

The retry handler MUST NOT await the reset. `resetQueries` mutates matched query state
synchronously and returns a promise that only tracks refetching of still-mounted observers
(`@tanstack/query-core/build/modern/queryClient.js:127-141`); awaiting it in a fallback whose
subtree just unmounted serves no purpose. Because the handler runs in an event handler, which no
error boundary catches, its rejection MUST be swallowed explicitly rather than left unhandled.

#### Scenario: Retry after a data-caused throw succeeds once the data changes

- GIVEN a tab boundary is showing its fallback after a render-phase throw caused by cached query
  data
- WHEN the user selects retry
- THEN the query cache is reset without a `type` filter before the boundary's `retry()` is called
- AND if the underlying data is now valid, the tab renders normally instead of throwing again

#### Scenario: The reset reaches a query whose subtree the boundary unmounted

- GIVEN a render-phase throw has unmounted the failing subtree, leaving its query with zero
  observers
- WHEN the user selects retry
- THEN that query is reset, because the reset applies no `type` filter
- AND the retry does not immediately re-throw on the same cached data

#### Scenario: A repeatedly failing retry does not strand the user

- GIVEN a tab boundary's fallback where retry has been invoked and the throw recurs
- WHEN the user selects the escape action instead
- THEN the user leaves the failing screen successfully, regardless of how many retries preceded it

### Requirement: Boundaries Catch Render-Phase Throws Only

An error boundary MUST be understood, and documented, as catching render-phase throws only. A
boundary MUST NOT be relied upon to catch an error thrown from an event handler, an effect
(`useEffect`/`useLayoutEffect`), or a rejected promise. This limit MUST be stated explicitly in
any documentation or fallback copy describing this capability, so a reader does not conclude the
application is crash-proof after this change.

#### Scenario: An event handler throw is not contained by a boundary

- GIVEN a component wrapped in an `ErrorBoundary`
- WHEN an `onPress` handler throws synchronously
- THEN the boundary does not catch it, because the throw did not occur during render

#### Scenario: A rejected promise is not contained by a boundary

- GIVEN a component wrapped in an `ErrorBoundary`
- WHEN an async effect's promise rejects
- THEN the boundary does not catch it, because the rejection did not occur during render

### Requirement: The Fallback Surfaces Error Detail In Development

The fallback SHOULD display `error.message` when `__DEV__` is true, so that a boundary does not
hide information a developer needs while debugging. This detail MAY be omitted in a production
build.

#### Scenario: A developer sees the underlying error message

- GIVEN `__DEV__` is true and a boundary has caught a render-phase throw
- WHEN the fallback renders
- THEN `error.message` is visible in the fallback content
