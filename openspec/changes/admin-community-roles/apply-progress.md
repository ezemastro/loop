# Apply Progress: admin-community-roles

Tracks slice-by-slice completion so a container restart loses at most one slice. Update this
file immediately after each slice builds green and is committed.

## Slice 1 — Community Scoping Wiring

- Status: DONE (completed in a previous apply batch, before this file existed)
- Branch: `feat/admin-community-scoping`
- Commit: `4230264`
- Verification: `adminClient npm run build` passes; zero new lint errors
- Tasks: 1.1–1.5 all `[x]` in `tasks.md`

## Slice 4 — Brand Tokens & Icon Foundation

- Status: DONE
- Branch: `feat/admin-brand-tokens` (off `main`)
- Commit: `6efb20f` — "feat(admin): tokens de marca e iconografia lucide-react"
- Tasks: 4.1–4.9 all `[x]` in `tasks.md`
- Verification:
  - `cd adminClient && npm run check:tokens` → passes against unmodified `client/config.ts`
  - `cd adminClient && npm run build` → passes (tsc -b && vite build)
  - `cd adminClient && npm run lint` → 13 errors (matches pre-existing baseline exactly, zero new)
- Deviation from design (documented, not silent): task 4.7 changed `EmptyState`'s `icon` prop
  from `string` to `LucideIcon`. Four call sites outside the slice's assigned file list already
  passed an emoji string to that prop (`Communities.tsx`, `Schools.tsx`, `Invitations.tsx`,
  `DeletionRequests.tsx`) and broke `tsc -b`. Fixed only the `icon={...}` value at each of those
  4 call sites (swap emoji → matching lucide icon: `Building2`, `Building2`, `Mail`, `Archive`)
  to keep slice 4 buildable standalone. Left everything else in those 4 pages untouched — the
  full UI-kit migration of those pages (PageHeader, Input, Button, remaining inline emoji) stays
  assigned to Slice 5 tasks 5.1/5.5 as designed.
- Also added a scoped ESLint override (`adminClient/eslint.config.js`, `scripts/**/*.mjs` →
  `globals.node`) — the new `check-brand-tokens.mjs` script tripped `no-undef` on
  `console`/`process` under the package's browser-only global config.
- `lucide-react@1.40.0` installed cleanly (registry's actual current version; the design's
  placeholder `0.545.0` was stale — major version bump upstream). Confirmed React 19 in its
  peerDependencies before depending on it.
- Full `rg` emoji re-scan of `adminClient/src` after this slice found exactly the files/counts
  the design predicted remain for Slice 5: `Notifications.tsx` (4), `AuthorizeAdmin.tsx` (4),
  `Communities.tsx` (1 remaining, inline avatar placeholder), `SchoolsTable.tsx` (1). No
  emoji-range false negatives found; the only other Unicode-range matches were `⇔`/`⇒` inside
  Spanish code comments (not functional icons, correctly out of scope).

## Slice 5 — Remaining Icons & UI-Kit Application

- Status: DONE
- Branch: `feat/admin-ui-kit-migration` (stacked on `feat/admin-brand-tokens`)
- Verification: `npm run build` passes; `npm run lint` = 13 errors (exact pre-existing baseline,
  zero new); `npm run check:tokens` passes; full emoji-range `rg` scan of `src` returns nothing.
- **Branch-structure correction (important).** The design declared slices 1-4 mutually
  independent. That is false for slice 1 vs slice 5: both edit `Dashboard.tsx`,
  `Notifications.tsx` and `Users.tsx`. Slice 4 and 5 had been branched off `main`, so the
  redesigned Dashboard silently dropped slice 1's `CommunityFilter`. Fixed by rebasing into a
  real linear stack: `main` -> slice 1 -> slice 4 -> slice 5. The three conflicts were resolved
  so both the community selector and the UI-kit layout survive, using `PageHeader`'s existing
  `filters` slot. Future slices MUST stack, not branch off `main`.
- Beyond the assigned file list, two brand gaps were closed because they were the most visible
  off-brand elements left: `ui/Button.tsx` primary variant went from `bg-indigo-600` to
  `bg-brand-primary`, and its focus ring from `indigo-500` to `brand-primary`.
- `AuthorizeAdmin.tsx` fully migrated to the kit (`PageHeader`, `Card`/`CardBody`, `Input`,
  `Button`, `Alert`), removing its 4 emoji. `Communities.tsx` -> `Building2`,
  `SchoolsTable.tsx` -> `School as SchoolIcon` (aliased: the bare name collides with the
  file's existing `School` type).
- Dashboard redesign: explicit `STAT_META` label map in Spanish for the 3 real `global_stats`
  names, headline stat (`total_kg_waste`) rendered at `size="lg"` with the two derived
  environmental stats secondary, all through `StatCard`; `LoadingBlock` and `EmptyState`
  replace the bare-text states.

## Slice 3 — Bootstrap Guard & Recovery Runbook

- Status: DONE
- Branch: `feat/admin-bootstrap-guard` (stacked on `feat/admin-ui-kit-migration`)
- Commit: `2be7936` — "feat(api): guardia de arranque para super_admin y runbook de recuperación"
- Tasks: 3.1–3.7 all `[x]` in `tasks.md`
- Verification:
  - `cd server/api && npm run check-types` → passes (`tsc --noEmit`, clean)
  - `cd server/api && npm run check-sql` → 222 call sites verified, OK (new `countSuperAdmins`
    query has zero params, matches its zero-arg call site)
  - `cd server/api && npx jest src/services/bootstrapChecks.test.ts` → 5/5 passing (zero rows
    warns and continues; ≥1 row is silent; hard-exit only under `NODE_ENV=production` AND the flag;
    production-without-flag and flag-without-production both stay warn-only)
- Implementation notes:
  - `server/api/src/env.ts`: added `REQUIRE_SUPER_ADMIN_ON_BOOT` next to `REQUIRE_EMAIL_
    VERIFICATION`, same `z.enum(["true","false"]).optional()` shape.
  - `server/api/src/config.ts`: re-exported it as a resolved boolean
    (`REQUIRE_SUPER_ADMIN_ON_BOOT = env.REQUIRE_SUPER_ADMIN_ON_BOOT === "true"`) — not in the
    original task list, but every other flag `bootstrapChecks.ts` needed to read
    (`REQUIRE_EMAIL_VERIFICATION`, `NODE_ENV`) already follows this exact re-export pattern in
    `config.ts`, so this keeps `bootstrapChecks.ts` consistent with `postgresClient.ts`'s own
    `NODE_ENV` import instead of reading `env.js` directly.
  - `server/api/src/services/queries.ts`: added `countSuperAdmins` (`SELECT count(*)::int AS count
    FROM admins WHERE role = 'super_admin'`), zero params.
  - `server/api/src/services/bootstrapChecks.ts`: `assertSuperAdminExists()` per Decision 2 —
    `withClient(fn, { unscoped("bootstrap") })`, `console.error` with the runbook path on zero
    rows, `throw` (caught by `index.ts`'s existing `.catch` → `process.exit(1)`, same shape as
    `assertDbHardening`'s failure path) only under `NODE_ENV==="production" &&
    REQUIRE_SUPER_ADMIN_ON_BOOT`.
  - `server/api/src/index.ts`: chained `assertSuperAdminExists()` after `assertDbHardening()`
    resolves in both the production branch (blocks `listen()`, same `.catch` → `exit(1)`) and the
    non-production branch (chained onto the already-fire-and-forget `assertDbHardening()` promise,
    so it stays non-blocking — the hard-fail path is unreachable there anyway since it requires
    `NODE_ENV==="production"`, which this branch structurally excludes). `test` branch untouched.
  - `server/api/src/scripts/migrate.ts`: the warning is scoped to migrations whose SQL actually
    references `app.authorized_admin_email` (detected via `migration.sql.includes(...)`, currently
    `0000` and `0006`), not every pending migration — the task said "before `exposeMigrationSettings`
    runs the promotion migration" specifically, and warning on every unrelated future migration
    while the var is unset would be log noise unrelated to BOOT-3's actual scenario.
  - `docs/runbook-super-admin-recovery.md`: read-only verification first, then the promotion
    `UPDATE` (both `role` and `community_id` in the same statement, per
    `admins_role_scope_chk`), an explicit rollback section requiring the original row captured in
    step 1, and the logout/re-login requirement tied to the 30-minute admin token. Written in
    Spanish per the language contract (operator-facing).

## Slice 2 — Grant-Path & Scope Regression Tests

- Status: DONE
- Branch: `feat/admin-role-grant-tests` (stacked on `feat/admin-bootstrap-guard`)
- Commit: `fe67396` — "test(api): regresión de grants de rol y de scope forzado por token"
- Tasks: 2.1–2.8 all `[x]` in `tasks.md`
- Verification:
  - `cd server/api && npm run check-types` → passes
  - `cd server/api && npx jest src/middlewares/parseAdminToken.test.ts` → 10/10 passing
  - `cd server/api && npx jest src/controllers/admin.test.ts` → 5/5 passing
  - Both files run together (`npx jest src/controllers/admin.test.ts
    src/middlewares/parseAdminToken.test.ts`) → 15/15 passing, no cross-file interference
  - Ran by exact file path only, per INF-06 — the full suite was never invoked and stays red
- Implementation notes:
  - `server/api/src/middlewares/parseAdminToken.test.ts` (new): unit tests calling
    `adminScopeCommunityId` directly against hand-built `Request` objects (no Express, no DB) —
    covers both roles: `super_admin` (undefined/null/empty → `null`; a valid UUID passed through;
    a non-UUID rejected with `InvalidInputError`) and `community_admin` (a spoofed `requested`
    community is always ignored in favor of the token's own; a missing `adminCommunityId`, or no
    session at all, fails closed with `UnauthorizedError` rather than falling back to unscoped).
  - **Deviation (necessary, documented):** `server/api/jest.config.js`'s `unit` project `testMatch`
    listed `models/`, `controllers/`, `routes/`, `utils/`, `services/` but not `middlewares/` — the
    exact directory `parseAdminToken.ts` lives in and the exact path the tasks artifact assigned
    for 2.1. Added `"**/middlewares/**/*.test.ts"` to `testMatch`; without it the assigned test file
    could not run at all (`jest ... parseAdminToken.test.ts` → "No tests found").
  - `server/api/src/controllers/admin.test.ts` (new): Supertest against a standalone Express app
    (`express()` + `cookieParser()` + real `adminRouter`, mirroring the isolation pattern in
    `routes/uploads.test.ts`) — `adminTokenMiddleware` runs for real (cookies built with the real
    `generateAdminToken`), so role gating is exercised end-to-end, not just at the unit level.
    `AdminModel.addValidEmailForRegistration` and `AdminModel.getUsers` are mocked (`jest.mock`) to
    assert call arguments without touching the DB. Five cases: community_admin → super_admin is
    rejected 403 with zero model calls; super_admin → super_admin succeeds with `communityId:
    null`; community_admin(A) → community_admin with a spoofed `communityId: B` still creates the
    row scoped to A; super_admin → community_admin with `communityId: C` creates it scoped to C;
    `GET /admin/users?communityId=<other>` as community_admin(A) is still called with `communityId:
    A`.

## Work order note

Executing 4 → 5 → 3 → 2 per orchestrator instruction (UI work is the stated priority). This file
is updated after each slice lands, before starting the next.
