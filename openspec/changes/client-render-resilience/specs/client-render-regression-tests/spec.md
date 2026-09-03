# Client Render Regression Tests Specification

## Purpose

Establishes that client components are render-tested, and defines the `act()` convention required
under React 19 to make a render test produce a committed tree. Closes the detection gap exposed by
the 2026-09-03 incident: no test in the repo rendered a component, so CI could not have caught it.

Out of scope: `@testing-library/react-native`, `nativewind/test`, resolved-style/computed-style
assertions, and the `react-test-renderer@19.0.0`/`react@19.1.0` peer-version skew (tracked
separately as CLI-10).

## Requirements

### Requirement: Render Tests Wrap `renderer.create` In `act()`

A render test MUST wrap its call to `renderer.create` in `act()`. React 19 defers the initial
commit, so a `renderer.create` call made outside `act()` yields a renderer whose tree has not
committed, and `toJSON()` returns `null`.

#### Scenario: An unwrapped render produces no tree

- GIVEN a render test calls `renderer.create` without `act()`
- WHEN `toJSON()` is called on the result
- THEN it returns `null`

#### Scenario: An `act()`-wrapped render produces a committed tree

- GIVEN a render test calls `renderer.create` inside `act()`
- WHEN `toJSON()` is called on the result
- THEN it returns the rendered tree, not `null`

### Requirement: The 2026-09-03 Notification Regression Is Asserted In CI

A test MUST render `cards/Notification.tsx` with a `null` listing and MUST assert that it renders
a fallback and does not throw. This is the exact defect that caused the 2026-09-03 production
incident.

#### Scenario: A notification card with a null listing does not throw

- GIVEN `cards/Notification.tsx` is rendered with a notification whose listing is `null`
- WHEN the component renders
- THEN no exception is thrown and a fallback is rendered

### Requirement: The Listing Card Handles Missing Media

A test MUST render `cards/Listing.tsx` with `media` absent and MUST assert that it renders and
does not throw.

#### Scenario: A listing card with no media does not throw

- GIVEN `cards/Listing.tsx` is rendered with `media` absent
- WHEN the component renders
- THEN no exception is thrown

### Requirement: A Boundary Containment Test Exists

A test MUST show that a component which throws during render is contained by an `ErrorBoundary`,
so the containment behavior defined in `client-render-error-containment` has an automated check.

#### Scenario: A throwing child is contained instead of propagating

- GIVEN a component that throws during render is mounted inside an `ErrorBoundary`
- WHEN the tree is rendered
- THEN the throw does not propagate out of the boundary and the fallback renders instead

### Requirement: Render Tests Run On The Existing Preset With No New Dependency

Render tests MUST pass on the existing `jest-expo` preset. Adding this capability MUST NOT
introduce a new dependency and MUST NOT require a Jest configuration change.

#### Scenario: The test suite runs unmodified

- GIVEN the render tests added by this change
- WHEN `cd client && npx jest --ci --watchAll=false` is run
- THEN they pass without any new package installed and without any change to Jest configuration

### Requirement: The Existing Test Baseline Remains Intact

The pre-existing baseline of 857 tests across 15 suites MUST remain passing after the new render
tests are added.

#### Scenario: The full suite still passes at the prior count or higher

- GIVEN the client test suite before this change reports 857 tests across 15 suites
- WHEN the full suite is run after this change
- THEN all 857 pre-existing tests still pass, and the suite count is at least 15 plus the new
  render-test suites

### Requirement: Computed Style Assertions Are Not Required

A render test MAY NOT assert on computed or resolved styles produced by NativeWind's CSS runtime.
`className` arrives as an inert prop under Jest because that runtime is injected by Metro, which
Jest does not run. Specs and tests under this capability MUST NOT require asserting computed
styles; structure and text-content assertions are sufficient.

#### Scenario: A render test asserts structure, not computed style

- GIVEN a component rendered under Jest carries a `className` prop
- WHEN the render test makes its assertions
- THEN it checks rendered structure and text content, and it does not assert a computed style
  value
