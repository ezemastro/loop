# Exploration — admin-community-roles

Phase: `sdd-explore` · Store: `openspec` · Status: complete (artifact persisted by orchestrator;
the explore sub-agent had no write tool in this session)

## Headline

The requested two-tier admin model **already exists** end to end. This is not a greenfield
build: it is a gap-closing pass over the adminClient plus a production data incident.

## A. Current admin/role model

- `server/migrations/0006_admins_invitations_deletion.sql:9` creates
  `CREATE TYPE admin_role AS ENUM ('super_admin', 'community_admin')`.
- `admins.role` and `admin_valid_emails.role` both added with
  `NOT NULL DEFAULT 'community_admin'` (same file, lines 11-14).
- Invariant enforced at the DB level (`admins_role_scope_chk`, lines 35-42):
  `(role = 'super_admin' AND community_id IS NULL) OR (role = 'community_admin' AND community_id IS NOT NULL)`.
  A `community_admin` row with a NULL community is therefore structurally impossible.
- Bootstrap super admin comes from `AUTHORIZED_ADMIN_EMAIL` (`server/api/src/config.ts:48`,
  consumed in `server/api/src/models/admin.ts:110-138` and `server/api/src/index.ts:176-181`).
- The migration runner forwards it to Postgres as the GUC `app.authorized_admin_email`
  (`server/api/src/scripts/migrate.ts:172`, value `AUTHORIZED_ADMIN_EMAIL ?? ""`).

## B. What breaks for an admin in the wrong tier

- `server/api/src/middlewares/parseAdminToken.ts:17-22` rejects a token whose
  `adminRole === "community_admin"` and has no `adminCommunityId`, because treating it as
  unscoped would silently grant super-admin reach.
- `parseAdminToken.ts:58` — `community_admin` scope always comes from the token and ignores any
  requested community; `super_admin` gets whatever it asks for, or all communities.
- Consequence: an admin left on the `community_admin` tier sees only their backfilled
  community, and a stale token issued before the role claims existed is rejected outright.

## C. Production root cause (high confidence)

Migration `0006` backfills every pre-existing admin to the `red-itinere` community, then promotes
only the row matching `lower(NULLIF(current_setting('app.authorized_admin_email', true), ''))`.

If `AUTHORIZED_ADMIN_EMAIL` was unset or empty when `0006` ran in production, `NULLIF` yields
NULL, the comparison is NULL for every row, and **no admin is promoted**. The operator's account
is then a `community_admin` of `red-itinere` — not "an admin with no community", which the CHECK
constraint forbids.

Verification required before any fix, read-only:

```sql
SELECT id, email, role, community_id FROM admins WHERE lower(email) = lower('<email>');
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
```

## D. adminClient screen inventory

Community selector already wired (`useCommunityScope` + `<CommunityFilter>`):

- `adminClient/src/pages/Schools.tsx`
- `adminClient/src/pages/Invitations.tsx`
- `adminClient/src/pages/DeletionRequests.tsx`
- `adminClient/src/pages/AuthorizeAdmin.tsx` (partial)

Community-scoped data but **selector missing** — the actual gap:

- `adminClient/src/pages/Users.tsx:26-29` — `adminApi.getUsers` called without `communityId`.
- `adminClient/src/pages/Notifications.tsx:23` — user search ignores community.
- `adminClient/src/pages/Dashboard.tsx:19` — `getStats()` unscoped; a super admin can only ever
  see the all-communities aggregate, never a per-community view.

Supporting pieces that already exist: `adminClient/src/hooks/useCommunityScope.ts`,
`adminClient/src/components/CommunityFilter.tsx`, `useIsSuperAdmin()` / `RequireSuperAdmin`.

## E. UI/design gap

- `adminClient/src/index.css` is a bare Tailwind v4 import: default `system-ui` font, no brand
  palette, **zero shared design tokens with `client/`** (brand palette lives in `client/config.ts`).
- Roughly 30 emoji-as-UI-icon occurrences across ~12 files, concentrated in
  `adminClient/src/components/Aside.tsx`, `adminClient/src/components/ui/Alert.tsx`, and
  `adminClient/src/components/ui/EmptyState.tsx` — fixing those three cascades across the panel.
- An `adminClient/src/components/ui/` kit exists but is applied inconsistently; several pages
  still use ad-hoc markup.

## F. Migrations

- Highest existing migration: `server/migrations/0017_admin_email_lower_unique.sql`. Next is `0018`.
- **No new migration is required for the role model** — it already exists. A migration is only
  warranted if the proposal adds capability (e.g. an audited role-change path).

## G. Confirmed gaps vs. the request

| Requested | State |
| --- | --- |
| super_admin / community_admin tiers | Exists (DB + API + client) |
| First super admin from env var | Exists (`AUTHORIZED_ADMIN_EMAIL`) |
| Super admin creates communities | Exists (`Communities.tsx`) |
| Super admin creates community admins | Exists (`AuthorizeAdmin.tsx`) |
| Super admin creates other super admins | **Verify in propose** — `AuthorizeAdmin.tsx` is only partially scoped |
| Community selector on every scoped screen | **Gap** — Users, Notifications, Dashboard |
| Community admin cannot switch community | Exists, enforced server-side (`parseAdminToken.ts:58`) |
| Shared palette/styles with `client/` | **Gap** — no shared tokens |
| No emoji / "AI slop" | **Gap** — ~30 occurrences |

## H. Risks

- **High** — anything touching the `community_admin` / `super_admin` trust boundary. Admin
  endpoints connect `unscoped("admin")`, so isolation is enforced in application code, not RLS.
- **Blocking for the production fix only** — the operator's real row must be read before the
  promotion statement is trusted; the reported symptom is impossible as literally stated.
- Unverifiable from this sandbox: whether production applied migrations through 0017, and what
  `AUTHORIZED_ADMIN_EMAIL` held when 0006 ran.
- Out of scope, noted: `0001_communities.sql` seeds stale community theme colors that no longer
  match `client/config.ts`.

## I. Recommendation for `sdd-propose`

Extend the proven patterns; do not rebuild. Slice into:

1. Community-selector wiring for Users / Notifications / Dashboard (small, low risk).
2. Super-admin creation path audit in `AuthorizeAdmin.tsx` (small, security-relevant).
3. Brand tokens shared with `client/` + emoji removal + UI-kit consistency (larger, UI-only,
   chain per the review budget).
4. Production recovery runbook (documentation + SQL, no application code).
