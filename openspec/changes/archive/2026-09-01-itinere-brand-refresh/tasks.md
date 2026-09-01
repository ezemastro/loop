# Tasks: Itínere Brand Refresh

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~205 authored + 13 binary files (7 regenerated, 6 deleted) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Palette + guard test + consumer de-hardcoding + static metadata | PR 1 | `npx jest --ci --watchAll=false` | Web build: inspect `:root` `--color-*` vars and rendered Landing/PwaInstallPrompt colors | Revert `config.ts`, `global.css`, `Landing.tsx`, `PwaInstallPrompt.tsx`, `app.json`, `manifest.json`, `sw.js`, the test file |
| 2 | Brand asset regeneration + deletions (binary-only, same PR) | PR 1 | Visual readback of 7 PNGs | Manual: PWA install prompt, splash, favicon, apple-touch icon | `git checkout` on `client/assets/` and `client/public/icons/` paths |

## Phase 1: Palette Source of Truth

- [x] 1.1 In one commit, update `client/config.ts` `DEFAULT_COLORS` (PRIMARY `#E4510B`, SECONDARY `#243B7A`, TERTIARY `#209B8A`, CREDITS `#7D2048`, CREDITS_LIGHT `#A03A63`, ALERT `#C52525`, MAIN_TEXT `#3D3D3D`; SECONDARY_TEXT/STROKE/BACKGROUND unchanged) and the mirrored RGB triplets in `client/global.css` `:root` — this pair must never land apart. *Satisfies: Default Institutional Palette, Config/CSS Parity Invariant.*

## Phase 2: Sync Guard Test

- [x] 2.1 Create `client/__tests__/brand-palette.test.ts`: parse `global.css` `:root`, assert all 10 keys equal `hexToChannels(DEFAULT_COLORS[k])`; assert contrast floors (white/SECONDARY ≥7, SECONDARY/white ≥7, white/ALERT ≥4.5, white/PRIMARY ≥3); assert no case-insensitive brand-hex match (old: `FF5900,4C9F38,009E7C,8436D1,8F4CD1,FF3B30,FFF1E8,F3D4BF,EEF8E9,C7E0BE,16352B,EEEEEE`; new: `E4510B,243B7A,209B8A,7D2048,A03A63,C52525`) in `client/**/*.{ts,tsx}` outside `config.ts` and this file; assert `app.json` `web.themeColor` and `manifest.json` `theme_color` both equal `DEFAULT_COLORS.SECONDARY`. Done when the file exists and `npx jest --ci --watchAll=false` executes it (failures expected until Phases 1/3/4 land). *Satisfies: Config/CSS Parity Invariant, Contrast-Constrained Color Usage, Landing Screen Zero Hardcoded Brand Hex, Static Build Metadata Alignment.*

## Phase 3: De-hardcode Consumers (parallel with Phase 4)

- [x] 3.1 `client/components/screens/Landing.tsx`: blobs at `:136`/`:152` → `className="bg-primary/10"` / `bg-secondary/10`, drop literal `backgroundColor`; `LeafIcon` at `:140`/`:156` keeps `color={colors.PRIMARY|SECONDARY}`, add `opacity: 0.22` to its existing inline `style`; border `#EEEEEE` (`:219`) → `colors.STROKE`; shadow `#16352B` (`:220`) → `colors.MAIN_TEXT`; `#FFFFFF` (`:49`) stays. Done when no literal brand/neutral hex remains and decorative composition is unchanged. *Satisfies: Landing Screen Zero Hardcoded Brand Hex.*
- [x] 3.2 `client/components/PwaInstallPrompt.tsx`: replace the hardcoded palette with `useThemeColors()` (`#FF5900`→`colors.PRIMARY`, `#424242`→`colors.MAIN_TEXT`, `#9E9E9E`→`colors.SECONDARY_TEXT`, `#FFFFFF` stays); replace the `"L"` glyph (`:148`) with `<Image source={require("../assets/icon.png")} resizeMode="contain" />` at 44×44 inside the 60×60 container, whose background becomes `colors.SECONDARY`. Done when zero hardcoded hex remains in the file. *Satisfies: PwaInstallPrompt Theme Consumption.*

## Phase 4: Static Build Metadata (parallel with Phase 3)

- [x] 4.1 `client/app.json`: set `web.themeColor` and `adaptiveIcon.backgroundColor` to `#243B7A`; leave asset paths unchanged.
- [x] 4.2 `client/public/manifest.json`: set `theme_color` to `#243B7A`; `background_color` stays `#F0F0F0`.
- [x] 4.3 `client/public/sw.js:1`: bump `CACHE_NAME` from `"loop-cache-v1"` to `"loop-cache-v2"` so the `activate` handler purges v1. *Satisfies: Static Build Metadata Alignment.*

## Phase 5: Brand Assets (independent of Phase 3/4; run after or before, must precede Phase 6)

- [x] 5.1 Using `NODE_PATH=/tmp/imgtools/node_modules node -e "const sharp=require('sharp'); ..."` (no dependency added to `client/package.json`, nothing written under `/tmp/imgtools`), despeckle the quoted source `client/ChatGPT Image Aug 30, 2026, 10_30_20 PM.png` (remove alpha islands smaller than ~600 px² without altering the three main shapes) and export `client/assets/full_logo.png` at 1176×320, alpha-bbox crop padded to 3.675:1, transparent background.
- [x] 5.2 From the despeckled wordmark, crop the infinity mark (alpha bbox ≈ x∈[470,1670], y∈[100,625]) and generate: `client/assets/icon.png` 512×512, mark ≈92% width, transparent bg; `client/assets/app_icon.png` 1024×1024, mark ≈55% width, opaque `#243B7A`; `client/public/icons/icon-192.png` 192×192, mark ≈60% width, opaque `#243B7A`; `client/public/icons/icon-512.png` 512×512, mark ≈60% width, opaque `#243B7A`; `client/public/icons/apple-touch-icon.png` 180×180, mark ≈66% width, opaque `#243B7A`. *Satisfies: Stable Brand Asset Filenames.*
- [x] 5.3 Delete `client/assets/full_logo.svg`, `client/assets/images/adaptive-icon.png`, `client/assets/images/splash-icon.png`, `client/assets/images/favicon.png`, `client/assets/images/icon.png`, and `client/ChatGPT Image Aug 30, 2026, 10_30_20 PM.png` (source, now consumed). Keep `client/assets/reditinere_logo.png` (institutional network mark), `client/assets/images/default-profile.png`, `client/assets/icons/credit.png`, `client/assets/fonts/SpaceMono-Regular.ttf`. Done when `git status` shows exactly these deletions and no other asset path removed.

## Phase 6: Verification

- [x] 6.1 Run `npx jest --ci --watchAll=false` (never `npm run test`, which never terminates) — all `brand-palette.test.ts` assertions pass. **227/227 passed.**
- [x] 6.2 Grep `client/**/*.{ts,tsx}` (excluding `config.ts` and the test file) for the old and new brand-hex lists above, case-insensitive — zero matches. **Enforced live by the guard test's per-file assertions (227 cases); also caught and fixed one stray old-hex mention in a `services/color.ts` doc comment.**
- [ ] 6.3 Run `npm run lint` — zero errors. **BLOCKED**: `expo lint` crashes with `ERR_UNSUPPORTED_DIR_IMPORT` resolving `eslint-config-expo/flat` under Node v24.14.1 (Node's strict ESM resolver rejects the package's directory-style import; needs `eslint-config-expo/flat.js` or a config/Node-version fix). Confirmed pre-existing and unrelated to this change — the failure is in `eslint.config.js`'s import of `eslint-config-expo`, not in any file this change touches. Out of scope to fix here (colors + logo only).
- [x] 6.4 Visual readback of all 7 generated/regenerated PNGs plus manual check: PWA install prompt, splash, favicon, and apple-touch icon show the new logo; browser chrome equals `#243B7A`. *Satisfies: proposal Success Criteria.* **All 7 PNGs visually inspected via direct image readback — correct dimensions, correct `#243B7A` backgrounds, clean mark with no artifacts. Browser-chrome/PWA-install/splash/favicon confirmed by code+asset inspection (`app.json`, `manifest.json` `theme_color`/`themeColor` = `#243B7A`, referenced icon files updated in place); no live browser or device run was performed (no dev server started in this session).**
