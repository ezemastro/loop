# Design: Admin Community Roles — Gap Closure

## Technical Approach

Every gap is closed by extending a pattern that already ships. **Key finding: the server needs zero
changes for community scoping.** `GET /admin/users` (`server/api/src/controllers/admin.ts:196`) and
`GET /admin/stats` (`:432`) already resolve their filter through `adminScopeCommunityId`, and
`adminApi.getUsers` / `adminApi.getStats` already accept `CommunityScope`
(`adminClient/src/api/adminApi.ts:86,213`). The gap is that three pages never pass it. Slice 1 is
therefore client-only.

## Architecture Decisions

### Decision 1a: Selected community lives in the existing Zustand store, not URL or page state

**Choice**: keep `useCommunitiesStore.selectedCommunityId` (`adminClient/src/stores/communities.ts:15`)
as the single holder; the three pages consume it through `useCommunityScope()`.
**Alternatives**: URL query param (deep-linkable, but forces router plumbing on 7 pages and lets a
stale link contradict the token); per-page `useState` (resets on every navigation).
**Rationale**: the store already documents this exact intent at `stores/communities.ts:11-14` —
a super admin who picks a community on Usuarios keeps it on Colegios. **Answer: same community, not
reset.** No `persist` middleware, so a full reload resets to "all"; that is correct because the admin
token lives 30 minutes and login re-establishes scope anyway.

### Decision 1b: `allowAll` differs per page, and that is the rule

| Page | Filter props | Value passed to API | Why |
|---|---|---|---|
| `Schools.tsx` (reference) | `allowAll={false}` | `targetCommunityId` | `GET /schools` cannot express "all" |
| `Users.tsx` | `allowAll` (default) | `scopeCommunityId` | `null` ⇒ all communities is valid |
| `Notifications.tsx` | `allowAll` (default) | `scopeCommunityId` | reuses `GET /admin/users` |
| `Dashboard.tsx` | `allowAll` (default) | `scopeCommunityId` | `null` ⇒ cross-community sum |

`scopeCommunityId` is `undefined` for a `community_admin` (`hooks/useCommunityScope.ts:36`). Pages
MUST pass `scopeCommunityId`, never `sessionCommunityId`, and MUST mount `<CommunityFilter>` only
under `isSuperAdmin`.

### Decision 1c: `unscoped("admin")` is retained on every touched endpoint

| Endpoint | DB scope | Rationale |
|---|---|---|
| `GET /admin/users` | `unscoped("admin")` (`models/admin.ts:55`) | a super admin reads across communities; `inCommunity(id)` pins exactly one community GUC and cannot express "all" |
| `GET /admin/stats` | `unscoped("admin")` | same |
| `GET /admin/schools/stats` | `unscoped("admin")` (unchanged) | same |

Isolation is therefore application-enforced, at one chokepoint. The design keeps it airtight by
adding no second path: (a) `adminScopeCommunityId` discards the client's `?communityId=` for
non-super admins (`middlewares/parseAdminToken.ts:65-78`); (b) no new endpoint, parameter, or scope
helper is introduced; (c) slice 2 adds regression tests asserting a `community_admin` sending
`?communityId=<other>` still receives only its own community.

### Decision 1d: Dashboard aggregate semantics — no new API parameter

`queries.ts:1148` is `WHERE ($1::uuid IS NULL OR community_id = $1::uuid)` over `global_stats`,
which holds 3 additive rows per community; `models/admin.ts:623-626` sums per `stat_name`. So
**"all communities" = arithmetic sum**, "one community" = that community's rows. Both are already
correct. `getStats(params?)` already accepts `communityId`; Dashboard only has to pass it and add it
to the effect dependency array. Constraint to record: this is valid only while every `stat_name` is
an additive counter — a future ratio or average would silently be summed.

### Decision 2: Warn-by-default confirmed; hard-fail behind `REQUIRE_SUPER_ADMIN_ON_BOOT`

**Choice**: `assertSuperAdminExists()` runs in `server/api/src/index.ts`, after `assertDbHardening()`
resolves and **before** `listen()`, using `withClient(fn, { scope: unscoped("bootstrap") })` — the
same scope already used at `index.ts:186`. Query: `SELECT count(*)::int FROM admins WHERE role =
'super_admin'`. Zero rows ⇒ `console.error` with the runbook path. It exits `1` only when
`NODE_ENV === "production"` **and** `REQUIRE_SUPER_ADMIN_ON_BOOT === "true"`.
Env shape follows `REQUIRE_EMAIL_VERIFICATION` (`server/api/src/env.ts:82`):
`REQUIRE_SUPER_ADMIN_ON_BOOT: z.enum(["true","false"]).optional()`, default off.
**Alternatives**: always hard-fail in production (rejected); warn only, no flag (rejected — gives
operators no way to enforce).
**Rationale**: `assertDbHardening` hard-fails because it inspects *catalog* state that is never
legitimately absent. Zero super admins is a *data* state that is legitimately true on a brand-new
deployment before the first registration completes. Different class ⇒ different default.

Also: `scripts/migrate.ts:172` keeps `AUTHORIZED_ADMIN_EMAIL ?? ""` (`set_config` needs a string and
`0006` is designed to no-op) but logs a loud warning when the value is empty, because that is exactly
the condition under which `0006`'s `NULLIF` promotes nobody.

### Decision 2b: No new migration — rationale (required by `rules.design`)

**No migration is added.** The enum, the `admins_role_scope_chk` invariant and the bootstrap
promotion all already exist in `server/migrations/0006_admins_invitations_deletion.sql:9,11-14,35-42`.
The defect is a data condition in one production database, not a schema gap. A migration would
either re-run `0006`'s promotion — silently promoting whoever `AUTHORIZED_ADMIN_EMAIL` happens to be
at deploy time in *every* environment — or hardcode an email, which is unauditable. Recovery is a
reviewed single-row `UPDATE` in the runbook, with the original row captured first. Highest applied
migration is `0017_admin_email_lower_unique.sql`; if one ever becomes necessary it MUST be `0018_*`
and MUST NOT edit `0006`.

### Decision 3: Tokens duplicated in `adminClient/src/styles/brand-tokens.css`, policed by a drift script

**Choice**: a new `adminClient/src/styles/brand-tokens.css` holding a Tailwind v4 `@theme` block,
imported from `adminClient/src/index.css`, with a header comment naming `client/config.ts` as source
of truth — plus `adminClient/scripts/check-brand-tokens.mjs` (`npm run check:tokens`, no new
dependency) that parses the hexes out of `client/config.ts` and fails when they disagree. The script
exits 0 with a notice when `../client/config.ts` is absent, and is **not** wired into `npm run build`.

| Option | Tradeoff | Verdict |
|---|---|---|
| Import `client/config.ts` from adminClient | **Impossible**: `client/config.ts:53` calls `requireEnv("EXPO_PUBLIC_API_URL", …)` at module load and throws; the admin build has no `EXPO_PUBLIC_*` vars | Rejected |
| New `shared/brand-tokens.css` | `Dockerfile.admin:16` copies `shared`, but `Dockerfile.admin.dev` does **not**, and making it a real single source needs `client/config.ts` to consume it — `client/` is out of scope | Rejected (documented upgrade path) |
| Duplicate + drift script | One extra copy, but mechanically policed; zero Docker, Vite or dependency changes | **Chosen** |

Note the constraint stated in the brief is stale in one respect: `adminClient/tsconfig.app.json:33`
*does* include `../shared/types/**/*.d.ts` (`AGENTS.md:177-179` says otherwise). It is still ambient
`.d.ts` only, so it carries no runtime values either way.

Mapping (`client/config.ts:7-18` → `@theme`), plus the scale the panel adopts:

```css
@theme {
  --color-brand-primary: #e4510b;   --color-brand-secondary: #243b7a;
  --color-brand-tertiary: #209b8a;  --color-brand-credits: #7d2048;
  --color-brand-credits-light: #a03a63;
  --color-brand-text: #3d3d3d;      --color-brand-text-muted: #9e9e9e;
  --color-brand-stroke: #e4e4e4;    --color-brand-bg: #f0f0f0;
  --color-brand-alert: #c52525;

  --font-sans: "Inter", system-ui, sans-serif;
  --text-page: 1.5rem;  --text-section: 1.125rem;  --text-body: 0.875rem;
  --text-meta: 0.75rem; --text-eyebrow: 0.625rem;
  --radius-control: 0.5rem; --radius-surface: 0.75rem;
}
```

Spacing stays on Tailwind's default 4px step; the panel restricts itself to `2 / 3 / 4 / 6 / 8` for
page, card and control rhythm. `index.css:4` (`font-family: system-ui, Avenir, …`) is replaced by
`--font-sans`. `client/`'s stale seeded community theme colors are out of scope and untouched.

### Decision 4: `lucide-react`, pinned exact — not inline SVG

**Choice**: add `"lucide-react": "0.545.0"` to `adminClient/package.json` dependencies (exact pin,
matching `@react-oauth/google`, `tailwindcss`, `zod`, `zustand`).
**Alternatives**: hand-written `components/ui/Icon.tsx` with a path map (no dependency, but ~18
glyphs of unreviewable SVG path data inside an already budget-critical slice, plus a hand-drawn
stroke grid); keep emoji (rejected by the proposal).
**Rationale**: per-icon ESM exports tree-shake to only what is imported, MIT-licensed, React 19
compatible, and it moves the diff from "200 lines of path data" to "18 import names" — a direct
review-budget win, which is the stated risk of this pass.

**Icon contract** (uniform, no improvisation at apply time):

- Nav, buttons, alerts, inline: `size={16}`, `strokeWidth={1.75}`.
- `EmptyState`: `size={32}`, wrapper `text-slate-400`.
- Color always inherits (`currentColor`); never a hardcoded icon colour.
- Decorative icons keep `aria-hidden`; an icon that is the only content needs `aria-label`.
- Type changes: `Aside.tsx` `NavItem.icon: string` → `LucideIcon`; `ui/Alert.tsx` `TONES[].icon:
  string` → `LucideIcon`; `ui/EmptyState.tsx` `icon?: string` → `icon?: LucideIcon`.

Verified inventory: **31 occurrences across 10 files** (`rg` emoji-range count), not 33 across 14 —
12 in `Aside.tsx`, 4 each in `ui/Alert.tsx`, `pages/Notifications.tsx`, `pages/AuthorizeAdmin.tsx`,
2 in `pages/Communities.tsx`, 1 each in `ui/EmptyState.tsx`, `SchoolsTable.tsx`, `pages/Schools.tsx`,
`pages/Invitations.tsx`, `pages/DeletionRequests.tsx`. Some ASCII-adjacent glyphs may fall outside
the scanned range; apply must re-scan.

| Emoji | Icon | Emoji | Icon |
|---|---|---|---|
| 📊 | `LayoutDashboard` | 🔑 | `KeyRound` |
| 👥 | `Users` | 🚪 | `LogOut` |
| 🏫 | `School` | ⚠️ | `TriangleAlert` |
| ✉️ | `Mail` | ✓ | `CircleCheck` |
| 🔔 | `Bell` | ℹ️ | `Info` |
| 🗑️ | `Trash2` | 📭 | `Inbox` |
| 🌐 | `Globe` | 🏙️ | `Building2` |
| 📁 | `FolderTree` | 📤 | `Send` |
| 🎯 | `Target` | 💡 | `Lightbulb` |

### Decision 5: Canonical primitives and migration order

Canonical (already exported from `adminClient/src/components/ui/index.ts`): `PageHeader`, `Card` /
`CardHeader` / `CardBody`, `Button`, `Field` / `Input` / `Select` / `Textarea` / `Toggle`, `Table`
family, `Alert`, `EmptyState`, `Badge`, `Modal`, `Spinner` / `LoadingBlock`, `StatCard`. The kit is
**not** redesigned; only `Alert` and `EmptyState` change, and only to accept a `LucideIcon`.

Migration order (each page: title → `PageHeader`, error `<div>` → `<Alert tone="error">`, raw
`<input>`/`<button>` → `Input`/`Button`, stat tiles → `StatCard`):

1. `Dashboard.tsx` — `StatCard` exists and is unused there (`Dashboard.tsx:54-64` is ad-hoc).
2. `Users.tsx` — search form and pager.
3. `Notifications.tsx` — largest ad-hoc form.
4. `Schools.tsx`, `Invitations.tsx`, `DeletionRequests.tsx` — already partly on the kit.
5. `AuthorizeAdmin.tsx`, `Communities.tsx`, `Categories.tsx`, `Missions.tsx`.

Ad-hoc colour classes (`bg-green-500`, `bg-blue-500`) are replaced by the brand tokens as each page
is migrated, not in a separate sweep. UI copy stays Spanish.

## Data Flow

    CommunityFilter ──set──→ communitiesStore.selectedCommunityId
                                      │
                             useCommunityScope()
                                      │ scopeCommunityId (undefined if community_admin)
                                      ▼
              adminApi.getUsers / getStats  ──?communityId=──→  Express
                                                                   │
                                              adminScopeCommunityId(req, requested)
                                       super_admin → requested ?? null │ community_admin → token
                                                                   ▼
                                        AdminModel  ──withClient(fn, unscoped("admin"))
                                                    query param $1: UUID | null

## File Changes

| File | Action | Description |
|---|---|---|
| `adminClient/src/pages/Users.tsx` | Modify | `useCommunityScope`, `<CommunityFilter allowAll>`, pass `communityId`, reset `page` on change |
| `adminClient/src/pages/Notifications.tsx` | Modify | Same; scope the user search |
| `adminClient/src/pages/Dashboard.tsx` | Modify | Same; `getStats({ communityId })` in the effect deps |
| `adminClient/src/styles/brand-tokens.css` | Create | `@theme` block, source-of-truth header comment |
| `adminClient/src/index.css` | Modify | Import tokens; drop hardcoded `font-family` |
| `adminClient/scripts/check-brand-tokens.mjs` | Create | Drift guard vs `client/config.ts` |
| `adminClient/package.json` | Modify | `lucide-react` pin + `check:tokens` script |
| `adminClient/src/components/Aside.tsx` | Modify | 12 emoji → icons; `NavItem.icon: LucideIcon` |
| `adminClient/src/components/ui/{Alert,EmptyState}.tsx` | Modify | Icon prop type change |
| 7 remaining emoji files | Modify | Call-site icon swaps |
| `server/api/src/services/bootstrapChecks.ts` | Create | `assertSuperAdminExists()` |
| `server/api/src/index.ts` | Modify | Call guard after `assertDbHardening`, before `listen` |
| `server/api/src/env.ts` | Modify | `REQUIRE_SUPER_ADMIN_ON_BOOT` |
| `server/api/src/scripts/migrate.ts` | Modify | Warn when `AUTHORIZED_ADMIN_EMAIL` is empty |
| `server/api/src/controllers/admin.test.ts` | Create | Grant-path + scope regression tests |
| `docs/runbook-super-admin-recovery.md` | Create | Read-only verification, then single-row promotion |
| `server/migrations/**` | None | See Decision 2b |

## Interfaces / Contracts

```ts
// server/api/src/services/bootstrapChecks.ts
/** Warns when no super_admin exists. Exits only under REQUIRE_SUPER_ADMIN_ON_BOOT in production. */
export const assertSuperAdminExists: () => Promise<void>;
```

No API contract changes: `?communityId=` is already accepted and validated on both endpoints.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `adminScopeCommunityId` ignores `requested` for `community_admin`; rejects a non-UUID | Jest, `middlewares/parseAdminToken` |
| Unit | `assertSuperAdminExists` warns on 0 rows; exits only with flag + production | Jest with mocked `withClient`, mirroring `postgresClient.test.ts:237` |
| Integration | `community_admin` cannot authorize a `super_admin` (403 `SUPER_ADMIN_REQUIRED`, `controllers/admin.ts:159-165`) | Supertest against `AdminController` |
| Integration | `super_admin` CAN authorize a `super_admin`, and `communityId` is forced to `null` | Supertest |
| Integration | `GET /admin/users?communityId=<other>` as `community_admin` returns only its own community | Supertest |
| Manual | Switch community on Users → navigate to Schools → same community selected | Browser |
| Manual | `npm run check:tokens` fails when a hex is edited in `client/config.ts` only | CLI |

The `server/api` Jest suite is known red (`openspec/config.yaml`, INF-06), so new tests MUST be
runnable by file path in isolation and MUST NOT depend on the red suites.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary. The multi-tenancy trust boundary is covered by Decision 1c and the
integration tests above.

## Migration / Rollout

No DB migration (Decision 2b). `REQUIRE_SUPER_ADMIN_ON_BOOT` defaults off, so deploying the guard
changes nothing until an operator opts in. Rollback per slice is `git revert`; no persisted state is
touched by any slice. Production recovery is a manual, runbook-driven operation that captures the
original `admins` row before mutating it.

## Delivery Slices

| # | Slice | Est. lines | Depends |
|---|---|---|---|
| 1 | Scope wiring: Users, Notifications, Dashboard (client only, no server change) | ~130 | — |
| 2 | Grant-path + scope regression tests | ~140 | — |
| 3 | Boot guard, env flag, `migrate.ts` warning, recovery runbook | ~200 | — |
| 4 | Brand tokens, drift script, `lucide-react`, `Alert`/`EmptyState`/`Aside` icons | ~280 | — |
| 5 | Remaining 7 emoji files + UI-kit application, pages 1–5 in order | ~340 | 4 |

Every slice is under the 400-line chained-PR rule and the 800-line session budget. Slices 1–4 are
mutually independent and may land in any order; 5 depends on 4 for the icon prop types. Slice 5 is
the budget risk: if it exceeds 400 lines at apply time, split at the migration-order boundary
(steps 1–3 vs 4–5) rather than accepting an exception.

## Open Questions

- [ ] Confirm the exact `lucide-react` version available on the registry at apply time; pin whatever
      is current rather than the placeholder above.
- [ ] `Dashboard` currently renders whatever keys `getStats` returns via `formatLabel`. Decide at
      apply time whether the per-community view needs a "no data yet" `EmptyState` when a community
      has no `global_stats` rows.
