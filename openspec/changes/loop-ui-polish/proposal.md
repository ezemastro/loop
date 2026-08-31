# Proposal: Loop UI Responsive Polish

## Intent

Loop was built mobile-first and is now used on the web, where it renders as a phone app stretched
across 1920px. Responsive design effectively does not exist: zero `sm:`/`md:`/`lg:` prefixes in
`app/` or `components/`, zero grid layout, one breakpoint check in the whole codebase. Red Itínere
needs it to read as professional. This change is layout and finish only — the palette landed in
`itinere-brand-refresh`.

## Scope

### In Scope

- Breakpoint foundation: Tailwind default `screens` + a `useBreakpoint()` hook for JS props only.
- Responsive listing grid (1/2/3/4 columns) with an image-hero card variant.
- Two-column listing detail on desktop (gallery left, sticky action panel right).
- Desktop header navigation at `lg` (≥1024px); bottom tab bar retained below `md`.
- Mobile polish: unified spacing, shadow, radius and type scales; empty/loading states.
- Screens: `Home`, `Search`, `Listing`, `MyListings`, `WishList`, `header/`, `(tabs)/_layout`.

### Out of Scope

- Color, palette, logo, dark mode. New features, API, or data-model changes.
- Fixing `npm run lint` (`ERR_UNSUPPORTED_DIR_IMPORT`, pre-existing).
- Remaining 17 screens (`Landing`, auth, `Chat`, `Messages`, profiles, editors) — follow-up.
- `ButtonText` `twMerge` bug and any hardcoded hex found: record, do not fix.

## Capabilities

### New Capabilities

- `responsive-layout`: breakpoint contract, page width caps, grid container, spacing/shadow/radius/type scales.
- `listing-discovery-grid`: listing card variants and column behavior per breakpoint.
- `desktop-navigation`: primary navigation placement by viewport.

### Modified Capabilities

- None (`openspec/specs/` is empty; `brand-theme` is unarchived and untouched here).

## Approach

**Breakpoints — resolved.** NativeWind responsive prefixes work on *both* platforms: on native,
`min-width` resolves against `vw` (`react-native-css-interop/.../native/conditions.js:158`), which
subscribes to `Dimensions.addEventListener("change")` (`unit-observables.js:15`), so prefixes are
reactive, not web-only. Therefore **classes are the default**; `useBreakpoint()` exists solely for
values that cannot be classes (carousel `height`, `Image` dimensions), reading the same constants.
Keep Tailwind defaults — `md` 768 and `lg` 1024 already match the locked decisions; no `screens`
override.

**Grid — resolved.** `Feed.tsx` and `ListingViewList.tsx` keep `.map()` inside a new flex-wrap
`ListingGrid` with per-item width classes (`w-full md:w-1/2 lg:w-1/3 xl:w-1/4`). `Search.tsx` keeps
its `FlatList` but wraps via `contentContainerClassName="flex-row flex-wrap"`. This avoids
`numColumns` entirely, so no `key`-change remount and no lost scroll position. `numColumns` +
`key={columns}` remains the documented escape hatch if virtualization is later required.

**Reuse.** Extend `bases/` and `cards/` primitives. Only two genuinely new shared units:
`ListingGrid` and `useBreakpoint`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/tailwind.config.js` | Modified | Confirm defaults; extend spacing/radius/shadow scales |
| `client/hooks/useBreakpoint.ts` | New | JS-prop breakpoint values |
| `client/components/bases/ListingGrid.tsx` | New | Flex-wrap responsive container |
| `client/components/cards/Listing.tsx` | Modified | Image-hero variant replaces 96×112 row |
| `client/components/Feed.tsx`, `bases/ListingViewList.tsx` | Modified | Wrap in `ListingGrid` |
| `client/components/screens/Search.tsx` | Modified | Wrapping `contentContainer` |
| `client/components/screens/Listing.tsx`, `ImageGallery.tsx` | Modified | Two-column detail; responsive gallery height |
| `client/components/header/Header.tsx` | Modified | Desktop nav links at `lg` |
| `client/app/(main)/(tabs)/_layout.tsx` | Modified | Hide tab bar at `lg` |
| `client/components/bases/MainView.tsx` | Modified | Reconcile `max-w-6xl` dropped in the `refreshEnabled` branch |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Exceeds 800-line review budget | High | Chained PRs (below) |
| Card redesign reads as a radical restyle | Med | Reuse existing badges/typography; structure change only |
| Flex-wrap `FlatList` weakens virtualization | Med | Lists are paginated and small; `numColumns` escape hatch documented |
| Hiding the tab bar at `lg` breaks routing/focus | Med | Keep routes identical; only presentation changes |
| Mobile regressions from shared-primitive edits | Med | U4 forbids repositioning; verify each screen at 375px |
| e2e breakage | Low | `e2e/` has zero text/role/testid selectors — verified |

## Rollback Plan

Each PR slice is an independent revert. Slice 1 (foundation) is additive and inert until consumed.
`MainView` and `ListingGrid` are the single toggle points for page cap and column behavior.

## Dependencies

- `feat/itinere-brand-refresh` merged into the parent branch (satisfied).
- Test command is `npx jest --ci --watchAll=false`; `npm run test` never terminates.

## Size Forecast and Delivery

Forecast: **~1500–2000 changed lines**, well over the 800-line budget. Chained PRs recommended,
each targeting the previous slice's branch:

1. **Foundation** — breakpoints, `useBreakpoint`, scales, `MainView` cap (~150 lines).
2. **Card + grid** — `Listing` card, `ListingGrid`, `Feed`, `ListingViewList`, `Search` (~450).
3. **Detail page** — two-column `Listing`, responsive `ImageGallery` (~350).
4. **Navigation** — header links, tab-bar visibility (~250).
5. **Mobile polish** — spacing/shadow/radius/type application, empty and loading states (~400).

## Success Criteria

- [ ] At 1920px, listings render 4 columns inside a capped page; no full-bleed stretch.
- [ ] At 1024px+, the five primary tabs sit in the header and the bottom bar is absent.
- [ ] Listing detail is two-column at `lg` with a sticky action panel.
- [ ] At 375px, no element changes position versus `main`; images are larger.
- [ ] Resizing across breakpoints re-lays out without remount or lost scroll position.
- [ ] `npx jest --ci --watchAll=false` and Playwright `e2e/` pass unchanged.
- [ ] Zero color, palette, or logo diffs in the change.
