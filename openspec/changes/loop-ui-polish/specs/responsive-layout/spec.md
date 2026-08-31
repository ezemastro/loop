# Responsive Layout Specification

## Purpose

Defines the breakpoint contract, page-width caps, shared visual scales (spacing, shadow,
radius, type), and generic responsive mechanisms (sticky regions, width-capped content) that
other capabilities (`listing-discovery-grid`, `desktop-navigation`) build on. This is layout and
finish only — no color, palette, or dark-mode work; the palette is out of scope (landed in
`itinere-brand-refresh`).

## Requirements

### Requirement: Breakpoint Contract

The system MUST use Tailwind's default `screens` (`md`=768px, `lg`=1024px, `xl`=1280px) as the
single source of breakpoint truth, applied via `md:`/`lg:`/`xl:` class prefixes as the default
mechanism on both web and native. The system MUST expose a `useBreakpoint()` hook, reading the
same constants, reserved only for JS-side props that cannot be expressed as classes (e.g.
carousel `height`, `Image` dimensions).

#### Scenario: Class prefixes react to viewport width on native

- GIVEN the app is running on a native (React Native) target
- WHEN the viewport width crosses 768px, 1024px, or 1280px
- THEN elements using `md:`/`lg:`/`xl:` classes re-layout without requiring a JS re-render

#### Scenario: Hook returns the correct breakpoint per range

- GIVEN four viewport widths: 375, 900, 1100, and 1440
- WHEN `useBreakpoint()` is read at each width
- THEN it reports `base`, `md`, `lg`, and `xl` respectively, matching the class breakpoints exactly

### Requirement: Page Width Cap

The system MUST apply a single, consistent maximum content width regardless of feature flags.
Below `xl` (1280px) the cap MUST remain 1152px (`max-w-6xl`, unchanged from today). At `xl` and
above the cap MUST widen to ~1400px.

(Slice 1 — Foundation)

#### Scenario: Cap is flag-independent

- GIVEN the `refreshEnabled` flag is either on or off
- WHEN `MainView` renders at any viewport width
- THEN the applied max-width is identical in both cases (no `max-w-6xl` drop in either branch)

#### Scenario: Cap widens at `xl`

- GIVEN a viewport of 1920px
- WHEN the listing grid renders at 4 columns inside the capped page
- THEN the page content is capped at ~1400px, not full-bleed, and cards are ~330px wide

### Requirement: Shared Visual Scales

The system MUST define one spacing scale, one shadow scale, one radius scale, and one
type-hierarchy scale, and MUST apply them consistently across mobile screens in place of ad hoc
values. This requirement MUST NOT change element position or screen structure on any screen
below 768px.

(Slice 5 — Mobile polish)

#### Scenario: Mobile screens use the unified scales

- GIVEN a viewport below 768px
- WHEN a screen renders cards, spacing, shadows, or type
- THEN all such values are drawn from the shared scales, and layout order/position is unchanged
  from the pre-change baseline

### Requirement: Chat Bubble Width Cap

The system MUST cap message bubble width with an absolute pixel maximum (not a percentage of
viewport) and MUST give the chat/messages column a readable maximum width on desktop.

(Slice 6 — Chat and Messages)

#### Scenario: Short message does not stretch at 1920px

- GIVEN a viewport of 1920px
- WHEN a three-word chat message renders
- THEN the bubble width does not exceed the fixed cap (it does not stretch toward ~1500px as
  `max-w-[80%]` does today)

### Requirement: Mobile Structural Invariant

Below 768px, this change MUST NOT alter element position, screen structure, or element order
compared to `main`, except for permitted finish changes (larger images, unified scales).

#### Scenario: No repositioning at 375px

- GIVEN any affected screen (`Home`, `Search`, `Listing`, `MyListings`, `WishList`) at 375px
- WHEN compared against its pre-change render
- THEN every element occupies the same relative position and order; only image size and the
  visual scales (spacing/shadow/radius/type) differ

### Requirement: Visual Language Preservation

The system MUST reuse existing primitives under `components/bases/` and `components/cards/`
rather than introducing a parallel set. A new shared primitive MUST NOT be added unless no
existing primitive can be reasonably extended. The system MUST NOT introduce new colors, a new
palette, or dark mode as part of this change.

#### Scenario: New primitive requires justification

- GIVEN a component needs new responsive behavior
- WHEN an existing `bases/` or `cards/` primitive can be extended to support it
- THEN no new parallel primitive is created

#### Scenario: No color changes ship

- GIVEN any file touched by this change
- WHEN its diff is reviewed
- THEN it contains zero new hex values, palette tokens, or dark-mode branches; any pre-existing
  hardcoded hex found is recorded as a follow-up, not fixed
