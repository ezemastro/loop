# Proposal: Itínere Brand Refresh

## Intent

Loop still ships the pre-Itínere palette (orange/green) and a legacy logo, so pre-auth screens and any community without its own theme look off-brand. Adopt the Red Itínere institutional palette as the default and replace the logo assets, so brand is defined in one place instead of scattered hex literals.

## Scope

### In Scope

- Rewrite `DEFAULT_COLORS` (`client/config.ts:7-18`) and the mirrored channels in `client/global.css:11-22` to the institutional palette: PRIMARY `#E4510B`, SECONDARY `#243B7A`, TERTIARY `#209B8A`, CREDITS `#7D2048`, CREDITS_LIGHT `#A03A63`, ALERT `#C52525`, MAIN_TEXT `#3D3D3D`. SECONDARY_TEXT/STROKE/BACKGROUND unchanged.
- Remove every brand hex from `client/components/screens/Landing.tsx`; derive the decorative tints from PRIMARY/SECONDARY (~8% / 20%) via `hexToChannels` (`client/services/color.ts:14`).
- Rewire `client/components/PwaInstallPrompt.tsx` to the active theme instead of its hardcoded palette copy.
- Align PWA/native metadata: `client/app.json` (splash, adaptiveIcon, web `themeColor`/`backgroundColor`) and `client/public/manifest.json`.
- Adopt the new logo: move `client/ChatGPT Image Aug 30, 2026, 10_30_20 PM.png` → `client/assets/full_logo.png` (despeckled) and regenerate `assets/icon.png`, `assets/app_icon.png`, `public/icons/icon-{192,512}.png`, `public/icons/apple-touch-icon.png`.
- Delete unreferenced assets (`full_logo.svg` 4.97 MB, `reditinere_logo.png`, Expo template leftovers).

### Out of Scope

- Layout, responsive, or card redesign (deferred to `loop-ui-polish`).
- Community theme data and the multi-tenancy mechanism.
- `Toast.tsx` semantic colors and `GoogleSignInButton.tsx` Google-brand colors.

## Capabilities

### New Capabilities

- `brand-theme`: default palette contract, theme-var pipeline invariants, brand asset set.

### Modified Capabilities

- None (no existing `openspec/specs/`).

## Approach

Change the values, not the mechanism. ~230 Tailwind semantic classes repaint through the existing CSS-variable pipeline (`ThemeProvider` → `vars()`), so no consumer component changes for the recolor. Only files holding literal hex are touched. Logo work is pure asset replacement so a future file swap needs no code change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/config.ts`, `client/global.css` | Modified | Palette source of truth (kept in sync) |
| `client/components/screens/Landing.tsx` | Modified | Derived tints replace pastel literals |
| `client/components/PwaInstallPrompt.tsx` | Modified | Consumes theme |
| `client/app.json`, `client/public/manifest.json` | Modified | themeColor/backgroundColor/icons |
| `client/assets/`, `client/public/icons/` | Modified/Removed | New logo + regenerated derivatives |

Contrast (computed, to be asserted in spec): white on SECONDARY `#243B7A` = 10.6:1 and `text-secondary` on white = 10.6:1 (both AAA, up from 3.3:1). ALERT improves to 5.7:1. White on PRIMARY `#E4510B` = 3.8:1 — AA large/UI only, same class as today.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New logo gradient is rainbow, not Itínere; sits beside a blue header | High (accepted) | Assets stay code-free; later swap is file replacement only |
| Palette drift between `config.ts` and `global.css` | Med | Spec requirement asserting both blocks match |
| Per-key fallback in `resolveThemeColors` regresses; themed communities repaint | Low | Regression requirement: themed communities unaffected |
| White-on-PRIMARY small text below AA | Med | Spec enumerates permitted PRIMARY usages |

## Rollback Plan

Single-commit revert restores the old palette and assets; no data, schema, or API surface changes.

## Dependencies

- Image tooling to despeckle and resize the source PNG into the six derived assets.

## Success Criteria

- [ ] Zero brand hex literals outside `config.ts`/`global.css` in the affected files.
- [ ] `config.ts` and `global.css` values match exactly.
- [ ] Communities with their own theme render identically to before.
- [ ] PWA install, splash, favicon, and apple-touch icon show the new logo; browser chrome is `#243B7A`.
