# Proposal: Admin Panel Fixes (AUDITORIA-2026-09 §7)

## Intent

The admin panel is the only tool Loop has for operating a community, and four of its high-severity
findings are outright breakage rather than polish: a super admin literally cannot authorize another
admin, half of every user list is unreachable, six dialogs render behind an opaque black wall, and
community logos never load. A fifth leaves the session cookie valid for 30 minutes after the operator
clicks "Cerrar sesión". This change fixes those, plus the cheap subset of the audit-trail and hygiene
findings, without touching the parts of the server that two parallel changes already own.

Every claim below was read in the source before being specified. Where the audit was wrong, see
**Corrections to the Audit**.

## Scope

### In Scope

- **ADM-02** — super admin can authorize admins: send `role` and `communityId`, route errors through
  `getErrorMessage`.
- **ADM-03** — user pagination: the API publishes its page size, the UI stops hardcoding `20`.
- **ADM-04** — migrate the six legacy `bg-black bg-opacity-50` modals onto the existing `ui/Modal`.
- **ADM-05** — community logos resolve through `getUrl`, matching the school screens.
- **ADM-06** — `POST /admin/logout` clears the cookie; an axios 401 interceptor ends dead sessions.
- **ADM-08 (admin-side only)** — mandatory reason on credit changes, confirmation on the three
  unguarded destructive actions, `partialize` the session store off PII, remove the two `console.log`s.
- **ADM-10 (partial)** — `index.html` `lang="es"` + a real favicon; `htmlFor` on the labels that the
  ADM-04 migration already rewrites.

### Out of Scope

- **ADM-01** — public legal/privacy/account-deletion routes. Owned by the `legal-public-routes` block.
- **ADM-07** — admin unit/E2E tests. Owned by the `delivery-and-ci` block. `adminClient` has **no test
  runner at all** (no `test` script, no vitest/jest, no `@testing-library/*`); this change does not add
  one, so every acceptance check here is a manual readback.
- **ADM-09** — finishing the `ui/` migration, collapsible/responsive layout, dashboard redesign, 404.
  Too large; deferred to its own change.
- **Remaining ADM-10** — `@types/axios` / `@types/react-router@5` pruning, `build.rollupOptions`,
  React Compiler verification, `Login`/`Register` DOM access, `publish.js` CWD, README, navigation
  emojis.
- **All §7.1 missing capabilities** — delete community, user detail/ban/disable, community column for
  super admin, mass notifications, admin listing/revocation, moderation. These are PROD roadmap items
  (PROD-01…PROD-05), not audit fixes.
- **Server ownership boundaries.** `sec-hardening-api` owns security middleware, env validation and the
  admin endpoint Zod schemas. `credit-economy-integrity` owns `wallet_transactions` and the ledger.
  This change adds exactly one server route (`POST /admin/logout`, unclaimed) and one additive response
  field (`pagination` on `GET /admin/users`). It adds **no migration**.

## Capabilities

### New Capabilities

- `admin-authorization` — who may authorize an admin, in which role, for which community, and how
  authorization failures are surfaced.
- `admin-session-lifecycle` — server-side session termination, expiry detection, and what the panel is
  allowed to persist in `localStorage`.
- `admin-safe-operations` — confirmation before irreversible admin actions, and the audit trail a
  credit adjustment must carry.
- `admin-panel-presentation` — pagination correctness, dialog surface, media URL resolution, and
  document-level accessibility.

### Modified Capabilities

- None. `openspec/specs/` is empty.

## Approach

**ADM-02 — the backend is already correct; only the client is broken.** `controllers/admin.ts:135-160`
already accepts `role` and `communityId` in the body, and `adminApi.ts:62-72` already accepts an
`options` argument. `AuthorizeAdmin.tsx:27` simply never passes it. The fix is client-only: a role
selector rendered for super admins, `CommunityFilter allowAll={false}` when the chosen role is
`community_admin`, and `getErrorMessage` in place of the raw `err.response?.data?.error` at
`AuthorizeAdmin.tsx:38`.

The security invariant is untouched. `adminScopeCommunityId` (`middlewares/parseAdminToken.ts:64-77`)
ignores the request value entirely for a `community_admin` and returns the token's community; only a
`super_admin` may name one. Sending `communityId` from the client does not weaken that — for the role
that could abuse it, the value is discarded server-side. `requireSuperAdmin` semantics are unchanged;
the 403 for a non-super admin requesting `super_admin` stays exactly where it is
(`controllers/admin.ts:141-147`).

**ADM-03 — publish the page size, do not duplicate the constant.** `Users.tsx:33` computes
`Math.ceil(total / 20)`; the server pages by `PAGE_SIZE = 10` (`config.ts:156`, applied at
`models/admin.ts:312-314`). The response currently carries only `{ users, total }`
(`controllers/admin.ts:171`). The fix is for the API to return its own page size and for the UI to
divide by the value it received. A `PaginatedApiResponse<T>` envelope with a `pagination` field
already exists at `shared/types/apiCalls.d.ts:25-27` and is already used by
`GetAdminInvitationsResponse` (`:741`), so this reuses an established shape rather than inventing one.

The audit suggested "expose `pageSize` in the response **or** in the shared type". Both, and neither
costs a tsconfig change — see correction 5. The runtime value is what fixes the bug; the shared type is
what stops it drifting again.

**ADM-04 — the migration cost is the footer, not the backdrop.** All six modals hand-roll the same
`bg-black bg-opacity-50` overlay plus a `p-6 rounded-lg shadow-lg` card, with their action buttons
*inside* the `<form>`. `ui/Modal` puts actions in a `footer` prop outside the body, so each migration
must re-wire submit (a `form` attribute on the footer button, or a shared submit handler). That, not the
class swap, is the work. `CategoryFormModal` and `MissionFormModal` map to `size="lg"`; the other four
to `size="md"`.

**ADM-05 — confirmed, not "to be confirmed".** Traced end to end: `models/upload.ts:35` inserts
`url: filename`, `utils/parseDb.ts:91-98` returns the column verbatim, and the schema stores plain
`TEXT` (`database_creation.sql:61-68`). So `community.media.url` is a bare filename like `abc123.webp`,
and `<img src="abc123.webp">` resolves against the SPA origin. The school screens already do it right
(`SchoolsTable.tsx:44`, `EditSchoolModal.tsx:170`). There is only **one** render site to fix in
`CommunityFormModal` (`:217`) — `:89` and `:109` are state assignments, so wrapping at the render site
is the single-point fix.

**ADM-06 — logout must not require a valid session.** If `POST /admin/logout` sat behind
`adminTokenMiddleware`, an already-expired cookie would 401, the new interceptor would call logout,
and that would 401 again. The route is therefore mounted unauthenticated: it only clears a cookie, it
is idempotent, and it discloses nothing. The clear must mirror `adminCookieOptions`
(`config.ts:146-151`) on `httpOnly`/`secure`/`sameSite`/`path` or the browser refuses the removal.

The 401 interceptor needs two exclusions or it makes things worse: a failed **login** must show
"credenciales inválidas" rather than bounce, and the logout call itself must never re-trigger it.

**ADM-08 — the reason can ship today; the columns cannot.** The `meta` jsonb plumbing already runs end
to end (`adminApi.ts:88-93` → `controllers/admin.ts:177-195` → `models/admin.ts:353-361`), and it is
currently always `null`. So the admin UI can make a reason mandatory and send it through `meta`
immediately, with no server change and no migration. Promoting `reason` and `admin_id` to first-class
columns on `wallet_transactions` is specified here as a requirement but **handed off to
`credit-economy-integrity`**, which owns that table.

Confirmations reuse the existing two-step pattern verbatim from `DeletionRequests.tsx` (`:56` staged
item state, `:179` stage-only danger button, `:196-210` `ui/Modal` with a `description` naming the
record and a `loading`-guarded danger button). There is no `window.confirm` anywhere in the panel and
none is introduced.

`partialize` carries a real tradeoff: dropping `fullName` and `communityName` from `localStorage` means
the sidebar shows its fallbacks until the next API response. That is accepted — see design D6.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `adminClient/src/pages/AuthorizeAdmin.tsx` | Modified | Role selector, community selector, `getErrorMessage` |
| `adminClient/src/pages/Users.tsx` | Modified | Page count from response; drop `console.log` |
| `adminClient/src/pages/Communities.tsx` | Modified | `getUrl` on logo; confirm on domain removal |
| `adminClient/src/pages/Invitations.tsx` | Modified | Confirm on revoke |
| `adminClient/src/pages/DeletionRequests.tsx` | Modified | Confirm on reject |
| `adminClient/src/components/CommunityFormModal.tsx` | Modified | `getUrl` at the render site |
| `adminClient/src/components/{ModifyCredits,ResetPassword,CreateSchool,EditSchool,CategoryForm,MissionForm}Modal.tsx` | Modified | Migrate to `ui/Modal`; `htmlFor` on labels |
| `adminClient/src/components/ModifyCreditsModal.tsx` | Modified | Mandatory reason field → `meta` |
| `adminClient/src/api/loop.ts` | Modified | 401 interceptor; drop `console.log(API_URL)` |
| `adminClient/src/api/adminApi.ts` | Modified | `logout()` call |
| `adminClient/src/stores/session.ts` | Modified | `partialize` |
| `adminClient/src/services/getUrl.ts` | Modified | Pass through absolute URLs |
| `adminClient/index.html` | Modified | `lang="es"`, favicon |
| `server/api/src/routes/admin.ts` | Modified | `POST /logout` |
| `server/api/src/controllers/admin.ts` | Modified | `logout` handler; `pagination` in `getUsers` |
| `shared/types/apiCalls.d.ts` | Modified | `GetAdminUsersResponse` gains pagination; logout types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The 401 interceptor bounces a failed login instead of showing the error | High | Excluded by URL; explicit scenario in `admin-session-lifecycle` |
| 401 interceptor loops via the logout call itself | Med | Logout route is unauthenticated and interceptor-excluded |
| `clearCookie` options drift from `adminCookieOptions` → cookie survives | Med | Clear reuses the exported object, never re-typed literals |
| Six modal migrations regress form submission (footer is outside `<form>`) | High | One modal per work unit; manual submit readback each |
| `partialize` blanks the sidebar name/community after reload | Med | Accepted, documented in D6; fallbacks already exist |
| ADM-02 change misread as weakening community scoping | Med | Server ignores client `communityId` for community admins; called out in the PR |
| Collision with `credit-economy-integrity` on `wallet_transactions` | Med | This change writes only `meta`; no migration, no column, no query change |
| Collision with `sec-hardening-api` on admin routes/schemas | Low | Single additive unauthenticated route; no middleware, no Zod schema touched |
| No test runner → every check is manual | High | Explicit manual readback checklist per unit; ADM-07 owns the real fix |

## Rollback Plan

No DB migration, so rollback is a plain revert. The change is not multi-tenant-risky: it adds no query,
no `withClient` call site, and no `community_id` handling. The two server edits are independently
revertible — dropping the `/logout` route degrades to today's behaviour (cookie expires on its own in
30 minutes), and dropping the `pagination` field degrades to today's `{ users, total }` payload, which
the fixed client must therefore tolerate defensively (D2).

## Dependencies

- Branch `fix/auditoria-2026-09` (already checked out).
- No dependency on `sec-hardening-api` or `credit-economy-integrity` landing first; the boundaries are
  disjoint. The `reason`/`admin_id` column promotion is a hand-off *to* `credit-economy-integrity`.
- `adminClient` typecheck is `npm run build` (`tsc -b && vite build`); there is no `check-types` script.

## Corrections to the Audit

Each was verified directly in the source.

1. **ADM-10 lockfile claim is FALSE — already fixed.** The audit says `adminClient/.gitignore` excludes
   `package-lock.json`. It does not: the file is 24 lines and contains no `lock` entry at all
   (`rg -n "lock" adminClient/.gitignore` → no match). `adminClient/package-lock.json` exists (137,363
   bytes) and is **tracked** (`git ls-files --error-unmatch` succeeds), committed in
   `93e9015 chore(admin): versiona el lockfile y registra la línea base de typecheck`. **Removed from
   scope — there is nothing to do.**

2. **`ui/Modal` does not use `bg-black/50`.** `ui/Modal.tsx:46` is
   `bg-slate-900/50 ... backdrop-blur-sm`. The ADM-04 migration target string in the audit is wrong;
   using `bg-black/50` would make the migrated modals inconsistent with the already-migrated ones.

3. **`ui/Modal` provides less than assumed.** It has Escape-to-close (`:34-41`) and
   `role="dialog" aria-modal="true"` (`:48-49`), but **no** overlay-click close, **no** focus trap, and
   **no** body scroll lock. Migrating to it is still correct, but it is not a free accessibility win;
   those gaps are recorded as follow-ups, not fixed here.

4. **ADM-02 breaks only for super admins.** The audit implies the page is broken outright. For a
   `community_admin` it works today, because `adminScopeCommunityId` takes the community from the token
   and ignores the body (`middlewares/parseAdminToken.ts:71-76`). Only `super_admin` gets
   `COMMUNITY_REQUIRED`. A second, unreported half of the bug: because `role` is never sent, a super
   admin also cannot mint another super admin — `controllers/admin.ts:140` silently collapses the role
   to `community_admin`.

5. **`adminClient` DOES see `shared/types/`.** `AGENTS.md:170` says the admin has its own type
   definitions, implying the shared types are unavailable. That is outdated:
   `adminClient/tsconfig.app.json` ends with `"include": ["src", "../shared/types/**/*.d.ts"]`, and the
   types are ambient globals (neither `.d.ts` has a top-level `export`), which is why `adminApi.ts` uses
   `GetAdminUsersResponse` with no import. **Consequence: the shared-type route for ADM-03 costs zero
   tsconfig change.** The coordinator's guidance to avoid widening the tsconfig is satisfied trivially —
   nothing needs widening.

6. **Audit paths are slightly off.** The middleware directory is `server/api/src/middlewares/`, not
   `middleware/`. `addValidEmailForRegistration` spans `controllers/admin.ts:135-160`, not `140-153`.
   `AuthorizeAdmin.tsx`'s raw error render is at `:38`, not `:37`.

7. **ADM-05 has one render site in `CommunityFormModal`, not three.** `:89` and `:109` assign state;
   only `:217` is an `src`. `Communities.tsx:110` is the second real site. Two `src` fixes total.

8. **Two audit gaps ADM-08 does not mention.** `balance_after` is written as `NULL` on every admin
   credit adjustment — it is absent from the INSERT column list (`services/queries.ts:855-859`), so
   balance history is unreconstructable. And the controller validates nothing about `amount`
   (`controllers/admin.ts:177-195` checks only that `userId` is present); the sole guard is
   `ModifyCreditsModal.tsx:40` on the client. Both are recorded and **handed off** —
   `balance_after` to `credit-economy-integrity`, `amount` validation to `sec-hardening-api`.

9. **The `meta` audit path already exists.** `adminApi.ts:92` → `controllers/admin.ts:179` →
   `models/admin.ts:359` all carry `meta`, always `null` today. The reason field needs no server change,
   which lowers the ADM-08 estimate materially.

10. **Label count and overlap.** 33 `<label` in `adminClient/src`, only 6 raw `<label htmlFor>`, so ~27
    unassociated — the audit's number is right. But 22 of them sit inside the six ADM-04 modals, so the
    label fix is the *same edit* as the modal migration and is sequenced inside it rather than as a
    separate sweep.

11. **`index.html` is only partial scaffold residue.** `lang="en"` (`:2`) and the Vite favicon (`:5`)
    are confirmed, but `<title>` is already `Loop Admin` (`:7`) — no change needed there.

## Size Forecast and Delivery

Forecast **~620 changed lines**, under the 800-line session review budget. Single PR on
`fix/auditoria-2026-09`; chained PRs are **not** recommended. Work units below are commit boundaries
within that one PR, not separate PRs.

## Success Criteria

- [ ] A super admin can authorize both a `community_admin` (with a community) and a `super_admin`
      (without one); a community admin sees no role or community selector and still succeeds.
- [ ] `COMMUNITY_REQUIRED` renders as "Hay que elegir una comunidad para esta acción.", never raw.
- [ ] With 25 users, the pager offers 3 pages and page 3 is reachable.
- [ ] All six migrated modals show a translucent backdrop and still submit correctly.
- [ ] Community logos render in `Communities` and `CommunityFormModal`.
- [ ] "Cerrar sesión" clears `admin_token`; a subsequent authenticated request 401s.
- [ ] With an expired cookie, the next request redirects to `/login` instead of failing silently.
- [ ] A credit change without a reason is rejected client-side; with one, the reason reaches `meta`.
- [ ] Revoke invitation, remove domain and reject deletion all require a second confirmation.
- [ ] `localStorage.session-storage` contains no `email`, `fullName` or `communityName`.
- [ ] No `console.log` remains in `adminClient/src`.
- [ ] `cd adminClient && npm run build` passes; `npm run lint` passes.
