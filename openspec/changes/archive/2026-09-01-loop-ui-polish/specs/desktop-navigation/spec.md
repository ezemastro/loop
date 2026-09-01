# Desktop Navigation Specification

## Purpose

Defines where the app's five primary tabs render depending on viewport width, and guarantees
mobile navigation is unaffected by this change. No new routes, tabs, or navigation features are
introduced.

## Requirements

### Requirement: Navigation Placement by Breakpoint

Below `lg` (<1024px, covering both mobile <768px and tablet 768–1023px) the five primary tabs
MUST remain in the bottom tab bar, unchanged from today. At `lg` and above (≥1024px) the five
tabs MUST move into the header as horizontal links, and the bottom tab bar MUST be hidden.

(Slice 4 — Desktop header nav)

#### Scenario: Bottom bar below 1024px

- GIVEN a viewport of 375px or 900px
- WHEN `(tabs)/_layout` renders
- THEN the five tabs are shown in the bottom tab bar and no tab links appear in the header

#### Scenario: Header links at 1024px and above

- GIVEN a viewport of 1024px or 1440px
- WHEN the header renders
- THEN the five tabs are shown as horizontal links in the header and the bottom tab bar is absent

### Requirement: Mobile Navigation Regression Guard

At <768px, navigation position, structure, and interaction MUST be pixel-for-pixel unchanged
from the pre-change baseline: bottom tab bar only, same tab order, same icons/labels.

#### Scenario: No structural change at 375px

- GIVEN a viewport of 375px
- WHEN the bottom tab bar renders
- THEN its position, tab order, and icon/label set are identical to `main`

### Requirement: Route and Focus Preservation

Switching the navigation's visual location (bottom bar vs. header links) MUST NOT change route
identifiers, active-tab detection, or focus behavior. This is a presentation-only change; no
routing, API, or state logic is added or altered.

#### Scenario: Active route highlights correctly in both presentations

- GIVEN the user is on the `WishList` route
- WHEN the viewport crosses 1024px in either direction
- THEN the active-tab indicator moves to the corresponding element (header link or bottom bar
  item) for the same route, with no navigation or remount
