# Tasks: Admin Panel Fixes (AUDITORIA-2026-09 §7)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650 total across 7 work units |
| Session review budget | 800 lines/PR (configured); the whole change stays under it |
| 400-line budget risk | Med (only against the skill default of 400; unit 5 is the single largest at ~280) |
| Chained PRs recommended | No |
| Suggested split | Single PR on `fix/auditoria-2026-09`; units below are commit boundaries, not PRs |
| Delivery strategy | single-pr / exception-ok |
| Chain strategy | N/A — single PR |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Med

### Suggested Work Units

| Unit | Goal | Branch | Focused check command | Runtime harness | Rollback boundary |
|------|------|--------|------------------------|------------------|--------------------|
| 1 | ADM-02 authorize admin | `fix/auditoria-2026-09` | `cd adminClient && npm run build` | Manual: super admin + community admin accounts (`DEMO.md`) | Client-only; revert restores today's broken-for-super-admin form |
| 2 | ADM-03 pagination | `fix/auditoria-2026-09` | `cd adminClient && npm run build`; `cd server/api && npm run check-types` | Manual: user list with >10 users | Additive response field; client has a fallback, so either side reverts alone |
| 3 | ADM-05 community logos | `fix/auditoria-2026-09` | `cd adminClient && npm run build` | Manual: communities list + community form | 3 lines; revert restores broken images |
| 4 | ADM-06 logout + 401 + PII | `fix/auditoria-2026-09` | `cd adminClient && npm run build`; `cd server/api && npm run check-types` | Manual: DevTools Cookies + Local Storage | Route and interceptor revert independently; `partialize` revert restores PII persistence |
| 5 | ADM-04 modals + reason + labels | `fix/auditoria-2026-09` | `cd adminClient && npm run build && npm run lint` | Manual: open and submit each of the 6 dialogs | Per-modal; each migration is its own commit-sized diff |
| 6 | ADM-08 confirmations | `fix/auditoria-2026-09` | `cd adminClient && npm run build` | Manual: 3 destructive actions | Per-action; revert restores immediate execution |
| 7 | ADM-10 document | `fix/auditoria-2026-09` | `cd adminClient && npm run build` | Manual: browser tab | 2 lines + 1 asset |

**Environment.** `adminClient` has **no test runner** — no `test` script, no vitest/jest, no
`@testing-library/*`, zero test files. Typecheck is `npm run build` (`tsc -b && vite build`); there is
no `check-types` script in that package. Adding a runner is ADM-07, owned by `delivery-and-ci`, and is
explicitly **not** in scope. Every behavioural check below is therefore a manual readback and must
actually be performed, not assumed.

The API Jest suite (`cd server/api && npm run test`) is **known red pre-existing** (INF-06). Compare
against the recorded baseline; it is not a gate for this change.

Manual readback needs two accounts from `DEMO.md`: one `super_admin` and one `community_admin`.

---

## Unit 1: ADM-02 — Authorize Admin

- [x] 1.1 Add `role` state to `adminClient/src/pages/AuthorizeAdmin.tsx` (default `"community_admin"`) and `communityId` state (default `null`). — *admin-authorization: Role Selection Restricted to Super Admins*
- [x] 1.2 In `AuthorizeAdmin.tsx`, render a role selector **only** when `useIsSuperAdmin()` (`stores/session.ts:52`) is true, offering `community_admin` and `super_admin` with Spanish labels ("Administrador de comunidad" / "Super administrador"). — *admin-authorization: Role Selection Restricted to Super Admins*
- [x] 1.3 In `AuthorizeAdmin.tsx`, render `CommunityFilter` with `allowAll={false}` **only** when the operator is a super admin **and** `role === "community_admin"`; load the list from `stores/communities.ts`. Do not render it for `role === "super_admin"` — the database `CHECK` requires super admins to have no community (`controllers/admin.ts:153-154`). — *admin-authorization: Community Binding Follows the Role*
- [x] 1.4 In `AuthorizeAdmin.tsx`, disable submit when the operator is a super admin, `role === "community_admin"`, and no `communityId` is selected, so the `COMMUNITY_REQUIRED` round trip is avoided rather than merely translated. — *admin-authorization: "Super admin must pick a community for a community admin grant"*
- [x] 1.5 Change the call at `AuthorizeAdmin.tsx:27` from `adminApi.addValidEmailForRegistration(email)` to pass the existing `options` argument (`adminApi.ts:62-72`): `{ role, communityId }`, sending `communityId: undefined` when the role is `super_admin`. No change to `adminApi.ts` is needed — the parameter already exists. — *admin-authorization: Role Selection Restricted to Super Admins, Community Binding Follows the Role*
- [x] 1.6 Replace the raw error render at `AuthorizeAdmin.tsx:37-39` (`err.response?.data?.error`) with `getErrorMessage(err, "Error al autorizar el email. Puede que ya esté autorizado.")` from `services/errors.ts:27-35`; drop the now-unused `AxiosError` import at `:4` if nothing else uses it. — *admin-authorization: Authorization Errors Are Human-Readable*
- [x] 1.7 Add `htmlFor`/`id` to the email label at `AuthorizeAdmin.tsx:74-84` and to the two new controls, using `ui/Field` where it fits. — *admin-panel-presentation: Form Labels Are Associated With Their Controls*
- [x] 1.8 **[Verify — do not modify]** Confirm `server/api/src/middlewares/parseAdminToken.ts` and the `requireSuperAdmin` guard on every route in `routes/admin.ts` are byte-identical to the base branch. This unit is client-only. — *admin-authorization: Community Scoping Invariant Preserved, "Scoping helpers are untouched"*
- [ ] 1.9 Manual readback as **super admin**: authorize a `community_admin` with a community chosen (succeeds); authorize a `super_admin` with no community selector shown (succeeds). — *admin-authorization: "Super admin authorizes a community admin end to end", "Super admin grant sends no community"*
- [ ] 1.10 Manual readback as **community admin**: no role selector and no community selector render; authorizing an email still succeeds and lands in their own community. — *admin-authorization: "Community admin sees no role choice"*
- [ ] 1.11 Manual readback: force a `COMMUNITY_REQUIRED` response and confirm it renders as "Hay que elegir una comunidad para esta acción." — *admin-authorization: "A known error code renders its Spanish message"*
- [x] 1.12 Run `cd adminClient && npm run build`.

**Done condition**: a super admin can grant both roles; a community admin's flow is unchanged; errors render in Spanish; `parseAdminToken.ts` shows a zero-line diff.

---

## Unit 2: ADM-03 — User Pagination

- [x] 2.1 Update `GetAdminUsersResponse` in `shared/types/apiCalls.d.ts:519-522` to the `PaginatedApiResponse` envelope already defined at `:25-27` and already used by `GetAdminInvitationsResponse` at `:741`, keeping `data.total` so the change is additive. — *admin-panel-presentation: Pagination Derives From the Server's Page Size*
- [x] 2.2 In `server/api/src/controllers/admin.ts:171`, include the pagination block (`page`, `pageSize: PAGE_SIZE`, `total`) in the `getUsers` response alongside the existing `data: { users, total }`. `PAGE_SIZE` is already imported in scope via `config.js` (`config.ts:156`). — *admin-panel-presentation: Pagination Derives From the Server's Page Size*
- [x] 2.3 In `adminClient/src/pages/Users.tsx:33`, replace `Math.ceil(total / 20)` with a computation over the page size received from the response, wrapped in `Math.max(1, ...)` so an empty list still shows one page. — *admin-panel-presentation: "Every page is reachable"*
- [x] 2.4 In `Users.tsx`, define a named `DEFAULT_PAGE_SIZE = 10` fallback constant with a comment citing `server/api/src/config.ts:156`, used only when the response omits pagination — required so the client and server edits stay independently revertible. Do **not** leave a bare `20`. — *admin-panel-presentation: "A response without pagination still renders"*
- [x] 2.5 Delete `console.log(response)` at `Users.tsx:27` — it prints names, emails and credit balances on every page and search change. — *admin-session-lifecycle: No Diagnostic Logging of Personal Data*
- [ ] 2.6 Manual readback: with more than 10 and fewer than 21 users, confirm the pager offers 2+ pages and the last page loads its users. — *admin-panel-presentation: "Every page is reachable"*
- [ ] 2.7 Manual readback: browse and search the user list with DevTools open; confirm nothing is logged. — *admin-session-lifecycle: "Loading the user list prints nothing"*
- [x] 2.8 Run `cd adminClient && npm run build` and `cd server/api && npm run check-types`.

**Done condition**: page count derives from the server's page size, every page is reachable, no bare `20` remains, no user data is logged.

---

## Unit 3: ADM-05 — Community Logos

- [x] 3.1 Harden `adminClient/src/services/getUrl.ts:3-5` to pass an already-absolute `http`/`https` value through unchanged, mirroring the mobile client's version. Required before the call sites change: demo/seed data can carry absolute URLs, and without this the fix would break the rows that render correctly today. — *admin-panel-presentation: "An absolute URL is not double-prefixed"*
- [x] 3.2 Wrap the logo source at `adminClient/src/pages/Communities.tsx:110` in `getUrl(...)` and add the import. — *admin-panel-presentation: Media Filenames Resolve to Absolute URLs*
- [x] 3.3 Wrap the preview source at `adminClient/src/components/CommunityFormModal.tsx:217` in `getUrl(...)` and add the import. Leave `:89` and `:109` alone — they assign state, not `src`; wrapping once at the single render site keeps `logoUrl` unambiguously "whatever the API gave us". — *admin-panel-presentation: Media Filenames Resolve to Absolute URLs*
- [ ] 3.4 Manual readback: a community with an uploaded logo renders it in the communities list, and uploading a new logo in the form shows a working preview. — *admin-panel-presentation: "A community logo renders", "A freshly uploaded logo previews"*
- [x] 3.5 Run `cd adminClient && npm run build`.

**Done condition**: community logos load in both places, resolution is idempotent for absolute URLs, and the school screens are untouched.

---

## Unit 4: ADM-06 — Real Logout, 401 Interceptor, PII

- [x] 4.1 Add `AdminController.logout` to `server/api/src/controllers/admin.ts`: clear `COOKIE_NAMES.ADMIN_TOKEN` reusing `adminCookieOptions` (`config.ts:146-151`) with `maxAge` omitted, then return `successResponse({})`. Reuse the exported object rather than re-typing `httpOnly`/`secure`/`sameSite` literals — they are env-conditional and a mismatch makes the browser silently refuse the removal. — *admin-session-lifecycle: Server-Side Session Termination*
- [x] 4.2 Mount `adminRouter.post("/logout", AdminController.logout)` in `server/api/src/routes/admin.ts` beside the other session routes (`:17-20`), **without** `adminTokenMiddleware`. Behind the middleware an expired cookie would 401, task 4.5's interceptor would call logout, and that would 401 again — a loop. The handler reads no session and touches no database. — *admin-session-lifecycle: Server-Side Session Termination, "Logout works without a session"*
- [x] 4.3 Add the logout request/response types to `shared/types/apiCalls.d.ts` next to the other admin session entries. — *admin-session-lifecycle: Server-Side Session Termination*
- [x] 4.4 Add `logout()` to `adminClient/src/api/adminApi.ts` calling `POST /admin/logout`. — *admin-session-lifecycle: Server-Side Session Termination*
- [x] 4.5 **[Highest-risk edit in this change — flag for careful review]** Add a response interceptor to `adminClient/src/api/loop.ts` that, on `401`, calls `useSessionStore.getState().logout()` and `window.location.replace("/login")`, then re-rejects the error. It **MUST** exclude `/admin/login`, `/admin/register`, `/admin/google-login` and `/admin/logout`. Without the login exclusion a wrong password bounces the operator instead of showing an error — strictly worse than today. Use `getState()` (module scope, not a component) and `window.location` (this file is outside the `RouterProvider` tree). — *admin-session-lifecycle: Expired Session Detection*
  - **Checkpoint**: verify the exclusion matches the actual `error.config.url`, which is relative to `baseURL` (`loop.ts:5`), not absolute.
- [x] 4.6 Delete `console.log(API_URL)` at `adminClient/src/api/loop.ts:10`. — *admin-session-lifecycle: No Diagnostic Logging of Personal Data*
- [x] 4.7 Change `handleLogout` at `adminClient/src/components/Aside.tsx:45-48` to await `adminApi.logout()` before the local `logout()` and `navigate("/login")`, swallowing a network failure so the local session is cleared even when the API is unreachable. — *admin-session-lifecycle: "Local session is cleared even if the server is unreachable"*
- [x] 4.8 Add `partialize` to the `persist` options at `adminClient/src/stores/session.ts:41-47`, projecting only `isLoggedIn`, `role` and `communityId`. — *admin-session-lifecycle: No Personal Data Persisted in Browser Storage*
- [x] 4.9 Bump `version` at `stores/session.ts:43` from `2` to `3` so previously-stored blobs containing `email`/`fullName`/`communityName` are discarded rather than lingering. The existing `migrate` at `:46` already forces a fresh login, so no new migration logic is needed. — *admin-session-lifecycle: "A pre-existing stored session with personal data is discarded"*
- [x] 4.10 **[Accepted regression — do not "fix"]** Confirm `Aside.tsx` falls back gracefully now that `fullName` and `communityName` are not persisted: the operator name shows its existing `"Administrador"` fallback until the next login. This is the documented D6 tradeoff. — *admin-session-lifecycle: No Personal Data Persisted in Browser Storage*
- [ ] 4.11 Manual readback: log in, click "Cerrar sesión", confirm in DevTools → Application → Cookies that `admin_token` is gone, and that a subsequent admin request responds 401. — *admin-session-lifecycle: "Logout revokes the cookie"*
- [ ] 4.12 Manual readback: log in, delete `admin_token` manually in DevTools, trigger any admin request, confirm redirect to `/login` rather than a silent failure. — *admin-session-lifecycle: "Expired cookie sends the operator to login"*
- [ ] 4.13 Manual readback: submit a wrong password on `/login` and confirm the credentials error renders with **no** redirect. — *admin-session-lifecycle: "A failed login shows an error instead of redirecting"*
- [ ] 4.14 Manual readback: inspect `localStorage` key `session-storage` after login; confirm it holds `isLoggedIn`/`role`/`communityId` and no `email`, `fullName` or `communityName`. — *admin-session-lifecycle: "Stored session contains no personal data"*
- [ ] 4.15 Manual readback as super admin: reload the panel and confirm super-admin-only navigation still renders before any API response. — *admin-session-lifecycle: "Role-dependent navigation still renders correctly after reload"*
- [x] 4.16 Run `rg -n "console\.log" adminClient/src` — must return nothing. — *admin-session-lifecycle: "No stray logs remain"*
- [x] 4.17 Run `cd adminClient && npm run build` and `cd server/api && npm run check-types`.

**Done condition**: logout revokes the cookie server-side, an expired session redirects instead of failing silently, a failed login still shows its error, `localStorage` holds no PII, and no `console.log` remains.

---

## Unit 5: ADM-04 — Modal Migration, Mandatory Reason, Labels

> Migrate one modal per commit. The cost is **not** the backdrop class — it is that each modal's action
> buttons currently live inside its `<form>`, while `ui/Modal` renders them in a `footer` outside the
> body. Wire the footer's submit button with `form="<id>"` matching an `id` on the `<form>` to keep
> native validation and Enter-to-submit working without lifting state.
>
> For every modal: drop `max-h-[90vh] overflow-y-auto` from the card (`ui/Modal` already constrains at
> `:50` and scrolls its body at `:66` — keeping both produces nested scrollers), and drop the
> `if (!isOpen) return null` guard (`ui/Modal` does it at `:43`).
>
> The correct backdrop is `ui/Modal`'s own (`ui/Modal.tsx:46`) — **not** `bg-black/50`, which the audit
> names incorrectly and which would leave these six inconsistent with the already-migrated screens.

- [x] 5.1 Migrate `adminClient/src/components/ModifyCreditsModal.tsx:77-78` to `ui/Modal` with `size="md"`; move the action row at `:125-141` into `footer`. — *admin-panel-presentation: Dialogs Use the Shared Modal Surface*
- [x] 5.2 Add a **required** reason input to `ModifyCreditsModal`, validated beside the existing amount check at `:40`, rejecting empty and whitespace-only values with a Spanish message ("El motivo es obligatorio"). — *admin-safe-operations: Credit Adjustments Carry a Mandatory Reason*
- [x] 5.3 Pass the reason through the existing `meta` parameter at the call site (`ModifyCreditsModal.tsx:47` → `adminApi.modifyUserCredits(user.id, creditAmount, isPositive, { reason })`). The parameter already exists (`adminApi.ts:88-93`) and flows unchanged to `wallet_transactions.meta` (`controllers/admin.ts:179` → `models/admin.ts:353-361`). **No server change and no migration.** — *admin-safe-operations: "The reason reaches the transaction record"*
- [x] 5.4 Reset the reason field in `ModifyCreditsModal`'s `handleClose` (`:66-72`) alongside the existing state resets. — *admin-safe-operations: Credit Adjustments Carry a Mandatory Reason*
- [x] 5.5 Migrate `adminClient/src/components/ResetPasswordModal.tsx:81-82` to `ui/Modal`, `size="md"`. — *admin-panel-presentation: Dialogs Use the Shared Modal Surface*
- [x] 5.6 Migrate `adminClient/src/components/CreateSchoolModal.tsx:139-140` to `ui/Modal`, `size="md"`; preserve the file-upload input's behaviour. — *admin-panel-presentation: Dialogs Use the Shared Modal Surface*
- [x] 5.7 Migrate `adminClient/src/components/EditSchoolModal.tsx:146-147` to `ui/Modal`, `size="md"`. Its guard at `:143` is `!isOpen || !school` — remove only the `!isOpen` half; the `!school` null check must stay. — *admin-panel-presentation: Dialogs Use the Shared Modal Surface*
- [x] 5.8 Migrate `adminClient/src/components/CategoryFormModal.tsx:150-151` to `ui/Modal`, `size="lg"` (it is `max-w-2xl` today). This one has `overflow-y-auto` on **both** the backdrop (`:150`) and the card (`:151`) — remove both. — *admin-panel-presentation: "No nested scrollbars"*
- [x] 5.9 Migrate `adminClient/src/components/MissionFormModal.tsx:119-120` to `ui/Modal`, `size="lg"`. — *admin-panel-presentation: Dialogs Use the Shared Modal Surface*
- [x] 5.10 While migrating each of the six, convert its fields to `ui/Field` with `htmlFor` plus an `id`-bearing input — 22 of the ~27 unassociated labels live in these files, so this is the same edit, not a separate sweep. Leave `ui/Field.tsx:62`'s `Toggle` alone: it wraps its input, which is valid implicit association. — *admin-panel-presentation: Form Labels Are Associated With Their Controls*
- [x] 5.11 Run `rg -n "bg-opacity" adminClient/src` — must return nothing. — *admin-panel-presentation: "The dead utility is gone"*
- [ ] 5.12 Manual readback: open each of the six dialogs, confirm the page is visible through a translucent backdrop, submit each with valid input, and confirm the same request and success behaviour as before. — *admin-panel-presentation: "The backdrop is translucent", "Migrated dialogs still submit"*
- [ ] 5.13 Manual readback: on a short viewport, open `CategoryFormModal` with overflowing content and confirm exactly one scroll container. — *admin-panel-presentation: "No nested scrollbars"*
- [ ] 5.14 Manual readback: attempt a credit change with an empty reason and with a whitespace-only reason; both must be refused with no request sent. Then submit with a real reason and confirm the `wallet_transactions.meta` column carries it instead of `NULL`. — *admin-safe-operations: "An adjustment without a reason is refused", "A whitespace reason is refused", "The reason reaches the transaction record"*
- [ ] 5.15 Manual readback: in each migrated dialog, click a field's label text and confirm focus moves to its control. — *admin-panel-presentation: "Migrated dialog labels focus their inputs"*
- [x] 5.16 Run `cd adminClient && npm run build && npm run lint`.

**Done condition**: all six dialogs render on `ui/Modal` with a translucent backdrop and working submission, no `bg-opacity` remains, a credit change requires a reason that reaches `meta`, and migrated labels focus their controls.

---

## Unit 6: ADM-08 — Confirmations on Destructive Actions

> Lift the existing pattern verbatim from `DeletionRequests.tsx` — staged-item state (`:56`), a
> stage-only danger button (`:179`), and a `ui/Modal` whose `description` names the specific record with
> a `loading`-guarded danger control (`:196-210`). Do **not** introduce `window.confirm`; none exists in
> the panel and it cannot identify the record. Do not build a shared `ConfirmDialog` primitive — that
> belongs in `ui/` and is ADM-09's migration.

- [x] 6.1 In `adminClient/src/pages/Invitations.tsx`, add `revoking` staged-item state; change the danger button at `:255-257` to stage instead of calling `handleRevoke` (`:116`) directly. — *admin-safe-operations: Irreversible Actions Require Explicit Confirmation*
- [x] 6.2 In `Invitations.tsx`, add a `ui/Modal` confirmation titled "¿Revocar esta invitación?" with the invitee email as `description`, a "Cancelar" ghost control, and a danger control "Sí, revocar" that is disabled while the request is in flight. — *admin-safe-operations: "Revoking an invitation asks first", "Double submission is prevented"*
- [x] 6.3 In `adminClient/src/pages/Communities.tsx`, add `removingDomain` staged-item state; change the `×` button at `:230-238` to stage instead of calling `remove` (`:199`) directly. — *admin-safe-operations: Irreversible Actions Require Explicit Confirmation*
- [x] 6.4 In `Communities.tsx`, add a `ui/Modal` confirmation titled "¿Quitar este dominio?" with `@{domain}` as `description` and confirm control "Sí, quitar". When `community.domains.length === 1`, the body must state that nobody will be able to self-register into that community — the consequence the page's own copy describes at `:219-220`. — *admin-safe-operations: "Removing a domain names the consequence"*
- [x] 6.5 In `adminClient/src/pages/DeletionRequests.tsx`, add `rejecting` staged-item state; change the "Rechazar" button at `:174-177` to stage instead of calling `resolve(request, "rejected")` (`:79`) directly. — *admin-safe-operations: Irreversible Actions Require Explicit Confirmation*
- [x] 6.6 In `DeletionRequests.tsx`, add a second `ui/Modal` titled "¿Rechazar esta solicitud?" with the requester email as `description` and confirm control "Sí, rechazar". Keep it as a separate instance from the existing "Borrar cuenta" modal at `:198` — do not generalize the two into one dialog. — *admin-safe-operations: "Rejecting a deletion request asks first"*
- [x] 6.7 **[Verify — do not modify]** Confirm the existing "Borrar cuenta" confirmation (`DeletionRequests.tsx:179`, `:196-210`) is unchanged. — *admin-safe-operations: Irreversible Actions Require Explicit Confirmation*
- [ ] 6.8 Manual readback: for each of the three actions, press the danger control and confirm **no** request is sent until the dialog's danger control is pressed; then cancel one and confirm the record is unchanged. — *admin-safe-operations: "Revoking an invitation asks first", "Cancelling leaves the record untouched", "Rejecting a deletion request asks first"*
- [ ] 6.9 Manual readback: with a confirmation in flight, press the danger control again and confirm no second request is sent. — *admin-safe-operations: "Double submission is prevented"*
- [ ] 6.10 Manual readback: on a community with exactly one domain, confirm the removal dialog states the self-registration consequence. — *admin-safe-operations: "Removing a domain names the consequence"*
- [x] 6.11 Run `cd adminClient && npm run build`.

**Done condition**: all three destructive actions require a second confirmation that names the record, double submission is blocked, and the pre-existing account-deletion confirmation is untouched.

---

## Unit 7: ADM-10 — Document Language and Identity

- [x] 7.1 Change `adminClient/index.html:2` from `lang="en"` to `lang="es"` — the interface is entirely Spanish. — *admin-panel-presentation: Document Language and Identity Are Correct*
- [x] 7.2 Replace the default Vite favicon reference at `adminClient/index.html:5` (`href="/vite.svg"`) with a Loop-branded icon, adding the asset under `adminClient/public/`. Leave `<title>` at `:7` unchanged — it is already "Loop Admin". — *admin-panel-presentation: "The scaffold favicon is gone"*
- [x] 7.3 Best-effort pass on the remaining unassociated `<label>`s outside the six modals covered in unit 5 (`Notifications.tsx` has 3). **Not a gate** — do not block the change on completeness. — *admin-panel-presentation: Form Labels Are Associated With Their Controls*
- [ ] 7.4 Manual readback: load the panel, confirm the document `lang` is `es` and the tab shows a Loop icon rather than the Vite default. — *admin-panel-presentation: "The document declares Spanish", "The scaffold favicon is gone"*
- [x] 7.5 Run `cd adminClient && npm run build`.

**Done condition**: the document declares Spanish and ships a Loop favicon; the title is unchanged.

---

## Final Gates

- [x] F.1 `cd adminClient && npm run build` (`tsc -b && vite build`) passes.
- [x] F.2 `cd adminClient && npm run lint` passes.
- [x] F.3 `cd server/api && npm run check-types` passes.
- [x] F.4 `cd server/api && npm run lint` passes.
- [x] F.5 `rg -n "console\.log" adminClient/src` returns nothing.
- [x] F.6 `rg -n "bg-opacity" adminClient/src` returns nothing.
- [x] F.7 `git diff --stat server/migrations/` is empty — this change adds no migration. — *admin-safe-operations: "This change does not modify the ledger"*
- [x] F.8 `git diff server/api/src/middlewares/parseAdminToken.ts` is empty. — *admin-authorization: "Scoping helpers are untouched"*
- [ ] F.9 `cd server/api && npm run test` compared against the recorded INF-06 baseline — **informational, not a gate**; the suite is known red pre-existing.
- [x] F.10 Confirm total changed lines are under the 800-line review budget; no chained PRs.

---

## Hand-offs (specified here, implemented elsewhere)

- **`credit-economy-integrity`** — first-class `admin_id` and `reason` columns on `wallet_transactions` (`database_creation.sql:98-108`), persisting `req.session.adminId` (available via `requireAdminId`, `controllers/admin.ts:21-25`) through the INSERT at `services/queries.ts:855-859`. Writing `meta.reason` in unit 5 is forward-compatible: a later migration can backfill from `meta->>'reason'`.
- **`credit-economy-integrity`** — `balance_after` is written `NULL` on every admin adjustment because the column is absent from that INSERT column list, making balance history unreconstructable.
- **`sec-hardening-api`** — `modifyUserCredits` performs no server-side validation of `amount` (`controllers/admin.ts:177-195` checks only `userId` presence); the sole guard today is client-side at `ModifyCreditsModal.tsx:40`.
- **`sec-hardening-api`** — rate limiting for the new unauthenticated `POST /admin/logout` route, if that change's middleware applies blanket limits.

## Recorded Follow-ups (explicitly deferred, not fixed here)

- `ui/Modal` has no overlay-click close, no focus trap and no body scroll lock (`ui/Modal.tsx:45-51`). Migrating to it is still correct, but it is not a free accessibility win — ADM-09.
- `GetAdminUsersRequest.query` does not declare `communityId` even though the controller reads it (`controllers/admin.ts:164`) and the client sends it (`adminApi.ts:15-17,78`) — pre-existing type drift.
- `adminClient` has no test runner; every check in this change is manual — ADM-07 / `delivery-and-ci`.
- The ~5 unassociated `<label>`s outside the six migrated modals — best-effort in 7.3, not a gate.
- ADM-09 in full: finishing the `ui/` migration, collapsible/responsive layout, dashboard business metrics, 404 route.
- ADM-01 public legal routes — `legal-public-routes`.
- Remaining ADM-10: `@types/axios` and `@types/react-router@5` pruning, `build.rollupOptions`, React Compiler verification on rolldown-vite, `Login`/`Register` direct DOM access, `publish.js:14` CWD-relative path, README template, navigation emojis.
- All §7.1 missing capabilities — delete community, user detail/ban/disable, community column for super admin, mass notifications, admin listing/revocation, content moderation. PROD roadmap (PROD-01…PROD-05), not audit fixes.
- **Dropped from scope entirely**: the ADM-10 lockfile item. `adminClient/.gitignore` does not exclude `package-lock.json` and the lockfile is already tracked — fixed in commit `93e9015`.
