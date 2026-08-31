# Brand Theme Specification

## Purpose

Defines the institutional (Itínere) default color palette as the single source of truth for the client app, the invariants that keep its two hand-synced representations aligned, the contrast rules that govern where each color may be used, and the stable asset-naming contract for brand imagery. Client-only; light mode only. Communities with their own theme data are an unaffected passthrough — no migration or notification.

## Requirements

### Requirement: Default Institutional Palette

`DEFAULT_COLORS` MUST hold exactly these values, used whenever no community is resolved or a community has no theme:

| Key | Hex |
|---|---|
| PRIMARY | `#E4510B` |
| SECONDARY | `#243B7A` |
| TERTIARY | `#209B8A` |
| CREDITS | `#7D2048` |
| CREDITS_LIGHT | `#A03A63` |
| ALERT | `#C52525` |
| MAIN_TEXT | `#3D3D3D` |

`SECONDARY_TEXT`, `STROKE`, `BACKGROUND` MUST remain unchanged.

#### Scenario: No community resolved

- GIVEN no user session and no preview community
- WHEN the app renders
- THEN every theme-var-driven surface uses `DEFAULT_COLORS` above

#### Scenario: Community with no theme data

- GIVEN a community whose `theme` field is absent
- WHEN colors resolve for that community
- THEN every key falls back to `DEFAULT_COLORS`

### Requirement: Config/CSS Parity Invariant

`client/config.ts` (`DEFAULT_COLORS`, hex) and `client/global.css` (`:root` CSS vars, RGB channel triplets) MUST express identical color values for every key.

#### Scenario: Palette value cross-check

- GIVEN the palette table above
- WHEN `--color-secondary` in `global.css` is read as RGB and converted to hex
- THEN it equals `DEFAULT_COLORS.SECONDARY` (`#243B7A` → `36 59 122`), and likewise for every other key

### Requirement: Per-Key Theme Fallback Regression

`resolveThemeColors` MUST continue resolving each color key independently: a community missing or holding an invalid value for one key MUST NOT affect other valid keys.

#### Scenario: Partial community theme

- GIVEN a community theme with a valid `primary` hex, an invalid `secondary` value, and no `alert` key
- WHEN colors resolve
- THEN PRIMARY uses the community's value, SECONDARY and ALERT fall back to the new `DEFAULT_COLORS`, and other valid community keys are unaffected

#### Scenario: Fully themed community, silent passthrough

- GIVEN a community with a complete valid theme predating this change
- WHEN the app renders before and after this change
- THEN the community's rendered colors are identical (no migration, no notification)

### Requirement: Contrast-Constrained Color Usage

SECONDARY, ALERT, and MAIN_TEXT MUST be usable as text/background at any size (SECONDARY on white = 10.6:1 AAA, white on SECONDARY = 10.6:1 AAA, white on ALERT = 5.7:1 AA, MAIN_TEXT on BACKGROUND = 9.5:1 AAA). PRIMARY and TERTIARY MUST NOT be used as the color pair with white/BACKGROUND for small or body text (white on PRIMARY = 3.8:1, white on TERTIARY = 3.4:1 — below the 4.5:1 normal-text AA threshold).

Permitted PRIMARY/TERTIARY usages (≥3:1, meets AA large-text/UI-component threshold): large headings (≥18pt regular or ≥14pt bold), filled buttons/icons/accents, borders, and focus rings. Prohibited: body copy, captions, or any small-text foreground/background pairing with white or BACKGROUND.

#### Scenario: Large CTA button

- GIVEN a filled button using PRIMARY background with a bold ≥14pt white label
- WHEN rendered
- THEN it satisfies WCAG AA (3:1, large text/UI threshold)

#### Scenario: Small body text rejected

- GIVEN a proposed use of PRIMARY as small (<14pt) body text color on BACKGROUND
- WHEN evaluated against this requirement
- THEN it is disallowed

### Requirement: Landing Screen Zero Hardcoded Brand Hex

`Landing.tsx` MUST NOT contain literal brand hex values. Its decorative blob tints MUST derive from `PRIMARY`/`SECONDARY` via `hexToChannels` at ~8% and ~20% alpha respectively. The decorative composition (shape, position, layering) is unchanged — recolor only.

#### Scenario: Default palette blobs

- GIVEN the default theme
- WHEN Landing renders
- THEN blob tints are computed from `#E4510B`/`#243B7A`, not literal hex

#### Scenario: Themed community blobs

- GIVEN a community with a custom PRIMARY/SECONDARY
- WHEN Landing renders for that community
- THEN blob tints follow that community's colors

### Requirement: PwaInstallPrompt Theme Consumption

`PwaInstallPrompt.tsx` MUST read colors from the active theme and MUST NOT hold its own hardcoded palette copy.

#### Scenario: Themed community prompt

- GIVEN a community with a custom theme
- WHEN the install prompt renders
- THEN it matches that community's colors, not a stale hardcoded copy

### Requirement: Static Build Metadata Alignment

`client/app.json` (`themeColor`, splash/web `backgroundColor`) and `client/public/manifest.json` (`theme_color`, `background_color`) MUST reflect `DEFAULT_COLORS` (`theme_color` = SECONDARY `#243B7A`; `background_color` = unchanged BACKGROUND `#F0F0F0`). These static surfaces MAY NOT vary per community — expected limitation, not a defect.

#### Scenario: Browser chrome color

- GIVEN the PWA manifest and app.json
- WHEN inspected
- THEN `theme_color`/`themeColor` equal `#243B7A`

### Requirement: Stable Brand Asset Filenames

Brand assets (`full_logo.png`, `icon.png`, `app_icon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) MUST be referenced only by these stable filenames, never by content-derived or versioned names.

#### Scenario: Future logo swap

- GIVEN a future replacement image for the brand logo
- WHEN the file is swapped in place under the same filenames
- THEN no code change is required anywhere in the app

### Requirement: Untouched Adjacent Surfaces

Toast semantic colors (`Toast.tsx`) and Google-brand button colors (`GoogleSignInButton.tsx`) MUST remain untouched by this change; no layout/responsive change is in scope.

#### Scenario: Toast and Google button unaffected

- GIVEN the Toast and GoogleSignInButton components
- WHEN this change is applied
- THEN their color values are byte-identical to before
