# Proposal: Client Render Resilience

## Intent

On 2026-09-03 `/notifications` went blank in production. The proximate defect is **already fixed
and shipped** (`5237081`, `9a5236a`). This change does not re-fix it. It closes the two systemic
gaps that incident exposed:

1. **No containment.** `grep -r ErrorBoundary client/` returns zero matches. One render-phase throw
   in one card unmounted the entire app.
2. **No detection.** No test in the repo renders a component, so CI could not have caught it.

Gap 2 was previously declined by `client-critical-fixes` and archived `2026-09-01-loop-settings` on
the premise that render testing needs new dependencies. **That premise was measured and is wrong.**
The only blocker was React 19 deferring the initial commit; wrapping `renderer.create` in `act()`
fixes it. The exact regression test was written, run and passed with **zero new dependencies and
zero Jest config changes**, and the 857-test / 15-suite baseline was re-verified unchanged.

## Scope

### In Scope

| # | Deliverable |
|---|---|
| 1 | A shared route fallback component (reusing `components/Error.tsx` for content) |
| 2 | `ErrorBoundary` export in `app/_layout.tsx` — the last net |
| 3 | `ErrorBoundary` export in the 7 tab screens — a failure costs one tab, not the app |
| 4 | Fallback offers **both** retry and an escape route (see Decision 1) |
| 5 | A documented `renderWithAct` test helper |
| 6 | Render regression tests for `cards/Notification.tsx` and `cards/Listing.tsx` with null/partial data, plus a test that a throwing child is contained |

### Out of Scope (non-goals)

- **List-item boundaries** — fast-follow, see Decision 2.
- **`@testing-library/react-native` / `nativewind/test`** (resolved-style assertions). Real future
  want; unverified against RN 0.81.5 / React 19.1.0. Not needed to catch this bug class.
- **`react-test-renderer@19.0.0` vs `react@19.1.0` peer skew** — real, but tracked as CLI-10 in
  `openspec/changes/delivery-and-ci/design.md:474`. It did not block rendering. Leave it there.
- **Any crash-reporting SDK** (Sentry etc.) — separate decision with privacy and cost questions.
  Consequence stated plainly: contained errors stay invisible to us in production.
- **Re-fixing the notification payload bug.** Already on `main`.
- **Global handlers** (`ErrorUtils.setGlobalHandler` / `window.onerror`) — those need a
  `Platform.OS` branch and cover a different failure class.

## Capabilities

`openspec/specs/` is empty, so every capability is new.

### New Capabilities

- `client-render-error-containment` — where boundaries exist, what the fallback must offer, and the
  explicit limits of what a boundary catches.
- `client-render-regression-tests` — the convention that components are render-tested, and the
  `act()` requirement under React 19.

### Modified Capabilities

- None.

## Approach

**Use what expo-router already ships.** `expo-router@6.0.21` wraps any route file exporting
`ErrorBoundary` in `<Try catch={ErrorBoundary}>` (`build/views/useScreens.js:128-142`). Granularity
is per file under `app/`, so root and each tab opt in independently, with no new dependency and no
hand-rolled class. Verified: `Try` passes `{ error, retry }` to the fallback
(`build/views/Try.js:53-66`).

**Layered, ships incrementally.** Root net first, then per-tab. Each layer is useful alone.

**Tests follow the existing idiom**, extended with `act()`. No new packages, no Jest config change.

**Both targets.** Per-route boundaries are plain React, so native and web behave identically. Any
"catch everything else" layer would diverge — which is why it is a non-goal here.

## Honest limits

Error boundaries catch **render-phase throws only**. Event handlers, effects and rejected promises
still escape them. The production incident was a render-phase throw, so this covers the observed
failure — but **the app is not crash-proof after this change**, and no one should read it that way.

## Decisions taken (auto mode)

The exploration left two product questions open. Resolved here without user input; both are open to
correction before spec.

**Decision 1 — the fallback offers retry AND a route back, not one or the other.**
`Try.retry()` only clears boundary state and re-renders the same subtree; with the same cached data
still in place it throws again immediately. So retry must first discard that data
(`queryClient.resetQueries({ type: "active" })` — active queries are exactly the mounted screens
that fed the throw) and only then call `retry()`. A retry that keeps failing must not strand the
user, so a second always-available action (`router.replace("/home")`) is mandatory, not optional.
Root-boundary failure is the degenerate case where navigation may itself be broken; that fallback
degrades to retry plus reload.

**Decision 2 — list-item boundaries are a fast-follow, not this change.**
Root plus 7 tab boundaries, a fallback, a test helper and the render tests already forecast near the
400-line review budget. Item-level containment needs a hand-rolled class *and* a stated convention
so new call sites do not silently miss it — that is design work, not a bolt-on. The marginal win is
also the smaller one: per-tab already takes the incident from "app dead" to "one tab degraded".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/components/RouteErrorFallback.tsx` | New | Shared fallback: message, retry, escape route |
| `client/app/_layout.tsx` | Modified | `ErrorBoundary` export |
| `client/app/(main)/(tabs)/*.tsx` (7 screens) | Modified | `ErrorBoundary` export |
| `client/components/Error.tsx` | Reused | Fallback content, unchanged |
| `client/__tests__/helpers/renderWithAct.tsx` | New | `act()`-wrapped render helper |
| `client/__tests__/` | New files | Card render regressions + containment test |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reader concludes the app is now crash-proof | High | Stated as a spec requirement, not just prose |
| Retry loops on unchanged data | High | Retry resets active queries first; escape route always present |
| `resetQueries({ type: "active" })` refetches more than the failed screen | Med | Bounded to mounted screens; acceptable cost on an error path |
| Boundary swallows an error we would have seen in dev | Med | Fallback surfaces `error.message` in `__DEV__` |
| Contained failures become invisible in production | High | Accepted and named: no crash sink is in scope |
| `act()` helper forgotten at new test sites | Med | Documented helper, not a note |
| 400-line budget exceeded | Med | List-item boundaries deferred (Decision 2) |

## Rollback Plan

Proportional to actual risk, which is **low**: no server change, no migration, no multi-tenancy/RLS
or credits/ledger surface — the config's high-risk triggers do not apply. Every edit is additive and
independently revertable. Deleting the `ErrorBoundary` export from any one route restores that
route's prior behaviour with no state to unwind; deleting the two new files removes the rest. The
test additions cannot affect runtime. Single branch, revertable as one commit range.

## Dependencies

- None. No new runtime or dev dependency. No Jest config change.
- Test command: `cd client && npx jest --ci --watchAll=false`. Baseline **857 tests / 15 suites**.

## Success Criteria

- [ ] A render-phase throw inside one tab leaves the other tabs usable; the app does not unmount.
- [ ] A render-phase throw not caught by any tab is caught at the root; no blank page.
- [ ] The fallback offers a retry that resets active queries, and an escape route that always works.
- [ ] `cards/Notification.tsx` with a `null` listing renders a fallback and does not throw — the
      exact 2026-09-03 regression, asserted in CI.
- [ ] `cards/Listing.tsx` with `media` absent renders and does not throw.
- [ ] Render tests pass on the existing `jest-expo` preset with no new dependency.
- [ ] The 857-test / 15-suite baseline is intact plus the new suites.
- [ ] The spec records that boundaries do not catch effects, event handlers or rejected promises.
