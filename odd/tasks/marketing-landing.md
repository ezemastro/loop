# Marketing landing at `/`

## Objective
Give `loop.reditinere.com` a real public landing page for logged-out web visitors, with the
information currently hosted on sostenibilidadenred.com/loop, rewritten and presented in Loop's
own visual language, with real app screenshots.

## Problem / why
- `/` (logged out) renders `components/screens/Landing.tsx`: brand hero + login. It explains
  almost nothing about what Loop is, who can use it, how loopies work or the community rules.
- That information lives on a third-party Wix page (sostenibilidadenred.com/loop), on another
  domain, with a weak design.

## Decisions (agreed with the user, 2026-10-02)
- URLs stay at the root. No `/app/` prefix (would break shared links, PWA `start_url`, native parity).
- Web, logged out, `/` -> new marketing landing.
- Native (iOS/Android), logged out -> the current `Landing.tsx` stays the first screen (no marketing).
- Web: `Landing.tsx` moves to a new access route (`/ingresar`), linked from the landing CTAs.
- Logged in -> unchanged (feed).
- `login.tsx` vs `Landing.tsx`: both already share `useLoginForm`; only presentation differs
  (`Landing` routes narrow screens to `/login`). Not a real duplicate, no merge.

## Scope
- Platform split for the `/` entry, new `(auth)/ingresar.tsx` route hidden from the auth tab bar.
- New web landing screen (RN + NativeWind, Itinere tokens via CSS vars, no literal hex).
- Real screenshots of the app taken in demo mode, stored under `client/assets/landing/`.
- Page `<title>`/description for `/` via `expo-router/head`.
- Tests for the routing split and guard allow-lists.

## Constraints
- `__tests__/brand-palette.test.ts` forbids literal brand hex outside `config.ts`.
- `__tests__/main-view.test.ts` forbids hand-rolled `max-w-*` outside its allow-list.
- No invented impact numbers: the source page has none.
- Copy in Spanish (voseo), matching the existing UI.

## Tasks
- [x] T1 Routing: platform split at `/`, `/ingresar` route, CTA wiring, tests. Route: delegated (writer trigger, 2+ files).
  Commit `470f411`. `(auth)/index.tsx` picks `MarketingLanding` on `Platform.OS === "web"`, `Landing`
  otherwise; `(auth)/ingresar.tsx` hosts the old `Landing` on web, hidden from the auth tab bar.
  Covered by `__tests__/marketing-landing-routing.test.ts`.
- [x] T2 Screenshots: capture real app screens in demo mode. Route: delegated (needs a running build + CDP harness).
  3 of 5 planned captures exist (made by a prior session, not this one): `phone-home`, `phone-listing`,
  `desktop-home`. `phone-chat` and `phone-publish` were never captured and are not reachable from the
  demo flow as scoped, so "Cómo funciona" uses icon badges for the 3 steps without a screenshot instead
  of inventing a fake UI. Converted all 3 PNGs (0.6-1.1 MB each) to WebP via headless Chromium CDP
  (`Page.captureScreenshot` format "webp", quality 80): 136-140 KB each, under the 250 KB target.
  Metro and jest-expo already support `.webp` by default, no config change needed.
- [x] T3 Landing: sections, copy, screenshots, head meta, motion with reduced-motion fallback. Route: delegated (same writer as T1).
  Commits `b2333ff` (sections + copy) and `418dbd9` (entrance animations + screenshot wiring, fixes
  a Reanimated-web bug where an animated element with its own `max-lg:hidden` class got stuck at
  near-zero opacity). `<Head>` title+description confirmed present in `dist/index.html` after export.
  Footer "Buzón de consultas" links to the real Google Form, confirmed by fetching
  sostenibilidadenred.com/loop directly. Design-rule audit (dashes, CTA labels, hex guard, max-w
  allow-list, accessibility, AI-filler copy) passed, see Verification below.
- [x] T4 Verify: jest, tsc, lint, web export, visual readback at 390 / 1440. Route: parent spot check + writer self-verification.
  All green except pre-existing lint debt in unrelated files (not touched by this feature). Visual
  readback at 390x844 and 1440x900 done via headless Chromium CDP, both full-page, no horizontal
  overflow. `/ingresar` confirmed to render the old `Landing`. React hydration error #418 reproduces
  on `/` with the new landing (console capture during the visual check); checking whether it also
  reproduces on `main`'s export was attempted via a git worktree but aborted as not cheap (`main`'s
  web export fails to even build in a fresh worktree for unrelated environment reasons, before
  reaching the point where the error could be observed). Not fixed, per scope.

## Round 2 (user feedback, 2026-10-04)
Accepted changes:
- [ ] T5 Fix the web hydration error #418 (pre-existing on `main`) that breaks bottom-tab switching. Needed by T7. Route: delegated.
- [ ] T6 Demo data: replace generic placeholder photos (bridge for "Botella de agua térmica") with real product photos from an open-license bank (Unsplash/Pexels), bundled locally. Route: delegated (worktree).
- [ ] T7 Embeddable live demo: a URL that boots the app straight into demo mode for an iframe inside the hero phone; demo banner hidden until the first interaction; must not leak demo session into the parent page storage. Route: delegated.
- [x] T8 Recapture screenshots with real demo photos, no demo banner, feed from the top (phone-home, phone-listing, phone-chat, phone-publish, desktop-home). Route: delegated (worktree).
  Done in worktree `/home/opencode/projects/loop-wt/shots2`, branch `feat/landing-shots` (off
  `feat/marketing-landing`, not yet merged). Commits `a0c6f1d` (fix, see below) and `6afa376` (the
  5 webp files, 37.6-51.9 KB each, 780x1688 mobile @2x / 1440x900 desktop @1x, all under the 250 KB
  budget). Captured from the live app in demo mode via headless Chromium over CDP. phone-home was
  adjusted mid-task by the coordinator: it must match `/demo`'s exact first paint (scroll top 0, no
  interaction) since it's the poster the live hero iframe replaces, not a scroll into the feed.
  phone-listing shows the water bottle (Lucía's, not ana's) with real photo, price and "Loopear".
  phone-chat is the real seeded ana<->Sofía thread, reached via the Mensajes tab. phone-publish has
  the title/category "Mochilas"/condition "Bueno" filled through the real form, photo area visible.
  Found and fixed a real rendering bug along the way (commit `a0c6f1d`): `cards/Listing.tsx`'s grid
  card `Image` had no explicit `style`, only `className="aspect-[4/3]"`; for demo listings (now
  real bundled photos per T6), RN-Web's `Image` applies the asset's Metro-embedded intrinsic height
  as an inline style default that survives being merged with a `style` prop unless that prop sets
  `height` itself (`aspectRatio` alone isn't enough — CSS `height` wins over `aspect-ratio` once
  both are present), so a portrait 800x1000 product photo blew a feed card up to 800x1000 CSS px.
  Fixed with `style={{width:'100%', height:'auto'}}`. This is a real, user-visible bug in the live
  demo (both `/demo` and the ordinary demo-mode feed), not just a screenshot artifact — not reverted
  before committing, since shipping "nice" screenshots while the real feed stays broken would be
  dishonest; flagged here and in the session report for review.
  Also found, but explicitly NOT fixed (out of scope, needs its own investigation): in this
  exported-web build, clicking any TAB-level route (bottom tab bar, header Messages icon, `/messages`
  index) updates the URL but does not swap the rendered screen — confirmed with both coordinate
  clicks and native `element.click()`, not a timing issue. STACK-level pushes (listing/chat detail,
  modal interactions) work fine via click. Worked around in the capture script with
  `history.pushState` + a dispatched `popstate` event (same technique the pre-T5 session used).
  Full write-up in Engram, project `loop`, title "T8 landing screenshots recaptured + demo card
  image-sizing bug fixed".
  Checks: `cd client && npx jest --ci --watchAll=false --maxWorkers=2` — 23 suites, 973 tests, all
  passed (worktree, both commits applied).
- [x] T9 Hero redesign: max-width centered container, no "Red Itínere" pill (use the Itínere logo instead), laptop + phone composition on a Loop-styled panel; phone runs the live demo (static shot on small screens). Route: delegated (opus). Commit `1e1d7c1`.
- [x] T10 "Cómo funciona" redesign: compact aligned steps with one sticky/switching device instead of scattered items. Route: delegated (opus, with T9). Commit `1e1d7c1` (shared with T9: both depend on the new `DeviceFrame`).
- [x] T11 Subtle motion and hover states across the page; self-critique with screenshots at 390 / 1440 / 1920. Route: delegated (opus, with T9). Commit `17b2595`.

## Acceptance criteria
- Logged-out web visit to `/` shows the new landing; "Ingresar" goes to `/ingresar` (old Landing).
- Native first screen is unchanged.
- Logged-in `/` behaves as before.
- Jest suite green, typecheck clean, `expo export -p web` succeeds.

## Checks
- TDD: off (source: `openspec/config.yaml` `tdd: false`). Runner: `cd client && npx jest --ci --watchAll=false`.
- Typecheck: `cd client && npx tsc --noEmit`. Lint: `cd client && npx expo lint`.
- RDD: off globally (user decision 2026-09-23).

## Delivery
- Strategy: ask-on-risk. Forecast > 400 authored lines (landing screen + copy). Branch `feat/marketing-landing`; PR/merge is the user's call.

## Progress
- 2026-10-05: T9-T11 done (`1e1d7c1`, `17b2595`). Hero: 1200px container, "Una plataforma de"
  + Itínere logo instead of the pill, laptop (`desktop-home.webp`) + phone straddling a navy block
  that bleeds right. From `lg` up the phone mounts `/demo` in an iframe ~700ms after load, keeps
  `phone-home.webp` as poster until the iframe's own path reaches `/home`, then fades it in;
  "Probala acá" hint hides on the first pointer/wheel/key/touch inside it; gives up and keeps the
  poster after 15s (`components/landing/useLiveDemo.ts`). Below `lg`: one static phone.
  "Cómo funciona": step list + one phone that crossfades to the active step's capture (hover,
  focus, press); mobile shows only the active step's description. Mapping: publicar->publish,
  recibir->listing, buscar->home, coordinar->chat. Rest of page: shared `layout.ts` container,
  `Reveal` (IntersectionObserver, motion-safe) replaces Reanimated `entering` (AnimatedView
  deleted), `LandingButton` with hover/active/focus-visible, rules use check icons (no dots), FAQ
  divided accordion, final CTA as contained navy panel. New guard
  `__tests__/marketing-landing-layout.test.ts`. Screenshots still the pre-T8 captures; the new
  ones drop in under the same filenames.
- 2026-10-04: captured `phone-publish.webp` and `phone-chat.webp` (real demo-mode UI, 390x844 @2x
  WebP, 35-39 KB each) and wired them into `MarketingLanding.tsx`'s `stepScreenshots` (`publicar`,
  `coordinar`), correcting T2's old claim that these two screens were unreachable. Commit `005e18c`. How they were
  reached, and the hydration-#418 root cause found along the way, are written up in the session
  report (not duplicated here to keep this file short); short version: `/ingresar` -> click
  "Explorar la demo sin crear cuenta" -> from there, every further navigation used
  `history.pushState` + a manual `popstate` dispatch instead of a real click or a fresh
  `Page.navigate`, because the bottom-tab navigator's fiber tree is left corrupted by the #418
  hydration mismatch (clicks silently no-op) and a full page load re-serves the logged-out static
  HTML for protected routes with no client-side correction. Chat used the real existing seeded
  conversation as-is: demo mode is read-only by design (`demo/readOnly.ts`), so sending a new
  message 403s with a toast instead of reaching the mock dataset. Hero recapture
  (`phone-home`/`desktop-home`/`phone-listing`) was started per a mid-task request, then cancelled
  by the user (real product photos are coming first, deferred to T6/T8); nothing from that attempt
  was written to `client/assets/landing/`.
- 2026-10-02: branch created, exploration done.
- 2026-10-02: T1 (`470f411`), T3 sections+copy (`b2333ff`), T3 motion+screenshots (`418dbd9`)
  committed. T4 verification run, see Checks below. Resumed after a container restart killed the
  writer mid-task; the uncommitted motion/screenshot work was reviewed, finished (reduced-motion
  already covered by Reanimated's default, one real bug found and fixed) and committed.

## Checks (2026-10-05, T9-T11)
- `cd client && npx jest --ci --watchAll=false --maxWorkers=2`: 24 suites, 1047 tests, all passed.
- `cd client && npx tsc --noEmit`: clean.
- `cd client && npx eslint components/landing components/screens/MarketingLanding.tsx`: zero issues.
- `cd client && npx expo export -p web`: succeeds; `client/dist` rebuilt at the end.
- Visual (headless Chromium CDP over a static server of the export): 390 DPR2 / 1440 / 1920 full
  page + hero viewports. iframe reaches `/home` and fades in at 1440 and 1920; a click on its
  "Publicar" tab navigates the embedded app to `/publish`, the demo banner appears, the hint goes
  to opacity 0. No horizontal overflow at 390 (`scrollWidth === clientWidth === 390`). Console: no
  errors (only the pre-existing expo-notifications web warning).

## Checks (2026-10-02, T4)
- `cd client && npx jest --ci --watchAll=false --maxWorkers=2`: 19 suites, 946 tests, all passed.
- `cd client && npx tsc --noEmit`: clean, no errors.
- `cd client && npx expo lint`: 16 errors / 2 warnings, all in files this feature never touches
  (`ListingStatusInfo.tsx`, `ModifyListing.tsx`, `PwaInstallPrompt.tsx`, `Toast.tsx`,
  `ToastProvider.tsx`, `ModifyWishModal.tsx`, `Login.tsx`, `ResetPassword.tsx`,
  `SchoolSelection.tsx`, legal docs) — pre-existing debt. `npx eslint components/landing/
  components/screens/MarketingLanding.tsx` alone: zero issues.
- `cd client && npx expo export -p web`: succeeds, `dist/index.html` has the `/` `<title>` and
  `<meta name="description">`.
- `rg '[—–]' client/components/landing client/components/screens/MarketingLanding.tsx`: no matches.
- Visual readback (headless Chromium CDP, full page): 390x844 DPR2 and 1440x900, no horizontal
  overflow (`scrollWidth === clientWidth` at 390). `/ingresar` renders the old `Landing`. Hydration
  error #418 appears in the browser console on `/`; not fixed (out of scope per task brief).
- 2026-10-02 (parent spot check): the hero phone was invisible at every width (same Reanimated
  `display:none` + entering bug) and mobile showed no screenshots at all (`max-lg:hidden`). Fixed by
  moving layout classes to a plain `View` and showing the phone shots at all widths. Re-captured at
  390 and 1440: hero phone and step screenshot visible, no horizontal overflow. jest 946/946, tsc clean.
  Hydration #418 on `/` is pre-existing: the screenshot agent reproduced it on `main`'s export.
