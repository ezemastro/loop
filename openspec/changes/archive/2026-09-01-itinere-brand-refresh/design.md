# Design: Itínere Brand Refresh

## Technical Approach

Change values, not mechanism. `DEFAULT_COLORS` (`client/config.ts:7-18`) stays the single source of
truth; `global.css:11-22` remains its hand-mirrored RGB-channel copy, now guarded by the repo's first
jest test. Every consumer already reads the palette through one of two existing paths — Tailwind
semantic classes backed by `--color-*`, or `useThemeColors()` for JS color props — so the recolor
touches only the files holding literal hex. Logo work is out-of-tree, one-time asset generation
committed as binaries; no image dependency enters `client/package.json`.

New palette channels (for `global.css`): PRIMARY `228 81 11`, SECONDARY `36 59 122`,
TERTIARY `32 155 138`, MAIN_TEXT `61 61 61`, CREDITS `125 32 72`, CREDITS_LIGHT `160 58 99`,
ALERT `197 37 37`. SECONDARY_TEXT/STROKE/BACKGROUND unchanged.

## Architecture Decisions

### Decision: Sync guard is a unit test, not codegen

| Option | Cost | Catches drift |
|---|---|---|
| Generate `global.css` from `config.ts` | New npm lifecycle hook + generated file in git; **there is no CSS build step today** | Yes |
| **Unit test comparing both blocks (chosen)** | ~90-line test; jest/jest-expo already in devDeps; zero new deps | Yes, at test time |
| Documented manual sync | Zero | No — it is today's state |

**Choice**: `client/__tests__/brand-palette.test.ts` parses `global.css` `:root` and asserts, for all
10 keys, `hexToChannels(DEFAULT_COLORS[k]) === parsedChannels[k]`, and that key sets match exactly.
**Rationale**: codegen buys the same guarantee at the price of a build step this project does not
have and would have to maintain forever for 10 lines of CSS.
**Honest cost**: the guard only fires when the suite runs, and `npm run test` is `jest --watchAll`
(never terminates, not CI-safe). Verification MUST therefore invoke `npx jest --ci --watchAll=false`.
The `jest-expo` universal preset runs each test once per platform project — expected duplication, not
a fault. This is the repo's first test file; no test infrastructure exists to reuse.

### Decision: Tints via existing alpha classes; no new color math

**Choice**: `Landing.tsx:136` → `className="absolute bg-primary/10"`; `:152` → `bg-secondary/10`
(drop both `backgroundColor` keys). `:140`/`:156` `LeafIcon` keeps `color={colors.PRIMARY|SECONDARY}`
and gains `opacity: 0.22` in its existing inline `style` object.
**Alternatives rejected**: (a) a JS tint helper over `hexToChannels` — new production surface for a
decorative effect; (b) `className="text-primary/25"` on `LeafIcon` — works via the `cssInterop`
`nativeStyleToProp` registration (`Icons.tsx:7-14`) but relies on alpha-color prop lifting, a
narrower path than plain `opacity` on a Feather glyph.
**Rationale**: `Landing.tsx:200` already uses `bg-secondary/10`; the vars are loose channels
precisely so alpha variants work (`services/color.ts:6-9`). `/10` over `/[0.08]` keeps the default
Tailwind step and matches the existing line. This supersedes the proposal's `hexToChannels` hint —
same outcome (tints derived from the active theme, zero literals), cheaper mechanism.
**Neutrals at `:219`/`:220`**: `#EEEEEE` → `colors.STROKE` (same file already uses it at `:231`;
`#E4E4E4` is visually equivalent). `#16352B` → `colors.MAIN_TEXT` — that green-black is old-palette
residue, and at `shadowOpacity: 0.1` a neutral is indistinguishable. `#FFFFFF` (`:49`, `bg-white`)
**stays**: white is not a brand color, the palette has no white token, and adding one would let a
community theme make "white" non-white and silently break on-brand contrast.

### Decision: `PwaInstallPrompt` uses `useThemeColors()`, not Tailwind classes

**Verified**: the component *is* inside `<ThemeProvider>` in the React tree (`_layout.tsx:74-97`,
prompt at `:95`), but it renders through React Native `Modal` (`PwaInstallPrompt.tsx:108`). On
react-native-web, `Modal` mounts through a portal appended to `document.body` — a DOM *sibling* of
the `ThemeProvider` `<View>`, not a descendant — so the inline custom properties from `vars()`
(`ThemeProvider.tsx:19-37`) do not cascade in. The `:root` block in `global.css` still resolves, so
Tailwind classes would render the **default** palette and silently never track a community theme.
**Evidence level**: React-tree placement is confirmed from source; the portal behaviour could not be
confirmed at runtime (no shell in this phase, `node_modules` not installed). The chosen design is
immune to that uncertainty — `useThemeColors()` reads the zustand store directly and never depends on
DOM cascade. Verification adds one cheap runtime confirmation (below).
**Fit**: the file uses inline `style` objects exclusively and zero `className`, and
`ThemeProvider.tsx:13-14` names `useThemeColors()` as the sanctioned path for JS-prop colors.
**Mapping**: `#FF5900` → `colors.PRIMARY`; `#424242` → `colors.MAIN_TEXT`; `#9E9E9E` →
`colors.SECONDARY_TEXT`; `#FFFFFF` stays (sheet surface / on-accent text). The `"L"` glyph (`:148`)
becomes `<Image source={require("../assets/icon.png")} resizeMode="contain" />` at 44×44 inside the
60×60 container, whose background becomes `colors.SECONDARY`.

### Decision: Square icons are the infinity mark on a full-bleed SECONDARY canvas

The source is a 3:1 wordmark `L∞P` (dark-gray letters, rainbow infinity). Square targets cannot hold
it: at a 32 px favicon the wordmark is ~9 px tall and illegible, and `manifest.json:17,23` declares
`purpose: "any maskable"`, which crops to the inner ~80 % circle and requires a full-bleed
background. So square icons **crop to the infinity mark** (source region ≈ `x∈[470,1670]`,
`y∈[100,625]`, refined to its alpha bbox) and center it on an opaque `#243B7A` canvas. Blue is
chosen because it is also `theme_color`, so icon and browser chrome agree.

| Asset | Size | Content | Background |
|---|---|---|---|
| `assets/full_logo.png` | 1176×320 | full wordmark, alpha-bbox crop padded to **3.675:1** | transparent |
| `assets/icon.png` | 512×512 | mark ≈92 % width | **transparent** — sits in a white circle in `AppLogo.tsx:6-11` |
| `assets/app_icon.png` | 1024×1024 | mark ≈55 % width | opaque `#243B7A` |
| `public/icons/icon-192.png` | 192×192 | mark ≈60 % width (maskable safe zone) | opaque `#243B7A` |
| `public/icons/icon-512.png` | 512×512 | mark ≈60 % width | opaque `#243B7A` |
| `public/icons/apple-touch-icon.png` | 180×180 | mark ≈66 % width | opaque `#243B7A` (iOS ignores alpha) |

`app_icon.png` serves both `expo.icon` (iOS: must be opaque) and `android.adaptiveIcon.foregroundImage`
(safe zone: inner 66 %). One file satisfies both because the foreground's own background equals the
new `adaptiveIcon.backgroundColor: "#243B7A"`, so the adaptive crop edge is invisible.
**The 3.675:1 wordmark target is load-bearing**: it matches the current `979×266` and therefore the
`280×76` / `205×58` render boxes at `Landing.tsx:178`, so `resizeMode="contain"` needs **no layout
change**. Exporting at the source's native 3:1 would shrink the rendered logo ~18 %.
**Accepted**: the mark is a rainbow gradient, not Itínere red — flagged in the proposal. Blue backing
is the best reconciliation without redrawing; a later swap stays file-only.

### Decision: Image tooling probed at apply time; nothing added to `package.json`

**Reported honestly**: this phase had no shell tool, so `magick`/`convert`/`python3 -c "import PIL"`
could **not** be executed. Filesystem evidence: `client/node_modules` does not exist and `sharp` is
absent from `client/package.json` devDeps, so sharp is unavailable without an install; `/usr/bin` is
outside the permitted working directories and could not be globbed, so binary presence is unresolved.
**Ordered rule for apply** — take the first that answers:
1. **ImageMagick** (`magick -version` / `convert -version`) — preferred: alpha-bbox trim,
   despeckle, and canvas composition in one tool.
2. **python3 + Pillow** — `getbbox()`, `alpha_composite`, `resize(LANCZOS)`; despeckle via a small
   connected-component BFS on the alpha channel (no scipy).
3. `npm i --no-save sharp` **in a temp dir outside the repo**.
4. None → block the asset slice, ship the palette slice alone, report.

**Despeckle requirement** (stated as an invariant, not a brittle command): remove isolated alpha
islands smaller than ~600 px² — the red/green specks right of the mark and the blue specks above it —
without altering the three main shapes. ImageMagick reference:
`magick src.png -alpha extract -morphology Open Disk:2 mask.png`, then re-apply via
`-compose CopyOpacity -composite`. Acceptance: visual readback plus the artwork alpha bbox unchanged
within 1 %. **Quote the source path** — it contains spaces and commas.

### Decision: Bump the service-worker cache name

`public/sw.js:1-2` caches `/` and `/manifest.json` under `loop-cache-v1` and serves
`cachedResponse || fetchPromise` — stale-first. Without a rename, returning visitors keep the old
manifest and icons for at least one more load, defeating the success criterion.
**Choice**: `CACHE_NAME = "loop-cache-v2"`, so the `activate` handler (`:13-22`) purges v1.
One line, outside the proposal's listed scope but required by it.
**Accepted limitation**: an already-installed PWA's home-screen icon is captured at install time and
will not update until reinstall. OS-level; document, do not chase.

### Decision: Deletions confirmed

Delete `assets/full_logo.svg` (4.97 MB, unreferenced), `assets/reditinere_logo.png`, and the Expo
template leftovers `assets/images/{adaptive-icon,splash-icon,favicon,icon}.png` — all verified
unreferenced by repo-wide grep. Also delete the source
`client/ChatGPT Image Aug 30, 2026, 10_30_20 PM.png` after conversion; it currently sits at the
client root and would otherwise ship and trip tooling.
**Keep** `assets/images/default-profile.png` (used at `services/getUrl.ts:4`) and
`assets/icons/credit.png` (used by `CreditIcon`). **Keep** `assets/fonts/SpaceMono-Regular.ttf`: also
unreferenced, but a font is not a brand asset and `expo-font` is a configured plugin — separate
cleanup, not this change. Only `full_logo.svg` is a material size win; the rest is tidiness, and git
history is the recovery path if the institutional mark in `reditinere_logo.png` is wanted later.

## Data Flow

    config.ts DEFAULT_COLORS ──hexToChannels──> ThemeProvider vars() ──> --color-* (inline, subtree)
         │                                                                       │
         │ (hand-mirrored; guarded by brand-palette.test.ts)                     ├─> bg-primary/10 → Landing blobs
         ├──> global.css :root --color-*  (pre-theme + outside-portal fallback)  └─> ~230 semantic classes
         │
         └──> useThemeColors() ──> JS color props: LeafIcon, shadowColor, PwaInstallPrompt inline styles

    app.json / manifest.json ── static, cannot read vars ──> literal #243B7A (asserted == SECONDARY)

## File Changes

| File | Action | Description |
|---|---|---|
| `client/config.ts` | Modify | 7 palette values → institutional palette |
| `client/global.css` | Modify | 7 mirrored channel triplets |
| `client/components/screens/Landing.tsx` | Modify | Blobs → alpha classes; leaves → `opacity`; border → `STROKE`; shadow → `MAIN_TEXT` |
| `client/components/PwaInstallPrompt.tsx` | Modify | `useThemeColors()`; `"L"` glyph → `icon.png` |
| `client/app.json` | Modify | `web.themeColor` and `adaptiveIcon.backgroundColor` → `#243B7A`; asset paths unchanged |
| `client/public/manifest.json` | Modify | `theme_color` → `#243B7A`; `background_color` stays `#F0F0F0` (= BACKGROUND) |
| `client/public/sw.js` | Modify | `CACHE_NAME` → `loop-cache-v2` |
| `client/__tests__/brand-palette.test.ts` | Create | Sync + contrast + no-brand-hex + static-metadata assertions |
| `client/assets/{full_logo,icon,app_icon}.png` | Modify | Regenerated (binary) |
| `client/public/icons/{icon-192,icon-512,apple-touch-icon}.png` | Modify | Regenerated (binary) |
| `client/assets/full_logo.svg`, `reditinere_logo.png`, `images/{adaptive-icon,splash-icon,favicon,icon}.png` | Delete | Unreferenced |
| `client/ChatGPT Image Aug 30, 2026, 10_30_20 PM.png` | Delete | Source consumed |

No change to `services/color.ts`, `stores/theme.ts`, `tailwind.config.js`, or `ThemeProvider.tsx` —
the mechanism is correct as-is.

## Interfaces / Contracts

No new runtime interface. `ThemeColorKey` and the 10-key `DEFAULT_COLORS` shape are unchanged, so
`resolveThemeColors` per-key fallback (`stores/theme.ts:58-65`) and every themed community keep
working untouched. Contrast helpers live **inside the test file**, not `services/color.ts`: no
runtime consumer needs them and unused exports are dead code.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `config.ts` ↔ `global.css` parity | Parse `:root`; assert all 10 keys and channel values match `hexToChannels` |
| Unit | Contrast floors | Test-local WCAG ratio; assert white-on-SECONDARY ≥ 7, `SECONDARY`-on-white ≥ 7, ALERT-on-white ≥ 4.5, white-on-PRIMARY ≥ 3 |
| Unit | No brand hex | Read `client/**/*.{ts,tsx}` except `config.ts` + the test; assert no case-insensitive match for old (`FF5900,4C9F38,009E7C,8436D1,8F4CD1,FF3B30,FFF1E8,F3D4BF,EEF8E9,C7E0BE,16352B,EEEEEE`) or new (`E4510B,243B7A,209B8A,7D2048,A03A63,C52525`) brand hex |
| Unit | Static metadata | `app.json` `web.themeColor` and `manifest.json` `theme_color` both `=== DEFAULT_COLORS.SECONDARY` |
| Manual | Portal theming | Web build: open the install prompt under a themed community; accent must equal that community's PRIMARY (confirms the `useThemeColors()` decision empirically) |
| Manual | Assets | Visual readback of all 7 generated files; PWA install, splash, favicon, apple-touch icon; browser chrome `#243B7A` |
| E2E | Regression | **No risk found.** `e2e/` is API/DB-driven; grep found zero hex, color, logo, or Landing selectors, and the Landing/admin specs were deliberately removed (`e2e/README.md:105`). Communities are seeded `theme='{}'`, so they fall back to `DEFAULT_COLORS` and simply render the new palette. Run `01`–`06` unchanged as a smoke check |

Run tests as `npx jest --ci --watchAll=false` (never `npm run test`), plus `npm run lint`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary in the shipped product. Asset generation is a one-time developer-run
step outside the build; its only hazard is the space-and-comma source filename, mitigated by quoting.

## Migration / Rollout

No data, schema, or API change. Single-commit revert restores palette and assets. Two ordered
slices if split: (1) palette + guard test + metadata + `sw.js`; (2) assets + deletions. Slice 1 is
independently shippable and self-verifying; slice 2 is binary-only.

**Estimated changed lines**: **~205 authored** (additions + deletions) — `config.ts` ~16,
`global.css` ~14, `Landing.tsx` ~20, `PwaInstallPrompt.tsx` ~55, `app.json` 4, `manifest.json` 2,
`sw.js` 2, new test ~90. Plus **13 binary files** (7 regenerated, 6 deleted), which carry no line
count but shift reviewer effort to visual readback. Under the 800-line budget; a single PR is
appropriate.

## Open Questions

- [ ] Image tooling is unresolved — no shell in this phase. Apply must run the ordered probe and
      report which of ImageMagick / Pillow / temp-dir sharp answered before touching assets.
- [ ] `assets/reditinere_logo.png` deletion: correct per the proposal and recoverable from git, but
      worth one human confirmation if the institutional mark is wanted for the eventual logo swap.
