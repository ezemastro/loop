# Design: Client Critical Fixes

## Technical Approach

Ten independent defect fixes in one client-only change, sharing one branch and one PR. There is no
new architecture: every fix either moves a value to a different store, makes an existing conditional
unconditional, narrows an existing conditional, or deletes something that should not ship. Two new
services are introduced (`secureStorage`, `showAlert`) and one new config file (`app.config.js`).
Everything else is edited in place.

The two properties that must survive the change are stated up front because most decisions below are
constrained by them:

1. **Demo isolation.** `client/demo/` installs an axios adapter that, when enabled, never delegates
   to the network (`demo/index.ts:140-149`, `:168-176`). The enable/disable call ordering in
   `stores/session.ts:46-57` and `:65-82` is load-bearing and documented in `DEMO.md`.
2. **Community theming and logout cleanup.** `syncCommunityTheme` (`stores/session.ts:36-38`) and the
   `useThemeStore.clear()` / `queryClient.clear()` / `disableDemoMode()` sequence in `logout`
   (`stores/session.ts:76-81`) exist to stop one community's colours and cached listings leaking to
   the next user on a shared device.

## Verified Facts

Read in the repository and in `client/node_modules`, not assumed. Each one changes a decision below.

| Fact | Evidence |
|---|---|
| `expo-secure-store` is **not** installed; SDK 54 pins `~15.0.8` | absent from `client/package.json`; `client/node_modules/expo/bundledNativeModules.json:77` |
| `expo-build-properties@~1.0.10` **is** already a dependency and installed | `client/package.json:35`; `client/node_modules/expo-build-properties/` |
| `@testing-library/react-native` is absent; no test renders a component | `client/package.json:68-87`; all 7 files in `client/__tests__/` are `.ts` pure/`fs` tests |
| `async-storage` ships its own jest mock | `client/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js` |
| Jest has **no** `moduleNameMapper`, so `@/` does not resolve in tests | `client/package.json:15-21`; every existing test imports relatively (`"../config"`) |
| Baseline is 721 tests / 7 suites, ~4s | `cd client && npx jest --ci --watchAll=false` |
| Metro does no tree-shaking; no `inlineRequires`, no `unstable_*` | `client/metro.config.js` (21 lines, none set) |
| The push payload carries **no** `data` field — only `to`, `title`, `body`, `categoryId` | `server/api/src/services/expoNotifications.ts:20-27` |
| A cross-platform toast already exists and is mounted app-wide | `components/ToastProvider.tsx:60-66` (`useToast`), mounted at `app/_layout.tsx:75` |
| The demo login ignores the password entirely | `client/demo/handlers/auth.ts:10-15` |
| The `development` EAS profile targets `http://192.168.1.37:3000`; `preview` sets no API URL | `client/eas.json:12`, `:17-20` |
| `new QueryClient()` is bare, so React Query's default `retry: 3` applies | `client/api/queryClient.ts:6` |
| e2e tests drive the API fixture, not the client UI | `e2e/tests/*.e2e.spec.ts` use `loginUser(api, …)` |

Two consequences run through everything below. **Consequence of the push-payload fact:** CLI-05
cannot be fully delivered client-side (D6). **Consequence of the no-tree-shaking fact:** CLI-06's
proposed remedy cannot work without deleting a production feature (D7).

## Architecture Decisions

### D1 — CLI-01: persist storage is chosen per platform, and the payload shrinks first

`stores/session.ts:95` is `storage: createJSONStorage(() => AsyncStorage)`. It becomes a factory in a
new `client/services/secureStorage.ts`:

```ts
// client/services/secureStorage.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { StateStorage } from "zustand/middleware";

/**
 * `expo-secure-store` has no web implementation. On web the browser's own origin isolation is the
 * boundary, so `AsyncStorage` (localStorage) is retained there rather than shimmed.
 */
export const sessionStorage: StateStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      };
```

**`partialize` is part of the fix, not a nicety.** The store persists the whole `PrivateUser`
(`stores/session.ts:43`, which includes `community`, `schools`, `profileMedia`, `credits`, `stats`).
SecureStore warns above 2048 bytes on Android and can fail outright; a user in several schools with a
themed community exceeds that easily. Only `authToken`, `hasAcceptedTerms`, `hasToken` and `demoMode`
are persisted. `user` is re-fetched by `useSelf` on every launch and written back through
`setUser` (`useSelf.ts:30-34`), which already calls `syncCommunityTheme` — so dropping `user` from
disk costs one already-issued request and preserves theming.

**Migration is mandatory and read-through.** Without it every logged-in user is silently logged out
on upgrade, because SecureStore starts empty. On native, `getItem` reads SecureStore first; on a
miss it reads the legacy `AsyncStorage` `"session-storage"` key, writes it into SecureStore, deletes
the legacy key, and returns it. It runs at most once per install and is idempotent.

**`demoMode` must stay in the same persisted object.** `stores/session.ts:13-18` explains why: token
and flag rehydrate together, so no instant exists with a demo token loaded and demo mode off. Moving
the token to SecureStore while leaving `demoMode` in `AsyncStorage` would recreate exactly that
window. One store, one storage backend, both platforms.

**Rejected**: a SecureStore web shim that throws — `zustand/persist` swallows storage errors, so it
would degrade to no persistence and log everyone out on refresh. **Rejected**: a separate secure
store only for the token — splits rehydration and reopens the demo race.

### D2 — CLI-01: the Google credential never reaches disk

`components/buttons/GoogleSignInButton.tsx:76` writes the raw Google ID token with
`AsyncStorage.setItem(GOOGLE_CREDENTIAL_KEY, credential)`. It is written because Google registration
is two-step and `schoolSelection` (`:99`) must resend the identical credential.

The credential becomes a module-scope variable in a small in-memory holder, not a persisted value.
This is safe precisely because the flow is single-session: `GoogleSignInButton` pushes straight to
`/(auth)/schoolSelection`, and if the app is killed between the two steps the credential is expired
or useless anyway — the correct recovery is to sign in again, which is what a user does today when
the stored credential has aged out. `GOOGLE_INVITATION_KEY` and `GOOGLE_COMMUNITY_KEY` are **not**
credentials (an invitation token scoped to an email, and a public community record) and stay in
`AsyncStorage`, so the second step keeps its non-secret context across a cold start.

**Rejected**: moving the credential to SecureStore. It keeps a bearer credential at rest for no
benefit — nothing reads it after the two-step flow completes (`:88` `clearStoredGoogleData()`).

### D3 — CLI-02: `app.config.js` layered over `app.json`

`app.json:32` (`"permissions": ["android.permission.RECORD_AUDIO"]`) is deleted outright — nothing in
the client records audio.

`usesCleartextTraffic` cannot simply be deleted: `eas.json:12` points the `development` profile at
`http://192.168.1.37:3000`. Static JSON cannot express "dev only", so the plugin entry
(`app.json:54-61`) is removed from `app.json` and re-added conditionally by a new
`client/app.config.js`:

```js
// client/app.config.js
// `app.json` stays the static base; Expo passes it in as `config`. Cleartext HTTP is a development
// affordance for the LAN API at eas.json's `development` profile — it must never reach a store build.
module.exports = ({ config }) => {
  const isDev = process.env.EAS_BUILD_PROFILE === "development" || process.env.NODE_ENV !== "production";
  if (!isDev) return config;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["expo-build-properties", { android: { usesCleartextTraffic: true } }]],
  };
};
```

Expo reads `app.config.js` after `app.json` and passes the static config in, so the two coexist
without duplication. No new dependency: `expo-build-properties` is already at `package.json:35`.

**Rejected**: two `app.json` files switched by a script — invisible at review and easy to desync.

### D4 — CLI-03: migrate to `parseApiError`, and pin the retry policy

Eight hooks end their catch with `if (error instanceof AxiosError) { throw {...} }` and no `else`, so
a non-Axios failure resolves the queryFn with `undefined`. React Query records it as a **success**
with `data: undefined`, and consumers written as `page!.data!` throw a `TypeError` during render.

The fix is not "add a trailing throw". All eight build their error from `parseErrorName`
(`services/errors.ts:8-13`), a bare status-to-name mapper. `parseApiError`
(`services/errors.ts:55-98`) is total — four exhaustive branches, never throws, always returns an
`ApiError` — and additionally recovers `errorCode`, the server's real message and `data`. Twenty-one
mutation hooks and one query (`useInvitation.ts:15`) already use it. So each catch collapses to the
existing house idiom:

```ts
  } catch (err) {
    throw parseApiError(err);
  }
```

**The logout trigger survives.** `useSelf.ts:36-40` fires on
`query.error?.name === ERROR_NAMES.UNAUTHORIZED`. `parseApiError` sets `name` via the same
`parseErrorName({ status })` for Axios errors (`errors.ts:72`), so a 401 still yields
`"UnauthorizedError"`. Its non-Axios branches return `name: "Error"` (`errors.ts:83`, `:91`), which
correctly does *not* log anyone out.

**The eight catch-less hooks get the same treatment** (`useCategories`, `useGlobalStats`,
`useNotifications`, `useUnreadMessages`, `useUnreadNotifications`, `useSchools`, `useWishes`,
`useResolveCommunity`). They do not crash today, but they leak raw `AxiosError` objects to consumers
so the error contract differs per hook. One contract, sixteen hooks.

**Retry policy is now load-bearing.** `api/queryClient.ts:6` is `new QueryClient()`, so React Query's
default `retry: 3` with exponential backoff applies. Failures that previously resolved as success now
throw, so they will retry three times (~7s) before `isError`, and the CLI-04/`useSelf` logout would
be delayed by the same amount. The client gains an explicit default:

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        (error as ApiError)?.name !== ERROR_NAMES.UNAUTHORIZED && failureCount < 2,
    },
  },
});
```

An expired session fails fast and logs out immediately; a transient network error still gets two
retries. `useInvitation.ts:29` and `useResolveCommunity.ts:25` already set `retry: false` locally and
keep it.

**The `page!.data!` consumers are cleaned up in the same change** — with the hooks throwing, the
queryFn return type stops including `undefined` and the assertions become unnecessary rather than
merely unsafe. Eight sites: `Search.tsx:42`, `Messages.tsx:28`, `Messages.tsx:30`, `Chat.tsx:43`,
`Offer.tsx:105`, `MyListingsList.tsx:15`, `MyPendingList.tsx:59`, `Notifications.tsx:18`.
`Feed.tsx:26` is already written safely and is left alone.

**Rejected**: keeping `parseErrorName` and adding a trailing `throw`. It fixes the crash while
preserving the loss of `errorCode`, and leaves two error shapes in the codebase forever.

### D5 — CLI-04: logout requires an authenticated, non-auth request

`api/loop.ts:63-69` logs the user out on *any* 401. A wrong password on `/auth/login` returns 401, so
a mistyped login destroys the session of whoever was already signed in; the same is true of any 401
from a public endpoint.

The predicate is derived from the failed request's own config, which axios attaches to the error:

```ts
const shouldLogout = (error: AxiosError) => {
  if (error.response?.status !== 401) return false;
  // A 401 on a request that carried no credentials says nothing about the stored session.
  if (!error.config?.headers?.Authorization) return false;
  // `/auth/*` 401s are credential verdicts (wrong password, unverified email), not session expiry.
  const path = (error.config.url ?? "").replace(/^https?:\/\/[^/]+/, "");
  return !path.startsWith("/auth/");
};
```

The `Authorization` header is set by the request interceptor at `api/loop.ts:37-44` only when a token
exists, so the header's presence is an exact proxy for "this request used the stored session". Both
conditions are required: `/auth/login` carries no header when logged out, but *does* carry one when
an already-signed-in user re-authenticates, and that 401 must not log them out either.

`applyRefreshedToken` behaviour (`api/loop.ts:66-69`) is unchanged: on a 401 the token is not
refreshed, on anything else it is.

### D6 — CLI-05: cards are fully fixable; push deep-linking is not, client-side

Two separate surfaces, and only one of them can be finished here.

**The notification cards can be fixed completely.** `components/cards/Notification.tsx` is a plain
`View` with no `onPress` (`:17-29`), but the rendered notification carries its full payload from the
database — `LoopNotificationPayload.listingId`, `DonationNotificationPayload.donorUserId`,
`MissionNotificationPayload.userMissionId` (`shared/types/app.d.ts:208-246`). A single pure resolver
maps a notification to a destination or `null`, and the card wraps in a `Pressable` only when a
destination exists:

| `notification.type` | Destination | Source field |
|---|---|---|
| `loop` | `/(main)/listing/[listingId]` | `payload.listingId` |
| `donation` | `/(main)/user/[userId]` | `payload.donorUserId` |
| `admin` with `target === "listing"` | `/(main)/listing/[listingId]` | `payload.referenceId` |
| `mission` | none — no mission detail route exists | — |

The resolver is a pure function in `client/services/notificationRoute.ts`, so it is unit-testable
without rendering, which is the only kind of test this repo supports (D10).

**Push tap routing cannot reach a specific listing or chat.** The audit's fix says map
"`categoryIdentifier` + data". There is no data: `server/api/src/services/expoNotifications.ts:20-27`
sends only `to`, `title`, `body` and `categoryId`. Every routing identifier
(`listingId`, `buyerId`, `donorUserId`) is written to Postgres by
`server/api/src/utils/notifications.ts` and never put on the wire.

So `contexts/notification.tsx:60-62`'s `console.log(response)` is replaced with the best routing the
available data supports, written to consume `data` when it eventually exists:

```
data.listingId present  → /(main)/listing/[listingId]
data.userId present     → /(main)/(tabs)/messages/[userId]
else categoryIdentifier === MESSAGE → /(main)/(tabs)/messages
else                                → /(main)/(tabs)/notifications
```

Today only the last two branches can fire; the first two are forward-compatible and start working the
day the server adds `data`. That server change is **recorded as a cross-block follow-up**, not done
here — this change touches no server file. Routing to the notifications tab is a genuine improvement
over `console.log` and is honest about what the payload supports.

**Rejected**: adding `data` to the push sender in this change. It is a server edit in a
client-scoped block, and it needs its own review of what identifiers are safe to put in a push
payload that transits Expo's servers.

### D7 — CLI-06: confirmed, reframed, and scoped to what is actually safe

The bundle inclusion is real and now proven: `metro.config.js` enables no tree-shaking, Metro does no
cross-module dead-code elimination, and `app.json:36` exports the web build statically. All 22 files
of `client/demo/` and the reachable `shared/demo-data` modules ship in every bundle.

The audit's remedy does not survive contact with the code:

- Demo mode is a **shipped production feature** reached from the Landing link
  (`components/screens/Landing.tsx:109-120` → `useLoginForm.ts:71-75`), documented in `DEMO.md`
  ("no es una instancia aparte ni un build especial").
- `EXPO_PUBLIC_DEMO_MODE` is read once (`config.ts:48`) and set in no `eas.json` profile, so it is
  false in production. Gating the import on it deletes the feature.
- `"Demo1234!"` is deliberately public — `shared/demo-data/buildCommunity.ts:135-138` says so and
  `DEMO.md` publishes it. There is no secret to protect.
- A lazy `import()` would make `enableDemoMode()` async. `stores/session.ts:13-18` and `:100-102`
  exist specifically to guarantee that demo mode is on in the same turn the token appears; an awaited
  chunk load reopens that window, and a slow or failed chunk sends demo traffic to the real API —
  the precise failure the design forbids.

What is left is small, real, and safe: `client/demo/handlers/auth.ts:10-15` ignores the password
entirely ("Cualquier credencial entra a la demo"), so `useLoginForm.ts:74` passing `DEMO_PASSWORD` is
dead weight. `DEMO_PASSWORD` has exactly one client consumer, so removing it also removes the
re-export chain at `demo/index.ts:28` and `demo/db/dataset.ts:15,24`, and application code stops
referencing a credential at all. A source guard keeps it that way.

Bundle-size reduction requires a separate web entry point and is recorded as a follow-up.

### D8 — CLI-07: four unrelated one-liners

| Site | Change |
|---|---|
| `components/ModifyListing.tsx:130-132` | `["listing", { listingId: initialData?.id }]` → `["listing", initialData?.id]`, matching `useListing.ts:22`. Today it matches nothing and only appears to work because `router.back()` remounts the screen |
| `api/loop.ts:8` | `withCredentials: true` deleted. The API is bearer-token authenticated (`api/loop.ts:37-44`); sending cookies cross-origin adds a CORS credentials requirement for no benefit |
| `config.ts:43` | `FILE_BASE_URL = API_URL + "/uploads/"` yields the literal `"undefined/uploads/"` when the env var is missing. It derives from the guarded value instead |
| `config.ts:44-45` | The two unconditional `console.log`s deleted. They print the API URL on every boot in every build — and, as observed, inside every test run |

The env guard is the one with a blast radius. `API_URL` becomes a checked read that throws at module
load when `EXPO_PUBLIC_API_URL` is absent, which is a build failure for a static export. **This
requires fixing `eas.json` in the same change**: the `preview` profile (`eas.json:17-20`) defines no
`EXPO_PUBLIC_API_URL` and would start failing. It gains one.

`Debug.tsx:75-77` reads `API_URL` and `FILE_BASE_URL` and still works — the guard throws only when
the value is genuinely absent, which is now impossible in a configured build.

### D9 — CLI-09: three unrelated exposures

**`/debug`.** `app/_layout.tsx:93` declares `<Stack.Screen name="debug" />` outside both
`Stack.Protected` guards (`:77-92`), so it is public and unauthenticated, and `Debug.tsx:89` dumps
the whole user object as JSON. The screen is genuinely useful in development, so it is not deleted —
it is wrapped in `<Stack.Protected guard={__DEV__}>`. `__DEV__` is `false` in every production build
on both platforms, and Metro replaces it with a literal so the branch is statically dead.

**Service worker.** `public/sw.js:22-38` is stale-while-revalidate over every `basic` response.
Today the web app and the API are on different origins, so API responses are `cors` and not `basic`
and are not cached — but that is an accident of deployment, not a guarantee, and the audit is right
that a same-origin deployment would cache `/me`. The `fetch` handler returns early for any request
whose path starts with `/api` and for any non-`GET` method. The second guard is worth having on its
own: `respondWith` currently wraps every method. The `.catch(() => cachedResponse)` at `:35` can
resolve to `undefined` and reject `respondWith`; it is left alone as pre-existing and recorded.

**`showAlert`.** `Alert.alert` is a no-op on React Native Web, so three sites are silently dead in
the browser: `ReportButton.tsx:84`, `AllowedDomainsNotice.tsx:36`, `useMailComposer.ts:16`. The
repo already has a cross-platform notifier — `useToast()` (`ToastProvider.tsx:60-66`), mounted app-
wide at `app/_layout.tsx:75` and built on `Animated`/`StyleSheet` rather than NativeWind, so it
renders identically on both platforms.

The gap is that `Alert.alert` supports action buttons and `Toast` does not. `showAlert` therefore has
an explicit two-tier contract rather than pretending to be `Alert.alert`:

```ts
// client/services/showAlert.ts
type AlertAction = { text: string; onPress?: () => void; style?: "cancel" };
export function showAlert(title: string, message: string, actions?: AlertAction[]): void;
```

- **Native** — delegates to `Alert.alert` verbatim. Zero behaviour change.
- **Web, no actions** — `showToast(\`${title}. ${message}\`, "error")`.
- **Web, with actions** — the non-cancel actions cannot be rendered by a toast, so the *caller*
  degrades rather than the service guessing. Both action-bearing sites already have a better web
  path: `useMailComposer` owns `MailFallbackSheet` (rendered at `ReportButton.tsx:105`) and can set
  `manualCopyText` directly, and `AllowedDomainsNotice` can copy to the clipboard immediately and
  confirm with a toast. `showAlert` invokes the first non-`cancel` action and shows the message,
  which is the behaviour those two sites want anyway.

`showAlert` is a plain function, not a hook, so it is callable from `useMailComposer`'s non-component
scope. It reads the toast through the module-scope emitter that `ToastProvider` already subscribes to
(`onGlobalApiError`/`showToast` at `ToastProvider.tsx:16-34`), avoiding a hook-order dependency.

**No new user-facing copy.** All three sites keep their existing Rioplatense strings verbatim —
`"No disponible"`, `"No hay un correo de denuncia configurado por ahora."`,
`"No se pudo abrir la app de correo"`, `"Escribinos a …"`, `"Copiar mail"`, `"Cerrar"`,
`"Escribí manualmente a … con el mensaje."`, `"Copiar manual"`, `"Compartir texto"`. This change
introduces zero new Spanish strings anywhere.

### D10 — CLI-12: real tests without a rendering library

`package.json:11` becomes `"test": "jest --ci"`. `--ci` alone does not disable watch mode in every
jest version, so the script is `jest --ci --watchAll=false`, which is exactly the command the repo
already uses by hand.

Two facts bound what can be tested. There is no `@testing-library/react-native` and no test renders a
component; and jest has **no `moduleNameMapper`**, so `@/` does not resolve and every new test must
import relatively, as all seven existing tests do.

Nothing in this change needs a rendered component, so no dependency is added:

| Target | How |
|---|---|
| `api/loop.ts` 401 predicate | Extract `shouldLogout(error)` (D5) as a named export and table-test it: 401 with header on `/listings`, 401 with header on `/auth/login`, 401 without header, 403 with header, network error with no response |
| `api/loop.ts` interceptor wiring | Invoke the registered rejection handler directly and assert `useSessionStore.getState().logout` is called only in the expected case, with `async-storage`'s shipped jest mock backing the store |
| `stores/session.ts` | Drive `login`/`setUser`/`enterDemoMode`/`logout` through `getState()` and assert theme sync, `queryClient.clear()`, and that `disableDemoMode` runs **last** in `logout` — the ordering `DEMO.md` depends on |
| `stores/session.ts` persistence | Assert `partialize` emits exactly `{authToken, hasAcceptedTerms, hasToken, demoMode}` and that its serialized form stays under the 2048-byte SecureStore limit |
| CLI-03 hook error path | The catch is now a one-liner, so test the contract instead: `parseApiError` over a non-Axios throwable returns `{name: "Error"}`, and a 401 Axios error returns `name === ERROR_NAMES.UNAUTHORIZED` — the exact value `useSelf.ts:37` compares |
| CLI-03 uniformity | Source guard over `walkTsFiles(hooks/)`: no file contains `instanceof AxiosError`, and every `catch` in `hooks/` is followed by `throw parseApiError` |
| CLI-05 routing | `notificationRoute(notification)` table test across all four types plus the missing-payload cases |
| CLI-06 | Source guard: `DEMO_PASSWORD` appears nowhere under `client/` outside `client/demo/` |
| CLI-02 | Assert `app.json` declares no `RECORD_AUDIO` and no `usesCleartextTraffic`, and that `app.config.js` adds it only for the dev profile |
| CLI-13 | `missionProgressPercent(current, total)` table test: `0/0`, `1/0`, `3/4`, `9/4` clamp to `[0,100]` |

The store and interceptor tests need `jest.mock("@react-native-async-storage/async-storage", () => require("…/jest/async-storage-mock"))` and a `jest.mock("expo-secure-store", …)` stub. Rather than a
`setupFiles` entry that would apply to all 7 existing suites, both mocks are declared inline in the
two suites that need them — narrower blast radius on a green baseline.

**Rejected**: adding `@testing-library/react-native`. Nothing in this change requires rendering, and
a new test dependency in a change whose block explicitly excludes dependency work (CLI-10 belongs to
`delivery-and-ci`) is scope creep. `expo-secure-store` is the one unavoidable addition.

### D11 — CLI-13: two one-liners, nothing else

`services/registerPushNotifications.ts:32` — `"Error getting push token: " + error` renders
`"[object Object]"` for any non-string throwable and discards the stack. It becomes an `Error` with a
`cause`, and the message uses the same `parseApiError`-style extraction the rest of the client uses.

`components/cards/Mission.tsx:30` — `(current / total) * 100` yields `NaN` for `0/0` and `Infinity`
for `n/0`, both invalid CSS widths, and this renders inside the notification list via
`Notification.tsx:85`. It is extracted as a pure `missionProgressPercent(current, total)` that
returns `0` when `total <= 0` and clamps to `[0, 100]` — extracted, not inlined, so D10 can test it.

## Data Flow

```
stores/session.ts  ──persist──→  services/secureStorage.ts
                                   ├─ web    → AsyncStorage (unchanged)
                                   └─ native → expo-secure-store (+ one-time AsyncStorage migration)
      │
      ├─ logout() → useThemeStore.clear() → queryClient.clear() → disableDemoMode()   (order preserved)
      └─ demoMode ──rehydrate──→ enableDemoMode()                                      (same turn, sync)

api/loop.ts  request  → Authorization header when a token exists
             response → shouldLogout(error) ─true─→ session.logout()
                                            └false→ reject, unchanged
      │
      └─ demoAwareAdapter (untouched — never delegates when enabled)

hooks/*.ts  catch → parseApiError(err) → throw → React Query error
                                                    ├─ retry policy (not UNAUTHORIZED, < 2)
                                                    └─ useSelf.ts:37 → logout on UnauthorizedError

notification tap ──→ services/notificationRoute.ts ──→ router.push(destination | notifications tab)
notification card ─┘
```

## File Changes

| File | Action |
|---|---|
| `client/package.json` | Modify — `"test": "jest --ci --watchAll=false"`, add `expo-secure-store@~15.0.8` |
| `client/services/secureStorage.ts` | Create — D1 |
| `client/stores/session.ts` | Modify — `storage`, `partialize` (D1) |
| `client/components/buttons/GoogleSignInButton.tsx` | Modify — credential in memory (D2) |
| `client/app.json` | Modify — drop `RECORD_AUDIO` and the cleartext plugin (D3) |
| `client/app.config.js` | Create — dev-only cleartext (D3) |
| `client/eas.json` | Modify — `preview` gains `EXPO_PUBLIC_API_URL` (D8) |
| `client/hooks/` × 16 | Modify — `throw parseApiError(err)` (D4) |
| `client/api/queryClient.ts` | Modify — retry policy (D4) |
| `client/api/loop.ts` | Modify — `shouldLogout`, drop `withCredentials` (D5, D8) |
| `client/components/screens/{Search,Messages,Chat,Offer}.tsx`, `MyListingsList.tsx`, `MyPendingList.tsx`, `screens/Notifications.tsx` | Modify — drop `page!.data!` (D4) |
| `client/services/notificationRoute.ts` | Create — D6 |
| `client/contexts/notification.tsx` | Modify — tap routing (D6) |
| `client/components/cards/Notification.tsx` | Modify — `Pressable` when a destination exists (D6) |
| `client/hooks/useLoginForm.ts`, `client/demo/index.ts`, `client/demo/db/dataset.ts` | Modify — drop `DEMO_PASSWORD` (D7) |
| `client/components/ModifyListing.tsx` | Modify — query key (D8) |
| `client/config.ts` | Modify — env guard, `FILE_BASE_URL`, delete logs (D8) |
| `client/app/_layout.tsx` | Modify — `/debug` behind `__DEV__` (D9) |
| `client/public/sw.js` | Modify — exclude `/api` and non-`GET` (D9) |
| `client/services/showAlert.ts` | Create — D9 |
| `client/components/ReportButton.tsx`, `AllowedDomainsNotice.tsx`, `hooks/useMailComposer.ts` | Modify — use `showAlert` (D9) |
| `client/services/registerPushNotifications.ts` | Modify — error message (D11) |
| `client/components/cards/Mission.tsx` | Modify — `missionProgressPercent` (D11) |
| `client/__tests__/*.test.ts` | Create — D10 |

## Testing Strategy

| Layer | What | Command |
|---|---|---|
| Regression | 721-test baseline must stay green | `cd client && npx jest --ci --watchAll=false` |
| Unit (pure) | `shouldLogout`, `parseApiError` contract, `notificationRoute`, `missionProgressPercent`, `partialize` shape | same |
| Integration (headless) | Session store transitions and the `api/loop.ts` rejection handler, with the shipped async-storage jest mock | same |
| Source guards (`fs`) | No `instanceof AxiosError` in `hooks/`; no `DEMO_PASSWORD` outside `client/demo/`; no `RECORD_AUDIO`/`usesCleartextTraffic` in `app.json`; no `console.log` in `config.ts` | same |
| E2E | Playwright `e2e/` — expected green and untouched: the suites drive the API fixture (`loginUser(api, …)`), not the client UI | `cd e2e && npx playwright test` |
| Manual | Upgrade migration, demo mode end to end, wrong-password login, notification tap, `/debug` absence in a production web export, web alert visibility | see tasks |

`npm run lint` is broken pre-existing (`expo lint` → `ERR_UNSUPPORTED_DIR_IMPORT` under Node 24) and
is **not** a gate. Formatting is Prettier: 2-space, double quotes, trailing commas, 100 columns.

## Threat Matrix

This change is entirely about trust boundaries, so the matrix is the point rather than an appendix.

| Boundary | Before | After |
|---|---|---|
| Session token at rest (native) | Plaintext `AsyncStorage` — readable on a rooted/jailbroken device and by any process with app-data access | Keychain / Android Keystore via `expo-secure-store` |
| Session token at rest (web) | `localStorage` | Unchanged — browser origin isolation is the boundary; noted, not fixed here |
| Google ID token at rest | Plaintext `AsyncStorage`, never deleted until the flow completes | Never written to disk |
| Android transport | Cleartext HTTP permitted in every build | Permitted only in `development` builds |
| Android permissions | `RECORD_AUDIO` requested, never used | Not requested |
| Debug surface | `/debug` public in production, dumps the user object | Unreachable outside `__DEV__` |
| Service worker cache | Cache-first over every `basic` GET | `/api` and non-`GET` excluded |
| Session lifetime | Any 401 anywhere destroys the session | Only an authenticated non-`/auth/*` 401 |
| Demo credential in app code | `useLoginForm.ts:5` imports it | Removed; guarded by a source test |
| Demo module in bundle | Ships unconditionally | **Unchanged** — deliberate, see D7; recorded as a follow-up |

## Migration / Rollout

One PR on `fix/auditoria-2026-09`. The only state migration is the session key move (D1), which is
read-through, idempotent, and native-only; web users are unaffected because their backend does not
change. There is no server change and no database change, so rollback is a revert with no cleanup —
except that users who launched the new build once will have their session in SecureStore, and a
revert would log them out. That is the single non-symmetric step and it is called out in the tasks.

## Open Questions

- [ ] None blocking. The one decision a human may want to overrule is D7: this change deliberately
      does **not** remove the demo module from the production bundle, because doing so removes a
      shipped feature. If the intent was to drop the production demo entirely, that is a product
      decision and a different change.

## Recorded Follow-ups (not fixed here)

- **Server: put routing identifiers in the push payload.** `expoNotifications.ts:20-27` sends no
  `data`, so push deep-linking cannot work. D6's client resolver is already written to consume it.
- `server/api/src/services/expoNotifications.ts:20` — `sendPushNotificationsAsync` is not awaited
  inside an `async` function; failures are silently dropped.
- `hooks/useNotifications.ts:4-7` — `fetchNotifications` ignores `pageParam` and always GETs page 1,
  so `fetchNextPage` loops forever on the same page.
- `components/screens/Notifications.tsx:60` — `FlatList` has no `keyExtractor`.
- `public/sw.js:35` — `.catch(() => cachedResponse)` can resolve `undefined` and reject
  `respondWith`, surfacing as a network error offline.
- `public/sw.js` has no `push`/`notificationclick` listener, so web push cannot be received at all.
- Demo module bundle size — needs a separate web entry point; see D7.
- `react-test-renderer@19.0.0` vs `react@19.1.0` mismatch — CLI-10, `delivery-and-ci`.
- Route strings are inconsistently group-prefixed (`"/listing/[listingId]"` at
  `ModifyListing.tsx:123` vs `"/(main)/listing/[listingId]"` at `cards/Listing.tsx:54`); a shared
  route builder would be worth it if deep-linking grows.
- `ModifyListing.tsx:121-127` — the `create` branch navigates away without invalidating `["listings"]`.
- Web `localStorage` remains the session store on web; a real fix is httpOnly cookies and a server change.
