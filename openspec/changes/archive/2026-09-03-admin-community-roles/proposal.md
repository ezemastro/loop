# Proposal: Admin Community Roles — Gap Closure

## Intent

The `super_admin` / `community_admin` model already exists in DB, API and adminClient. This change closes the residual gaps: three screens ignore community scope, the panel shares no design tokens with `client/`, 33 emoji act as UI icons, and production has no super admin.

**Verified in propose (exploration's open question):** super admins CAN already create super admins — `controllers/admin.ts:158-172` gates `role="super_admin"` on the caller's own role and forces `community_id = null`; `AuthorizeAdmin.tsx:113-128` exposes it to super admins only. **No gap; needs regression coverage, not new code.**

**Incident root cause (confirmed):** `scripts/migrate.ts:172` passes `AUTHORIZED_ADMIN_EMAIL ?? ""`; empty → `NULLIF` NULL → `0006` promotes nobody, all admins stay backfilled to `red-itinere`.

## Scope

### In Scope
- Wire `useCommunityScope` + `<CommunityFilter>` into `Users.tsx`, `Notifications.tsx`, `Dashboard.tsx`.
- Regression tests for the admin grant path.
- Brand tokens shared with `client/config.ts`; remove emoji-as-icon (33 across 14 files); apply `components/ui/` consistently.
- Recovery runbook (docs + SQL only) plus a loud startup guard when no `super_admin` exists.

### Out of Scope
- RLS rewrites, credits ledger, the `client/` app, `0001_communities.sql` theme colors, any new role tier.

## Capabilities

### New Capabilities
- `admin-community-scoping`: selector on every scoped screen for super admins; community admins pinned to token scope.
- `admin-role-grants`: who grants which tier; the `super_admin ⇔ no community` invariant.
- `admin-bootstrap-recovery`: bootstrap guarantees, loud failure, documented recovery.
- `admin-panel-design-system`: shared tokens, no emoji icons, consistent UI kit.

### Modified Capabilities
- None. `openspec/specs/` is empty.

## Approach

Extend proven patterns; rebuild nothing. Copy the `Schools.tsx` scoping pattern into the three pages. Promote `client/config.ts` hexes into CSS custom properties in `adminClient/src/index.css`, then de-emoji and route pages through `components/ui/`; UI copy stays Spanish. Recovery is a runbook: read-only verification `SELECT` first, then a single-row promotion. Guard = startup check in `server/api/src/index.ts` + `migrate.ts` warning — **no migration preferred**; if one becomes necessary it must be `0018+`, never an edit to an applied migration.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `adminClient/src/pages/{Users,Notifications,Dashboard}.tsx` | Modified | Selector + scoped queries |
| `adminClient/src/index.css` | Modified | Brand tokens |
| `adminClient/src/components/{Aside,ui/Alert,ui/EmptyState}.tsx` | Modified | Emoji removal (cascades ~12 files) |
| `server/api/src/index.ts`, `scripts/migrate.ts` | Modified | Guard + empty-env warning |
| `server/api/src/controllers/admin.ts` | Tests only | Grant-path regression |
| `docs/` | New | Recovery runbook |

## Risks

**HIGH-RISK — multi-tenancy trust boundary.** Admin endpoints run `unscoped("admin")`; isolation is application-enforced, not RLS.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scoping leaks cross-community data | Med | Reuse `Schools.tsx` pattern; server still derives scope from token (`parseAdminToken.ts:58`) |
| Guard blocks a valid deploy | Med | Warn-and-continue by default; hard-fail only behind an explicit env flag |
| Recovery SQL promotes wrong row | Low | Mandatory read-only verification; single-row `WHERE lower(email)=lower($1)` |
| Design pass exceeds review budget | High | Split tokens and emoji passes (below) |
| Token drift with `client/` | Med | Header comment naming `client/config.ts` as source of truth |

## Delivery Slices (auto-chain, 800-line budget)

| # | Slice | Est. | Depends |
|---|---|---|---|
| 1 | Selector: Users, Notifications, Dashboard | ~150 | — |
| 2 | Grant-path regression tests | ~100 | — |
| 3 | Recovery runbook + bootstrap guard | ~180 | — |
| 4 | Brand tokens + UI-kit primitives | ~250 | — |
| 5 | Emoji removal + UI-kit application | ~400 | 4 |

Slices 4 and 5 MUST NOT merge as one PR. Slices 1–3 are independent.

## Rollback Plan

- Slices 1, 2, 4, 5: app-level and additive — revert the commit, no persisted state touched.
- Slice 3: guard is warn-only by default, so a revert restores prior boot behavior. The runbook MUST require capturing the original `admins` row before mutating; inverse is `UPDATE admins SET role='community_admin', community_id=<original> WHERE id=<id>`.
- No migration planned; any added migration must be `0018+` and ship a documented inverse.

## Dependencies

- Production DB access for the read-only verification queries.
- Unknown: what `AUTHORIZED_ADMIN_EMAIL` held when `0006` ran — the runbook must handle both cases.

## Success Criteria

- [ ] Super admin switches community on Users, Notifications, Dashboard and the data follows.
- [ ] Community admin sees identical screens, no selector, no cross-community data.
- [ ] Tests prove a `community_admin` cannot authorize a `super_admin`.
- [ ] adminClient renders with the `client/` palette; zero emoji used as UI icons.
- [ ] Runbook restores a super admin where `0006` promoted nobody.
- [ ] Booting with zero `super_admin` rows emits a loud, actionable warning.
