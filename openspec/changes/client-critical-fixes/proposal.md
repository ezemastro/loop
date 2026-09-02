# Proposal: Client Critical Fixes

## Intent

Block D of the 2026-09 audit (`AUDITORIA-2026-09.md` §6). The Expo client currently persists the
session JWT in plaintext storage, ships a debug route and a mock API to production, hard-crashes
screens when a non-Axios failure reaches a query hook, and logs the user out on any 401 including a
mistyped password. These are correctness and exposure defects in code that already shipped — not
new features. This change closes the Critical and High items plus the cheap Medium/Low ones, and
deliberately leaves the structural items (polling, dependency alignment, virtualisation) to their
own blocks.

Every finding below was re-read in the source before being specified. Where the audit was wrong,
the correction is recorded in "Corrections to the Audit" and the spec follows the code, not the
audit.

## Scope

### In Scope

| Audit ID | Sev | What lands here |
|---|---|---|
| CLI-01 | Critical | `expo-secure-store` as the `persist` storage on native, `AsyncStorage` retained on web; the raw Google credential never written to disk |
| CLI-02 | Critical | `RECORD_AUDIO` removed; `usesCleartextTraffic` moved to a dev-only build profile |
| CLI-03 | Critical | Query hooks throw `parseApiError` unconditionally; the `page!.data!` crash class removed |
| CLI-04 | High | Logout only when the failed request carried `Authorization` and its path is not `/auth/*` |
| CLI-05 | High | Notification tap and notification card route to the listing or the chat |
| CLI-06 | High | Demo credential removed from application code; demo bundle inclusion documented and guarded (see corrections — the audit's proposed fix is invalid here) |
| CLI-07 | High | Unified `listing` query key; `withCredentials` dropped; `FILE_BASE_URL` no longer concatenates `undefined`; boot `console.log` removed |
| CLI-09 | Medium | `/debug` gated outside development; service worker excludes `/api`; a cross-platform `showAlert` replaces no-op `Alert.alert` calls on web |
| CLI-12 | Medium (partial) | `jest --ci` replaces `jest --watchAll`; real tests for `api/loop.ts` interceptors, `stores/session.ts`, and the CLI-03 hook error path |
| CLI-13 | Low (partial) | Only the two one-liners: `"[object Object]"` in `registerPushNotifications.ts`, division by zero in `cards/Mission.tsx` |

### Out of Scope

Stated explicitly so a reviewer does not read an omission as an oversight:

- **CLI-08** — polling, `refetchInterval`, "since" endpoints, SSE/WebSocket. This change touches
  `useMessages.ts` only in its `catch` block; its 5-second `refetchInterval` (`:31`) is left alone.
- **CLI-10** — dependency alignment and the Expo 57 track. Block `delivery-and-ci` owns dependency
  bumps. The one exception is additive and unavoidable: `expo-secure-store` is a **new** dependency
  required by CLI-01, pinned to the SDK 54 value.
- **CLI-11** — virtualisation, `Home`/`Feed` render cost, `setNotificationHandler` placement,
  `Dimensions.get` module reads, non-null-assertion cleanup beyond the CLI-03 crash sites.
- **The rest of CLI-13** — accessibility labels, per-route `<title>`, register copy consistency,
  orphan assets, `eas.json` LAN IP and duckdns domain, the 6-character password minimum,
  `orientation: portrait`.
- **All legal/public routes** — block `legal-public-routes` (ADM-01, SEC-11, PROD-05).
- Any server change. The client is the only package touched.

## Capabilities

`openspec/specs/` is empty, so every capability below is new.

### New Capabilities

- `client-credential-storage` — where the session token and the OAuth credential are allowed to live.
- `client-api-error-contract` — how a failed request becomes a React Query error, and when a failure logs the user out.
- `client-notification-actions` — what a push notification and a notification card do when tapped.
- `client-build-hardening` — what ships in a production build and which configuration is allowed to be absent.
- `client-demo-isolation` — the boundary between the demo module and application code.
- `client-cross-platform-feedback` — user-visible feedback that must work on native and web alike.

### Modified Capabilities

- None.

## Approach

**CLI-01 is a platform split, not a swap.** `expo-secure-store` has no web implementation, so
`createJSONStorage(() => AsyncStorage)` at `stores/session.ts:95` becomes a storage object chosen by
`Platform.OS`: SecureStore on iOS/Android, `AsyncStorage` on web (where the browser already denies
cross-origin access to it). The persisted payload must shrink to the token and the flags, because
SecureStore has a per-value size limit on Android and the store currently persists the whole
`PrivateUser`. `partialize` is therefore part of the fix, not an optimisation.

**CLI-03 changes more than the audit says.** The eight affected hooks do not call `parseApiError` at
all — they hand-build `{name, message}` from `parseErrorName`. Making the throw unconditional while
keeping `parseErrorName` would fix the crash but keep losing `errorCode` and the server's message,
so the hooks move to `parseApiError`, matching the 21 mutation hooks and the one query
(`useInvitation.ts:15`) that already does it. Because `api/queryClient.ts:6` is a bare
`new QueryClient()`, React Query's default `retry: 3` now applies to failures that used to resolve
silently — the retry policy is specified rather than left to default.

**CLI-02 needs a config file, not a config edit.** `app.json` is static JSON and cannot express
"cleartext only in dev". The change adds an `app.config.js` that receives the `app.json` config and
appends `expo-build-properties` with `usesCleartextTraffic` only when the build profile is
`development`.

**CLI-06 is reframed.** The bundle inclusion is confirmed, but the audit's remedy would delete a
shipped production feature. See corrections below.

**Reuse over invention.** The tests follow the established idiom in `client/__tests__/` — pure
functions plus `fs` source guards over `walkTsFiles` — so no rendering library is added.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/stores/session.ts` | Modified | Platform-split persist storage, `partialize` |
| `client/services/secureStorage.ts` | New | The `StateStorage` implementation chosen per platform |
| `client/components/buttons/GoogleSignInButton.tsx` | Modified | Credential held in memory only |
| `client/app.json` | Modified | `RECORD_AUDIO` and the cleartext plugin entry removed |
| `client/app.config.js` | New | Dev-profile-only `expo-build-properties` |
| `client/eas.json` | Modified | `preview` profile gains the API URL the build guard requires |
| `client/hooks/*.ts` (8 hooks + 8 catch-less) | Modified | `throw parseApiError(error)` |
| `client/api/loop.ts` | Modified | Scoped 401 logout, `withCredentials` dropped |
| `client/api/queryClient.ts` | Modified | Explicit retry policy |
| `client/config.ts` | Modified | Env guard, `FILE_BASE_URL`, boot logs removed |
| `client/components/ModifyListing.tsx` | Modified | Query key unified with `useListing.ts:22` |
| `client/contexts/notification.tsx`, `components/cards/Notification.tsx` | Modified | Tap routing |
| `client/services/registerPushNotifications.ts` | Modified | `"[object Object]"` |
| `client/app/_layout.tsx` | Modified | `/debug` gated |
| `client/public/sw.js` | Modified | `/api` excluded from cache-first |
| `client/services/showAlert.ts` | New | Cross-platform alert |
| `client/components/cards/Mission.tsx` | Modified | Division by zero |
| `client/package.json` | Modified | `jest --ci`, `expo-secure-store` |
| `client/__tests__/` | New files | Interceptor, session store, hook error path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SecureStore migration logs every existing user out | High | Read-through migration from `AsyncStorage` on first launch, then delete the old key |
| SecureStore Android per-value size limit rejects the payload | Med | `partialize` to token + flags; assert the serialized size in a test |
| Scoped logout (CLI-04) leaves a genuinely expired token in place | Med | The `Authorization`-header condition still covers every authenticated request; only `/auth/*` and anonymous calls are exempt |
| CLI-03 surfaces errors that were previously invisible, so screens that "worked" now show error states | High | This is the intended behaviour; visual readback on every affected screen is a task |
| Default `retry: 3` delays the CLI-04 logout by ~7s | Med | Explicit retry policy that does not retry `UnauthorizedError` |
| Removing cleartext breaks Android dev builds against `http://192.168.1.37:3000` | High | The dev profile keeps cleartext via `app.config.js` |
| Demo mode regressions (adapter, hydration ordering, theme/cache cleanup) | High | Demo isolation guarantees are specified as scenarios; `enableDemoMode`/`disableDemoMode` call order in `session.ts:78-81` is preserved verbatim |
| Community theming or logout cleanup breaks | Med | `syncCommunityTheme`, `queryClient.clear()` and `useThemeStore.clear()` ordering is unchanged and covered by a test |
| `preview` EAS profile fails the new env guard | High | `eas.json` `preview` gains `EXPO_PUBLIC_API_URL` in the same change |

## Rollback Plan

Single PR, single branch `fix/auditoria-2026-09`, revertable as one commit range. The three riskiest
edits have independent toggle points: `client/services/secureStorage.ts` (swap the factory back to
`AsyncStorage`), `client/api/loop.ts` (restore the unconditional 401 branch), and `app.config.js`
(delete the file to fall back to `app.json` alone). No data migration on the server; the only client
state migration is the session key move, which is read-through and idempotent.

## Dependencies

- `expo-secure-store@~15.0.8` — new, pinned from `client/node_modules/expo/bundledNativeModules.json:77`.
- `expo-build-properties@~1.0.10` — **already** a dependency (`client/package.json:35`) and installed.
- No new test dependency: `@react-native-async-storage/async-storage/jest/async-storage-mock` ships
  with the installed package, so the store and interceptor tests run under the existing `jest-expo`
  preset without `@testing-library/react-native`.
- Test command is `cd client && npx jest --ci --watchAll=false`; baseline is **721 tests / 7 suites
  passing**. `npm run test` never terminates today — that is CLI-12.

## Corrections to the Audit

Each was verified in the source. Where they conflict, the code wins.

1. **CLI-03 says ten hooks; it is eight.** `useUser.ts:18` and `useUsers.ts:21` already end their
   catch with a bare `throw err;` and never return `undefined`. The eight that do are `useSelf`,
   `useListings`, `useListing`, `useMyListings`, `useMessages`, `useMissions`, `usePublicWishes`,
   `useChats`.
2. **CLI-03's proposed fix names the wrong function.** The eight hooks use `parseErrorName`
   (`services/errors.ts:8-13`), a status-to-name mapper, not `parseApiError`
   (`services/errors.ts:55-98`). "Throw unconditionally" alone would preserve the loss of
   `errorCode`, the server message and `data`.
3. **CLI-03 misses an adjacent class.** Eight further query hooks have no `try/catch` at all, so a
   raw `AxiosError` reaches consumers un-normalised: `useCategories`, `useGlobalStats`,
   `useNotifications`, `useUnreadMessages`, `useUnreadNotifications`, `useSchools`, `useWishes`,
   `useResolveCommunity`. Three of them compound it with `response.data.data!` assertions
   (`useCategories.ts:7`, `useSchools.ts:18`, `useResolveCommunity.ts:8`).
4. **CLI-03 names two consumers; there are eight.** Beyond `Search.tsx:42` and `Messages.tsx:28`:
   `Chat.tsx:43`, `Messages.tsx:30`, `Offer.tsx:105`, `MyListingsList.tsx:15`,
   `MyPendingList.tsx:59`, and `Notifications.tsx:18`. Only `Feed.tsx:26` is written safely.
5. **"Mutations already do this" holds for 21 of 24.** The three `useWishes.ts` mutations
   (`:22-31`, `:36-45`, `:58-67`) have no catch and never call `parseApiError`.
6. **CLI-04's line reference is wrong.** The blanket 401 logout is `api/loop.ts:63-69`, not
   `51-66`; `51-56` is `applyRefreshedToken`.
7. **CLI-01's line reference is off by one.** The persist storage is `stores/session.ts:95`
   (`storage: createJSONStorage(() => AsyncStorage)`), in the config block at `93-103`.
8. **CLI-06's proposed fix is invalid for this repo, and the finding is mis-attributed.**
   - The bundle inclusion is **confirmed**: `client/metro.config.js` sets no `inlineRequires` and no
     `unstable_*` flags, Metro performs no cross-module tree-shaking, and `app.json:36` exports web
     statically — so all 22 files of `client/demo/` and the reachable `shared/demo-data` ship in
     every bundle.
   - There are **three** static imports, not two. The audit misses
     `client/hooks/useLoginForm.ts:5`, which is the *production* demo entry point behind the
     Landing link (`components/screens/Landing.tsx:109-120`).
   - `EXPO_PUBLIC_DEMO_MODE` is read in exactly one place (`config.ts:48`) and is set in **no**
     `eas.json` profile. Gating the import on it would delete the production demo documented in
     `DEMO.md` ("no es una instancia aparte ni un build especial").
   - `"Demo1234!"` is **deliberately public**: `shared/demo-data/buildCommunity.ts:135-138` says so
     in a comment and `DEMO.md` publishes it. The audit's `*(a confirmar)*` on credential leakage
     resolves to "not a secret". The real cost is bundle weight and a shipped mock API surface.
   - The one real, safe win: `client/demo/handlers/auth.ts:10-15` **ignores the password entirely**
     ("Cualquier credencial entra a la demo"), so `useLoginForm.ts:62` passing `DEMO_PASSWORD` is
     dead weight. `DEMO_PASSWORD` has exactly one client consumer; removing it lets the re-export
     chain (`demo/index.ts:28`, `demo/db/dataset.ts:15,24`) go too, and application code stops
     referencing a credential. Bundle-size reduction requires an entry-point split and is deferred.
9. **CLI-02 has a hidden dependency.** `eas.json:12` points the `development` profile at
   `http://192.168.1.37:3000`. Removing cleartext outright breaks Android dev builds, so the
   dev-profile carve-out is mandatory. `expo-build-properties` is already installed, so no new
   package is needed for it.
10. **CLI-07's build guard conflicts with an existing profile.** The `preview` profile
    (`eas.json:17-20`) defines no `EXPO_PUBLIC_API_URL`. Failing the build on a missing value breaks
    `preview` unless that profile is fixed in the same change.
11. **CLI-07's file path is wrong.** `ModifyListing.tsx` is at `client/components/ModifyListing.tsx`,
    not `client/components/screens/`. The mismatched invalidation is at `:129-132`.
12. **CLI-12 needs no new test dependency.** The audit implies `@testing-library/react-native` is
    required. `async-storage`'s jest mock is already installed and the repo's existing idiom
    (pure functions plus `fs` source guards via `__tests__/helpers/sourceFiles.ts`) covers the
    interceptors, the store and the hook error path without rendering a component.

## Size Forecast and Delivery

Forecast: **~900–1100 changed lines**, the bulk of it mechanical (16 hook catch blocks) and tests.
Delivery is `single-pr` on one branch, `fix/auditoria-2026-09`, with the `exception-ok` allowance
already granted for this session. Chained PRs are **not** recommended: the CLI-03 hook edits and
their consumer readback are one atomic correctness change, and splitting CLI-01 from its migration
test would ship a user-logout regression behind a green build.

## Success Criteria

- [ ] On iOS/Android the session token is readable only through SecureStore; on web the behaviour is unchanged.
- [ ] An existing logged-in user survives the upgrade without being logged out.
- [ ] No raw Google credential is ever written to persistent storage.
- [ ] A production Android build declares no `RECORD_AUDIO` and no `usesCleartextTraffic`; a `development` build still reaches `http://192.168.1.37:3000`.
- [ ] Every query hook surfaces a failure as `isError`, never as `data: undefined` with `isSuccess`.
- [ ] A wrong password on `/auth/login` shows an error and does **not** log the user out.
- [ ] Tapping a notification opens the listing or the chat it refers to.
- [ ] `/debug` is unreachable in a production build.
- [ ] `ReportButton`, `AllowedDomainsNotice` and `useMailComposer` show visible feedback on web.
- [ ] Demo mode still works end to end: the Landing link, the read-only guard, the rehydration path, and logout cleanup.
- [ ] `cd client && npm test` terminates.
- [ ] `cd client && npx jest --ci --watchAll=false` passes with the 721-test baseline intact plus the new suites.
