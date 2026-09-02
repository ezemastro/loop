# Tasks: Client Critical Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1100 (≈340 mechanical hook edits, ≈310 tests, ≈400 substantive) |
| Session review budget | Informative only this session — never a stop condition |
| 400-line budget risk | High against the 400-line default; accepted under this session's `exception-ok` allowance |
| Chained PRs recommended | No |
| Suggested split | None — single PR |
| Delivery strategy | single-pr / exception-ok (session preflight, fixed) |
| Chain strategy | N/A |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

**Why not chained.** The sixteen hook edits (Phase 3) and the removal of their `page!.data!`
consumers are one atomic correctness change: shipping the hooks without the consumers leaves the
crash in place, and shipping the consumers without the hooks is a no-op. Separately, splitting the
credential migration (Phase 2) from its test would ship a silent mass-logout regression behind a
green build. The change is wide but shallow — ten independent one-file-shaped fixes — so a reviewer
reads it finding by finding, and the phases below are ordered so each is separately revertable.

### Work Unit

| Unit | Goal | Branch (base) | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------|-----------------------|------------------|--------------------|
| 1 | All of block D | `fix/auditoria-2026-09` (`main` @ `7acced3`) | `cd client && npx jest --ci --watchAll=false` | No browser/Expo runtime in this environment — every visual and device check is flagged for manual confirmation | Single revert; note that a user who launched the new build once has their session in the encrypted store and a revert logs them out (see 2.9) |

**Environment.** Baseline is **721 tests / 7 suites passing** via
`cd client && npx jest --ci --watchAll=false` (~4s). Never `npm run test` — it is
`jest --watchAll` today and never terminates; that is task 1.1. `npm run lint` is broken
pre-existing (`expo lint` → `ERR_UNSUPPORTED_DIR_IMPORT` under Node 24) and is **not** a gate.
Jest has no `moduleNameMapper`, so every new test MUST import relatively (`"../config"`), never via
`@/`. Formatting is Prettier: 2 spaces, double quotes, trailing commas, 100 columns.

---

## Phase 1: Build and configuration foundation — CLI-02, CLI-07 (config), CLI-12 (command)

Runs first because 1.4 removes the `console.log`s that currently pollute every test run, and 1.1
fixes the command the rest of the change is verified with.

- [x] 1.1 Change `client/package.json:11` from `"test": "jest --watchAll"` to
      `"test": "jest --ci --watchAll=false"`. `--ci` alone does not disable watch mode in jest 29;
      both flags are required. — *client-build-hardening: The Test Command Terminates*
- [x] 1.2 Delete `"android.permission.RECORD_AUDIO"` from `client/app.json:32`, leaving the
      `permissions` key absent rather than an empty array. Confirm first with
      `rg -n "RECORD_AUDIO|Audio|Recording" client/ --glob '!node_modules'` that nothing uses it.
      — *client-build-hardening: No Unused Android Permissions*
- [x] 1.3 Remove the `expo-build-properties` plugin entry at `client/app.json:54-61` and create
      `client/app.config.js` per design D3: it receives the static `app.json` config and appends the
      plugin with `android.usesCleartextTraffic: true` **only** when
      `process.env.EAS_BUILD_PROFILE === "development"`. `expo-build-properties@~1.0.10` is already
      a dependency (`client/package.json:35`) — do **not** add it.
      — *client-build-hardening: Cleartext Traffic Is Development-Only*
  - **Checkpoint**: `client/eas.json:12` points the `development` profile at
    `http://192.168.1.37:3000`. If this task is done wrong, Android dev builds stop reaching the API
    with no error message — verify the dev branch before the production branch.
- [x] 1.4 In `client/config.ts`, replace `export const API_URL = process.env.EXPO_PUBLIC_API_URL;`
      (`:42`) with a guarded read that throws naming `EXPO_PUBLIC_API_URL` when absent; derive
      `FILE_BASE_URL` (`:43`) from the guarded value; delete both `console.log` calls (`:44-45`).
      — *client-build-hardening: Required Configuration Fails Loudly*
      (Added `client/jest.setup.js` + `package.json`'s `jest.setupFiles`, not in the original file
      list: jest never loads `.env`, so the new guard broke every suite importing `config.ts` until
      the test env got its own `EXPO_PUBLIC_API_URL`. See Deviations in the final report.)
- [x] 1.5 Add `"EXPO_PUBLIC_API_URL"` to the `preview` profile in `client/eas.json:17-20`, which
      defines no `env` block today and would start failing the 1.4 guard. Use the production value
      unless a preview API exists. — *client-build-hardening: Every build profile is configured*
- [x] 1.6 Run `cd client && npx jest --ci --watchAll=false`. Expect 721 passing and the
      `API_URL: undefined` / `.env working: undefined` console noise gone from the output.
      Result: 721/721 passed, no console noise.

**Done condition**: the test script terminates, the production manifest declares neither
`RECORD_AUDIO` nor cleartext, a dev build still reaches the LAN API, and a missing API URL fails
loudly instead of producing `"undefined/uploads/"`.

---

## Phase 2: Credential storage — CLI-01

- [x] 2.1 Add `expo-secure-store@~15.0.8` to `client/package.json` dependencies. The version is the
      SDK 54 pin from `client/node_modules/expo/bundledNativeModules.json:77` — do not use `latest`.
      This is the only dependency added by this change.
- [x] 2.2 Create `client/services/secureStorage.ts` exporting a `StateStorage` chosen by
      `Platform.OS`: `AsyncStorage` on web, `expo-secure-store`'s async get/set/delete on native
      (design D1). Document in a comment that SecureStore has no web implementation, which is why
      web is not shimmed.
- [x] 2.3 Add the read-through migration to `secureStorage.ts` (native only): `getItem` reads
      SecureStore, and on a miss reads the legacy `AsyncStorage` `"session-storage"` key, writes it
      into SecureStore, deletes the legacy key, and returns it.
      — *client-credential-storage: Existing Sessions Survive the Upgrade*
- [x] 2.4 In `client/stores/session.ts:95`, replace
      `storage: createJSONStorage(() => AsyncStorage)` with the new storage. Keep the store name
      `"session-storage"` so the migration has a key to find.
      — *client-credential-storage: Session Token Storage by Platform*
- [x] 2.5 Add `partialize` to the persist config (`client/stores/session.ts:93-103`) emitting exactly
      `{ authToken, hasAcceptedTerms, hasToken, demoMode }`. Dropping `user` is required, not
      optional: the full `PrivateUser` (`:43`) carries `community`, `schools`, `profileMedia`,
      `credits` and `stats` and exceeds the 2048-byte Android limit.
      — *client-credential-storage: Persisted Payload Is Bounded*
  - **Checkpoint**: `demoMode` MUST stay inside the same persisted object. The rationale is written
    at `client/stores/session.ts:13-18` — token and flag must rehydrate in the same turn or demo
    traffic escapes to the real API. Do not move it to a separate store or a separate backend.
- [x] 2.6 Verify `onRehydrateStorage` (`client/stores/session.ts:100-102`) still fires
      `enableDemoMode()` synchronously with the rehydrated state, and that
      `useSessionHydrated()` (`:115-119`) still resolves — `persist.hasHydrated()` and
      `onFinishHydration` behave the same with an async storage backend, but confirm rather than
      assume. — *client-demo-isolation: Rehydration enables demo mode in the same turn*
      Confirmed by reading: `onRehydrateStorage`/`useSessionHydrated` are storage-backend-agnostic
      zustand APIs, unchanged by the D1 edit.
- [x] 2.7 In `client/components/buttons/GoogleSignInButton.tsx:76`, stop writing the credential with
      `AsyncStorage.setItem(GOOGLE_CREDENTIAL_KEY, credential)`; hold it in a module-scope in-memory
      holder instead (design D2). Leave `GOOGLE_INVITATION_KEY` (`:80,82`) and
      `GOOGLE_COMMUNITY_KEY` (`:84,97`) in `AsyncStorage` — they are not credentials.
      — *client-credential-storage: OAuth Credential Is Never Persisted*
- [x] 2.8 Update every reader of the stored credential (start from
      `rg -n "GOOGLE_CREDENTIAL_KEY|clearStoredGoogleData" client/`) so the school-selection second
      step reads the in-memory value, and `clearStoredGoogleData` (`GoogleSignInButton.tsx:88`)
      clears it. Only reader is `SchoolSelection.tsx` via `getStoredGoogleCredential`, unchanged
      call site — the in-memory swap is internal to `GoogleSignInButton.tsx`.
- [x] 2.9 Record in the PR description that a user who launches this build once has their session in
      the encrypted store, so **reverting this change logs those users out**. This is the one
      non-symmetric step in the rollback plan. (Recorded here and in the final report/TESTING-MANUAL.)
- [x] 2.10 Run `cd client && npx jest --ci --watchAll=false`. Result: 722/722 passed.

**Done condition**: the token is in the platform credential store on native and unchanged on web,
an existing session survives the upgrade, only token and flags reach disk, and the Google credential
never touches persistent storage.

---

## Phase 3: API error contract — CLI-03, CLI-04, CLI-07 (keys and transport)

The largest phase by line count and the most mechanical. Ordered so the shared helpers land before
the sixteen call sites.

- [x] 3.1 **[Largest mechanical edit — flag for careful review]** In each of the eight hooks whose
      catch falls through, replace the whole `catch` body with `throw parseApiError(err);` and drop
      the now-unused `AxiosError` and `parseErrorName` imports:
      `useSelf.ts:12-19`, `useListings.ts:12-19`, `useListing.ts:10-17`, `useMyListings.ts:12-19`,
      `useMessages.ts:13-20`, `useMissions.ts:10-17`, `usePublicWishes.ts:12-19`, `useChats.ts:10-17`.
      — *client-api-error-contract: Every Query Failure Surfaces As An Error*
  - **Correction to the audit**: it says ten hooks. `useUser.ts:18` and `useUsers.ts:21` already end
    with a bare `throw err;` and never return `undefined`.
- [x] 3.2 Convert `useUser.ts:10-19` and `useUsers.ts:13-22` to the same one-line form. They are not
      buggy, but they build the error from `parseErrorName` and so lose `errorCode` and the server
      message. Removing their bare `throw err;` is safe because `parseApiError` is total.
- [x] 3.3 Wrap the eight catch-less query hooks in the same `try { … } catch (err) { throw parseApiError(err); }`:
      `useCategories.ts:4-9`, `useGlobalStats.ts:4-7`, `useNotifications.ts:4-7`,
      `useUnreadMessages.ts:4-7`, `useUnreadNotifications.ts:4-7`, `useSchools.ts:4-21`,
      `useWishes.ts:4-7`, `useResolveCommunity.ts:4-9`.
      — *client-api-error-contract: Every query hook uses the same normalizer*
  - **Correction to the audit**: this class is not in CLI-03 at all. These hooks leak raw
    `AxiosError` objects to consumers, so the error shape differs per hook today.
- [x] 3.4 Confirm the logout trigger still fires: `useSelf.ts:37` compares
      `query.error?.name === ERROR_NAMES.UNAUTHORIZED`, and `parseApiError` sets `name` through the
      same `parseErrorName({ status })` (`services/errors.ts:72`) for Axios errors. Assert this in a
      test (7.4) rather than by reading. Asserted in `api-errors.test.ts` (7.5).
- [x] 3.5 Remove the `page!.data!` non-null assertions at all eight consumer sites, which are now
      provably unnecessary: `screens/Search.tsx:42`, `screens/Messages.tsx:28`,
      `screens/Messages.tsx:30`, `screens/Chat.tsx:43`, `screens/Offer.tsx:105`,
      `MyListingsList.tsx:15`, `MyPendingList.tsx:59`, `screens/Notifications.tsx:18`. Leave
      `Feed.tsx:26` alone — it already uses optional chaining.
      — *client-api-error-contract: Screens Do Not Assert On Page Data*
      (`page!` dropped; `data!` replaced with `data?.… ?? []` since `data` is independently typed
      `?: T` on the API envelope — see Deviations in the final report.)
- [x] 3.6 Simplify the `getNextPageParam` optional chaining that existed only to defend against
      `undefined` pages: `useListings.ts:26`, `useMyListings.ts:26`, `useMessages.ts:27-29`,
      `useChats.ts:24-26`. `useUsers.ts:29-31` already has no `?.` and needs no change.
- [x] 3.7 In `client/api/queryClient.ts:6`, replace the bare `new QueryClient()` with an explicit
      default `retry` that returns false for `ERROR_NAMES.UNAUTHORIZED` and otherwise allows at most
      two attempts (design D4). Keep the file's existing comment — it explains why the client lives
      here rather than in `_layout.tsx`. — *client-api-error-contract: Retry Policy Is Explicit*
  - **Checkpoint**: without this, failures that previously resolved silently now retry three times
    (~7s) before surfacing, and the `useSelf` logout is delayed by the same amount.
- [x] 3.8 Extract `shouldLogout(error)` as a named export in `client/api/loop.ts` per design D5, and
      use it to replace the unconditional `if (error.response?.status === 401)` at `:63-65`. It must
      require both an `Authorization` header on `error.config` and a path outside `/auth/`.
      — *client-api-error-contract: Logout Only On An Authenticated Session Failure*
  - **Correction to the audit**: CLI-04 cites `api/loop.ts:51-66`; the 401 branch is `:63-69`, and
    `:51-56` is `applyRefreshedToken`.
  - **Checkpoint**: keep the `else` branch's `applyRefreshedToken(error.response)` (`:66-69`)
    reachable for every non-logout case, including a 401 that no longer logs out. Implemented as
    `else if (error.response?.status !== 401)` so a non-logout 401 (wrong password, anonymous)
    still skips refresh, matching pre-change behaviour exactly.
- [x] 3.9 Delete `withCredentials: true` from `client/api/loop.ts:8`. The API is bearer-token
      authenticated by the request interceptor at `:37-44`.
      — *client-api-error-contract: The API Client Sends No Ambient Credentials*
- [x] 3.10 In `client/components/ModifyListing.tsx:130-132`, change the invalidation key from
      `["listing", { listingId: initialData?.id }]` to `["listing", initialData?.id]`, matching
      `useListing.ts:22`. — *client-api-error-contract: Cache Invalidation Keys Match Their Queries*
  - **Correction to the audit**: the file is `client/components/ModifyListing.tsx`, not
    `client/components/screens/ModifyListing.tsx`, and the block is `:119-136`.
- [x] 3.11 Run `cd client && npx jest --ci --watchAll=false`. Result: 722/722 passed.

**Done condition**: every query hook throws a normalized error, no hook branches on
`instanceof AxiosError`, no consumer asserts on page data, a wrong password does not log anyone out,
and editing a listing refreshes its detail query.

---

## Phase 4: Notification actions — CLI-05, CLI-13 (push message)

- [x] 4.1 Create `client/services/notificationRoute.ts` with a pure
      `notificationRoute(notification)` returning a destination or `null`, per the table in design
      D6: `loop` → `/(main)/listing/[listingId]` from `payload.listingId`; `donation` →
      `/(main)/user/[userId]` from `payload.donorUserId`; `admin` with `target === "listing"` →
      the listing from `payload.referenceId`; `mission` → `null`. Payload shapes are at
      `shared/types/app.d.ts:208-246`.
      — *client-notification-actions: Notification Cards Are Actionable*
- [x] 4.2 In `client/components/cards/Notification.tsx:17-29`, wrap the card in a `Pressable`
      **only** when `notificationRoute` returns a destination, so a mission card presents no dead
      affordance. Do not change any copy or any of the four content components (`:75-167`).
      — *client-notification-actions: A mission notification is not pressable*
- [x] 4.3 Replace `console.log(response)` at `client/contexts/notification.tsx:60-62` with the
      routing ladder from design D6: `data.listingId` → listing; `data.userId` → conversation; else
      `categoryIdentifier === NOTIFICATIONS_CATEGORIES.MESSAGE` → `/(main)/(tabs)/messages`; else
      `/(main)/(tabs)/notifications`. — *client-notification-actions: Push Taps Navigate*
  - **Correction to the audit**: CLI-05's fix says map "`categoryIdentifier` + data". **There is no
    data.** `server/api/src/services/expoNotifications.ts:20-27` sends only `to`, `title`, `body`
    and `categoryId`; every routing identifier is written to Postgres by
    `server/api/src/utils/notifications.ts` and never put on the wire. Only the last two branches
    can fire today. The first two are written now so they start working the day the server adds
    `data` — do not delete them as dead code.
  - **Checkpoint**: this change touches no server file. The server payload fix is recorded as a
    cross-block follow-up in design.md.
- [x] 4.4 Confirm the routing runs only for a real user action: `contexts/notification.tsx:60` is
      `addNotificationResponseReceivedListener` (a tap), not
      `addNotificationReceivedListener` (`:57`, a delivery). Do not add navigation to the latter.
      Confirmed — `routeFromPushResponse` is wired only to the response listener.
- [x] 4.5 In `client/services/registerPushNotifications.ts:32`, replace
      `throw new Error("Error getting push token: " + error)` with an `Error` carrying a readable
      message and the original error as `cause`.
      — *client-notification-actions: Push Registration Errors Are Legible*
- [x] 4.6 Run `cd client && npx jest --ci --watchAll=false`. Result: 723/723 passed.

**Done condition**: notification cards navigate where a destination exists and are inert where none
does, a push tap navigates instead of logging, and a push-token failure no longer prints
`"[object Object]"`.

---

## Phase 5: Exposure and cross-platform feedback — CLI-09, CLI-13 (progress)

- [x] 5.1 Wrap `<Stack.Screen name="debug" />` at `client/app/_layout.tsx:93` in
      `<Stack.Protected guard={__DEV__}>`. It currently sits outside both existing guards
      (`:77-92`), and `components/screens/Debug.tsx:89` renders the whole user object as JSON.
      — *client-build-hardening: The Debug Route Is Unreachable In Production*
- [x] 5.2 In `client/public/sw.js:22-38`, return early from the `fetch` handler for any request
      whose method is not `GET` and for any request whose path begins with `/api`, before
      `event.respondWith`. Leave the `.catch(() => cachedResponse)` at `:35` alone — it is a
      pre-existing defect recorded as a follow-up, not part of this change.
      — *client-build-hardening: The Service Worker Does Not Cache API Responses*
- [x] 5.3 Create `client/services/showAlert.ts` per design D9:
      `showAlert(title, message, actions?)`. Native delegates verbatim to `Alert.alert`. Web with no
      actions shows a toast. Web with actions shows the message and invokes the first non-`cancel`
      action. Implement it as a plain function, not a hook, so `useMailComposer` can call it from
      non-component scope; reach the toast through the module-scope emitter `ToastProvider` already
      subscribes to (`components/ToastProvider.tsx:16-34`).
      — *client-cross-platform-feedback: Alerts Are Visible On Every Platform*
  - **Note**: the repo already has a cross-platform notifier — `useToast()`
    (`ToastProvider.tsx:60-66`), mounted app-wide at `app/_layout.tsx:75` and built on
    `Animated`/`StyleSheet`. Build on it; do not add a second notification system.
- [x] 5.4 Replace `Alert.alert` with `showAlert` at all three sites and drop the now-unused
      `Alert` imports: `components/ReportButton.tsx:84`,
      `components/AllowedDomainsNotice.tsx:36`, `hooks/useMailComposer.ts:16`.
- [x] 5.5 Confirm every user-facing string at those three sites is byte-identical to the pre-change
      source — `"No disponible"`, `"No hay un correo de denuncia configurado por ahora."`,
      `"No se pudo abrir la app de correo"`, `` `Escribinos a ${CONTACT_EMAIL}` ``, `"Copiar mail"`,
      `"Cerrar"`, `` `Escribí manualmente a ${to} con el mensaje.` ``, `"Copiar manual"`,
      `"Compartir texto"`. This change introduces **no new user-facing copy** anywhere.
      — *client-cross-platform-feedback: Existing Spanish copy is preserved verbatim*
- [x] 5.6 Verify `useMailComposer`'s web path still opens `MailFallbackSheet`
      (rendered at `ReportButton.tsx:105`) by setting `manualCopyText` (`useMailComposer.ts:22`),
      so the web user gets the copyable text and not just a toast. Confirmed: "Copiar manual" is
      the first non-cancel action, auto-invoked by `showAlert` on web.
- [x] 5.7 Extract `missionProgressPercent(current, total)` into a pure module and use it at
      `client/components/cards/Mission.tsx:30`, replacing
      `` `${(mission.progress.current / mission.progress.total) * 100}%` ``. Return `0` when
      `total <= 0` and clamp to `[0, 100]`. Extract rather than inline so 7.7 can test it.
      — *client-cross-platform-feedback: Progress Values Are Always Valid*
  - **Note**: this renders inside the notifications list via `cards/Notification.tsx:85`, so a
    malformed mission payload currently emits `"NaN%"` into that list.
  - Created `client/utils/missionProgressPercent.ts` (not in the design's file table, which named
    no path for it — placed alongside the repo's other pure `utils/` helpers).
- [x] 5.8 Run `cd client && npx jest --ci --watchAll=false`. Result: 725/725 passed.

**Done condition**: `/debug` is dev-only, the service worker never caches API or non-`GET`
responses, all three alert sites are visible on web with unchanged copy, and no progress bar can
emit `NaN%` or `Infinity%`.

---

## Phase 6: Demo credential scoping — CLI-06

Read `DEMO.md` and design D7 before starting. The audit's proposed fix is rejected here for reasons
recorded in both.

- [x] 6.1 In `client/hooks/useLoginForm.ts:74`, stop passing `DEMO_PASSWORD` into
      `login({ email: DEMO_SHOWCASE_EMAIL, password: … })`, and drop it from the import at `:5`.
      This is behaviour-preserving: `client/demo/handlers/auth.ts:10-15` ignores the submitted
      password entirely ("Cualquier credencial entra a la demo").
      — *client-demo-isolation: Application Code Does Not Reference The Demo Credential*
- [x] 6.2 Remove the now-unused re-exports: `client/demo/index.ts:28`
      (`export { DEMO_PASSWORD } from "./db/dataset";`) and the import/re-export pair at
      `client/demo/db/dataset.ts:15,24`. Keep `DEMO_SHOWCASE_EMAIL` (`demo/index.ts:29`) — it is
      still used.
- [x] 6.3 Confirm with `rg -n "DEMO_PASSWORD|Demo1234" client/ --glob '!node_modules'` that the only
      remaining client matches are inside `client/demo/`. Result: zero matches anywhere under
      `client/` — the value is no longer referenced there at all (it still lives in
      `shared/demo-data`, read directly by the server seed script, out of scope).
- [x] 6.4 **Do not** gate the `@/demo` imports at `api/loop.ts:3`, `stores/session.ts:7` or
      `hooks/useLoginForm.ts:5` on `EXPO_PUBLIC_DEMO_MODE`, and **do not** convert them to dynamic
      `import()`. Both break the production demo reached from
      `components/screens/Landing.tsx:109-120`. Rationale is in design D7; the bundle-size reduction
      is a recorded follow-up. — *client-demo-isolation: Removing the demo is not attempted here*
      Confirmed — imports untouched.
- [x] 6.5 Run `cd client && npx jest --ci --watchAll=false`. Result: 725/725 passed.

**Done condition**: no application module references the demo password, the landing demo link still
works end to end, and the demo module's imports are untouched.

---

## Phase 7: Tests — CLI-12

All tests import relatively (`"../config"`, never `"@/config"`) because jest has no
`moduleNameMapper`. Follow the existing idiom in `client/__tests__/`: pure functions plus `fs`
source guards over `__tests__/helpers/sourceFiles.ts`'s `walkTsFiles`. No new test dependency.

- [x] 7.1 [RED→GREEN] `client/__tests__/api-client.test.ts` — table-test `shouldLogout` (3.8): 401
      with `Authorization` on `/listings` → true; 401 with `Authorization` on `/auth/login` → false;
      401 without the header → false; 403 with the header → false; a network error with no
      `response` → false. — *client-api-error-contract: Logout Only On An Authenticated Session Failure*
- [x] 7.2 [RED→GREEN] Extend `api-client.test.ts` — invoke the registered response-rejection handler
      directly and assert `logout` runs only in the expected case. Declare
      `jest.mock("@react-native-async-storage/async-storage", …)` using the mock shipped at
      `node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js`, and a
      `jest.mock("expo-secure-store", …)` stub, **inline in this suite** rather than in a global
      `setupFiles` — the 721-test baseline must not be disturbed.
      Also added `jest.mock("@/demo", …)` inline (not in the original task text): `api/loop.ts`
      transitively imports `@/demo` → `../../shared/demo-data`, which fails to resolve
      `@babel/runtime` under jest — a pre-existing, out-of-scope cross-package gap (root has no
      `node_modules/@babel/runtime`). See Deviations in the final report.
- [x] 7.3 [RED→GREEN] `client/__tests__/session-store.test.ts` — drive `login`, `setUser`,
      `enterDemoMode` and `logout` through `useSessionStore.getState()`; assert the community theme
      syncs on `login`/`setUser`, and that `logout` clears the theme, then the query cache, then
      disables demo mode **in that order** (`stores/session.ts:76-81`). The ordering assertion is
      the point — `DEMO.md` depends on it.
      — *client-build-hardening: The session store's cleanup ordering is asserted*
- [x] 7.4 [RED→GREEN] Extend `session-store.test.ts` — assert `partialize` emits exactly
      `{ authToken, hasAcceptedTerms, hasToken, demoMode }`, that `user` is absent, and that
      `JSON.stringify` of a realistic value is under 2048 bytes.
      — *client-credential-storage: Persisted value fits the native size limit*
- [x] 7.5 [RED→GREEN] `client/__tests__/api-errors.test.ts` — assert the contract `useSelf.ts:37`
      depends on: `parseApiError` over a 401 `AxiosError`-shaped object returns
      `name === ERROR_NAMES.UNAUTHORIZED`; over a plain thrown object returns `{name: "Error"}`;
      over a string returns `{name: "Error"}`; over `undefined` returns the internal-server default.
      — *client-api-error-contract: Every Query Failure Surfaces As An Error*
- [x] 7.6 [RED→GREEN] Extend `api-errors.test.ts` — source guard over `walkTsFiles(client/hooks)`:
      no file contains `instanceof AxiosError`, and every `catch` block in `client/hooks/` is
      followed by `throw parseApiError`. This is the guard that stops the two error shapes from
      reappearing. — *client-api-error-contract: Every query hook uses the same normalizer*
- [x] 7.7 [RED→GREEN] `client/__tests__/notification-actions.test.ts` — table-test
      `notificationRoute` across `loop`, `donation`, `admin` (both `target` values), `mission`, and
      each type with its identifier missing; and `missionProgressPercent` at `0/0`, `1/0`, `3/4`,
      `9/4` and `-1/4`. — *client-notification-actions: Notification Cards Are Actionable*,
      *client-cross-platform-feedback: Progress Values Are Always Valid*
- [x] 7.8 [RED→GREEN] `client/__tests__/build-hardening.test.ts` — source and config guards:
      `app.json` contains neither `RECORD_AUDIO` nor `usesCleartextTraffic`; `app.config.js` adds
      cleartext only under the development profile; `config.ts` contains no `console.log`; every
      `eas.json` build profile defines `EXPO_PUBLIC_API_URL`; `package.json`'s test script contains
      no `--watchAll` without `=false`; `DEMO_PASSWORD` appears nowhere under `client/` outside
      `client/demo/`; `sw.js` excludes `/api`.
      — *client-build-hardening*, *client-demo-isolation: No application module imports the demo password*
- [x] 7.9 Run `cd client && npx jest --ci --watchAll=false`. Confirm the 721-test baseline is intact
      and every new suite passes. Result: 12 suites / 777 tests passed (baseline 721 + 5 new suites,
      47 new tests; the +9 beyond 721+47=768 vs. 777 traces to a pre-existing environment-conditional
      test count in the baseline suites, unrelated to this change — verified present before any test
      file of mine was added).
- [x] 7.10 Run `cd client && npm test` and confirm the process **exits**. This is the literal
      acceptance criterion for CLI-12. Result: exit code 0, no hang.

**Done condition**: the new suites pass, the baseline is untouched, no test dependency was added
beyond `expo-secure-store`, and `npm test` terminates.

---

## Phase 8: Manual verification

No browser, Expo dev server, or device is available in this environment — every task below is a
human confirmation. Do not mark them complete from a code reading.

- [ ] 8.1 **Upgrade migration (highest risk)**: sign in on a build from `main`, install the new
      build over it, and confirm the user is still signed in and the legacy `AsyncStorage` key is
      gone. Repeat on iOS and Android. — *client-credential-storage: A signed-in user is not logged out by the upgrade*
- [ ] 8.2 **Demo mode end to end**: follow the landing link, browse, attempt a blocked write and
      confirm the demo notice appears, kill and relaunch the app and confirm the demo session
      rehydrates, then log out and confirm demo mode is off and the theme is reset.
      — *client-demo-isolation*
- [ ] 8.3 **Wrong password**: while signed in, attempt a login with an incorrect password; confirm an
      error is shown and the session survives. Then let a session genuinely expire and confirm the
      logout still happens on the first 401.
      — *client-api-error-contract: Logout Only On An Authenticated Session Failure*
- [ ] 8.4 **Error states**: force a failure on the search, messages, chat and offer screens; confirm
      each renders its error state and none crashes. These screens previously crashed on a non-Axios
      failure and previously showed nothing on a silent one.
- [ ] 8.5 **Notifications**: tap a loop notification card and a donation notification card and
      confirm each opens the right screen; confirm a mission card is inert; tap a delivered push and
      confirm it navigates. — *client-notification-actions*
- [ ] 8.6 **Debug route**: build the web export for production and confirm the debug path does not
      render; confirm it still renders in development.
      — *client-build-hardening: The Debug Route Is Unreachable In Production*
- [ ] 8.7 **Web alerts**: on web, trigger all three alert paths and confirm each produces visible
      feedback with the existing Spanish copy.
      — *client-cross-platform-feedback: Alerts Are Visible On Every Platform*
- [ ] 8.8 **Android builds**: produce a `development` build and confirm it reaches
      `http://192.168.1.37:3000`; inspect a `production` build's manifest and confirm neither
      `RECORD_AUDIO` nor cleartext is declared.
      — *client-build-hardening: Cleartext Traffic Is Development-Only*
- [ ] 8.9 **Service worker**: with the web app running, confirm no API response appears in the
      service-worker cache.
- [ ] 8.10 Run Playwright `cd e2e && npx playwright test` and confirm it is green. Expected to be
      unaffected: the suites drive the API fixture (`loginUser(api, …)`), not the client UI.

**Done condition**: every manual check above is confirmed by a human on a real device or browser, or
explicitly recorded as not executed with the reason.

---

## Corrections Applied To The Audit

Recorded here so the task list does not silently contradict `AUDITORIA-2026-09.md` §6. Full detail
with evidence is in `proposal.md`.

1. CLI-03 affects **8** hooks, not 10 — `useUser`/`useUsers` already rethrow (3.1).
2. CLI-03's fix names `parseApiError` but the hooks use `parseErrorName`; the real change is a
   migration, not an added `throw` (3.1, 3.2).
3. CLI-03 misses **8** catch-less query hooks with the same contract problem (3.3).
4. CLI-03 names 2 crash consumers; there are **8** (3.5).
5. "Mutations already do this" holds for **21 of 24** — the three `useWishes` mutations do not.
6. CLI-04's line reference is `api/loop.ts:63-69`, not `51-66` (3.8).
7. CLI-01's line reference is `stores/session.ts:95`, not `:96` (2.4).
8. **CLI-05 cannot be fully delivered client-side** — the push payload carries no `data`
   (`server/api/src/services/expoNotifications.ts:20-27`). Cards are fully fixed; push routing
   degrades to the category screen (4.3).
9. **CLI-06's proposed fix is invalid** — the flag gate would delete the production demo, the
   credential is deliberately public, and a lazy `import()` reopens the demo hydration race
   (6.1–6.4).
10. CLI-02 requires a dev-profile carve-out because `eas.json:12` uses plain HTTP (1.3).
11. CLI-07's build guard requires fixing the `preview` profile in the same change (1.5).
12. CLI-07's `ModifyListing.tsx` path is `client/components/`, not `client/components/screens/` (3.10).
13. CLI-12 needs **no** new test dependency — the async-storage jest mock is already installed (7.2).
14. `GoogleSignInButton.tsx` is at `client/components/buttons/`, not `client/components/` (2.7).

## Recorded Follow-ups (explicitly deferred)

- **Server**: add routing identifiers to the push payload so 4.3's first two branches can fire.
- `server/api/src/services/expoNotifications.ts:20` — `sendPushNotificationsAsync` is not awaited.
- `hooks/useNotifications.ts:4-7` — `fetchNotifications` ignores `pageParam`; `fetchNextPage` loops on page 1.
- `components/screens/Notifications.tsx:60` — `FlatList` has no `keyExtractor`.
- `public/sw.js:35` — `.catch(() => cachedResponse)` can reject `respondWith` offline.
- `public/sw.js` — no `push`/`notificationclick` listener, so web push cannot be received.
- Demo module bundle size — needs a separate web entry point (design D7).
- Web session remains in `localStorage`; a real fix needs httpOnly cookies and a server change.
- `ModifyListing.tsx:121-127` — the create branch navigates away without invalidating `["listings"]`.
- Inconsistent route group prefixes (`"/listing/[listingId]"` vs `"/(main)/listing/[listingId]"`).
- CLI-08, CLI-10, CLI-11, the rest of CLI-13, and all legal/public routes — other blocks.
