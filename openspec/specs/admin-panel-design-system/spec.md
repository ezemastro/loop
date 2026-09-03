# Admin Panel Design System Specification

## Purpose

Defines the shared visual identity contract between `adminClient` and `client/`, and removes
emoji used as functional iconography. `client/config.ts` `DEFAULT_COLORS` is the source of truth
for palette. UI copy in `adminClient` stays Spanish; only tokens and iconography change.

## Requirements

### Requirement: Shared Brand Color Tokens

`adminClient` MUST derive its color palette from the same source values as `client/config.ts`
`DEFAULT_COLORS`, exposed as CSS custom properties, with the source documented in a header comment.

#### Scenario: Token values match the source of truth

- GIVEN `adminClient/src/index.css` defines brand CSS custom properties
- WHEN their computed values are compared to `client/config.ts` `DEFAULT_COLORS`
- THEN each corresponding color (primary, secondary, tertiary, alert, etc.) MUST match the hex
  value in `DEFAULT_COLORS`

#### Scenario: No independent hardcoded palette

- GIVEN a component in `adminClient` renders a brand color
- WHEN its styling is inspected
- THEN it MUST reference the shared CSS custom properties, not a separately hardcoded hex value

### Requirement: Intentional Typography

`adminClient` MUST apply a deliberately chosen type scale and typeface instead of the unstyled
`system-ui` browser default.

#### Scenario: Root typography is explicitly defined

- GIVEN `adminClient/src/index.css` previously imported only Tailwind's base layer with no font
  declaration
- WHEN the design tokens land
- THEN the document root MUST resolve to an explicitly declared, non-default font-family

### Requirement: No Emoji as Functional Icons

`adminClient` UI MUST NOT use emoji characters as functional iconography — status indicators,
action icons, empty-state icons, or navigation icons. Emoji-as-icon usages MUST be replaced by an
SVG or icon component from the existing `components/ui/` kit.

#### Scenario: Emoji icon is replaced

- GIVEN a component previously rendered an emoji glyph as an icon (e.g. `Aside.tsx`,
  `ui/Alert.tsx`, `ui/EmptyState.tsx`, or any of their cascading consumers)
- WHEN that component renders after this change
- THEN no emoji character appears as a standalone icon at that position; a vector icon component
  renders instead

#### Scenario: Adjacent copy is unaffected

- GIVEN an emoji icon is removed from a component
- WHEN the surrounding label or message text is compared before and after
- THEN the text content and its Spanish language MUST remain unchanged

### Requirement: Consistent UI Kit Usage

Screens touched by this change (Users, Notifications, Dashboard, and any page whose alert or
empty-state markup is modified) MUST render alerts, empty states, and buttons through the existing
`components/ui/` primitives rather than ad-hoc inline markup.

#### Scenario: Alert renders via the shared primitive

- GIVEN a touched page displays an error or informational alert
- WHEN the page renders after this change
- THEN it MUST use the shared `ui/Alert` component (or equivalent primitive), not duplicated
  inline markup

#### Scenario: Empty state renders via the shared primitive

- GIVEN a touched page has no data to display
- WHEN the page renders after this change
- THEN it MUST use the shared `ui/EmptyState` component (or equivalent primitive)
