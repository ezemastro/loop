# Tasks: Admin Community Roles — Gap Closure

Delivery: 5 independent-to-mostly-independent slices, chained PRs (`auto-chain`). Full forecast at
the end of this file.

## Phase 1: Community Scoping Wiring (Slice 1, ~130 lines, independent)

- [x] 1.1 `adminClient/src/pages/Users.tsx`: add `useCommunityScope()`, mount `<CommunityFilter
      allowAll communities={communities} value={selectedCommunityId}
      onChange={setSelectedCommunityId} loading={communitiesLoading} />` under `isSuperAdmin`, pass
      `scopeCommunityId` to `adminApi.getUsers`, reset `page` to `1` on community change, add
      `scopeCommunityId` to the `loadUsers` effect deps. [SCOPE-1, SCOPE-2]
- [x] 1.2 `adminClient/src/pages/Notifications.tsx`: same wiring; pass `scopeCommunityId` into the
      `adminApi.getUsers({ search })` call in `handleSearch`. [SCOPE-1, SCOPE-2]
- [x] 1.3 `adminClient/src/pages/Dashboard.tsx`: same wiring; call
      `adminApi.getStats({ communityId: scopeCommunityId })`, add `scopeCommunityId` to the
      `loadStats` effect deps. [SCOPE-1, SCOPE-2, SCOPE-4]
- [ ] 1.4 (PENDIENTE — QA manual, requiere ejecutar la app) Manual: as super_admin, pick a community on Users, navigate to Schools, confirm the same
      community is still selected (store persists across nav, resets on reload). [SCOPE-1]
- [ ] 1.5 (PENDIENTE — QA manual, requiere ejecutar la app) Manual: as community_admin, open Users/Notifications/Dashboard — confirm no selector
      renders and only own-community data appears. [SCOPE-2]

## Phase 2: Grant-Path & Scope Regression Tests (Slice 2, ~140 lines, independent)

- [x] 2.1 RED: `server/api/src/middlewares/parseAdminToken.test.ts` — failing test: for
      `community_admin`, `adminScopeCommunityId` ignores a client-supplied `requested` community and
      rejects a non-UUID value. [SCOPE-3, SCOPE-5]
- [x] 2.2 GREEN: `cd server/api && npm run test -- parseAdminToken.test.ts` — confirm it passes
      against existing `parseAdminToken.ts:58` (regression only, no production change expected).
      [SCOPE-3]
- [x] 2.3 RED: create `server/api/src/controllers/admin.test.ts` (Supertest) — case: `community_admin`
      submitting `role: "super_admin"` is rejected 403 `SUPER_ADMIN_REQUIRED`, no
      `admin_valid_emails` row created. [GRANT-1]
- [x] 2.4 RED: add case — `super_admin` granting `role: "super_admin"` succeeds, created row has
      `community_id = NULL`. [GRANT-1]
- [x] 2.5 RED: add case — `community_admin` of community A granting `community_admin` with a
      spoofed `communityId` for community B still creates a row scoped to A. [GRANT-2]
- [x] 2.6 RED: add case — `super_admin` granting `community_admin` with `communityId: C` creates a
      row scoped to `C`. [GRANT-3]
- [x] 2.7 RED: add case — `GET /admin/users?communityId=<other>` as `community_admin` returns only
      the token's own community. [SCOPE-3, SCOPE-5]
- [x] 2.8 GREEN: `cd server/api && npm run test -- admin.test.ts` — confirm all cases pass against
      existing `controllers/admin.ts:158-172` (regression only). [GRANT-1, GRANT-2, GRANT-3]

## Phase 3: Bootstrap Guard & Recovery Runbook (Slice 3, ~200 lines, independent)

- [x] 3.1 `server/api/src/env.ts`: add `REQUIRE_SUPER_ADMIN_ON_BOOT: z.enum(["true","false"
      ]).optional()`, default off, next to `REQUIRE_EMAIL_VERIFICATION` (`:82`). [BOOT-2]
- [x] 3.2 RED: `server/api/src/services/bootstrapChecks.test.ts` — mocked `withClient` (pattern:
      `postgresClient.test.ts:237`); failing cases: warns on 0 `super_admin` rows and continues; no
      warning when ≥1 row exists; exits only when `NODE_ENV==="production"` AND the flag is
      `"true"`. [BOOT-1, BOOT-2]
- [x] 3.3 GREEN: create `server/api/src/services/bootstrapChecks.ts` — `assertSuperAdminExists()`
      runs `SELECT count(*)::int FROM admins WHERE role='super_admin'` via
      `withClient(fn, { unscoped("bootstrap") })`; `console.error` with the runbook path on zero;
      `process.exit(1)` only under the flag+production condition. [BOOT-1, BOOT-2]
- [x] 3.4 `server/api/src/index.ts`: call `assertSuperAdminExists()` after `assertDbHardening()`
      resolves and before `listen()`, in both the production branch (`:207-215`) and the
      non-production branch (`:216-220`); leave the `test` branch (`:205-206`) untouched. [BOOT-1]
- [x] 3.5 `cd server/api && npm run test -- bootstrapChecks.test.ts` — confirm GREEN. [BOOT-1, BOOT-2]
- [x] 3.6 `server/api/src/scripts/migrate.ts:172`: log a warning when `AUTHORIZED_ADMIN_EMAIL` is
      unset/empty, before `exposeMigrationSettings` runs the promotion migration. [BOOT-3]
- [x] 3.7 Create `docs/runbook-super-admin-recovery.md`: read-only verification
      (`SELECT id, email, role, community_id FROM admins WHERE lower(email)=lower($1)` plus latest
      `schema_migrations` version) first; then idempotent
      `UPDATE admins SET role='super_admin', community_id=NULL WHERE id=<verified id>`; explicit
      instruction to log out/back in before relying on the new role. [BOOT-4, BOOT-5]

## Phase 4: Brand Tokens & Icon Foundation (Slice 4, ~280 lines, independent)

- [x] 4.1 Create `adminClient/src/styles/brand-tokens.css` with the `@theme` block (colors,
      `--font-sans`, text scale, radii) mapped from `client/config.ts:7-18`; header comment names
      `client/config.ts` as source of truth. [DESIGN-1, DESIGN-2]
- [x] 4.2 `adminClient/src/index.css`: import `brand-tokens.css`; drop the hardcoded `font-family`
      (`:4`). [DESIGN-1, DESIGN-2]
- [x] 4.3 Create `adminClient/scripts/check-brand-tokens.mjs`: parse hexes from `client/config.ts`,
      fail on mismatch vs `brand-tokens.css`; exit 0 with a notice if `client/config.ts` is absent.
      [DESIGN-1]
- [x] 4.4 `adminClient/package.json`: add `"lucide-react"` (pin the current registry version at
      apply time) and a `"check:tokens": "node scripts/check-brand-tokens.mjs"` script. [DESIGN-1,
      DESIGN-3]
- [x] 4.5 `cd adminClient && npm run check:tokens` — confirm it passes against unmodified
      `client/config.ts`. [DESIGN-1]
- [x] 4.6 `adminClient/src/components/ui/Alert.tsx`: change `TONES[].icon: string` →
      `LucideIcon`; replace its 4 emoji per the Decision 4 map; `size={16} strokeWidth={1.75}`,
      `currentColor`. [DESIGN-3]
- [x] 4.7 `adminClient/src/components/ui/EmptyState.tsx`: change `icon?: string` →
      `icon?: LucideIcon`; replace its emoji; `size={32}`, wrapper `text-slate-400`. [DESIGN-3]
- [x] 4.8 `adminClient/src/components/Aside.tsx`: change `NavItem.icon: string` → `LucideIcon`;
      re-scan with `rg` for the emoji Unicode ranges and replace all occurrences per the Decision 4
      map (confirm exact count at apply time — do not trust the ~12 estimate blindly). [DESIGN-3]
- [x] 4.9 Manual: render Aside, every `Alert` tone, and `EmptyState`; confirm no emoji glyph
      remains, decorative icons carry `aria-hidden`, icon-only usages carry `aria-label`. [DESIGN-3]

## Phase 5: Remaining Icons & UI-Kit Application (Slice 5, ~340 lines, depends on Phase 4)

- [x] 5.1 Re-scan `adminClient/src` with `rg` for emoji-range glyphs; replace remaining occurrences
      in `Notifications.tsx`, `AuthorizeAdmin.tsx`, `Communities.tsx`, `SchoolsTable.tsx`,
      `Schools.tsx`, `Invitations.tsx`, `DeletionRequests.tsx` per the Decision 4 map — text/Spanish
      copy stays unchanged. [DESIGN-3]
- [x] 5.2 Migrate `Dashboard.tsx`: `PageHeader` for the title, `StatCard` for stat tiles (replace
      the ad-hoc block at `:54-64`), `<Alert tone="error">` for the error state. [DESIGN-4]
- [x] 5.3 Migrate `Users.tsx`: `PageHeader`, `Input`/`Button` for the search form and pager,
      `<Alert tone="error">`. [DESIGN-4]
- [x] 5.4 Migrate `Notifications.tsx`: `PageHeader`, `Input`/`Button`/`Textarea` for the
      notification form, `<Alert tone="error">`, `EmptyState` for no results. [DESIGN-4]
- [x] 5.5 Migrate `Schools.tsx`, `Invitations.tsx`, `DeletionRequests.tsx`: replace remaining raw
      `<input>`/`<button>` and error `<div>`s with kit primitives. [DESIGN-4]
- [x] 5.6 Migrate `AuthorizeAdmin.tsx`, `Communities.tsx`, `Categories.tsx`, `Missions.tsx`: same
      pass. [DESIGN-4]
- [x] 5.7 Manual: diff Spanish copy on every migrated page before/after — confirm text is byte-for
      -byte unchanged, only tokens/iconography changed. [DESIGN-3 — "Adjacent copy is unaffected"]
- [x] 5.8 If the diff exceeds the 800-line session budget at apply time, split at the migration
      -order boundary: 5a = steps 5.2–5.4 (Dashboard, Users, Notifications), 5b = steps 5.1, 5.5–5.6
      (remaining 7 files), rather than requesting `size:exception`.

## Requirement Reference

`SCOPE-*` = `specs/admin-community-scoping`; `GRANT-*` = `specs/admin-role-grants`; `BOOT-*` =
`specs/admin-bootstrap-recovery`; `DESIGN-*` = `specs/admin-panel-design-system`. Threat matrix:
N/A per design (no routing/shell/subprocess/VCS boundary in this change).

## Review Workload Forecast

| Field | Value |
|---|---|
| Slice 1 — Scoping wiring | ~130 lines |
| Slice 2 — Grant-path + scope regression tests | ~140 lines |
| Slice 3 — Boot guard, env flag, migrate.ts warning, runbook | ~200 lines |
| Slice 4 — Brand tokens, drift script, lucide-react, Alert/EmptyState/Aside icons | ~280 lines |
| Slice 5 — Remaining 7 emoji files + UI-kit application (depends on Slice 4) | ~340 lines |
| **Total estimated** | **~1090 lines** |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Chained PRs recommended: Yes
800-line budget risk: Low
Decision needed before apply: No

Rationale: total estimate (~1090) exceeds the 800-line session budget, so chaining is required, but
every individual slice (max ~340) sits well under 800 even accounting for the design's own
uncertainty flag on Slice 5 (7-file icon sweep + UI-kit pass). `stacked-to-main` fits because Slices
1–4 are mutually independent per design and may merge in any order; Slice 5 depends only on Slice 4
for the `LucideIcon` prop types and stacks after it.

### Suggested slice-to-PR mapping

| PR | Slice | Base | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| PR1 | 1 — Scoping wiring | main | N/A — no test runner in `adminClient` | `cd adminClient && npm run build`; manual QA (task 1.4–1.5) | Revert commit; no persisted state touched |
| PR2 | 2 — Regression tests | main | `cd server/api && npm run test -- admin.test.ts parseAdminToken.test.ts` | Same command (Jest, isolated by file path; full suite stays red per INF-06) | Revert commit; tests only, no prod code |
| PR3 | 3 — Boot guard + runbook | main | `cd server/api && npm run test -- bootstrapChecks.test.ts` | Manual: boot with 0 super_admin rows, confirm warn-only default | Revert commit; flag defaults off, runbook is docs-only |
| PR4 | 4 — Brand tokens + icon foundation | main | N/A — no test runner in `adminClient` | `cd adminClient && npm run check:tokens && npm run build`; manual QA (task 4.9) | Revert commit; additive CSS + dependency |
| PR5 | 5 — Remaining icons + UI-kit application | PR4 (after merge) | N/A — no test runner in `adminClient` | `cd adminClient && npm run build`; manual QA (task 5.7); split per 5.8 if oversized | Revert commit; app-level only |
