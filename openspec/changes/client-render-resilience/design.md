# Design: Client Render Resilience

## Technical Approach

Two independent additions sharing one branch: **containment** (one shared fallback component wired
into 10 route files via a one-line re-export) and **detection** (one `act()` helper plus three render
suites). No new dependency, no Jest config change, no server change.

The whole containment design is constrained by one verified fact: `app/_layout.tsx` goes through the
same `fromImport` path as every other route (`global-state/router-store.js:168` →
`useScreens.js:128-147`), so the root `<Try>` wraps `RootLayout` **itself**. The root fallback
therefore renders *outside* `QueryClientProvider`, `SafeAreaProvider`, `ThemeProvider`,
`GestureHandlerRootView` and `ToastProvider` — everything `RootLayout` mounts. It may consume no
React context at all. That constraint is strictly tighter than a tab's, so one component satisfying
it also works in a tab.

## Verified Facts

Read in the repo and in `client/node_modules`, not assumed. Each one changes a decision below.

| Fact | Evidence |
|---|---|
| `Try` passes exactly `{ error, retry }`; `retry` returns a `Promise<void>` and only does `setState({ error: undefined })` | `expo-router/build/views/Try.js:53-67`, `Try.d.ts:3-8` |
| The root layout is wrapped too, above its own providers | `router-store.js:168` calls `getQualifiedRouteComponent(routeNode)` |
| `ErrorBoundaryProps` is a public export; the `Try` class is not | `expo-router/build/exports.d.ts:13` |
| **`resetQueries({ type: "active" })` cannot match the query that threw** | `Try.render()` unmounts children, so its observers are gone; `query.js:86-90` `isActive()` is `false` at zero observers; `utils.js:39-47` then excludes it |
| `resetQueries` reverts matched queries **synchronously**; the returned promise only tracks refetching the still-mounted ones | `queryClient.js:127-141` |
| `Updates.reloadAsync()` reloads on web (`window.location.reload`) and native, but **throws in `__DEV__`** | `ExpoUpdates.web.js:30-33`; `Updates.js:168-178`; `expo-updates` is already a dependency and `app.json:74-76` configures it |
| `act` is exported from `react` 19.1.0 under `NODE_ENV=test` | `react/cjs/react.development.js:781` |
| `@/…` resolves in Jest via tsconfig paths | `jest-expo/jest-preset.js:115` `withTypescriptMapping` |
| Every file under `__tests__/` is collected as a suite; `helpers/` is the escape hatch and already holds `sourceFiles.ts` | Jest default `testMatch`; `package.json:23-26` |
| `Listing.tsx:50` still does `listing.media.length` unguarded | read directly |
| All user-facing copy in `client/` is Spanish | `Loader.tsx:6`, `Notification.tsx:91`, `Notifications.tsx:73` |

## Architecture Decisions

### D1 — One fallback component, two named boundaries, zero context

`client/components/RouteErrorFallback.tsx` exports a presentational
`RouteErrorFallback({ error, retry, escape })` plus two thin bindings, `TabErrorBoundary`
(`escape="home"`) and `AppErrorBoundary` (`escape="reload"`).

`queryClient` is imported from `@/api/queryClient` as the module singleton, never via
`useQueryClient()`. Forced by the root case, and already the repo's stated intent — that module's own
comment says it lives outside `_layout.tsx` precisely so it can be used without React.

Content reuses `components/Error.tsx` for the message block and plain RN `Pressable`/`Text` for the
two actions (`rounded-lg px-3 py-1.5 active:opacity-70 bg-primary`, the `Debug.tsx:69` idiom). No
`useSafeAreaInsets`, no `useToast`, no gesture-handler.

**Rejected — two components (root vs tab).** The only difference is one action; duplicating a
context-free component to vary a string is worse than one prop.
**Rejected — `useQueryClient()`.** Throws at the root, where there is no provider.

### D2 — Retry resets *all* queries, not active ones, and does not await the refetch

The spec's `resetQueries({ type: "active" })` is **wrong and must be amended** (see Open Questions).
When the fallback is on screen the failing subtree is already unmounted, so its query has zero
observers and `type: "active"` provably excludes it — retry would remount over the same poisoned
cache and throw again, which is the exact loop the requirement exists to prevent.

```tsx
const handleRetry = async () => {
  // Unfiltered: the query that threw is now observer-less, so `{ type: "active" }` would skip the
  // one entry that has to go. The reset is synchronous; the returned promise only tracks refetching
  // screens still mounted elsewhere, and awaiting that would block this remount on their network.
  queryClient.resetQueries().catch(() => {});
  await retry();
};
```

`.catch` is mandatory: this is an event handler, so a rejection here is *not* caught by any boundary.

**Rejected — `removeQueries()`**: evicts entries out from under mounted observers for no added
guarantee. **Rejected — `queryClient.clear()`**: that call means "session ended" in this codebase
(`stores/session.ts` logout); overloading it would blur a security-relevant idiom.

### D3 — Escape route: `home` for tabs, `reload` for the root *and* the home tab

`escape="home"` → `router.replace("/(main)/(tabs)/home")` (the canonical href from
`primaryTabs.ts:34`, restated as a local constant with a cross-reference comment rather than
importing `PRIMARY_TABS` and dragging `@expo/vector-icons` into the fallback).

`escape="reload"` → a new `client/services/reloadApp.ts`:

```ts
export async function reloadApp(): Promise<void> {
  if (Platform.OS === "web") return void window.location.reload();
  // Native: `Updates.reloadAsync()` restarts the JS bundle, which also drops the in-memory query
  // cache. It throws in `__DEV__` and when updates are disabled; there is no safe native fallback,
  // and retry is still on screen.
  try {
    await Updates.reloadAsync();
  } catch {}
}
```

Its own module because it is the mock seam that keeps `expo-updates` out of the fallback's tests.

**The home tab uses `reload`, not `home`**: replacing `/home` while standing on `/home` is not an
escape. **Rejected — `window.location.reload()` everywhere**: `window` does not exist on native.
**Rejected — `Updates.reloadAsync()` on web too**: it works, but routes through a deprecated
`reload(true)` shim for no gain.

### D4 — Literal one-line re-export at every site, no factory

```tsx
export { TabErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";
```

Ten sites, one line each, greppable. A factory would add indirection and save nothing — the
repetition *is* the opt-in signal, and `useScreens.js` keys off the export name, so it must be
literal and statically visible either way.

### D5 — Route sites: 7 tabs + `messages/_layout.tsx` + root; `(tabs)/_layout.tsx` is out

| Site | Boundary | Why |
|---|---|---|
| `app/_layout.tsx` | `AppErrorBoundary` | last net; navigation may be dead |
| `(tabs)/home.tsx` | `AppErrorBoundary` | escaping to home from home is a no-op (D3) |
| the other 6 tab screens | `TabErrorBoundary` | spec requirement |
| `(tabs)/messages/_layout.tsx` | `TabErrorBoundary` | `messages` is an 8th tab implemented as a directory; without it a throw in a chat row falls all the way to the root, i.e. the incident's exact shape. One file covers `index` and `[userId]` at tab granularity, for ~2 lines |
| `(tabs)/_layout.tsx` | **none** | it renders no server data beyond `useSelf()`; its fallback would need root semantics (it would have replaced the navigator its own escape targets), and the root already catches it. A third configuration for near-zero marginal containment |

Out of scope and named as a remaining gap: `(main)/listing/**`, `(main)/user/[userId]`,
`(main)/settings`, `(auth)/**` — 19 further route files, same fast-follow bucket as list-item
boundaries.

### D6 — `Listing.tsx` needs a one-line guard for its spec scenario to be satisfiable

`Listing.tsx:50` is `const hasImage = listing.media.length > 0;`. The shipped fix (`5237081`,
`9a5236a`) guarded `payload.listing` in `Notification.tsx:146`; it did not touch this line. The spec
requires a test proving this card renders with `media` absent, and today that throws. It becomes
`const hasImage = (listing.media?.length ?? 0) > 0;`. Two lines, and the change is otherwise a test
asserting a known failure.

### D7 — `renderWithAct` in `__tests__/helpers/`; mocks stay per-suite

```tsx
// client/__tests__/helpers/renderWithAct.tsx  (not collected: package.json testPathIgnorePatterns)
import { act } from "react";
import renderer, { type ReactTestRenderer } from "react-test-renderer";

/** React 19 defers the initial commit: `renderer.create` outside `act()` leaves the tree
 *  uncommitted and `toJSON()` returns `null`. The async form also flushes effects. */
export async function renderWithAct(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(element);
  });
  return tree;
}

/** React logs a caught boundary error through `console.error`. Scoped, restored per test. */
export function silenceRenderErrors(): () => void { /* jest.spyOn(console, "error") + restore */ }
```

`act` from `react`, not `react-test-renderer` — the React 19 entry point, and it sidesteps the
CLI-10 peer skew entirely.

**Mocks are declared per suite, never in the helper.** `jest.mock` is hoisted per *file* by
`babel-plugin-jest-hoist`; a helper calling it at module scope would depend on the importing file's
require order. `session-store.test.ts:6-14` already documents this constraint, and every render suite
follows that idiom (`@react-native-async-storage/async-storage` → its shipped mock, `@/demo`,
`expo-router`'s `useRouter`).

### D8 — Containment is tested against the real `Try`

`route-error-fallback.test.tsx` renders `<Try catch={TabErrorBoundary}><Throws/></Try>` importing
`Try` from `expo-router/build/views/Try` — the exact class `useScreens.js:139` installs. The deep
path is deliberate: if it moves, this test fails loudly, which is the correct signal for a change
whose entire containment story rests on that file. It needs `jest.mock("expo-splash-screen", …)`
because `getDerivedStateFromError` calls `SplashScreen.hideAsync()`. Mocking `expo-router` for the
fallback's own `router` does not affect this deep path — different resolved modules.

**Rejected — a locally written boundary class**: proves React works, not that our wiring does.
**Rejected — booting `ExpoRoot`**: needs a full route context for no extra assurance.

### D9 — In-app copy is Spanish; the artifact is English

Every user-facing string in `client/` is Spanish. An English error screen would be the only one in
the app. Fallback copy: "Algo salió mal", "Reintentar", "Ir al inicio" / "Recargar la app", plus
`error.message` under `__DEV__`. Code comments in English, matching the most recent client files.

## Data Flow

    render throw ──→ Try.getDerivedStateFromError ──→ children UNMOUNT (observers drop)
                                                            │
                              RouteErrorFallback({ error, retry, escape })
                                        │                        │
                    retry ──────────────┘                        └────── escape
                      │                                                    │
        queryClient.resetQueries()  (sync, unfiltered)          router.replace("/…/home")
                      │                                                 or reloadApp()
                 await retry()  →  setState({error: undefined})  →  subtree remounts, cache empty

## File Changes

| File | Action | Description |
|---|---|---|
| `client/components/RouteErrorFallback.tsx` | Create | Fallback + `TabErrorBoundary` / `AppErrorBoundary` |
| `client/services/reloadApp.ts` | Create | Platform-branched reload; the `expo-updates` mock seam |
| `client/app/_layout.tsx` | Modify | `AppErrorBoundary` re-export |
| `client/app/(main)/(tabs)/home.tsx` | Modify | `AppErrorBoundary` re-export (D3) |
| 6 other `(tabs)/*.tsx` + `(tabs)/messages/_layout.tsx` | Modify | `TabErrorBoundary` re-export |
| `client/components/cards/Listing.tsx` | Modify | `media?.length ?? 0` guard (D6) |
| `client/__tests__/helpers/renderWithAct.tsx` | Create | `renderWithAct`, `silenceRenderErrors` |
| `client/__tests__/notification-card.test.tsx` | Create | null listing / null donor / unknown type |
| `client/__tests__/listing-card.test.tsx` | Create | `media` absent, both variants |
| `client/__tests__/route-error-fallback.test.tsx` | Create | containment via `Try`; retry ordering; escape per mode |

## Interfaces / Contracts

```tsx
import type { ErrorBoundaryProps } from "expo-router";

type RouteErrorFallbackProps = ErrorBoundaryProps & { escape: "home" | "reload" };
export function RouteErrorFallback(props: RouteErrorFallbackProps): React.JSX.Element;
export function TabErrorBoundary(props: ErrorBoundaryProps): React.JSX.Element;
export function AppErrorBoundary(props: ErrorBoundaryProps): React.JSX.Element;
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `reloadApp` platform branch | mock `react-native` `Platform` + `expo-updates`; assert the right call and that a `__DEV__` throw is swallowed |
| Render | `Notification` with `listing: null`; `Listing` with `media` absent | `renderWithAct`, assert on `toJSON()` text content — never computed style |
| Render | Retry ordering | spy `queryClient.resetQueries`, assert it is invoked before the injected `retry` resolves |
| Integration | Containment | real `Try` + `TabErrorBoundary` + a throwing child; `silenceRenderErrors` around it |
| Manual | Escape on both targets | web reload and a native build; `Updates.reloadAsync` cannot be exercised in Jest |

## Threat Matrix

**N/A.** No shell command, subprocess, VCS/PR automation, executable-file classification or process
integration. `router.replace` targets a static in-app literal with no user input, which is not the
repository-selection/argument-composition boundary the matrix covers.

## Migration / Rollout

No migration. No DB change, so `openspec/config.yaml`'s `rules.design` items do not apply here and
are recorded as such rather than performed: **no `community_id` scoping decision** (client-only, no
query is issued or scoped by this change) and **no new migration under `server/migrations/`**.

Ships as two chained PRs — `delivery_strategy: auto-chain`, and the honest forecast is ~435 changed
lines against a 400 budget (**Medium-High**):

| Slice | Contents | ~lines |
|---|---|---|
| 1 — containment | `RouteErrorFallback`, `reloadApp`, 10 route sites, `Listing` guard | ~125 |
| 2 — detection | `renderWithAct` + 3 render suites | ~310 |

Slice 1 is useful and revertable alone; slice 2 cannot regress runtime.

## Open Questions

- [ ] **Blocking on spec, not on design.** `client-render-error-containment` normatively requires
      `queryClient.resetQueries({ type: "active" })`. D2 proves that call cannot match the query that
      threw. The requirement should read "MUST discard the cached data that caused the failure
      (`queryClient.resetQueries()`) before invoking `retry()`". Applying the spec as written would
      ship the retry loop it was written to prevent.
- [ ] Does `router.replace` to the route you are already on remount the screen in
      `expo-router@6.0.21`? D3 sidesteps the question for the home tab, so nothing depends on the
      answer — but confirming it would tell us whether `AppErrorBoundary` on `home.tsx` is necessary
      or merely safe. Resolved by one manual check on web.
- [ ] The home href is duplicated as a constant in the fallback rather than read from `PRIMARY_TABS`
      (D3). Accepted drift risk; a one-line assertion could be added to `primary-tabs.test.ts` if the
      route ever moves.
