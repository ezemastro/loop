# UI polish and public changelog

## Objective
Make the logged-in client look professional through small, systematic changes, and ship a hidden
`/changelog` page where non-technical stakeholders see progress with before/after images.

## Problem / why
A 2026-11-07 visual audit found the app has no visual system: about 22 unshared `TextInput`s, one
button style, zero hover/focus styles, seven competing accent colours, secondary text at 2.35:1,
unresolved modal backdrops and the framework's own English 404. `/ingresar` and `/settings` are the
in-repo reference for the target quality.

## Decisions
- User delegated the header decision (2026-11-07): each community must keep a visible identity AND
  the app must look professional. Resolved: white header, community colour on a top strip, active
  tab, primary actions and the user's own chat bubbles.
- Colour roles: `secondary` is the community colour. New derived token `accent` is `secondary`
  darkened until white text reaches 4.5:1, computed in `ThemeProvider`, so any palette passes.
  `secondary-text` is likewise darkened against `background` to 4.5:1. `primary` is reserved for
  count badges. `tertiary` stops being the default action colour. Community data is not changed.
- Shape scale: controls 8px (`rounded-lg`), cards 12px (`rounded-xl`), chips and avatars full.
- Type scale: page title 24 semibold left, section 18 semibold, body 16, small 14, caption 12. No
  trailing colons. Web uses Figtree across the app; native keeps the system font.
- Copy: voseo everywhere, matching the landing.
- Changelog: hidden route, no links, `noindex`, not in the sitemap, not in robots `Disallow` (a
  crawler must be able to read the `noindex`). Every change has a stable ID so the owner can say
  "undo C-0007". Written for non-technical readers.
- Isolated worktree `../loop-ui-polish`, branch `feat/ui-polish` from `f89f18f`, because another
  session works on `feat/landing-conversion` in the main checkout.
- Delivery strategy: `single-pr`. No push or PR without the user asking. This branch depends on
  `feat/landing-conversion`, so that one merges first.
- Two-pane desktop chat is out of this round: it is a route-structure change, not a small detail.

## Scope
Client only (`client/`), plus `docs/`, `AGENTS.md` and `scripts/` for the changelog process. No
server, no admin, no community data, no marketing landing redesign.

## Constraints
- `__tests__/brand-palette.test.ts` forbids literal brand hex outside `config.ts`;
  `__tests__/main-view.test.ts` forbids hand-rolled `max-w-*` outside its allow-list. Source-reading
  guards must be updated deliberately, never deleted to get green.
- Never talk about sale, prices, plans or usage numbers in public copy.
- UI strings in Spanish (voseo); code and comments in English.
- No `Co-Authored-By` in commits; Conventional Commits only.

## TDD
Mode: off. Source: `openspec/config.yaml` (`strict_tdd: false`). Runner: `npm test` in `client/`
(jest-expo). Ordinary functional checks still run per task.

## Checks per task
- `npm test` and `npx tsc --noEmit` in `client/`.
- Web export plus Playwright captures at 1280 and 390 px, read by the parent.

## Tasks
- [x] T1 Changelog foundation. Route: delegated (writer trigger). Commits `13b935e`, `7feaa72`, `8ae9f4d`.
- [x] T2 Quick fixes. Route: delegated. Commits `66534e8`, `204bb03`, `445c0dd`, `9a5ceee`, `702b6b6`, `e74c6b6`, `b6f993f`.
- [x] T3 Primitives. Route: delegated. Commits `de2c098`, `81cfd17`, `ff97006`, `22aae64`.
- [x] T4 Header and colour roles. Route: delegated. Commits `ffe217b`, `f99a4e8`.
- [x] T5 Chat. Route: delegated. Commit `b445681`; parent fix `780a143`.
- [x] T6 Screens. Route: delegated. Commits `c99e39b`, `58fdc05`, `7a9d37a`, `f8dc84d`, `cdc09c4`, `f03c109`, `9cb6ab3`, `c82c62b`, `e23e74c`, `602fa84`, `2908f14`.
- [x] T8 Recapture the landing screenshots and share image with the new UI. Route: delegated. Commits `1dc9a02` (script `scripts/landing/capture.mjs`), `cb2eaa3` (captures). Run `node scripts/landing/capture.mjs` (needs `PLAYWRIGHT_FROM`); chat timestamps follow the clock, so reruns are not byte-identical.
- [x] T7 Release 1.5.0 in the changelog. Route: inline. Commit `4c51574`, hydration fix `4670b73`.

## Verification evidence
- `npx jest --ci --watchAll=false --silent`: 28 suites, 1204 tests passed. `npx tsc --noEmit`: clean.
- Web export captured at 1280 and 390 px and read by the parent.
- Interactions in demo mode: chat input grows and shrinks, send disabled when empty, overlay closes
  by Escape and button, filters apply, donate and wish modals open, mobile tab bar hides inside a
  conversation and returns. Loopear behaves the same as on the base build.
- Hydration: `/`, `/login`, `/register`, `/forgot-password`, `/privacidad`, `/changelog` clean at
  both widths. `/ingresar` at 1280 keeps error #418, already present on the base (`Landing.tsx:55`).

## Not verified / pending
- Native iOS and Android were not run. Community colours inside native modals are reasoned, not seen.
- Sending a message or confirming an offer was not exercised: demo mode is read-only.
- Two-pane desktop chat stays out of this round.
- `/ingresar` hydration error, pre-existing.

## Next step
Owner reviews `/changelog` and says which change IDs to keep or undo. Merge order:
`feat/landing-conversion` first, then this branch. Push, PR and deploy are the owner's decisions.
