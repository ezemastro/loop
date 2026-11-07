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
- [ ] T1 Changelog foundation: data model, `/changelog` route, capture script, guide, AGENTS pointer,
  tests. Route: delegated (writer trigger, 2+ files).
- [ ] T2 Quick fixes: modal backdrop, 404, focus ring, placeholders, contrast tokens, Figtree, copy
  voice. Route: delegated.
- [ ] T3 Primitives: `CustomButton` variants, `Field`, card and shape scale, migrate call sites.
  Route: delegated.
- [ ] T4 Header and colour roles. Route: delegated.
- [ ] T5 Chat. Route: delegated.
- [ ] T6 Screens: Home order, Search row, listing detail, Offer, Publish, Notifications, Profile,
  Wishlist, empty and loading states. Route: delegated.
- [ ] T7 Publish changelog release: after captures, entries, version bump, review with the owner.
  Route: inline plus script.

## Progress
Baseline: "before" export built from `f89f18f`.

## Next step
T1.
