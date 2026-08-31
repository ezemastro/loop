import fs from "fs";
import path from "path";
import { DEFAULT_COLORS, ThemeColorKey } from "../config";
import { hexToChannels } from "../services/color";
import { walkTsFiles } from "./helpers/sourceFiles";

/**
 * Sync guard for the Itínere brand palette. `config.ts` (`DEFAULT_COLORS`, hex) and
 * `global.css` (`:root` CSS vars, RGB channel triplets) are hand-mirrored — this test is the
 * only thing keeping them aligned. It also enforces the contrast floors that gate where each
 * color may be used, verifies no consumer holds a hardcoded copy of the palette, and checks
 * that the static PWA/Expo build metadata agrees with `DEFAULT_COLORS.SECONDARY`.
 */

const CLIENT_ROOT = path.join(__dirname, "..");
const GLOBAL_CSS_PATH = path.join(CLIENT_ROOT, "global.css");
const APP_JSON_PATH = path.join(CLIENT_ROOT, "app.json");
const MANIFEST_JSON_PATH = path.join(CLIENT_ROOT, "public", "manifest.json");
const THIS_FILE = path.join(__dirname, "brand-palette.test.ts");

const CSS_VAR_TO_KEY: Record<string, ThemeColorKey> = {
  "--color-primary": "PRIMARY",
  "--color-secondary": "SECONDARY",
  "--color-tertiary": "TERTIARY",
  "--color-main-text": "MAIN_TEXT",
  "--color-secondary-text": "SECONDARY_TEXT",
  "--color-credits": "CREDITS",
  "--color-credits-light": "CREDITS_LIGHT",
  "--color-stroke": "STROKE",
  "--color-background": "BACKGROUND",
  "--color-alert": "ALERT",
};

// Hex values that MUST NOT appear literally anywhere in `client/**/*.{ts,tsx}` (outside
// `config.ts` and this file): the retired palette, and the new palette (which must only ever
// be referenced through `DEFAULT_COLORS` / `useThemeColors()`, never re-hardcoded).
const OLD_BRAND_HEX = [
  "FF5900",
  "4C9F38",
  "009E7C",
  "8436D1",
  "8F4CD1",
  "FF3B30",
  "FFF1E8",
  "F3D4BF",
  "EEF8E9",
  "C7E0BE",
  "16352B",
  "EEEEEE",
];
const NEW_BRAND_HEX = ["E4510B", "243B7A", "209B8A", "7D2048", "A03A63", "C52525"];
const FORBIDDEN_HEX = [...OLD_BRAND_HEX, ...NEW_BRAND_HEX].map((hex) => hex.toLowerCase());

function parseRootBlock(css: string): Record<string, string> {
  const rootMatch = css.match(/:root\s*{([^}]*)}/);
  if (!rootMatch) throw new Error("global.css has no :root block");
  const entries: Record<string, string> = {};
  const declRe = /(--[a-z-]+)\s*:\s*([^;]+);/g;
  let decl: RegExpExecArray | null;
  while ((decl = declRe.exec(rootMatch[1])) !== null) {
    entries[decl[1].trim()] = decl[2].trim();
  }
  return entries;
}

/** WCAG 2.x relative luminance / contrast ratio, computed only in this test — no runtime consumer needs it. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex)
    .split(" ")
    .map((n) => Number(n));
  const srgb = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("brand palette", () => {
  describe("Config/CSS Parity Invariant", () => {
    const cssVars = parseRootBlock(fs.readFileSync(GLOBAL_CSS_PATH, "utf8"));

    it("global.css declares exactly the 10 expected --color-* keys", () => {
      expect(Object.keys(cssVars).sort()).toEqual(Object.keys(CSS_VAR_TO_KEY).sort());
    });

    it.each(Object.entries(CSS_VAR_TO_KEY))(
      "%s matches hexToChannels(DEFAULT_COLORS.%s)",
      (cssVar, key) => {
        expect(cssVars[cssVar]).toBe(hexToChannels(DEFAULT_COLORS[key]));
      },
    );
  });

  describe("Default Institutional Palette", () => {
    it("matches the spec table exactly", () => {
      expect(DEFAULT_COLORS.PRIMARY).toBe("#E4510B");
      expect(DEFAULT_COLORS.SECONDARY).toBe("#243B7A");
      expect(DEFAULT_COLORS.TERTIARY).toBe("#209B8A");
      expect(DEFAULT_COLORS.CREDITS).toBe("#7D2048");
      expect(DEFAULT_COLORS.CREDITS_LIGHT).toBe("#A03A63");
      expect(DEFAULT_COLORS.ALERT).toBe("#C52525");
      expect(DEFAULT_COLORS.MAIN_TEXT).toBe("#3D3D3D");
    });

    it("leaves SECONDARY_TEXT, STROKE, BACKGROUND unchanged", () => {
      expect(DEFAULT_COLORS.SECONDARY_TEXT).toBe("#9E9E9E");
      expect(DEFAULT_COLORS.STROKE).toBe("#E4E4E4");
      expect(DEFAULT_COLORS.BACKGROUND).toBe("#F0F0F0");
    });
  });

  describe("Contrast-Constrained Color Usage", () => {
    it("white on SECONDARY meets AAA (>= 7:1)", () => {
      expect(contrastRatio("#FFFFFF", DEFAULT_COLORS.SECONDARY)).toBeGreaterThanOrEqual(7);
    });

    it("SECONDARY on white meets AAA (>= 7:1)", () => {
      expect(contrastRatio(DEFAULT_COLORS.SECONDARY, "#FFFFFF")).toBeGreaterThanOrEqual(7);
    });

    it("white on ALERT meets AA normal text (>= 4.5:1)", () => {
      expect(contrastRatio("#FFFFFF", DEFAULT_COLORS.ALERT)).toBeGreaterThanOrEqual(4.5);
    });

    it("white on PRIMARY meets the large-text/UI-component floor (>= 3:1)", () => {
      expect(contrastRatio("#FFFFFF", DEFAULT_COLORS.PRIMARY)).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Landing Screen Zero Hardcoded Brand Hex / PwaInstallPrompt Theme Consumption", () => {
    const files = walkTsFiles(CLIENT_ROOT).filter((file) => {
      const rel = path.relative(CLIENT_ROOT, file);
      return rel !== "config.ts" && file !== THIS_FILE;
    });

    it("scanned at least one file", () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)("%s has no literal brand hex", (file) => {
      const content = fs.readFileSync(file, "utf8").toLowerCase();
      const found = FORBIDDEN_HEX.filter((hex) => content.includes(hex));
      expect(found).toEqual([]);
    });
  });

  describe("Static Build Metadata Alignment", () => {
    it("app.json web.themeColor equals DEFAULT_COLORS.SECONDARY", () => {
      const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, "utf8"));
      expect(appJson.expo.web.themeColor).toBe(DEFAULT_COLORS.SECONDARY);
    });

    it("manifest.json theme_color equals DEFAULT_COLORS.SECONDARY", () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON_PATH, "utf8"));
      expect(manifest.theme_color).toBe(DEFAULT_COLORS.SECONDARY);
    });
  });
});
