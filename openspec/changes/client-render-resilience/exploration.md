# Exploration — client-render-resilience

## Why this change exists

On 2026-09-03, `loop.reditinere.com/notifications` rendered a completely blank page in
production. The proximate defect is already fixed and shipped to `main` (`5237081`, `9a5236a`):
the server hydrates notification references best-effort and may omit them, the shared types
declared them non-null, and `client/components/cards/Listing.tsx:50` dereferenced
`listing.media` on `undefined`.

The proximate defect is not what this change is about. **The amplifier is.** One throw, inside
one card, inside one list, unmounted the entire application. Verified: grep for `ErrorBoundary`
across `client/` returns zero matches. There is no containment anywhere.

Two gaps follow from that incident:

1. Nothing contains a render-phase throw, so any one of them is a total outage.
2. Nothing could have caught it in CI, because no test in this repo renders a component.

## Thread 1 — Error boundaries

### Current state

- `client/app/_layout.tsx` is a flat `<Stack>` with `Stack.Protected` auth/terms guards. No
  error containment.
- `client/app/(main)/(tabs)/_layout.tsx` is a `<Tabs>` navigator. No error containment.
- No crash-reporting SDK is installed (no Sentry, Bugsnag, or Crashlytics in
  `client/package.json`).
- `onGlobalApiError` / `emitGlobalApiError` (`client/api/loop.ts`, consumed by
  `client/components/ToastProvider.tsx`) is a pub-sub for **axios** errors only. It is not a
  React error boundary and has no `componentDidCatch` equivalent.
- `client/components/Error.tsx` is presentational only. Reusable as fallback *content*, not as
  the boundary itself.

### What expo-router already provides

`expo-router@6.0.21` ships `expo-router/build/views/Try.js`, a class component using
`getDerivedStateFromError`. `useScreens.js:128-142` wraps **any route file that exports
`ErrorBoundary`** in `<Try catch={ErrorBoundary}>`, keyed to that route's file.

Consequences:

- Granularity is **per file under `app/`**. A root layout, a tab screen, or a stack screen can
  each opt in independently.
- There is **no built-in mechanism for wrapping a single list item**. Containing one bad row in
  a `FlatList` requires a hand-rolled `class extends React.Component`, because React still
  offers no boundary hook.
- Being a standard React boundary, it catches **render-phase throws only**: not event handlers,
  not effects, not promise rejections. The production incident WAS a render-phase throw, so this
  covers the observed failure — but the limit must be stated, not glossed.
- Native additionally has `global.ErrorUtils.setGlobalHandler`; web would need
  `window.onerror` / `unhandledrejection`. Any "catch everything else" layer needs an explicit
  `Platform.OS` branch. This codebase ships to both.

### Options

1. **Root-only boundary.** Low effort, catches every render throw, but the user still loses the
   whole app — a nicer blank page is still a blank page.
2. **Per-route / per-tab boundary.** Medium effort. Isolates a failure to one tab, which is
   exactly the shape of the incident.
3. **List-item boundary** around card renderers. Most surgical: one bad row degrades, the list
   survives. Hand-rolled, and easy to forget at a new call site without a shared convention.
4. **Layered: root net, then per-tab, then list-item.** Ships incrementally, each layer useful
   alone.

**Recommendation:** option 4. No crash-reporting SDK in this change — remote visibility is a
separate decision with its own privacy and cost questions.

## Thread 2 — Component render testing

### The premise two earlier changes acted on was wrong

`openspec/changes/client-critical-fixes/design.md` and the archived `2026-09-01-loop-settings`
both recorded that no test renders a component and declined to add the apparatus. An initial
investigation for this change proposed a three-cause theory: a `react-test-renderer` /`react`
version skew, NativeWind's CSS runtime never being initialized under Jest, and
`@testing-library/react-native` being absent.

**All three were measured directly, and the theory is wrong on its main point.**

Installed versions (verified, not inferred):

| Package | Version |
| --- | --- |
| `react` | 19.1.0 |
| `react-test-renderer` (top level) | 19.0.0 |
| `react-test-renderer` (nested under `jest-expo`) | 19.1.0 |
| `react-native` | 0.81.5 |
| `nativewind` | 4.2.1 |
| `react-native-css-interop` | 0.2.1 |
| `expo-router` | 6.0.21 |
| `@testing-library/react-native` | absent |

The measurements:

| # | Setup | `toJSON()` |
| --- | --- | --- |
| A | matched 19.1.0 renderer, plain `<View><Text>`, **no** `className`, no `act` | `null` |
| B | matched 19.1.0 renderer, **with** `className`, no `act` | `null` |
| C | default 19.0.0 renderer, plain `<View><Text>`, **wrapped in `act()`** | full tree |
| D | default 19.0.0 renderer, **with** `className`, **wrapped in `act()`** | full tree |

Case A is decisive. With the version skew removed and NativeWind entirely out of the picture,
the tree is still `null`. Neither the version pin nor NativeWind is the blocker.

**The actual cause: React 19 defers the initial commit.** `renderer.create` called outside
`act()` returns a renderer whose tree has not been committed, so `toJSON()` is `null`. Wrapping
the call in `act()` fixes it completely.

Confirmed end to end: the exact regression test that "could not be written" for the production
bug — a notification card whose listing is `null` must render a fallback instead of throwing —
was written, run, and passed, with **zero new dependencies and zero Jest configuration
changes**. The 857-test / 15-suite baseline was re-run afterwards and is unchanged.

### What `act()` does and does not buy

- Structure and text assertions work. That is what catches the class of bug in the incident.
- `className` arrives as an inert prop; NativeWind's CSS runtime is genuinely not initialized
  under Jest, because that injection is Metro's job (`withNativeWind(config, { input:
  "./global.css" })` in `metro.config.js`) and Jest never runs Metro. **Computed styles cannot
  be asserted.** For this change that is acceptable: we need to prove components do not throw
  and render the right content, not that padding is 16px.
- If asserting resolved styles is ever wanted, `nativewind/test` is the official path, and it
  `require`s `@testing-library/react-native` directly — a devDependency of
  `react-native-css-interop` that is not installed here. That is a separate, larger decision and
  is explicitly out of scope.

### The version skew is still real

`react-test-renderer@19.0.0` declares `peerDependencies.react: "^19.0.0"` against installed
`react@19.1.0`. Already flagged and deferred as CLI-10 in
`openspec/changes/delivery-and-ci/design.md:474`. It is not what blocked rendering, and it
should not be conflated with this change. Worth aligning on its own merits; leave it to
`delivery-and-ci`.

### Options

1. **`act()` plus render tests, no new dependencies.** Effectively zero risk to the existing
   suite. Closes the CI gap for the incident's bug class.
2. **Add `@testing-library/react-native` and `nativewind/test`.** Unlocks resolved-style
   assertions. New runtime-test dependency, unverified against RN 0.81.5 / React 19.1.0
   (`react-native-css-interop` pins `^12.0.1`, tested there against RN 0.75.2 / React 18).
3. **Stay pure-function only.** Does not close the gap: nothing would have caught
   `Listing.tsx:50`.

**Recommendation:** option 1. Option 2 is a real future want, but it is not needed to fix what
broke, and it carries dependency risk that option 1 does not.

## Affected areas

- `client/app/_layout.tsx` — root boundary site
- `client/app/(main)/(tabs)/_layout.tsx` and the tab screens — per-route boundary sites
- `client/components/cards/Notification.tsx`, `client/components/cards/Listing.tsx` — the
  components that threw; list-item boundary candidates
- `client/components/Error.tsx` — reusable fallback content
- `client/__tests__/` — 15 suites, 857 passing pure-function tests, zero render tests

## Risks

- Error boundaries catch render-phase throws only. Effects, event handlers, and rejected
  promises still escape. Anyone reading the change must not conclude the app is now crash-proof.
- Web and native diverge for anything beyond render-phase containment; a single strategy must be
  checked on both targets.
- List-item boundaries need a shared wrapper and a stated convention, or new call sites will
  silently miss them.
- There is no sink for reported render errors. Out of scope here, but it means containment is
  currently invisible to us in production — we only learn from user reports.
- Adding `act()` to a growing number of render tests is easy to forget; a documented helper is
  worth more than a note.

## Open questions for proposal

- Does the fallback offer a retry, or only a way back? A boundary that cannot recover still
  strands the user on the notifications tab.
- Do list-item boundaries go in now, or as a fast-follow after root and per-tab land?

## Ready for proposal

Yes.
