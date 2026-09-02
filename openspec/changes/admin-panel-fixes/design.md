# Design: Admin Panel Fixes (AUDITORIA-2026-09 §7)

## Technical Approach

Nine decisions, all constrained by three facts read in the source: the backend already accepts what
ADM-02 fails to send, the `meta` audit channel already runs end to end, and `adminClient` has no test
runner. Consequently the change is overwhelmingly client-side — one new server route, one additive
response field, **zero migrations** — and every acceptance check is a manual readback.

Delivered as one PR on `fix/auditoria-2026-09` with seven commit-sized work units.

## Verified Facts

These were read in the repository, not assumed. They drive the decisions below.

| Fact | Evidence |
|---|---|
| The authorize endpoint already accepts `role` and `communityId`; the client just never sends them | `controllers/admin.ts:135-160`; `adminApi.ts:62-72`; `AuthorizeAdmin.tsx:27` |
| Community scoping is token-derived: a `community_admin`'s request value is discarded server-side | `middlewares/parseAdminToken.ts:64-77` (`:71-76` ignores `requested`) |
| Server pages by 10; the client divides by 20 | `config.ts:156` `PAGE_SIZE = 10`, applied at `models/admin.ts:312-314`; `Users.tsx:33` |
| The users response carries only `{ users, total }` — no `page`, no `pageSize` | `controllers/admin.ts:171`; `models/admin.ts:327` |
| A `PaginatedApiResponse<T>` envelope already exists and is already used | `shared/types/apiCalls.d.ts:25-27`; `GetAdminInvitationsResponse` at `:741` |
| `adminClient` compiles against `shared/types` as ambient globals — no import, no alias | `adminClient/tsconfig.app.json` `"include": ["src", "../shared/types/**/*.d.ts"]` |
| `media.url` is a bare filename, stored as plain `TEXT` | `models/upload.ts:35` `url: filename`; `utils/parseDb.ts:91-98`; `database_creation.sql:61-68` |
| The school screens already resolve it correctly; the community screens do not | `SchoolsTable.tsx:44`, `EditSchoolModal.tsx:170` vs `Communities.tsx:110`, `CommunityFormModal.tsx:217` |
| No `logout` and no `clearCookie` exist anywhere in the API | `rg "logout\|clearCookie" server/api/src` → zero hits; `routes/admin.ts` is 132 lines, 26 routes |
| The cookie is set with env-conditional options and no explicit `path` | `config.ts:146-151` `adminCookieOptions`; set at `controllers/admin.ts:63`, `:94`, `:126` |
| The axios instance has no interceptors at all | `api/loop.ts` (10 lines, entire file); `rg "interceptors" adminClient/src` → zero hits |
| `persist` has no `partialize`, so the whole store including `email`/`fullName` hits `localStorage` | `stores/session.ts:41-47` |
| The `meta` jsonb channel is wired end to end and is always `null` today | `adminApi.ts:88-93` → `controllers/admin.ts:177-195` → `models/admin.ts:353-361` |
| `wallet_transactions` has `meta jsonb` but no `admin_id` and no `reason` | `database_creation.sql:98-108` |
| A two-step confirm pattern already exists and uses `ui/Modal` | `DeletionRequests.tsx:56`, `:179`, `:196-210` |
| Exactly six modals use the dead utility; `ui/Modal` uses a different backdrop than the audit claims | `rg "bg-opacity" adminClient` → 6 hits; `ui/Modal.tsx:46` `bg-slate-900/50 backdrop-blur-sm` |
| Tailwind v4 css-first, no config file — `bg-opacity-*` is a removed utility | `package.json` `tailwindcss 4.1.18`; `src/index.css:1` `@import "tailwindcss";` |
| `adminClient` has no test runner | `package.json` scripts are `dev`/`build`/`lint`/`preview`/`deploy`; no vitest/jest/testing-library |

## Architecture Decisions

### D1 — ADM-02: client-only fix, role drives whether a community is required

`AuthorizeAdmin.tsx` gains two controls, both gated on `useIsSuperAdmin()` (`stores/session.ts:52`):

```
role selector        rendered only for super_admin; values "community_admin" | "super_admin"
CommunityFilter      rendered only for super_admin AND role === "community_admin", allowAll={false}
```

The call becomes `adminApi.addValidEmailForRegistration(email, { role, communityId })`, using the
`options` parameter that already exists at `adminApi.ts:62-72`.

For a **community admin** nothing renders and nothing changes: they send no `role` (server defaults to
`community_admin` at `controllers/admin.ts:140`) and no `communityId` (server takes it from the token
at `parseAdminToken.ts:71-76`). Their flow is unchanged, which is why the bug never surfaced for them.

For a **super admin**, `role === "super_admin"` sends `communityId: undefined` — the server forces
`null` at `controllers/admin.ts:153-154` because a `CHECK` in the database requires super admins to
have no community. Selecting a community for a super-admin role is therefore not merely unnecessary,
it is invalid; the selector is hidden rather than disabled so the invalid state is unreachable.

Client-side, submit is blocked when `role === "community_admin" && !communityId`, so the round trip
that produces `COMMUNITY_REQUIRED` is avoided rather than merely translated.

**Security invariant preserved.** Sending `communityId` from the client cannot widen anyone's scope: the
only role whose value is honored is `super_admin`, which is already unscoped, and
`adminScopeCommunityId` validates it against `UUID_RE` before use (`parseAdminToken.ts:68`).
`requireSuperAdmin` (`parseAdminToken.ts:44-53`) is not touched, and the 403 guard for requesting
`super_admin` without being one (`controllers/admin.ts:141-147`) is not touched.

**Rejected**: adding `requireSuperAdmin` to the `/authorize-email` route. It would lock community
admins out of authorizing peers in their own community — a capability regression, not a fix.

### D2 — ADM-03: server publishes pagination, client trusts what it receives

Server, `controllers/admin.ts:171`:

```ts
return res.status(200).json(
  successResponse({ data: { users, total }, pagination: { page, pageSize: PAGE_SIZE, total } })
);
```

The exact envelope shape follows whatever `PaginatedApiResponse<T>` (`apiCalls.d.ts:25-27`) already
prescribes and `GetAdminInvitationsResponse` (`:741`) already demonstrates — this decision is to reuse
that shape, not to invent one. `data.total` is retained alongside it so the change is purely additive
and no existing consumer breaks.

Client, `Users.tsx:33`:

```ts
const pageSize = response.pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
```

The `??` fallback is deliberate: the two server edits must be independently revertible (proposal
rollback plan), so the client must tolerate a payload without `pagination`. `DEFAULT_PAGE_SIZE` is a
named constant in `Users.tsx` with a comment pointing at `server/api/src/config.ts:156`, not a bare
`20` — and it is 10, so even the fallback path is correct today.

`GetAdminUsersResponse` (`apiCalls.d.ts:519-522`) is updated to the paginated envelope. Because
`adminClient` already compiles against `shared/types` as ambient globals, this needs **no tsconfig
change and no import** — the type simply tightens where `adminApi.ts:78-83` already references it.

**Rejected**: duplicating `PAGE_SIZE = 10` as a client constant. That is exactly the drift the audit
asks us to prevent. **Rejected**: widening `adminClient/tsconfig.app.json`. Unnecessary — it already
includes `shared/types`.

### D3 — ADM-04: migrate to `ui/Modal`, footer is the real work

Target, per modal:

| Modal | Line | `size` | Note |
|---|---|---|---|
| `ModifyCreditsModal.tsx` | `:77` | `md` | also gains the D5 reason field |
| `ResetPasswordModal.tsx` | `:81` | `md` | |
| `CreateSchoolModal.tsx` | `:139` | `md` | file upload input |
| `EditSchoolModal.tsx` | `:146` | `md` | nullable `school` prop; guard at `:143` |
| `CategoryFormModal.tsx` | `:150` | `lg` | largest; double `overflow-y-auto` today |
| `MissionFormModal.tsx` | `:119` | `lg` | no scroll containment today |

The backdrop is not the cost. Each modal's action buttons currently live *inside* its `<form>`;
`ui/Modal` renders them in a `footer` prop *outside* the body. Each migration therefore re-wires
submission — the footer's submit button carries `form="<id>"` matching an `id` on the `<form>`, which
keeps native validation and Enter-to-submit working without lifting state.

`max-h-[90vh] overflow-y-auto` is dropped from all six cards: `ui/Modal` already constrains with
`max-h-[90vh]` and scrolls its body (`ui/Modal.tsx:50`, `:66`). Keeping both produces the nested
scrollers `CategoryFormModal` has today.

`if (!isOpen) return null` guards are removed — `ui/Modal` does it at `:43`. `EditSchoolModal.tsx:143`
is the exception: its guard is `!isOpen || !school`, so the `!school` half stays.

**Rejected**: swapping `bg-opacity-50` for `bg-black/50` in place. It fixes the pixel and leaves six
hand-rolled dialogs with no Escape handling, no `role="dialog"`, and no shared surface — the audit's
actual finding is the duplication.

**Recorded, not fixed**: `ui/Modal` has no overlay-click close, no focus trap, and no body scroll lock
(`ui/Modal.tsx:45-51`). Adding them changes behaviour for the five screens already using it, which is
`ui/`-migration work owned by ADM-09.

### D4 — ADM-05: fix at the render site, and harden `getUrl`

Two `src` attributes change:

```
Communities.tsx:110            src={community.media.url}  →  src={getUrl(community.media.url)}
CommunityFormModal.tsx:217     src={logoUrl}              →  src={getUrl(logoUrl)}
```

`CommunityFormModal.tsx:89` and `:109` are left alone. They assign state, and `:109` assigns from a
fresh upload response — wrapping at both assignment sites would work but leaves `logoUrl` holding two
different kinds of value depending on provenance. Wrapping once at the single render site keeps
`logoUrl` unambiguously "whatever the API gave us".

`services/getUrl.ts:3-5` gains an absolute-URL passthrough, mirroring the client's version:

```ts
export const getUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${FILE_BASE_URL}${path}`;
```

This is required, not cosmetic: demo/seed data can carry absolute URLs, and without the guard the fix
would break exactly the rows that render correctly today. It also makes the two call sites idempotent.

**Rejected**: resolving the URL server-side in `parseMediaFromDb`. That is a cross-cutting API contract
change affecting the mobile client and every media consumer — far outside an admin-panel fix.

### D5 — ADM-06: unauthenticated logout route, narrowly-scoped interceptor

**Server.** `POST /admin/logout` is mounted in `routes/admin.ts` alongside the other session routes
(`:17-20`), deliberately **without** `adminTokenMiddleware`:

```ts
adminRouter.post("/logout", AdminController.logout);
```

Rationale: the whole point is to end a session that may already be unusable. Behind the middleware, an
expired cookie would 401, the D5 interceptor would call logout, and that would 401 — a loop. The route
clears a cookie and returns success; it reads no session, touches no database, and discloses nothing,
so it is safe unauthenticated and idempotent.

The handler mirrors the set options rather than re-typing them:

```ts
static logout = async (_req: Request, res: Response) => {
  const { maxAge: _maxAge, ...clearOptions } = adminCookieOptions;
  res.clearCookie(COOKIE_NAMES.ADMIN_TOKEN, clearOptions);
  return res.status(200).json(successResponse({}));
};
```

`httpOnly`, `secure` and `sameSite` are env-conditional (`config.ts:146-151`); if the clear does not
match them the browser silently refuses the removal, which is the failure mode this fix exists to
prevent. `maxAge` is meaningless on a clear and is dropped. Neither set nor clear specifies `path`, so
both use Express's `/` default — consistent by construction.

**Client.** `api/loop.ts` gains a response interceptor:

```ts
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url ?? "";
    const isAuthRoute = /\/admin\/(login|register|google-login|logout)$/.test(url);
    if (error.response?.status === 401 && !isAuthRoute) {
      useSessionStore.getState().logout();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  },
);
```

The exclusion list is load-bearing. Without `login`, a wrong password 401s and the operator is bounced
to the page they are already on with no error shown — strictly worse than today. Without `logout`, the
interceptor can re-enter itself.

`useSessionStore.getState()` is used rather than the hook because this is module scope, not a
component. `window.location.replace` rather than the router: `loop.ts` sits outside the `RouterProvider`
tree and has no `navigate`, and a full reload is desirable here — it discards every stale query result
held in component state.

`Aside.tsx:45-48` becomes `await adminApi.logout()` then `logout()` then `navigate("/login")`, with the
network failure swallowed: if the server is unreachable, the local session must still be cleared.

**Rejected**: a request interceptor that pre-checks token expiry. The token is httpOnly and
deliberately unreadable from JS; the 401 is the only honest signal.

### D6 — ADM-08 PII: `partialize` to three fields, accept the cosmetic cost

`stores/session.ts:41-47` gains:

```ts
partialize: (state) => ({
  isLoggedIn: state.isLoggedIn,
  role: state.role,
  communityId: state.communityId,
}),
```

`email`, `fullName` and `communityName` stop being written to `localStorage`. The three retained fields
are not PII — they are the authorization shape the panel needs before its first API response to avoid
a flash of the wrong navigation (`Aside.tsx` gates on `useIsSuperAdmin()`, `Layout.tsx:14` on
`isLoggedIn`).

**Accepted tradeoff:** after a reload, `Aside.tsx:65` shows its `"Administrador"` fallback and the
community line renders empty until a fresh login. This is a real, visible regression in polish and it is
accepted — persisting an operator's name and email in plaintext `localStorage` on a shared or
school-managed machine is the worse outcome. `version` is bumped to `3` so existing stored blobs
containing PII are discarded on first load rather than lingering; the existing
`migrate: () => ({ ...LOGGED_OUT })` (`:46`) already forces a fresh login, so no new migration logic is
needed.

**Rejected**: `sessionStorage`. It narrows the exposure window but still stores PII in cleartext and
breaks the "still logged in in a new tab" behaviour operators rely on.

### D7 — ADM-08 audit trail: reason via `meta` now, columns handed off

**In this change (admin UI only).** `ModifyCreditsModal` gains a required reason input, validated
alongside the existing amount check at `:40`, and submits through the `meta` parameter that
`adminApi.ts:88-93` already exposes and that nothing currently populates:

```ts
await adminApi.modifyUserCredits(user.id, creditAmount, isPositive, { reason: reason.trim() });
```

That value already flows to `wallet_transactions.meta` unchanged (`controllers/admin.ts:179` →
`models/admin.ts:359`). So the *reason* half of ADM-08 is satisfiable today with no server edit, no
column, and no migration.

**Handed off to `credit-economy-integrity`.** Promoting `reason` and `admin_id` to first-class columns
on `wallet_transactions` is specified as a requirement in `admin-safe-operations` but implemented
there, because that change owns the table and the ledger. `admin_id` in particular cannot be done here
honestly: it must come from `req.session.adminId` (available via `requireAdminId`,
`controllers/admin.ts:21-25`) and be persisted through a modified INSERT
(`services/queries.ts:855-859`) — a ledger schema change by any definition.

Two further gaps found during verification and handed off with it: `balance_after` is written `NULL` on
every admin adjustment because the column is absent from that INSERT list, and `amount` receives no
server-side validation (`controllers/admin.ts:177-195` checks only `userId` presence) — the latter
belongs to `sec-hardening-api`, which owns the admin Zod schemas.

Writing `meta.reason` now is forward-compatible: a later migration can backfill a `reason` column from
`meta->>'reason'`.

### D8 — ADM-08 confirmations: lift the existing pattern verbatim

Three actions gain a second step, reusing `DeletionRequests.tsx`'s structure exactly — staged-item
state rather than a boolean, a `ui/Modal` whose `description` names the specific record, and an
in-flight `loading` guard on the danger button:

| Action | Stage-only trigger | Confirm copy (Spanish, matching surrounding UI) |
|---|---|---|
| Revoke invitation (`Invitations.tsx:255-257`) | `setRevoking(invitation)` | title `"¿Revocar esta invitación?"`, description = invitee email, confirm `"Sí, revocar"` |
| Remove domain (`Communities.tsx:230-238`) | `setRemovingDomain(entry)` | title `"¿Quitar este dominio?"`, description `"@{domain}"`, confirm `"Sí, quitar"` |
| Reject deletion request (`DeletionRequests.tsx:174-177`) | `setRejecting(request)` | title `"¿Rechazar esta solicitud?"`, description = requester email, confirm `"Sí, rechazar"` |

Domain removal warrants the strongest description: removing the last domain means nobody can
self-register into that community, which the page's own copy states at `Communities.tsx:219-220`. The
confirm body names that consequence when `community.domains.length === 1`.

`DeletionRequests.tsx` ends up with two confirm modals — the existing one for "Borrar cuenta" (`:198`)
and a new one for "Rechazar". They are kept as two separate `ui/Modal` instances with distinct state
rather than one generalized dialog: a shared `ConfirmDialog` primitive belongs in `ui/` and that is
ADM-09's migration, not this change's.

**Rejected**: `window.confirm`. None exists in the panel today and it cannot carry the record-identifying
description that makes these confirmations useful.

### D9 — ADM-10: only what the ADM-04 edit already touches

`index.html:2` `lang="en"` → `lang="es"` (the UI is entirely Spanish), and `:5` `href="/vite.svg"` →
a real admin favicon. `<title>` at `:7` is already `Loop Admin` — untouched.

Labels are **not** a separate sweep. 22 of the ~27 unassociated `<label>`s live inside the six modals
being rewritten in D3, and `ui/Field` (`ui/Field.tsx:9,19,28`) already takes `htmlFor` and renders the
`<label>`. So converting those modals' fields to `<Field label htmlFor>` + an `id`-bearing input fixes
both findings in one edit. The remaining handful outside those files
(`AuthorizeAdmin.tsx:74` is fixed by D1; `Notifications.tsx` has 3) is a best-effort pass, explicitly
not a completeness gate. `ui/Field.tsx:62`'s `Toggle` wraps its input in the `<label>` — valid implicit
association, no `htmlFor` needed, do not "fix" it.

The lockfile item is **dropped entirely** — already done in commit `93e9015` (proposal correction 1).

## Data Flow

```
ADM-02   AuthorizeAdmin (role, communityId)
           → adminApi.addValidEmailForRegistration(email, options)   [adminApi.ts:62-72, exists]
           → POST /admin/authorize-email
           → controllers/admin.ts:140  role default
           → controllers/admin.ts:153  super_admin ? null : requireScopeCommunityId(req, communityId)
           → parseAdminToken.ts:64-77  community_admin ⇒ token wins, request ignored   [INVARIANT]

ADM-03   models/admin.ts:312 PAGE_SIZE ──┐
                                          ├→ controllers/admin.ts:171  pagination.pageSize
         config.ts:156 PAGE_SIZE = 10 ───┘        → GetAdminUsersResponse [apiCalls.d.ts]
                                                  → Users.tsx  ceil(total / pagination.pageSize)

ADM-06   Aside "Cerrar sesión" → adminApi.logout() → POST /admin/logout (no auth)
                                                   → clearCookie(adminCookieOptions − maxAge)
         any 401 (except login/register/google-login/logout)
                                → session.logout() → window.location.replace("/login")

ADM-08   ModifyCreditsModal.reason → adminApi meta → controllers/admin.ts:179
                                   → models/admin.ts:359 → wallet_transactions.meta   [exists today]
         admin_id + reason columns ──────────────────────────→ credit-economy-integrity  [HAND-OFF]
         balance_after NULL ────────────────────────────────→ credit-economy-integrity  [HAND-OFF]
         amount validation ────────────────────────────────→ sec-hardening-api         [HAND-OFF]
```

## File Changes

| File | Action | Unit |
|---|---|---|
| `adminClient/src/pages/AuthorizeAdmin.tsx` | Modify — role + community selectors, `getErrorMessage` (D1) | 1 |
| `server/api/src/controllers/admin.ts` | Modify — `pagination` in `getUsers` (D2); `logout` handler (D5) | 2, 4 |
| `shared/types/apiCalls.d.ts` | Modify — `GetAdminUsersResponse` envelope (D2); logout types (D5) | 2, 4 |
| `adminClient/src/pages/Users.tsx` | Modify — page count from response; drop `console.log` (D2) | 2 |
| `adminClient/src/services/getUrl.ts` | Modify — absolute-URL passthrough (D4) | 3 |
| `adminClient/src/pages/Communities.tsx` | Modify — `getUrl` (D4); domain-removal confirm (D8) | 3, 6 |
| `adminClient/src/components/CommunityFormModal.tsx` | Modify — `getUrl` at `:217` (D4) | 3 |
| `server/api/src/routes/admin.ts` | Modify — `POST /logout`, unauthenticated (D5) | 4 |
| `adminClient/src/api/loop.ts` | Modify — 401 interceptor; drop `console.log` (D5) | 4 |
| `adminClient/src/api/adminApi.ts` | Modify — `logout()` (D5) | 4 |
| `adminClient/src/components/Aside.tsx` | Modify — server logout before local (D5) | 4 |
| `adminClient/src/stores/session.ts` | Modify — `partialize`, `version: 3` (D6) | 4 |
| `adminClient/src/components/ModifyCreditsModal.tsx` | Modify — `ui/Modal` (D3) + reason field (D7) | 5 |
| `adminClient/src/components/ResetPasswordModal.tsx` | Modify — `ui/Modal` (D3) | 5 |
| `adminClient/src/components/CreateSchoolModal.tsx` | Modify — `ui/Modal` (D3) | 5 |
| `adminClient/src/components/EditSchoolModal.tsx` | Modify — `ui/Modal` (D3) | 5 |
| `adminClient/src/components/CategoryFormModal.tsx` | Modify — `ui/Modal` (D3) | 5 |
| `adminClient/src/components/MissionFormModal.tsx` | Modify — `ui/Modal` (D3) | 5 |
| `adminClient/src/pages/Invitations.tsx` | Modify — revoke confirm (D8) | 6 |
| `adminClient/src/pages/DeletionRequests.tsx` | Modify — reject confirm (D8) | 6 |
| `adminClient/index.html` | Modify — `lang="es"`, favicon (D9) | 7 |
| `adminClient/public/favicon.svg` | Create — replaces the Vite scaffold icon (D9) | 7 |

No migration under `server/migrations/`. No `withClient` call site added or changed, so no
`inCommunity`/`unscoped` decision arises anywhere in this change.

## Testing Strategy

`adminClient` has **no test runner** — no `test` script, no vitest/jest, no `@testing-library/*`, zero
test files. Adding one is ADM-07's job, owned by `delivery-and-ci`. Proposing a suite here would mean
introducing a runner, a config, a jsdom environment and a rendering apparatus as a side effect of a bug
fix. Scope is therefore deliberately narrow and honest: static gates plus a manual readback checklist.

| Layer | What | How |
|---|---|---|
| Typecheck | Whole admin package | `cd adminClient && npm run build` (`tsc -b && vite build`) |
| Typecheck | API | `cd server/api && npm run check-types` |
| Lint | Both | `cd adminClient && npm run lint`; `cd server/api && npm run lint` |
| Source guard | No `console.log` left | `rg -n "console\.log" adminClient/src` → must be empty |
| Source guard | No dead Tailwind utility left | `rg -n "bg-opacity" adminClient/src` → must be empty |
| Source guard | No raw `data.error` render left in touched files | `rg -n "response\?\.data\?\.error" adminClient/src/pages` |
| API regression | Existing API suite | `cd server/api && npm run test` — **known red pre-existing (INF-06)**; compare against the recorded baseline, do not treat as a gate |
| Manual | Everything behavioural | The per-unit readback checklist in `tasks.md` |

Manual readback needs two accounts (`DEMO.md`): one `super_admin` and one `community_admin`. Cookie
assertions are done in DevTools → Application → Cookies (`admin_token`) and Local Storage
(`session-storage`).

`npm run check-sql` is unaffected — no query parameter count changes.

## Threat Matrix

| Boundary | Assessment |
|---|---|
| Multi-tenant / RLS | **Not weakened.** No query, no `withClient` call site, no `community_id` handling changes. `adminScopeCommunityId` and `requireSuperAdmin` are read but not modified. The client now *sends* `communityId`, which the server already ignores for every role that could abuse it (`parseAdminToken.ts:71-76`). |
| Credits ledger | **Not modified.** Only `meta` — an already-wired, currently-`null` jsonb field — is populated. No schema, INSERT, or balance arithmetic change. Column work is handed off to `credit-economy-integrity`. |
| New unauthenticated route | `POST /admin/logout` reads no session, touches no database, accepts no body, and returns a constant. Its only effect is clearing the caller's own cookie. Rate limiting is `sec-hardening-api`'s remit. |
| Session confidentiality | **Improved.** Cookie is now actually revoked on logout, and `localStorage` stops holding operator email and name. |
| Redirect handling | `window.location.replace("/login")` is a hardcoded same-origin literal — no user input reaches it, so no open-redirect surface. |
| Privilege escalation | The role selector cannot escalate: requesting `super_admin` without being one is rejected server-side at `controllers/admin.ts:141-147`, which this change does not touch. |

## Migration / Rollout

No data migration. One PR on `fix/auditoria-2026-09`, seven commit-sized units:

| # | Unit | Content | ~Lines |
|---|---|---|---|
| 1 | ADM-02 authorize | Role + community selectors, `getErrorMessage` | 90 |
| 2 | ADM-03 pagination | `pagination` in response, shared type, `Users.tsx` | 40 |
| 3 | ADM-05 logos | `getUrl` hardening + two call sites | 20 |
| 4 | ADM-06 + PII | Logout route/handler, interceptor, `Aside`, `partialize`, drop logs | 110 |
| 5 | ADM-04 + reason | Six modal migrations, `htmlFor`, mandatory reason | 280 |
| 6 | ADM-08 confirms | Three confirmation dialogs | 100 |
| 7 | ADM-10 document | `lang`, favicon | 10 |

Total ≈ 650. Units 1–4 are independent of each other. Unit 5 must precede unit 6 only where both touch
`Communities.tsx`/`DeletionRequests.tsx` — sequence as listed to avoid conflicts.

## Open Questions

- [ ] None blocking. The favicon asset (D9) is a design choice, not a decision — any Loop-branded SVG
      satisfies it, and shipping the existing Loop mark is the default.

## Recorded Follow-ups (not fixed here)

- `ui/Modal` lacks overlay-click close, focus trap, and body scroll lock (`ui/Modal.tsx:45-51`) — ADM-09.
- `wallet_transactions.balance_after` is written `NULL` on every admin adjustment
  (`services/queries.ts:855-859`) — **hand-off to `credit-economy-integrity`**.
- `wallet_transactions` needs first-class `admin_id` and `reason` columns —
  **hand-off to `credit-economy-integrity`**.
- `modifyUserCredits` validates nothing about `amount` (`controllers/admin.ts:177-195`) —
  **hand-off to `sec-hardening-api`**.
- `GetAdminUsersRequest.query` does not declare `communityId` even though the controller reads it
  (`controllers/admin.ts:164`) and the client sends it (`adminApi.ts:15-17,78`) — pre-existing type drift,
  not fixed here.
- `adminClient` has no test runner — ADM-07 / `delivery-and-ci`.
- The remaining ~5 unassociated `<label>`s outside the six migrated modals — best-effort, not a gate.
- Emojis in navigation and the `"créditos"`/`"loopies"` copy inconsistency — recorded decisions, ADM-09.
