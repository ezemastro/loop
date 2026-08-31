# Listing Discovery Grid Specification

## Purpose

Defines listing card presentation, grid column behavior per breakpoint, the two-column listing
detail layout, and loading/empty states for listing screens (`Home`/`Feed`, `Search`,
`MyListings`, `WishList`, `Listing` detail). Builds on the breakpoint contract and page cap
defined in `responsive-layout`.

## Requirements

### Requirement: Grid Column Count by Breakpoint

The system MUST render listing cards in a flex-wrap grid (not `FlatList` `numColumns`) with
column counts of 1 (<768px), 2 (768–1023px), 3 (1024–1279px), and 4 (≥1280px). `Feed.tsx` and
`ListingViewList.tsx` MUST use `.map()` inside a `ListingGrid` container; `Search.tsx` MUST keep
its `FlatList` with a flex-wrap `contentContainerClassName`.

(Slice 2 — Card + ListingGrid)

#### Scenario: Column count per range

- GIVEN viewports of 500, 900, 1100, and 1400px
- WHEN a listing grid renders
- THEN it shows 1, 2, 3, and 4 columns respectively

#### Scenario: Grid reflows without remount or scroll loss

- GIVEN a listing grid scrolled partway down at 1100px (3 columns)
- WHEN the viewport is resized to 1400px (4 columns)
- THEN the grid re-lays out to 4 columns without remounting the list and without resetting scroll
  position

### Requirement: Image-First Card Variant

The system MUST replace the existing 96×112 row card with an image-hero variant. On mobile
(<768px) the card MUST be full-width with a ~16:9 image. Existing badges and typography
primitives MUST be reused; this MUST read as a structural change, not a new visual language.

(Slice 2 — Card + ListingGrid)

#### Scenario: Mobile card is full-width, image-first

- GIVEN a viewport below 768px
- WHEN a listing card renders
- THEN it spans the full available width with a ~16:9 image above the existing badge/text content

### Requirement: Two-Column Listing Detail

At `lg` (≥1024px) the listing detail screen MUST render two columns: gallery left, a sticky
action panel right (title, credits, status, school, Ofertar / Deseados actions). Below `lg` it
MUST render single-column, in the existing element order.

(Slice 3 — Detail two-column + gallery)

#### Scenario: Two columns at 1280px

- GIVEN a viewport of 1280px
- WHEN the `Listing` detail screen renders
- THEN the gallery occupies the left column and the action panel occupies the right column

#### Scenario: Single column below 1024px

- GIVEN a viewport of 1023px or less (including tablet, 768–1023px)
- WHEN the `Listing` detail screen renders
- THEN gallery and action panel stack in a single column, in the pre-change order

### Requirement: Sticky Panel Reachability

The sticky right-hand action panel MUST be height-constrained to the viewport height minus the
header, and MUST scroll internally when its content exceeds that space, so the primary action
(Ofertar / Deseados) is always reachable without scrolling the page.

(Slice 3 — Detail two-column + gallery)

#### Scenario: Primary action reachable on a short laptop viewport

- GIVEN a viewport of 1024×768
- WHEN the action panel's content (title, credits, status, school, actions) exceeds the visible
  height
- THEN the panel scrolls internally within its constrained height, and the Ofertar / Deseados
  action remains reachable without scrolling the outer page

### Requirement: Tablet Layout

Between 768–1023px, the grid MUST show 2 columns, the bottom tab bar MUST remain present
(navigation only moves to the header at `lg`), and the listing detail MUST render single-column.

(Slices 2, 3, 4)

#### Scenario: Tablet grid and nav

- GIVEN a viewport of 900px
- WHEN `Home`/`Search`/`MyListings`/`WishList` render
- THEN the grid shows 2 columns and the bottom tab bar is still visible

### Requirement: Grid Loading and Empty States

The system MUST render skeleton cards matching the new card shape while a listing grid is
loading, and MUST render an explicit empty state when a grid has no results. Neither state MAY
use the existing bare `Loader` component for grid contexts.

(Slice 5 — Mobile polish + empty/skeleton states)

#### Scenario: Skeleton during load

- GIVEN a listing grid is fetching data
- WHEN it renders before data arrives
- THEN skeleton cards matching the card's shape (image block + text placeholders) are shown, not
  a bare spinner

#### Scenario: Explicit empty state

- GIVEN a listing grid query returns zero results
- WHEN the grid renders
- THEN a dedicated empty state is shown instead of a blank container
