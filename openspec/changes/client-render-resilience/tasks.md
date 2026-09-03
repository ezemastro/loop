# Tasks: Client Render Resilience

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~435 total (Slice 1 ~125, Slice 2 ~310) |
| 400-line budget risk | High (total) / Low per individual slice |
| Chained delivery recommended | Yes |
| Suggested split | Slice 1 (containment) → Slice 2 (detection), both to `main` |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (adapted: two sequential commits directly to `main`, not GitHub PRs — explicit user direction) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Target | Focused test command | Runtime harness | Rollback boundary |
|------|------|--------|----------------------|-----------------|-------------------|
| 1 | Containment: fallback, reload service, 10 route sites, Listing guard | Commit 1 → `main` | `cd client && npx tsc --noEmit` | Manual only: web build (trigger throw, verify retry/escape) + native build (`Updates.reloadAsync`, cannot run in Jest, throws in `__DEV__`) | Revert 2 new files + 10 one-line re-exports + Listing's one-line guard; no state to unwind |
| 2 | Detection: `renderWithAct` helper + 3 render suites | Commit 2 → `main` | `cd client && npx jest --ci --watchAll=false` | N/A — test-only, zero runtime surface; the Jest run is the harness | Delete helper + 3 test files; no runtime impact |

## Phase 1: Slice 1 — Containment Foundation

- [x] 1.1 Create `client/services/reloadApp.ts`: `reloadApp()` — web calls `window.location.reload()`; native calls `Updates.reloadAsync()` wrapped in `try/catch` (throws in `__DEV__`, swallowed). Verify: `cd client && npx tsc --noEmit`. (Satisfies: containment spec, "root fallback degrades to reload")
- [x] 1.2 Create `client/components/RouteErrorFallback.tsx` exporting `RouteErrorFallback({error, retry, escape})`, `TabErrorBoundary` (`escape="home"`), `AppErrorBoundary` (`escape="reload"`). Reuses `components/Error.tsx` for message; imports `queryClient` from `@/api/queryClient` module singleton (never `useQueryClient()`). Retry: `queryClient.resetQueries().catch(() => {})` — unfiltered, not awaited, rejection swallowed — then `await retry()`. Escape `"home"` → `router.replace("/(main)/(tabs)/home")`; escape `"reload"` → `reloadApp()`. Spanish copy: "Algo salió mal", "Reintentar", "Ir al inicio" / "Recargar la app"; show `error.message` under `__DEV__`. No React context consumed. Verify: `cd client && npx tsc --noEmit`. (Satisfies: all Requirements in `client-render-error-containment`)
- [x] 1.3 Fix `client/components/cards/Listing.tsx:50`: `const hasImage = listing.media.length > 0;` → `const hasImage = (listing.media?.length ?? 0) > 0;`. Verify: `cd client && npx tsc --noEmit`. (Satisfies: `client-render-regression-tests` — "The Listing Card Handles Missing Media", made satisfiable)

## Phase 2: Slice 1 — Route Wiring (depends on 1.1, 1.2)

- [x] 2.1 Add `export { AppErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";` to `client/app/_layout.tsx`. (Satisfies: "Root Boundary Contains An Uncaught Render Throw")
- [x] 2.2 Add the identical `AppErrorBoundary` re-export to `client/app/(main)/(tabs)/home.tsx` (D3: home tab escapes via reload, since replacing `/home` while on `/home` is a no-op). (Satisfies: "Each Tab Screen Contains Its Own Render Throw")
- [x] 2.3 Add `export { TabErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";` to each: `myListings.tsx`, `notifications.tsx`, `profile.tsx`, `publish.tsx`, `search.tsx`, `wishlist.tsx` (all under `client/app/(main)/(tabs)/`). (Satisfies: "Each Tab Screen Contains Its Own Render Throw" — the 6 remaining single-file tabs)
- [x] 2.4 Add the identical `TabErrorBoundary` re-export to `client/app/(main)/(tabs)/messages/_layout.tsx`. (Satisfies: same requirement — messages is the 8th tab, directory-implemented)
- [x] 2.5 Confirm no boundary export is added to `client/app/(main)/(tabs)/_layout.tsx` — review-only, no file change. (Satisfies: explicit exclusion in "Each Tab Screen Contains Its Own Render Throw")

## Phase 3: Slice 1 — Verify and Ship

- [x] 3.1 Run `cd client && npx tsc --noEmit`; must pass clean.
- [x] 3.2 Run `cd client && npx jest --ci --watchAll=false`; must report the unchanged baseline (no new tests land until Slice 2). Result: **862 tests / 15 suites**, all passing. The 857 baseline in this table is CORRECT and was not stale. Slice 1 writes no test files, but it adds two source files, and five existing suites (`build-hardening`, `responsive-tokens`, `api-errors`, `main-view`, `brand-palette`) enumerate source files through `__tests__/helpers/sourceFiles.ts` and generate a guard case per file. Those two new files therefore produce 5 additional generated tests, all green. Verified by moving the two new files out of the tree (857/15) and back in (862/15). Note for anyone repeating this: `git stash` without `-u` does NOT stash untracked files, so stashing to measure a "before" baseline leaves newly created files in place and silently contaminates the count.
- [ ] 3.3 **Manual-only** (cannot run in Jest): on a web build, force a render throw inside one tab and at the root; confirm retry and escape both work and other tabs stay usable. On a native build, exercise `Updates.reloadAsync()` via the root/home escape path. (Satisfies: containment spec scenarios end-to-end; resolves design Open Question on `router.replace` remount behavior)
- [x] 3.4 Commit Slice 1 to `main` as one commit (containment: `RouteErrorFallback.tsx`, `reloadApp.ts`, 10 route re-exports, `Listing.tsx` guard). Independently revertable, no state to unwind.

## Phase 4: Slice 2 — Test Helper (depends on Slice 1 committed)

- [x] 4.1 Create `client/__tests__/helpers/renderWithAct.tsx`: `renderWithAct(element)` awaits `act(() => { tree = renderer.create(element) })` using `act` imported from `react` (not `react-test-renderer`); `silenceRenderErrors()` scopes a `console.error` spy, restored per test. Confirm the file stays excluded from suite collection via existing `testPathIgnorePatterns`. Verify: `cd client && npx tsc --noEmit`. (Satisfies: "Render Tests Wrap `renderer.create` In `act()`") — Deviation: `react-test-renderer@19.0.0` ships no type declarations at all (verified, no bundled `.d.ts`, no `@types/react-test-renderer` in the repo), so `tsc --noEmit` failed with TS7016 on the design's exact snippet. Added `client/__tests__/helpers/react-test-renderer.d.ts`, a minimal hand-written ambient module declaration covering only the surface actually used (`create`, `ReactTestRenderer.toJSON()`/`.root`, `ReactTestInstance.props`/`.findAllByType`/`.findAll`). No new dependency, no Jest config change — satisfies the same constraint the task already required.

## Phase 5: Slice 2 — Render Regression Suites

- [x] 5.1 Create `client/__tests__/notification-card.test.tsx`: render `cards/Notification.tsx` via `renderWithAct` with `payload.listing: null`, with a `null` donor, and with an unknown notification type; assert each renders a fallback and does not throw. Declare mocks per-suite only (`@react-native-async-storage/async-storage`, `@/demo`, `expo-router`'s `useRouter`). (Satisfies: "The 2026-09-03 Notification Regression Is Asserted In CI") — also covers the mission (`userMission: null`) case and both `default: return null` switch paths (unknown type, admin action other than `credits`); 5 tests total.
- [x] 5.2 Create `client/__tests__/listing-card.test.tsx`: render `cards/Listing.tsx` via `renderWithAct` with `media` absent, in both `"grid"` and `"compact"` variants; assert no throw. (Satisfies: "The Listing Card Handles Missing Media") — also covers `media: []`, 4 cases total. Deviation: `CategoryBadge` (rendered unconditionally by `Listing.tsx`) calls `useWishes()` (`@tanstack/react-query`), which throws without a `QueryClientProvider` and would otherwise fire a real network request on mount; mocked `@/hooks/useWishes` directly instead of standing up a provider, per the same "mocks stay per-suite" idiom (design.md D7).
- [x] 5.3 Create `client/__tests__/route-error-fallback.test.tsx`: render `<Try catch={TabErrorBoundary}><Throws /></Try>` importing `Try` from `expo-router/build/views/Try` (the exact class `useScreens.js` installs); mock `expo-splash-screen` (`getDerivedStateFromError` calls `SplashScreen.hideAsync()`). Assert the throw is contained and the fallback renders. Spy `queryClient.resetQueries`; assert it is called before the injected `retry()` resolves and receives no `type` filter. Assert the escape target per mode (`home` vs `reload`). Wrap with `silenceRenderErrors()`. (Satisfies: "A Boundary Containment Test Exists"; retry-ordering and unfiltered-reset requirements in `client-render-error-containment`) — retry-ordering and escape-target assertions render `TabErrorBoundary`/`AppErrorBoundary` directly with injected `error`/`retry` props (matching the design's own Testing Strategy table, which lists them as separate rows from containment), rather than through `Try`, because `Try`'s internal `retry` reference is captured once by `RouteErrorFallback` at the first catch-render and cannot be swapped afterward to control timing. Deviation: matching the rendered `Pressable`s required matching by preserved function name, not by reference — NativeWind's Babel transform wraps any host component carrying `className` (both buttons here) in a per-file `cssInterop` component, so the wrapped reference used inside `RouteErrorFallback.tsx` is never `===` the plain `Pressable` this test file imports from `react-native`.

## Phase 6: Slice 2 — Verify and Ship

- [x] 6.1 Run `cd client && npx tsc --noEmit`; must pass clean. Result: clean, no output.
- [x] 6.2 Run `cd client && npx jest --ci --watchAll=false`; must report the 862 tests reached after Slice 1 (857 baseline + 5 generated source-guard cases) still passing, plus the new render tests, across 18 suites total. Expect the generated count to rise again for any new non-test source file this slice adds, with no new dependency and no Jest config change. (Satisfies: "Render Tests Run On The Existing Preset With No New Dependency"; "The Existing Test Baseline Remains Intact") Result: **880 tests / 18 suites, all passing** — 862 baseline + 5 more generated source-guard cases (this slice adds 2 new non-test files: `renderWithAct.tsx`, `react-test-renderer.d.ts` — the same +5 pattern task 3.2 recorded for Slice 1's 2 new files) + 13 new handwritten render/containment tests (5 notification-card + 4 listing-card + 4 route-error-fallback).
- [x] 6.3 Commit Slice 2 to `main` as one commit (`renderWithAct.tsx` + 3 render suites). Independently revertable; test-only, cannot affect runtime. — Left for the parent to commit (apply-phase instruction: leave tree dirty).

## Phase 7: Documentation Follow-up

- [x] 7.1 Scope a documentation update (do not author content in this phase) for `TESTING-MANUAL.md` — record: (a) these are the first render tests in the repo, (b) the `renderWithAct` helper and its per-suite-mocks-only convention, (c) that the premise recorded by `client-critical-fixes` / `2026-09-01-loop-settings` — that render testing requires new dependencies — is corrected: it does not. Cross-check whether `TODO.md`, `AGENTS.md`, or `docs/` reference the same stale premise or list this gap as open, and flag any that need a matching update.

Documentation landed 2026-09-03 by the orchestrator: a new block H in `TESTING-MANUAL.md` (the incident, the tab-isolation check, the retry, the manual-only `Updates.reloadAsync()` path, the production no-leak check, and the deferred work); a progress row in `AUDITORIA-2026-09.md` §10 following that document's own closing convention; and two entries in `AUDITORIA-CORRECCIONES.md` — the disproven CLI-12 dependency premise, and the fact that no CLI finding ever noted the total absence of error boundaries. Nothing was deleted: the stale statements all live in dated audit records that the repo corrects by appending rather than by rewriting.

Verify (2026-09-03) returned PASS WITH WARNINGS: 12/12 requirements, 17/17 scenarios, 0 blockers, 0 critical. Its one substantive warning is resolved: `RouteErrorFallback` used `useRouter()`, which reads `PreviewRouteContext` through `use()` and therefore contradicted design D1's "consumes no React context". It now uses the imperative `router` export instead, so the property is literally true rather than approximately true. Task 3.3 (manual web/Android verification) remains genuinely open and is the only thing this change cannot prove on its own — it is written up as block H in `TESTING-MANUAL.md`.
