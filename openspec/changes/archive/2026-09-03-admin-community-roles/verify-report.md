```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c56bf6f658b314a6acb335c39cb1b187068535a451330bb19ecd3c65310ab65a
verdict: fail
blockers: 1
critical_findings: 1
requirements: 16/18
scenarios: 27/31
test_command: cd server/api && npx jest src/services/bootstrapChecks.test.ts src/middlewares/parseAdminToken.test.ts src/controllers/admin.test.ts
test_exit_code: 0
test_output_hash: sha256:ce3a54a24fc278747e183489565db65145accd3b001912caa4a428b6c05608dc
build_command: cd adminClient && npm run build
build_exit_code: 0
build_output_hash: sha256:190a4f9bdfe6784ab91001783af329da77b09e9899b2b6de0f4442f03f5eb8f1
```

## Verification Report

**Change**: admin-community-roles
**Version**: N/A (delta specs, no versioned main spec merge yet)
**Mode**: Standard (Strict TDD not declared active for this change)
**HEAD verified**: `3a303fb` on `feat/admin-role-grant-tests` (envelope `evidence_revision` is the sha256 of this git sha1, since the envelope requires a sha256-shaped digest), containing the full linear stack
`main -> feat/admin-community-scoping -> feat/admin-brand-tokens -> feat/admin-ui-kit-migration ->
feat/admin-bootstrap-guard -> feat/admin-role-grant-tests`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 30 |
| Tasks checked `[x]` | 28 |
| Tasks honestly unchecked (manual QA) | 2 (1.4, 1.5) |
| Tasks checked but NOT actually done | 2 of the checked 28 (5.5 partially, 5.6 partially — see CRITICAL) |

Tasks 1.4 and 1.5 are correctly and honestly left unchecked — both require a running app and a
per-role login, which this verification cannot execute. They are the residual manual QA the human
still owes: (1.4) confirm the selected community persists across navigation from Users to Schools
and resets on reload; (1.5) confirm a `community_admin` sees no selector and only own-community data
on Users/Notifications/Dashboard.

Tasks 5.5 and 5.6 are checked `[x]` but source inspection shows they were **not fully executed** —
see CRITICAL-1 below.

### Build & Tests Execution

**Build (`adminClient`)**: PASSED
```text
cd adminClient && npm run build
> tsc -b && vite build
✓ 2019 modules transformed, built in 2.98s
```

**Type-check (`server/api`)**: PASSED
```text
cd server/api && npm run check-types
> tsc --noEmit
(clean, no output)
```

**SQL arity check (`server/api`)**: PASSED
```text
cd server/api && npm run check-sql
Call sites verificados: 222
OK: todos los call sites coinciden con la aridad de su query.
```

**Brand token drift check (`adminClient`)**: PASSED
```text
cd adminClient && npm run check:tokens
check:tokens — brand-tokens.css matches client/config.ts DEFAULT_COLORS.
```

**Lint (`adminClient`)**: 13 errors — re-run and confirmed to be `react-hooks/set-state-in-effect`
findings, all in files this change did not introduce the pattern in newly (`Schools.tsx:93`,
`Users.tsx:64`, and 11 others). This is the documented pre-existing baseline, not a regression from
this change; zero new errors introduced.

**Tests (focused, per INF-06 — full `server/api` suite stays red and must never be invoked)**:
```text
cd server/api && npx jest src/services/bootstrapChecks.test.ts src/middlewares/parseAdminToken.test.ts src/controllers/admin.test.ts
Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
```
Re-run independently by this verification, not just trusted from apply-progress. All 20 pass.

**Coverage**: Not tracked as a project gate; `adminClient` has no `test` script (pre-existing,
documented). ➖ Not available / not applicable.

### Spec Compliance Matrix

**`specs/admin-community-scoping/spec.md`** (5 requirements, 10 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Super Admin Community Selector | Selector present on every scoped screen | Source: `Dashboard.tsx`, `Users.tsx`, `Notifications.tsx`, `Invitations.tsx`, `DeletionRequests.tsx` all mount `<CommunityFilter allowAll>`; `Schools.tsx` mounts it with `allowAll={false}` | ⚠️ PARTIAL — 5/6 screens compliant; `Schools.tsx` never offers "all communities", contradicting the requirement's literal text (see WARNING-1) |
| | Selecting a single community scopes the data | `adminApi.getUsers`/`getStats` pass `communityId`; server enforces via `adminScopeCommunityId` (tested) | ✅ COMPLIANT |
| | "All communities" shows the unscoped aggregate | `scopeCommunityId` `undefined`/`null` → `communityId: null` → `WHERE ($1 IS NULL OR ...)` (pre-existing, unchanged) | ✅ COMPLIANT (source-verified, no adminClient test runner exists) |
| Community Admin Fixed Scope | No selector shown to a community admin | All touched pages gate `<CommunityFilter>` behind `isSuperAdmin &&` | ✅ COMPLIANT (source-verified; runtime confirmation is task 1.5, correctly deferred to manual QA) |
| | Data is limited to the admin's own community | `adminScopeCommunityId` ignores `requested` for `community_admin` | ✅ COMPLIANT — `parseAdminToken.test.ts` (10/10) |
| Server-Derived Scope for Community Admins | Forged query parameter is ignored | `admin.test.ts` "GET /admin/users — SCOPE-3/5" | ✅ COMPLIANT — tested end-to-end via Supertest |
| | Forged body or header field is ignored | No test exercises a body/header-supplied community; architecturally unreachable — `adminScopeCommunityId(req, requested)` is only ever called with a value read from `req.query`, never `req.body` or headers (`admin.ts:196,224,249,614`) | ⚠️ PARTIAL — architecturally sound but no explicit regression test for this exact vector |
| | Token without a community for a community_admin is rejected | `parseAdminToken.test.ts` "sin comunidad en el token falla cerrado" | ✅ COMPLIANT |
| Super Admin View Parity | Same community, same result set | Both paths converge on the same `AdminModel.getUsers`/`getStats` call with the same `communityId` value; no dedicated comparison test | ✅ COMPLIANT (architecturally guaranteed by shared code path, not independently tested) |
| No Client-Supplied Scope Widening | Wildcard/"all" rejected for a community admin | `parseAdminToken.test.ts` "un valor no-UUID pedido tampoco importa" | ✅ COMPLIANT |

**Compliance summary**: 8/10 scenarios fully compliant, 2 partial (Schools' missing "all" option;
untested body/header vector).

**`specs/admin-role-grants/spec.md`** (4 requirements, 5 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Only a Super Admin May Grant Super Admin | Community admin is rejected | `admin.test.ts` "rechaza a un community_admin que pide super_admin" | ✅ COMPLIANT |
| | Super admin grant succeeds | `admin.test.ts` "un super_admin sí puede otorgar super_admin" | ✅ COMPLIANT |
| Community Admin Grants Are Scoped | Grant pinned to own community despite spoofed id | `admin.test.ts` "un community_admin de A queda pinneado a A" | ✅ COMPLIANT |
| Super Admin Granting Community Admin Requires Target | Scoped row created for target community | `admin.test.ts` "un super_admin que otorga community_admin con communityId=C" | ✅ COMPLIANT |
| Role/Community Invariant Enforced at the DB | Violating write rejected | `admins_role_scope_chk` / `admin_valid_emails_role_scope_chk` (`0006_admins_invitations_deletion.sql:35-42`), pre-existing, confirmed present, unchanged by this change | ✅ COMPLIANT (regression spec — DB-level, not exercised by a new integration test, correctly per design) |

**Compliance summary**: 5/5 scenarios compliant.

**`specs/admin-bootstrap-recovery/spec.md`** (5 requirements, 9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Startup Super Admin Guard | Zero super admins warns, does not block | `bootstrapChecks.test.ts` | ✅ COMPLIANT |
| | ≥1 super admin emits no warning | `bootstrapChecks.test.ts` | ✅ COMPLIANT |
| Opt-In Hard-Fail Mode | Hard-fail flag blocks startup | `bootstrapChecks.test.ts` (prod + flag → throw, caught by `index.ts`'s `.catch` → `exit(1)`) | ✅ COMPLIANT |
| | Hard-fail disabled falls back to warn-only | `bootstrapChecks.test.ts` (prod without flag, flag without prod both stay warn-only) | ✅ COMPLIANT |
| Empty Authorized-Admin-Email Warning at Migration Time | Empty env var triggers migration-time warning | Source-verified: `scripts/migrate.ts:245-251`, scoped to migrations whose SQL references `app.authorized_admin_email` | ✅ COMPLIANT (no automated test; migration runner has no test harness in this repo, consistent with existing convention) |
| Recovery Procedure Properties | Re-running promotion is a no-op | `docs/runbook-super-admin-recovery.md` §2 "Idempotencia" — reviewed, correct (idempotent `UPDATE`, `WHERE` matches same row, `BEGIN`/`COMMIT` boundary) | ✅ COMPLIANT (documentation review, no executable test possible for a manual runbook) |
| | Promotion satisfies role/community invariant | Runbook §2: single `UPDATE ... SET role='super_admin', community_id=NULL` in one statement, matching `admins_role_scope_chk` | ✅ COMPLIANT |
| | Verification precedes mutation | Runbook §1 (read-only `SELECT`) explicitly precedes §2 (mutating `UPDATE`), with an explicit "no continuar sin haber corrido esta verificación" gate | ✅ COMPLIANT |
| Stale Session Handling After Recovery | Runbook instructs re-login after promotion | Runbook §2, explicit instruction plus rationale (JWT not re-read per request) | ✅ COMPLIANT |

**Compliance summary**: 9/9 scenarios compliant.

**`specs/admin-panel-design-system/spec.md`** (4 requirements, 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Shared Brand Color Tokens | Token values match source of truth | `npm run check:tokens` (re-run, PASSED) against unmodified `client/config.ts` `DEFAULT_COLORS` | ✅ COMPLIANT |
| | No independent hardcoded palette | Mostly true (`Button.tsx` primary now uses `bg-brand-primary`); but `ui/Alert.tsx`, `ui/Badge.tsx`, and `Notifications.tsx`'s selected-user callout still use Tailwind's stock `indigo-*`/`red-*`/`emerald-*` utility classes rather than the brand tokens | ⚠️ PARTIAL (see SUGGESTION-1 — ambiguous whether semantic status tones are in scope of "brand color", but the spec text names "alert" explicitly and `Alert`'s error tone does not use `--color-brand-alert`) |
| Intentional Typography | Root typography explicitly defined | `index.css:5` `font-family: var(--font-sans)`; `brand-tokens.css` defines `--font-sans: "Inter", system-ui, sans-serif` | ✅ COMPLIANT |
| No Emoji as Functional Icons | Emoji icon replaced | Full emoji-range `rg` re-scan of `adminClient/src` (54 files) — re-run independently, zero matches | ✅ COMPLIANT |
| | Adjacent copy unaffected | Spot-checked Spanish copy across `Dashboard.tsx`, `Users.tsx`, `Notifications.tsx`, `Aside.tsx` — unchanged strings, only icon/token substitutions | ✅ COMPLIANT |
| Consistent UI Kit Usage | Alert renders via shared primitive | `Dashboard.tsx`, `Users.tsx`, `Notifications.tsx`, `Invitations.tsx`, `DeletionRequests.tsx`, `Communities.tsx`, `AuthorizeAdmin.tsx` all use `<Alert tone="error">`. **`Schools.tsx:126` still renders a raw `<div className="bg-red-100 text-red-700 p-4 rounded mb-4">`** despite this exact page's `EmptyState` icon having been touched by this change (which brings it into the requirement's stated scope: "any page whose alert or empty-state markup is modified") | ❌ FAILING — see CRITICAL-1 |
| | Empty state renders via shared primitive | `EmptyState` used correctly everywhere it appears, including `Schools.tsx` | ✅ COMPLIANT |

**Compliance summary**: 5/7 scenarios compliant, 1 failing, 1 partial.

**Grand total**: 27/31 scenarios compliant across all four specs; 16/18 requirements fully compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Trust boundary (admin `unscoped("admin")` + app-level isolation) | ✅ Implemented | `adminScopeCommunityId` (`parseAdminToken.ts:65-78`) is the single chokepoint; every admin controller method that reads `communityId` routes through it or `requireScopeCommunityId`. No second path found by `rg` for `req.body.communityId` or a header-derived community anywhere in `admin.ts`. |
| Only `super_admin` grants `super_admin` | ✅ Implemented | `admin.ts:159-165`, tested |
| `community_admin` cannot widen scope via any client-supplied parameter | ✅ Implemented | Confirmed for query string (tested); body/header vectors are architecturally unreachable (function signature only ever receives `req.query.*`) but not independently regression-tested |
| Bootstrap guard warn-by-default, hard-fail opt-in | ✅ Implemented | `bootstrapChecks.ts`, `index.ts:208-228`, tested |
| Migration-time warning scoped correctly | ✅ Implemented | `migrate.ts:245-251`, detects `app.authorized_admin_email` reference in migration SQL, not a hardcoded version list |
| Recovery runbook properties | ✅ Implemented | Reviewed against all 4 sub-requirements |
| Brand tokens match source of truth | ✅ Implemented | `check:tokens` re-run, passed |
| No emoji as functional icons | ✅ Implemented | Full re-scan, zero matches |
| Consistent UI kit usage (Users/Notifications/Dashboard + touched pages) | ❌ Not fully implemented | `Schools.tsx`, `Categories.tsx`, `Missions.tsx` — see CRITICAL-1 |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| 1a — scope lives in Zustand store | ✅ Yes | `useCommunitiesStore.selectedCommunityId`, no `persist` middleware, matches design |
| 1b — `allowAll` differs per page | ✅ Yes | `Schools.tsx` keeps `allowAll={false}` per the documented rationale; this is consistent with the design but sits in tension with the spec's literal text (WARNING-1) |
| 1c — `unscoped("admin")` retained, no second scope path | ✅ Yes | Confirmed by source inspection |
| 1d — Dashboard aggregate = arithmetic sum, no new param | ✅ Yes | `getStats({ communityId })`, unchanged query |
| 2 — warn-by-default, hard-fail behind flag | ✅ Yes | Matches exactly, including the "non-production branch stays non-blocking" reasoning |
| 2b — no new migration | ✅ Yes | `server/migrations/**` untouched; runbook exists instead |
| 3 — duplicated tokens + drift script | ✅ Yes | `brand-tokens.css`, `check-brand-tokens.mjs`, both present and passing |
| 4 — `lucide-react`, pinned exact | ✅ Yes (with documented deviation) | `1.40.0` installed, not the design's stale `0.545.0` placeholder — correctly flagged as a registry-drift deviation, not silent |
| 5 — canonical primitives, migration order | ⚠️ Partially followed | `Dashboard.tsx`, `Users.tsx`, `Notifications.tsx` fully migrated (order items 1–3); `Schools.tsx`/`Invitations.tsx`/`DeletionRequests.tsx` (item 4) and `AuthorizeAdmin.tsx`/`Communities.tsx`/`Categories.tsx`/`Missions.tsx` (item 5) were **not** all migrated — see CRITICAL-1 |
| Branch-structure correction (slice 1 vs 5 conflict) | ✅ Yes, and verified independently | `Dashboard.tsx`, `Users.tsx`, `Notifications.tsx` at HEAD all carry BOTH `useCommunityScope()`/`<CommunityFilter>` AND the UI-kit layout (`PageHeader`, `StatCard`, `Alert`, etc.) — confirmed by direct file read, not just trusting `apply-progress.md`'s claim |

### Issues Found

**CRITICAL**

1. **Tasks 5.5 and 5.6 are checked `[x]` (claimed complete) but are not fully done.**
   `apply-progress.md`'s Slice 5 entry and `tasks.md` both claim `Schools.tsx`, `Categories.tsx`,
   `Missions.tsx` were migrated to the UI kit. Direct inspection of HEAD shows:
   - `Schools.tsx:104-126` — still a raw `<h1 className="text-3xl font-bold">` instead of
     `PageHeader`, a raw `<button className="bg-green-500 ...">` instead of `Button`, and a raw
     `<div className="bg-red-100 text-red-700 p-4 rounded mb-4">` instead of `<Alert tone="error">`.
     `git diff main..HEAD -- adminClient/src/pages/Schools.tsx` is only 2 lines (the `EmptyState`
     icon prop fix from Slice 4) — no UI-kit migration commit ever touched this file.
   - `Categories.tsx` and `Missions.tsx` — `git diff main..HEAD` shows **zero changes** to either
     file across the entire 5-slice stack. Both still use raw `<h1>`, raw
     `bg-green-500`/`bg-red-100` markup, exactly as before the change. Task 5.6 explicitly assigns
     both files for migration and is checked done; the code proves it was never attempted.
   - By contrast, `Invitations.tsx` and `DeletionRequests.tsx` (also task 5.5) and
     `AuthorizeAdmin.tsx`/`Communities.tsx` (also task 5.6) genuinely are on the kit — largely
     because they were already substantially on it before this change (per `apply-progress.md`'s
     own Slice 4 deviation note), with `AuthorizeAdmin.tsx` receiving a real 148-line migration in
     this change.

   This violates `specs/admin-panel-design-system` → "Consistent UI Kit Usage" → "Alert renders via
   the shared primitive" for `Schools.tsx` specifically (in scope per the requirement's own
   "any page whose alert or empty-state markup is modified" clause, since this change touched its
   `EmptyState` icon). `Categories.tsx`/`Missions.tsx` are not technically in the spec's scope
   (never touched, so the requirement's own scoping clause excludes them from a *spec* violation),
   but the task-completion claim for them is false regardless — the tasks artifact is inaccurate,
   which is worse than an honestly unchecked task.

   **Recommendation**: reopen tasks 5.5 (Schools.tsx portion) and 5.6 (Categories.tsx, Missions.tsx)
   before archiving. Either complete the migration for all three files, or explicitly narrow the
   task/design scope to only what was actually delivered and re-document why
   Categories.tsx/Missions.tsx were descoped (if that was a deliberate call made during apply and
   simply not written down).

**WARNING**

1. `Schools.tsx` never offers an "all communities" option (`allowAll={false}`), which contradicts
   the literal text of `specs/admin-community-scoping` → "Super Admin Community Selector" → "Selector
   present on every scoped screen" (which lists Schools among the screens requiring the "all
   communities" option). This is a **pre-existing** pattern (documented and rationalized in
   `design.md` Decision 1b: "`GET /schools` cannot express 'all'") that this change did not
   introduce and consciously chose not to fix. The spec text itself was not amended to carve out
   this exception. Recommend either updating the spec's scenario text to exempt Schools explicitly,
   or tracking a follow-up to make `GET /schools` support an unscoped query.
2. UI-side scoping behavior (selector presence/absence per role, correct screen it filters) has zero
   automated test coverage — `adminClient` has no test runner at all. This is a pre-existing,
   documented gap (tasks 1.4/1.5 correctly deferred to manual QA), not something this verification
   is newly discovering, but it means requirements SCOPE-1/SCOPE-2/SCOPE-4 are verified by source
   inspection and a passing build only, never by a runtime assertion.

**SUGGESTION**

1. `ui/Alert.tsx`'s `error` tone (`border-red-200 bg-red-50 text-red-800`) and `info` tone
   (`border-indigo-200 bg-indigo-50 text-indigo-900`), `ui/Badge.tsx`'s `danger`/`info` tones, and
   `Notifications.tsx`'s selected-user callout (`border-indigo-200 bg-indigo-50 ...`) all use
   Tailwind's stock color palette rather than `--color-brand-alert` or another brand token. The spec
   text for "No independent hardcoded palette" explicitly names "alert" as one of the colors that
   "MUST match the hex value in `DEFAULT_COLORS`". Whether semantic status tones (as opposed to
   brand identity accents) are meant to be in scope is ambiguous and worth a design clarification
   before the next design-system pass, rather than silently deciding either way.
2. `Notifications.tsx`'s "Usuario destinatario" selected-state box (lines 130-140) is the one leftover
   inline-styled block on an otherwise fully migrated page; low priority given `Alert`/`Card`
   surround it.

### Verdict

**FAIL**

Reason: one CRITICAL finding — tasks 5.5/5.6 are marked complete in `tasks.md` but
`Schools.tsx`/`Categories.tsx`/`Missions.tsx` were not migrated to the UI kit as claimed (verified by
`git diff main..HEAD` showing zero or near-zero changes to those files, and direct inspection of raw
markup still present at HEAD). This is a genuine implementation gap, not merely a documentation
slip, because `Schools.tsx` is in the spec's own stated scope (its `EmptyState` icon was modified by
this change) and still fails the "Alert renders via the shared primitive" scenario. Everything else
verified — the community-scoping trust boundary, the grant-path authorization rules, the bootstrap
guard, the recovery runbook, and the brand-token/emoji work on the pages that were actually touched —
holds up under adversarial re-testing, all re-run independently rather than trusted from
`apply-progress.md`.

---

## Addendum — CRITICAL finding resolved (orchestrator, post-verify)

The verify phase returned FAIL on one CRITICAL: tasks 5.5 and 5.6 were marked `[x]` while
`Schools.tsx` had only a 2-line change (its `EmptyState` icon) and `Categories.tsx` /
`Missions.tsx` had **zero diff** across the whole stack. The orchestrator independently
reproduced this with `git diff --stat main..HEAD -- <file>` and confirmed the finding.

Resolved in `feat/admin-ui-kit-migration`:

- `d494a48` — `Schools.tsx`, `Categories.tsx`, `Missions.tsx` migrated to `PageHeader`
  (title + `actions` + `filters`), `Button`, and `Alert`. The `<div className="p-8">` wrappers
  were removed because `Layout` already supplies page padding.
- `6521d07` — scope completed beyond the original task list, because the same defect class was
  still present elsewhere and the change's stated goal is a panel that no longer looks
  machine-generated:
  - `Home.tsx` and `Register.tsx` migrated to the auth-screen pattern already established by
    `Login.tsx` (centered card, `Field`/`Input`/`Alert`/`Button`).
  - Row action buttons in `UsersTable`, `CategoriesTable`, `SchoolsTable` and `MissionsTable`
    moved from raw `bg-blue-500` / `bg-green-500` / `bg-orange-500` markup to
    `<Button variant="secondary" size="sm">`.
  - `MissionsTable`'s hand-rolled active/inactive pill replaced with the kit's `Badge`.
  - `Login.tsx`'s `text-indigo-600` link recolored to `text-brand-primary`.

Verified at stack HEAD after the fix:

| Check | Result |
| --- | --- |
| `adminClient` `npm run build` | passes |
| `adminClient` `npm run lint` | **12** errors — one *below* the 13-error pre-existing baseline on `main` |
| `adminClient` `npm run check:tokens` | no drift against `client/config.ts` |
| `server/api` `npm run check-types` | clean |
| `server/api` `npm run check-sql` | 222/222 call sites OK |
| Focused Jest (by exact file path) | 20/20 across 3 suites |
| Raw off-brand markup scan of `src/pages` and `src/components` | only `Button.tsx`'s intentional `danger` variant remains |

The `server/api` Jest suite as a whole remains red (INF-06, pre-existing and out of scope);
it was never run in full and is not claimed green.

Still open, and **not** resolvable without a human: tasks **1.4 and 1.5**, the manual QA passes
that require a running app and a login as each role. They remain unchecked on purpose.
