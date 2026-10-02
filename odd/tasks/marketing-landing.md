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
- [ ] T1 Routing: platform split at `/`, `/ingresar` route, CTA wiring, tests. Route: delegated (writer trigger, 2+ files).
- [ ] T2 Screenshots: capture real app screens in demo mode. Route: delegated (needs a running build + CDP harness).
- [ ] T3 Landing: sections, copy, screenshots, head meta, motion with reduced-motion fallback. Route: delegated (same writer as T1).
- [ ] T4 Verify: jest, tsc, lint, web export, visual readback at 390 / 1440. Route: parent spot check + writer self-verification.

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
- 2026-10-02: branch created, exploration done.
