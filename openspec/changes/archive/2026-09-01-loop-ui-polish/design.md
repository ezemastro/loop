# Design: Loop UI Responsive Polish

## Technical Approach

Layout-only change. Tailwind responsive prefixes are the default mechanism on both platforms;
`useBreakpoint()` exists only for values that cannot be classes. Three token tables land in the
existing `client/config.ts` (no new config home), one new layout primitive (`ListingGrid`) and one
new visual primitive (`Skeleton`) are added, and every other change extends `bases/`, `cards/` or a
screen in place. Delivered as six stacked PRs onto `main`.

## Verified Platform Facts

These were read in `client/node_modules`, not assumed. They drive four decisions below.

| Fact | Evidence |
|---|---|
| `min-width` **and** `max-width` media conditions evaluate against `vw`/`vh` observables on native, so both are reactive | `react-native-css-interop/dist/runtime/native/conditions.js:158,160` + `unit-observables.js:15` |
| A `not` media qualifier (what Tailwind emits for `max-*`) is honored | `conditions.js:39` — `qualifier === "not" ? !pass : pass` |
| `display` accepts **only** `none` on native; `display:flex` emits a value warning and returns `undefined` | `css-to-rn/parseDeclaration.js:1709-1717` |
| `box-shadow` maps to **only** `shadowColor` + `shadowRadius` (from `spread`, which is `0` in every Tailwind default shadow). No `shadowOffset`, no `shadowOpacity`, no `elevation` | `parseDeclaration.js:1700-1708` |
| `aspect-ratio` is fully supported on native | `parseDeclaration.js:29,922,1759` |
| `position: "sticky"` passes through RNW's StyleSheet unvalidated (RNW uses it itself) | `react-native-web/dist/cjs/exports/ScrollView/index.js:640-641`; no `position` allow-list in `StyleSheet/` |
| No `@testing-library/react-native` — only `react-test-renderer`. The single existing test is pure Node + `fs` | `client/package.json:64-83`, `client/__tests__/brand-palette.test.ts` |

Consequence of fact 3: **`hidden lg:flex` is broken on native** — the base `display:none` wins because
`lg:flex` is dropped. The cross-platform idiom is therefore *always* one-directional:
`lg:hidden` (mobile-only) and **`max-lg:hidden`** (desktop-only). This is a hard rule for slices 3–6.

## Architecture Decisions

### D1 — Scales: documented class subsets, one runtime table for shadow only (slice 1)

| Scale | Choice | Rationale |
|---|---|---|
| Spacing | **No `tailwind.config.js` change.** Allowed subset only: `1`(4) icon gaps, `2`(8) intra-element, `3`(12) card internals, `4`(16) screen/section padding, `6`(24) desktop gutters | The 4px default scale is already correct and already in use; extending it adds tokens with no consumer |
| Radius | **No config change.** `rounded-lg`(8) media, `rounded-xl`(12) cards/surfaces, `rounded-full` badges/pills, `rounded-2xl`(16) sheets | All four exist as defaults; today's `rounded`(4) on gallery images is the only migration |
| Shadow | **`ELEVATION` table in `config.ts`**, projected per platform via `Platform.select` | See below — a `boxShadow` theme extension physically cannot reach Android |

Shadow is the only scale needing runtime code. Because `box-shadow` drops opacity, offset and
`elevation` on native (fact 4), today's `shadow` classes on `cards/Listing.tsx:20`,
`cards/ChatCard.tsx:21` and `header/Header.tsx:17` render **nothing on native**. Extending
`theme.boxShadow` would inherit the same defect. One table, two projections:

```ts
// client/config.ts
export const ELEVATION = {
  raised: {
    // cards, list surfaces
    class: "shadow",
    native: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  },
  overlay: {
    // header, sheets, toasts
    class: "shadow-md",
    native: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 },
  },
} as const;
// usage: className={twMerge(Platform.OS === "web" ? ELEVATION.raised.class : "", ...)}
//        style={Platform.OS === "web" ? undefined : ELEVATION.raised.native}
```

`class` values are chosen to reproduce today's web appearance exactly (`shadow` stays `shadow`), so
this is a native-only visual gain, not a restyle. `#000` follows the existing `Toast.tsx:113`
precedent; tinting from `useThemeColors().MAIN_TEXT` (as `Landing.tsx:230`) was rejected because it
turns a static token table into a hook.

**Rejected**: `theme.extend.boxShadow` (never reaches Android); a `<Surface>` wrapper component
(one more layer in every card for a two-line style application).

### D2 — `ListingGrid`: negative-margin gutters, class constants shared with the `FlatList` (slice 2)

```tsx
// client/components/bases/ListingGrid.tsx
export const GRID_ROW_CLASS = "flex-row flex-wrap -mx-1.5";
export const GRID_CELL_CLASS = "w-full md:w-1/2 lg:w-1/3 xl:w-1/4 px-1.5 pb-3";
export const columnsAt = (bp: Breakpoint) => ({ base: 1, md: 2, lg: 3, xl: 4 })[bp];

export default function ListingGrid({ children, className }:
  { children: React.ReactNode; className?: string }) {
  return (
    <View className={twMerge(GRID_ROW_CLASS, className)}>
      {React.Children.map(children, (child) => <View className={GRID_CELL_CLASS}>{child}</View>)}
    </View>
  );
}
```

Gutters: the row carries `-mx-1.5` (−6px) and every cell `px-1.5`, so each cell is *exactly* `w-1/N`
of the padded row and the visible gutter is 12px. **`gap-*` + `w-1/2` was rejected**: 50% + gap
overflows the row and collapses flex-wrap to one item per line — this is the failure mode the task
flagged. Callers must already have ≥6px horizontal padding (all do: `px-4`).

Sharing without duplication: `Search.tsx` keeps its `FlatList` and imports the same two constants —
`className="px-4"` on the list, `contentContainerClassName={GRID_ROW_CLASS}`, and
`renderItem={({item}) => <View className={GRID_CELL_CLASS}><Listing listing={item}/></View>}`. The
column ramp exists in exactly one string.

`React.Children.map` wraps *every* child in a cell, so `Loader`/`Error`/"Cargar más" must move
outside `<ListingGrid>` in `Feed.tsx` and `ListingViewList.tsx`. Skeletons go inside (D7). No
`columns` prop: the 1/2/3/4 ramp is a single global contract; an `itemClassName` override is the
documented escape hatch if a caller ever diverges.

### D3 — One card, no variants (slice 2)

`cards/Listing.tsx` becomes image-first. The card never knows its column count — it fills its cell
(`w-full` comes from `GRID_CELL_CLASS`), so the 375px full-width variant and the ~270px 4-column
variant are the *same* markup at different widths. Zero variant props.

```tsx
<Pressable className="overflow-hidden rounded-xl border border-stroke bg-white" style={raised}>
  <Image className="aspect-[4/3] w-full bg-background" resizeMode="cover" source={...} />
  <View className="gap-2 p-3">
    <View className="flex-row items-start justify-between gap-2">
      <Text numberOfLines={2} className="flex-1 text-lg font-medium text-main-text">{title}</Text>
      <CreditsBadge credits={listing.price} />
    </View>
    <CategoryBadge category={listing.category} className="text-sm" numberOfLines={1} />
    <View className="flex-row items-center gap-2">
      <ProductStatusBadge status={listing.productStatus} />
      <View className="flex-1 flex-row gap-0.5 overflow-hidden">{schoolThumbs}</View>
    </View>
    <UserBadge user={listing.seller} />
    {customButton}
  </View>
</Pressable>
```

All four badges are reused unchanged except `CategoryBadge`, which gains a `numberOfLines?: number`
passthrough (2 lines). The content block keeps today's element order — only the 96×112 side
thumbnail becomes a hero. Truncation uses RN `numberOfLines`, not `line-clamp-*` (web-only CSS).
`resizeMode` moves `contain` → `cover` so the 4:3 box fills; `bg-background` covers letterboxing on
odd aspect ratios. **Rejected**: badges absolutely positioned over the image (reads as a restyle);
separate `ListingCardCompact`/`ListingCardHero` components (two things to keep in sync).

### D4 — Detail two-column: sibling scrollers, not CSS sticky (slice 3)

`components/screens/Listing.tsx` drops the `FlatList`-of-7-static-sections (virtualization buys
nothing there) for a `ScrollView`, and the action panel becomes a *sibling* of that scroller:

```
MainView  "flex-1 lg:flex-row lg:gap-6"
├── ScrollView "flex-1"          → back/actions, ImageGallery, details, stats
│     └── View "lg:hidden"       → price, seller, status  (mobile inline copies)
├── View "max-lg:hidden lg:w-[380px] lg:shrink-0"     → desktop aside
│     ├── ScrollView "flex-1"    → price, seller, status  (D6 internal scrolling)
│     └── View                   → ListingButtons
└── View "p-4 flex-row gap-4 lg:hidden"               → mobile bottom bar (ListingButtons)
```

Because the aside is a flex sibling inside a bounded-height row, it is sticky *by construction* on
both platforms and gets D6's internal scrolling for free. Everything is class-driven, so crossing
1024px re-lays out with **no remount and no lost scroll position** (the proposal's success
criterion). Note `max-lg:hidden` on the aside — `hidden lg:flex` would hide it forever on native.

Cost: price/seller/status render twice (three presentational components) and `ListingButtons`
renders twice. `ListingButtons` was read end-to-end — it has no mount effects, only handlers and
`useMutation` registrations — so double-mounting is inert.

**Rejected**: `position: "sticky"` via `Platform.OS === "web"`. It does work (RNW passes it through,
fact 6) but needs a TS cast (`ViewStyle["position"]` has no `sticky`) and does nothing on native
tablets at `lg`. **Rejected**: a `useBreakpoint()` JS branch between a mobile tree and a desktop
tree — simpler to read, but remounts the screen on every 1024px crossing.

### D5 — Desktop nav: hide the bar, share one tab table (slice 4)

`app/(main)/(tabs)/_layout.tsx` keeps `Tabs` as the router untouched. The bar is hidden, never
unmounted, by extending the `tabBarStyle.display` expression that already exists for the keyboard:

```tsx
tabBarStyle: { height: 60 + insets.bottom, paddingTop: 5,
               display: visible && !isDesktop ? "flex" : "none" }
```

`tabBarStyle` is a JS style prop, so this is a legitimate `useBreakpoint()` consumer.
`screenOptions` / `Tabs.Screen` / `href: null` entries are untouched, so routing, deep links and
focus are unchanged.

A `PRIMARY_TABS` constant (`name`, `title`, `icon`, `iconProps`) moves to
`components/navigation/primaryTabs.tsx` and is consumed by **both** `_layout.tsx` (mapped to
`<Tabs.Screen>`) and `Header.tsx` — the tab list exists once, so the header cannot drift. The
header nav row is `max-lg:hidden`; the active highlight uses `usePathname()`, already imported at
`Header.tsx:8` and already compared bare (`pathname === "/search"` at `:14`), confirming group
segments are stripped. Nav items use expo-router `<Link href asChild>` rather than the file's
existing `Pressable` + `router.push`, so desktop nav renders real anchors (middle-click, focus
ring); this is scoped to the new nav row, not a repo-wide refactor.

### D6 — `ImageGallery`: kill the module-scope read (slice 3)

`ImageGallery.tsx:8`'s `Dimensions.get("window").width` at module scope is evaluated once per
process and never updates. It is only the seed for `containerWidth`, which `onLayout` already
corrects — so delete the constant and the `Dimensions` import, initialize `containerWidth` to `0`,
and render the `Carousel` only once `containerWidth > 0`. `onLayout` becomes the sole width source
and is inherently reactive.

Height (fixed `240` at `:36` and `:47`) comes from `useBreakpoint()` — a carousel `height` prop and
an `Image` style number cannot be classes: `GALLERY_HEIGHT = { base: 260, md: 360, lg: 420, xl: 420 }`
in `config.ts`. Both call sites read the same value. `selectors/ImagesSelector.tsx:15` has the
identical module-scope bug — **recorded as a follow-up, not fixed** (out of the proposal's screens).

### D7 — Skeletons (slice 5)

`bases/Skeleton.tsx` — a `View` with `bg-stroke rounded-lg` plus a pulse driven by
`react-native-reanimated` (`useSharedValue` + `withRepeat(withTiming(opacity 0.5↔1, 900ms), -1, true)`).
Already a direct dependency and already used by `ImageGallery`, so **no new dependency**.

`cards/ListingSkeleton.tsx` sits beside the card so the two drift together: same outer
`rounded-xl border border-stroke bg-white`, an `aspect-[4/3]` block, then three lines
(`h-5 w-3/4`, `h-4 w-1/2`, `h-4 w-2/3`). Rendered as `SKELETON_COUNT = 4` children *inside*
`ListingGrid`, so skeletons inherit the real column ramp. Replaces `<Loader/>` on initial load only;
`<Loader/>` stays for pagination. Empty states keep the existing `Error` component and its Spanish
copy, gaining only `min-h-40 items-center justify-center` — no new empty-state component.

### D8 — Chat/Messages (slice 6)

| Target | Change |
|---|---|
| `MessageItem.tsx:15` | `max-w-[80%]` → `max-w-[80%] md:max-w-[60%] lg:max-w-[520px]` — a readable measure, not 80% of a 1400px page |
| `MessageItem.tsx:14-17,20-27` | string-concatenated `className` → `twMerge` (same bug class as `ButtonText`) |
| `screens/Chat.tsx` | thread wrapper gains `w-full lg:mx-auto lg:max-w-3xl` (768px) |
| `screens/Messages.tsx` | conversation list gains `w-full lg:mx-auto lg:max-w-2xl` (672px) |
| `cards/ChatCard.tsx:21` | `shadow` → `ELEVATION.raised` |

A master–detail (list left / thread right) desktop messaging layout is an explicit **non-goal** —
it is a navigation restructure, not polish, and would blow the slice budget.

### D9 — Page cap reconciliation (slice 1)

`bases/MainView.tsx` drops `max-w-6xl mx-auto` in the `refreshEnabled` branch (`:20-28`) but keeps
it at `:32`. One constant, applied at the level that is correct per branch:

```ts
const PAGE_CLASS = "w-full max-w-6xl xl:max-w-[1400px] mx-auto";
```

Non-refresh branch → outer `View` (as today). Refresh branch → `contentContainerClassName` on the
`ScrollView`, so the scroller stays full-width and the web scrollbar stays at the viewport edge
while content is capped. `max-w-6xl` = 1152px below `xl`, `max-w-[1400px]` at `xl` (D9). Arbitrary
value rather than a `theme.maxWidth` token because it has exactly one consumer.

### D10 — `ButtonText` twMerge (slice 1)

`bases/ButtonText.tsx:5` interpolates `props.className` into a template string, so `twMerge` never
runs and any caller override loses to the base classes (`ListingButtons.tsx` passes overrides
today). Fix: `className={twMerge("text-white text-xl font-medium text-center", props.className)}`.
In scope for slice 1 per the task, superseding the proposal's "record, do not fix".

## Data Flow

```
config.ts (BREAKPOINTS, ELEVATION, GALLERY_HEIGHT)
   │                    │
   ├─ tailwind.config.js (defaults: md 768 / lg 1024 / xl 1280 — asserted equal, never overridden)
   │        └──→ class prefixes  md:/lg:/xl:/max-lg:  ──→ every component
   └─ useBreakpoint() ──→ JS-prop consumers only:
                            tabBarStyle.display  (_layout.tsx)
                            Carousel height / Image height  (ImageGallery.tsx)

ListingGrid  ──exports──→ GRID_ROW_CLASS + GRID_CELL_CLASS
   ├─ Feed.tsx / ListingViewList.tsx     use the component (.map children)
   └─ Search.tsx                          uses the constants (FlatList contentContainer)
```

## File Changes

| File | Action | Slice |
|---|---|---|
| `client/config.ts` | Modify — add `BREAKPOINTS`, `ELEVATION`, `GALLERY_HEIGHT`, `SKELETON_COUNT` | 1 |
| `client/hooks/useBreakpoint.ts` | Create — `useWindowDimensions()` + pure `resolveBreakpoint(width)` | 1 |
| `client/components/bases/MainView.tsx` | Modify — `PAGE_CLASS` in both branches (D9) | 1 |
| `client/components/bases/ButtonText.tsx` | Modify — `twMerge` (D10) | 1 |
| `client/__tests__/helpers/sourceFiles.ts` | Create — `walkTsFiles` extracted from the palette guard | 1 |
| `client/__tests__/responsive-tokens.test.ts` | Create — parity + column math + shadow guard | 1 |
| `client/components/bases/ListingGrid.tsx` | Create (D2) | 2 |
| `client/components/cards/Listing.tsx` | Modify — image-first (D3) | 2 |
| `client/components/CategoryBadge.tsx` | Modify — `numberOfLines` passthrough | 2 |
| `client/components/Feed.tsx`, `bases/ListingViewList.tsx` | Modify — wrap in `ListingGrid` | 2 |
| `client/components/screens/Search.tsx` | Modify — grid constants on the `FlatList` | 2 |
| `client/components/screens/Listing.tsx` | Modify — `FlatList` → `ScrollView` + aside (D4) | 3 |
| `client/components/ImageGallery.tsx` | Modify — D6 | 3 |
| `client/components/navigation/primaryTabs.tsx` | Create — shared tab table (D5) | 4 |
| `client/app/(main)/(tabs)/_layout.tsx` | Modify — map `PRIMARY_TABS`, hide bar at `lg` | 4 |
| `client/components/header/Header.tsx` | Modify — `max-lg:hidden` nav row | 4 |
| `client/components/bases/Skeleton.tsx`, `cards/ListingSkeleton.tsx` | Create (D7) | 5 |
| `client/components/cards/ChatCard.tsx`, `Error.tsx`, misc `shadow`/radius call sites | Modify — apply scales | 5 |
| `client/components/MessageItem.tsx`, `screens/Chat.tsx`, `screens/Messages.tsx` | Modify (D8) | 6 |

`client/tailwind.config.js` is **not** modified. Confirming the defaults is an assertion in the
parity test, not an edit.

## Testing Strategy

The repo has one test file, pure Node + `fs`, and **no** `@testing-library/react-native`. Proposing
component or snapshot tests would mean adding a dependency and a rendering apparatus this repo does
not sustain. Scope is therefore deliberately narrow: assert the invariants that silently rot, and
read back the rest visually.

| Layer | What | Approach |
|---|---|---|
| Unit (jest, pure) | `BREAKPOINTS` ≡ resolved Tailwind `theme.screens` | `resolveConfig(tailwind.config)` → assert `md/lg/xl` = 768/1024/1280 and equal `BREAKPOINTS`. Fails loudly if anyone adds a `screens` override and desyncs classes from `useBreakpoint()` |
| Unit (jest, pure) | Column math | `columnsAt("base"\|"md"\|"lg"\|"xl")` = 1/2/3/4, and `GRID_CELL_CLASS` contains exactly the matching `w-full`/`w-1/2`/`w-1/3`/`w-1/4` fractions |
| Unit (jest, pure) | `resolveBreakpoint(width)` | Table test at 375/767/768/1023/1024/1279/1280/1920 |
| Unit (jest, pure) | `ELEVATION` shape | Every token has `class` + all five native fields; `elevation` a positive int; `overlay` strictly above `raised` on radius/offset/elevation |
| Source guard (jest, `fs`) | One shadow scale | No `shadow-`/`shadowOpacity`/`elevation` outside `config.ts` and the grandfathered allow-list (`Toast.tsx`, `GoogleSignInButton.tsx`, `Landing.tsx`). Reuses the palette guard's file walker |
| Source guard (jest, `fs`) | Native display trap | No `hidden lg:` / `hidden md:` / `hidden xl:` sequence anywhere — the fact-3 trap, cheap to detect, invisible at review |
| Regression | Existing 231 tests | `cd client && npx jest --ci --watchAll=false`. Never `npm run test` (`--watchAll`, never terminates) |
| E2E | Playwright `e2e/` | Unchanged and expected to stay green: grepped, zero role/text/testid selectors, so layout carries no e2e risk |
| Visual readback | Everything else | Per slice, at 375 / 768 / 1024 / 1440 / 1920: column count, no full-bleed stretch, tab bar present ≤768 and absent ≥1024, aside sticky and internally scrollable, no element repositioned at 375 vs `main` |

`npm run lint` is broken pre-existing (`expo lint` → `ERR_UNSUPPORTED_DIR_IMPORT` on
`eslint-config-expo/flat` under Node v24) and is **not** a gate. Formatting is Prettier only:
2-space, double quotes, trailing commas, 100-char width, `prettier-plugin-tailwindcss` class sorting.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary. Expo Router file routes are unchanged: D5 alters `tabBarStyle`
presentation only and adds no route, redirect or `href`.

## Migration / Rollout

No data migration. Six stacked PRs, each onto the previous, first onto `main`:

| # | Slice | Content | ~Lines |
|---|---|---|---|
| 1 | Foundation | `config.ts` tokens, `useBreakpoint`, `MainView` cap (D9), `ButtonText` (D10), parity tests | 150 |
| 2 | Card + grid | `ListingGrid` (D2), card (D3), `CategoryBadge`, `Feed`, `ListingViewList`, `Search` | 450 |
| 3 | Detail + gallery | Two-column detail (D4), `ImageGallery` (D6) | 350 |
| 4 | Desktop nav | `primaryTabs`, `_layout`, `Header` (D5) | 250 |
| 5 | Mobile polish | Scales applied (D1), skeletons + empty states (D7) | 400 |
| 6 | Chat + Messages | D8 | 250 |

Total ≈ 1850. Slice 1 is additive and inert until consumed, so it is a safe no-op merge. Each slice
reverts independently; `MainView` (page cap) and `ListingGrid` (columns) remain the two toggle
points.

## Open Questions

- [ ] None blocking.

## Recorded Follow-ups (not fixed here)

- `selectors/ImagesSelector.tsx:15` — same module-scope `Dimensions.get("window").width` bug as D6.
- `text-md` is not a Tailwind class; it silently applies nothing at `CreditsBadge.tsx:28` and
  `screens/Listing.tsx:74`. Fixing it to `text-base` changes rendered size (14 → 16), so it is a
  visual decision, not a cleanup.
- `Toast.tsx:113` / `GoogleSignInButton.tsx:228-251` / `Landing.tsx:230-234` keep ad-hoc shadows,
  grandfathered in the source guard's allow-list.
- Desktop master–detail messaging layout (D8).
- `numColumns` + `key={columns}` remains the documented escape hatch if the grid ever needs real
  virtualization.
