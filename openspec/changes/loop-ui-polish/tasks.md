# Tasks: Loop UI Responsive Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1850 total across 6 slices |
| Session review budget | 800 lines/PR (configured); every slice below stays under it |
| 400-line budget risk | High (only against the skill default of 400; slices 2 and 5 exceed it individually) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 (below) |
| Delivery strategy | ask-on-risk (resolved: chained PRs, user-approved) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Branch (base) | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------|-----------------------|------------------|--------------------|
| 1 | Foundation tokens + guards | `feat/ui-1-foundation` (`feat/itinere-brand-refresh`) | `cd client && npx jest --ci --watchAll=false __tests__/responsive-tokens.test.ts` | N/A — no `@testing-library/react-native`; pure-`fs`/pure-function tests only | Additive/inert; revert leaves app unchanged |
| 2 | Card + `ListingGrid` | `feat/ui-2-listing-grid` (`feat/ui-1-foundation`) | `cd client && npx jest --ci --watchAll=false` | Manual visual readback, `npx expo start --web`, at 375/768/1024/1440/1920 | Revert restores `.map()` row-card rendering; `ListingGrid`/`Listing.tsx` are the toggle points |
| 3 | Two-column detail + gallery | `feat/ui-3-detail-layout` (`feat/ui-2-listing-grid`) | `cd client && npx jest --ci --watchAll=false` | Manual visual readback at 1024×768, 1024, 1280; resize test crossing 1024px | Revert restores single-column `FlatList` detail screen |
| 4 | Desktop header nav | `feat/ui-4-desktop-nav` (`feat/ui-3-detail-layout`) | `cd client && npx jest --ci --watchAll=false` | Manual visual readback at 375/900/1024/1440; manual route-cross check on `WishList` | Revert restores bottom-bar-only nav; `tabBarStyle.display` is the toggle point |
| 5 | Mobile polish + skeletons | `feat/ui-5-mobile-polish` (`feat/ui-4-desktop-nav`) | `cd client && npx jest --ci --watchAll=false __tests__/responsive-tokens.test.ts` | Manual visual readback at 375px on all five listed screens | Revert restores `<Loader/>`-only states and unscaled ad hoc values |
| 6 | Chat + Messages | `feat/ui-6-chat` (`feat/ui-5-mobile-polish`) | `cd client && npx jest --ci --watchAll=false`; Playwright `e2e/` | Manual visual readback at 375/1920 on Chat/Messages | Revert restores `max-w-[80%]` bubble cap |

Environment: baseline is **231/231 passing** via `cd client && npx jest --ci --watchAll=false`. Never `npm run test` (`--watchAll`, never terminates). `npm run lint` is broken pre-existing (`expo lint` → `ERR_UNSUPPORTED_DIR_IMPORT` under Node v24) — not a gate, do not attempt to fix it here.

---

## Slice 1: Foundation — `feat/ui-1-foundation` (base: `feat/itinere-brand-refresh`)

> Corrected from the original `main` label: this slice is stacked on `feat/itinere-brand-refresh`
> (the Itínere rebrand, PR #1) so the redesign is seen with the new palette. Slices 2–6 keep their
> stated bases (each is stacked on the previous slice).

- [x] 1.1 Add `BREAKPOINTS` constant to `client/config.ts` (`md`=768, `lg`=1024, `xl`=1280). — *responsive-layout: Breakpoint Contract*
- [x] 1.2 Add `ELEVATION` table to `client/config.ts` (`raised`, `overlay`, each with `class` + 5 native fields per design D1). — *responsive-layout: Shared Visual Scales*
- [x] 1.3 Add `GALLERY_HEIGHT` (`{base:260, md:360, lg:420, xl:420}`) and `SKELETON_COUNT = 4` constants to `client/config.ts` (consumed in slices 3 and 5).
- [x] 1.4 Create `client/hooks/useBreakpoint.ts`: `useWindowDimensions()` wrapper exporting a pure `resolveBreakpoint(width)` function and the hook itself. — *responsive-layout: Breakpoint Contract, "Hook returns the correct breakpoint per range"*
- [x] 1.5 Fix `client/components/bases/MainView.tsx`: define `PAGE_CLASS = "w-full max-w-6xl xl:max-w-[1400px] mx-auto"`; apply via `contentContainerClassName` in the `refreshEnabled` branch (`:20-28`) and the outer `View` in the non-refresh branch (`:32`), so both branches match (D9). — *responsive-layout: Page Width Cap, "Cap is flag-independent"*
- [x] 1.6 Fix `client/components/bases/ButtonText.tsx:5`: replace the template-string `className` interpolation with `twMerge("text-white text-xl font-medium text-center", props.className)` (D10 — in scope per task, supersedes the proposal's "record, do not fix").
- [x] 1.7 Create `client/__tests__/helpers/sourceFiles.ts`: extract the `walkTsFiles` file-walker from `client/__tests__/brand-palette.test.ts` so both source guards below can reuse it.
- [x] 1.8 [RED→GREEN] Write `client/__tests__/responsive-tokens.test.ts` — breakpoint parity: `resolveConfig(tailwind.config)` `theme.screens` `md/lg/xl` === 768/1024/1280 === `BREAKPOINTS`. — *responsive-layout: Breakpoint Contract*
- [x] 1.9 [RED→GREEN] Extend `responsive-tokens.test.ts` — `resolveBreakpoint(width)` table test at 375/767/768/1023/1024/1279/1280/1920. — *responsive-layout: "Hook returns the correct breakpoint per range"*
- [x] 1.10 [RED→GREEN] Extend `responsive-tokens.test.ts` — `ELEVATION` shape test: every token has `class` + all 5 native fields, `elevation` a positive int, `overlay` strictly above `raised` on radius/offset/elevation.
- [x] 1.11 [RED→GREEN] Extend `responsive-tokens.test.ts` — source guard (using `walkTsFiles`): no `shadow-`/`shadowOpacity`/`elevation` token outside `config.ts` and the grandfathered allow-list (`Toast.tsx`, `GoogleSignInButton.tsx`, `Landing.tsx`), scanning `app/` and `components/`. **Deviation**: two additional pre-existing call sites were found outside that 3-file list and were added to the allow-list — see "Issues Found" in apply-progress: `components/screens/Listing.tsx` (`shadow-sm` at `:97`, rewritten wholesale in slice 3/D4) and `components/ToastProvider.tsx` (`elevation: 99999` at `:47`, the same Android z-stacking companion to `Toast.tsx`, not a shadow-depth choice).
- [x] 1.12 [RED→GREEN] Extend `responsive-tokens.test.ts` — **native display-trap guard (hard rule)**: assert no `className` string in `app/` or `components/` contains the literal token `hidden` together with any `md:`/`lg:`/`xl:` display-restoring prefix (`md:flex`, `lg:flex`, `xl:flex`, `md:block`, `lg:block`, `xl:block`, `md:grid`, `lg:grid`, `xl:grid`, `md:inline`, etc.) in the same string. `display: none` cannot be overridden by any later `display` value on native (`parseDeclaration.js:1709-1717`), so `hidden lg:flex` hides an element forever there. This guard is required before slices 3–6 rely on `max-lg:hidden`.
- [x] 1.13 Run `cd client && npx jest --ci --watchAll=false`; confirm 231 baseline + all slice-1 tests pass.

**Done condition**: all slice-1 tests green (baseline 231 unaffected), `MainView`/`ButtonText` fixes visually confirmed unchanged at 375px and 1920px, tokens are additive and inert until consumed by later slices.

---

## Slice 2: Card + Grid — `feat/ui-2-listing-grid` (base: `feat/ui-1-foundation`)

- [ ] 2.1 Create `client/components/bases/ListingGrid.tsx`: export `GRID_ROW_CLASS = "flex-row flex-wrap -mx-1.5"`, `GRID_CELL_CLASS = "w-full md:w-1/2 lg:w-1/3 xl:w-1/4 px-1.5 pb-3"`, `columnsAt(bp)` returning `{base:1, md:2, lg:3, xl:4}[bp]`, and a default component wrapping children via `React.Children.map` (D2). — *listing-discovery-grid: Grid Column Count by Breakpoint*
- [ ] 2.2 [RED→GREEN] Add a column-math unit test (in `responsive-tokens.test.ts` or a new `listing-grid.test.ts`): `columnsAt()` returns 1/2/3/4 per breakpoint, and `GRID_CELL_CLASS` contains exactly the matching `w-full`/`w-1/2`/`w-1/3`/`w-1/4` fraction tokens. — *listing-discovery-grid: "Column count per range"*
- [ ] 2.3 Modify `client/components/CategoryBadge.tsx`: add an optional `numberOfLines?: number` passthrough (default behavior unchanged).
- [ ] 2.4 Rewrite `client/components/cards/Listing.tsx` to the image-first markup from design D3: `Image` `aspect-[4/3] w-full bg-background` hero with `resizeMode="cover"`, badge/content block below reusing `CreditsBadge`/`CategoryBadge`/`ProductStatusBadge`/`UserBadge` unchanged, zero variant props. — *listing-discovery-grid: Image-First Card Variant*
  - **Checkpoint**: `resizeMode` moves `contain` → `cover`; this is the change most likely to read as "restyled" in review — call out that `bg-background` covers letterboxing and no badge/typography primitive changed.
- [ ] 2.5 Apply `ELEVATION.raised` to the card container (D1): `twMerge` the web `class` on web, apply the native `style` object on native via `Platform.select`.
- [ ] 2.6 Modify `client/components/Feed.tsx`: wrap the listing `.map()` output in `<ListingGrid>`; move `Loader`/`Error`/"Cargar más" outside the grid container (required — `ListingGrid` wraps every child in a cell). — *listing-discovery-grid: Grid Column Count by Breakpoint*
- [ ] 2.7 Modify `client/components/bases/ListingViewList.tsx`: same `ListingGrid` wrap and `Loader`/`Error` relocation as 2.6.
- [ ] 2.8 Modify `client/components/screens/Search.tsx`: keep the `FlatList`; set `className="px-4"` on the list, `contentContainerClassName={GRID_ROW_CLASS}`, `renderItem={({item}) => <View className={GRID_CELL_CLASS}><Listing listing={item}/></View>}`. — *listing-discovery-grid: Grid Column Count by Breakpoint (FlatList path)*
- [ ] 2.9 Visual readback at 500/900/1100/1400px on `Home`, `Search`, `MyListings`, `WishList`: confirm 1/2/3/4 columns respectively; resize 1100→1400px and confirm no remount and no lost scroll position. — *listing-discovery-grid: "Column count per range", "Grid reflows without remount or scroll loss"*
- [ ] 2.10 Run `cd client && npx jest --ci --watchAll=false`; confirm baseline + slice-1 + slice-2 tests pass.

**Done condition**: grid renders correct column counts at all four breakpoints, card reads as a structural change (badges/typography unchanged), resize does not remount or lose scroll position, all tests green.

---

## Slice 3: Detail + Gallery — `feat/ui-3-detail-layout` (base: `feat/ui-2-listing-grid`)

- [ ] 3.1 **[Largest structural edit — flag for careful review]** Rewrite `client/components/screens/Listing.tsx`: replace the `FlatList`-of-7-static-sections with a `ScrollView` layout inside `MainView "flex-1 lg:flex-row lg:gap-6"` per design D4's tree. Verify no section content or order is dropped in the `FlatList`→`ScrollView` conversion. — *listing-discovery-grid: Two-Column Listing Detail*
- [ ] 3.2 Add the mobile inline copies (`View "lg:hidden"`, price/seller/status) inside the `ScrollView` column, and the desktop aside (`View "max-lg:hidden lg:w-[380px] lg:shrink-0"`) containing an internally-scrolling `ScrollView` for price/seller/status + `ListingButtons`. — *listing-discovery-grid: Sticky Panel Reachability*
  - **Checkpoint (verified inert, note don't dedupe)**: price/seller/status (3 components) and `ListingButtons` render twice by design. `ListingButtons` was read end-to-end — no mount effects, only handlers and `useMutation` registrations — so double-mounting is inert.
- [ ] 3.3 Add the mobile bottom bar (`View "p-4 flex-row gap-4 lg:hidden"`) with `ListingButtons`, preserving the pre-change single-column element order below `lg`. — *listing-discovery-grid: "Single column below 1024px"*
- [ ] 3.4 Confirm every desktop-only region added in 3.1–3.3 uses `max-lg:hidden`, never `hidden lg:flex` (fact 3 / hard rule); re-run the slice-1 display-trap guard (task 1.12) against these new lines.
- [ ] 3.5 Modify `client/components/ImageGallery.tsx`: delete the module-scope `Dimensions.get("window").width` constant (`:8`) and the `Dimensions` import; initialize `containerWidth` to `0`; render `Carousel` only once `containerWidth > 0` via `onLayout` (D6).
- [ ] 3.6 In `ImageGallery.tsx`, replace the fixed `240` height (`:36`, `:47`) on both the `Carousel` `height` prop and the `Image` style number with `useBreakpoint()` reading `GALLERY_HEIGHT` from `client/config.ts`.
- [ ] 3.7 Visual readback at 1024×768 (short laptop viewport): confirm the aside scrolls internally and the Ofertar/Deseados action stays reachable without scrolling the outer page. — *listing-discovery-grid: "Primary action reachable on a short laptop viewport"*
- [ ] 3.8 Visual readback at 1280px: gallery occupies the left column, action panel occupies the right column. — *listing-discovery-grid: "Two columns at 1280px"*
- [ ] 3.9 Visual readback at 768px/900px/1023px: single column, pre-change element order preserved, tab bar still visible. — *listing-discovery-grid: "Single column below 1024px", Tablet Layout*
- [ ] 3.10 Manually cross 1023↔1024px (browser resize or Expo web dev tools): confirm no remount and no scroll-position loss.
- [ ] 3.11 Run `cd client && npx jest --ci --watchAll=false`; confirm all tests green (no new unit tests in this slice — verification is structural readback per 3.7–3.10).

**Done condition**: detail screen is two-column at `lg` with an internally-scrolling, reachable aside; single-column unchanged below `lg`; gallery height is responsive; no remount/scroll-loss crossing 1024px; all tests green.

---

## Slice 4: Desktop Nav — `feat/ui-4-desktop-nav` (base: `feat/ui-3-detail-layout`)

- [ ] 4.1 Create `client/components/navigation/primaryTabs.tsx`: export `PRIMARY_TABS` (`name`, `title`, `icon`, `iconProps`) for the five primary tabs — one source shared by the tab layout and the header (D5).
- [ ] 4.2 Modify `client/app/(main)/(tabs)/_layout.tsx`: map `PRIMARY_TABS` to `<Tabs.Screen>` entries instead of a hardcoded list; leave `screenOptions`, `href: null` entries untouched. — *desktop-navigation: Route and Focus Preservation*
- [ ] 4.3 In `_layout.tsx`, extend the existing `tabBarStyle.display` expression (already conditioned on keyboard visibility) to `display: visible && !isDesktop ? "flex" : "none"`, deriving `isDesktop` from `useBreakpoint()` (`lg` and above). The bar is hidden, never unmounted. — *desktop-navigation: Navigation Placement by Breakpoint*
- [ ] 4.4 Add a horizontal nav row to `client/components/header/Header.tsx`, `className="max-lg:hidden ..."`, mapping `PRIMARY_TABS` to `<Link href asChild>` items (not `Pressable` + `router.push`), reusing the existing bare `usePathname()` compare (`Header.tsx:14`) for the active state. — *desktop-navigation: "Header links at 1024px and above"*
- [ ] 4.5 Re-run the slice-1 display-trap guard (task 1.12) and confirm the new header row and `tabBarStyle` ternary do not introduce `hidden lg:flex`-style sequences.
- [ ] 4.6 Visual readback at 375px/900px: bottom bar present, tab order/icons/labels identical to `main`, no header nav row visible. — *desktop-navigation: Mobile Navigation Regression Guard, "No structural change at 375px"*
- [ ] 4.7 Visual readback at 1024px/1440px: header nav row shows all five tabs, bottom bar absent. — *desktop-navigation: "Header links at 1024px and above"*
- [ ] 4.8 Manual check: navigate to `WishList`, cross 1024px in both directions; confirm the active-tab indicator moves to the corresponding element with no navigation event or remount. — *desktop-navigation: Route and Focus Preservation, "Active route highlights correctly in both presentations"*
- [ ] 4.9 Run `cd client && npx jest --ci --watchAll=false`; confirm all tests green.

**Done condition**: five tabs render in the header at `lg`+ with the bottom bar hidden (not unmounted); mobile nav is pixel-identical to `main` below 768px; routing/focus unchanged; all tests green.

---

## Slice 5: Mobile Polish — `feat/ui-5-mobile-polish` (base: `feat/ui-4-desktop-nav`)

- [ ] 5.1 Create `client/components/bases/Skeleton.tsx`: `View` with `bg-stroke rounded-lg` plus a `react-native-reanimated` pulse (`useSharedValue` + `withRepeat(withTiming(opacity 0.5↔1, 900ms), -1, true)`) — no new dependency (D7).
- [ ] 5.2 Create `client/components/cards/ListingSkeleton.tsx` beside `cards/Listing.tsx`: same outer `rounded-xl border border-stroke bg-white`, an `aspect-[4/3]` block, three placeholder lines (`h-5 w-3/4`, `h-4 w-1/2`, `h-4 w-2/3`). — *listing-discovery-grid: Grid Loading and Empty States*
- [ ] 5.3 Wire `SKELETON_COUNT = 4` `ListingSkeleton` children inside `ListingGrid` on initial load in `Feed.tsx`, `ListingViewList.tsx`, and `Search.tsx`; keep `<Loader/>` for pagination only. — *listing-discovery-grid: "Skeleton during load"*
- [ ] 5.4 Add `min-h-40 items-center justify-center` to the existing `Error` component usage for the empty-result case in grid contexts; keep the existing Spanish copy — no new empty-state component. — *listing-discovery-grid: "Explicit empty state"*
- [ ] 5.5 Apply the documented spacing subset (`1`/`2`/`3`/`4`/`6`) across mobile call sites using ad hoc spacing values (per design scan); apply the radius subset (`rounded-lg`/`xl`/`full`/`2xl`), migrating the gallery images' `rounded` (4px) to the correct token. — *responsive-layout: Shared Visual Scales*
- [ ] 5.6 Apply `ELEVATION.raised`/`ELEVATION.overlay` to `client/components/cards/ChatCard.tsx:21` and any remaining un-migrated `shadow` call site outside the slice-1/2/4 sites already covered. — *responsive-layout: Shared Visual Scales*
- [ ] 5.7 Re-run the slice-1 shadow source guard (task 1.11); confirm only the grandfathered allow-list (`Toast.tsx`, `GoogleSignInButton.tsx`, `Landing.tsx`) remains outside `config.ts`.
- [ ] 5.8 Visual readback at 375px on `Home`, `Search`, `Listing`, `MyListings`, `WishList`: confirm zero element repositioning versus `main` — only image size and scale values differ. — *responsive-layout: Mobile Structural Invariant, "No repositioning at 375px"*
- [ ] 5.9 Run `cd client && npx jest --ci --watchAll=false`; confirm all tests green.

**Done condition**: skeletons/empty states render in all grid contexts, spacing/shadow/radius scales applied with zero 375px repositioning, shadow guard passes with only the grandfathered allow-list remaining, all tests green.

---

## Slice 6: Chat + Messages — `feat/ui-6-chat` (base: `feat/ui-5-mobile-polish`)

- [ ] 6.1 Modify `client/components/MessageItem.tsx:15`: change `max-w-[80%]` to `max-w-[80%] md:max-w-[60%] lg:max-w-[520px]`. — *responsive-layout: Chat Bubble Width Cap*
- [ ] 6.2 Modify `client/components/MessageItem.tsx:14-17,20-27`: replace string-concatenated `className` with `twMerge` (same bug class as `ButtonText`, D10 precedent).
- [ ] 6.3 Modify `client/components/screens/Chat.tsx`: add `w-full lg:mx-auto lg:max-w-3xl` to the thread wrapper. — *responsive-layout: Chat Bubble Width Cap*
- [ ] 6.4 Modify `client/components/screens/Messages.tsx`: add `w-full lg:mx-auto lg:max-w-2xl` to the conversation list wrapper. — *responsive-layout: Chat Bubble Width Cap*
- [ ] 6.5 Confirm `client/components/cards/ChatCard.tsx:21` already uses `ELEVATION.raised` (carried from slice 5); no further change required beyond verification.
- [ ] 6.6 Visual readback at 1920px: a three-word chat message bubble does not stretch toward ~1500px, stays within the fixed cap. — *responsive-layout: "Short message does not stretch at 1920px"*
- [ ] 6.7 Visual readback at 375px: `Chat`/`Messages` screens structurally unchanged versus `main`. — *responsive-layout: Mobile Structural Invariant*
- [ ] 6.8 Run `cd client && npx jest --ci --watchAll=false` (confirm 231+ tests green) and Playwright `e2e/` (confirm unchanged pass — zero role/text/testid selectors touched by this change).

**Done condition**: chat bubble capped at a fixed pixel width on desktop (no percentage-of-viewport stretch), `className` bug fixed via `twMerge`, mobile chat/messages structurally unchanged, jest + e2e green.

---

## Recorded Follow-ups (explicitly deferred, not fixed in this change)

- `text-md` is not a Tailwind class and is currently a silent no-op at `components/badges/CreditsBadge.tsx:28` and `components/screens/Listing.tsx:74`. **Deferred** — correcting it to `text-base` changes rendered size 14px→16px, a visual delta outside this change's remit.
- `selectors/ImagesSelector.tsx:15` has the same module-scope `Dimensions.get("window").width` bug fixed in `ImageGallery.tsx` by slice 3 (D6) — out of the proposal's screen list.
- `Toast.tsx:113` / `GoogleSignInButton.tsx:228-251` / `Landing.tsx:230-234` keep ad hoc shadows, grandfathered in the shadow source guard's allow-list.
- Desktop master–detail messaging layout (list left / thread right) — explicit non-goal per D8; a navigation restructure, not polish.
- `numColumns` + `key={columns}` remains the documented escape hatch if the grid ever needs real virtualization.
- Remaining 17 screens (`Landing`, auth, profiles, editors) — out of scope per proposal, follow-up change.
