import fs from "fs";
import path from "path";
import resolveConfig from "tailwindcss/resolveConfig";
// `tailwind.config.js` has no default export (only named `content`/`theme`/`presets`/`plugins`),
// so it must be imported as a namespace, not a default import.
import * as tailwindConfig from "../tailwind.config";
import { BREAKPOINTS, ELEVATION } from "../config";
import { resolveBreakpoint } from "../hooks/useBreakpoint";
import { walkTsFiles } from "./helpers/sourceFiles";

/**
 * Foundation-level responsive tokens: breakpoint parity, the `resolveBreakpoint` table, the
 * `ELEVATION` shape, and two source guards. See design.md D1/D9/D10 and the "Verified Platform
 * Facts" table for why each guard exists.
 */

const CLIENT_ROOT = path.join(__dirname, "..");

describe("responsive tokens", () => {
  describe("Breakpoint Contract", () => {
    it("BREAKPOINTS matches Tailwind's resolved default theme.screens exactly", () => {
      const resolved = resolveConfig(
        tailwindConfig as unknown as Parameters<typeof resolveConfig>[0],
      );
      const screens = resolved.theme.screens as Record<string, string>;
      expect(parseInt(screens.md, 10)).toBe(BREAKPOINTS.md);
      expect(parseInt(screens.lg, 10)).toBe(BREAKPOINTS.lg);
      expect(parseInt(screens.xl, 10)).toBe(BREAKPOINTS.xl);
      expect(BREAKPOINTS).toEqual({ md: 768, lg: 1024, xl: 1280 });
    });

    describe("resolveBreakpoint(width)", () => {
      it.each([
        [375, "base"],
        [767, "base"],
        [768, "md"],
        [1023, "md"],
        [1024, "lg"],
        [1279, "lg"],
        [1280, "xl"],
        [1920, "xl"],
      ])("resolveBreakpoint(%i) === %s", (width, expected) => {
        expect(resolveBreakpoint(width)).toBe(expected);
      });
    });
  });

  describe("Shared Visual Scales — ELEVATION shape", () => {
    const NATIVE_FIELDS = [
      "shadowColor",
      "shadowOffset",
      "shadowOpacity",
      "shadowRadius",
      "elevation",
    ] as const;

    it.each(Object.entries(ELEVATION))("%s has a class and all 5 native fields", (_, token) => {
      expect(typeof token.class).toBe("string");
      expect(token.class.length).toBeGreaterThan(0);
      for (const field of NATIVE_FIELDS) {
        expect(token.native).toHaveProperty(field);
      }
    });

    it("elevation is a positive integer on every token", () => {
      for (const token of Object.values(ELEVATION)) {
        expect(Number.isInteger(token.native.elevation)).toBe(true);
        expect(token.native.elevation).toBeGreaterThan(0);
      }
    });

    it("overlay is strictly above raised on radius, offset height, and elevation", () => {
      expect(ELEVATION.overlay.native.shadowRadius).toBeGreaterThan(
        ELEVATION.raised.native.shadowRadius,
      );
      expect(ELEVATION.overlay.native.shadowOffset.height).toBeGreaterThan(
        ELEVATION.raised.native.shadowOffset.height,
      );
      expect(ELEVATION.overlay.native.elevation).toBeGreaterThan(ELEVATION.raised.native.elevation);
    });
  });

  describe("Source guard: one shadow scale (ELEVATION)", () => {
    // Grandfathered by design.md D1/D9's "Verified Platform Facts": ad hoc shadows kept outside
    // `ELEVATION` on purpose, tracked as a Recorded Follow-up, not fixed by this change.
    // `ToastProvider.tsx` was an additional pre-existing call site discovered while writing this
    // guard (not in the original 3-file design list): its `elevation` is the same Android
    // z-stacking companion to `Toast.tsx`, not a shadow-depth choice.
    // `screens/Listing.tsx` was grandfathered pending its slice-3 rewrite (D4); the rewrite is done
    // and the file no longer uses a raw shadow token, so it is removed from this list.
    const ALLOW_LIST = new Set([
      "components/Toast.tsx",
      "components/ToastProvider.tsx",
      "components/buttons/GoogleSignInButton.tsx",
      "components/screens/Landing.tsx",
    ]);
    const FORBIDDEN_TOKENS = ["shadow-", "shadowOpacity", "elevation"];

    const files = [
      ...walkTsFiles(path.join(CLIENT_ROOT, "app")),
      ...walkTsFiles(path.join(CLIENT_ROOT, "components")),
    ];

    it("scanned at least one file", () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)("%s has no shadow token outside the allow-list", (file) => {
      const rel = path.relative(CLIENT_ROOT, file).split(path.sep).join("/");
      if (ALLOW_LIST.has(rel)) return;
      const content = fs.readFileSync(file, "utf8");
      const found = FORBIDDEN_TOKENS.filter((token) => content.includes(token));
      expect(found).toEqual([]);
    });
  });

  describe("Source guard: native display trap (hard rule)", () => {
    // On native, `display: none` cannot be overridden by any later `display` value
    // (react-native-css-interop/dist/css-to-rn/parseDeclaration.js:1709-1717's `parseDisplay`
    // returns only for "none"; every other value warns and returns `undefined`). So a className
    // string containing both `hidden` and a `md:`/`lg:`/`xl:` display-restoring prefix hides the
    // element forever on native. The one-directional idiom is `lg:hidden` / `max-lg:hidden`.
    const DISPLAY_RESTORE_PREFIXES = [
      "flex",
      "block",
      "grid",
      "inline",
      "inline-block",
      "inline-flex",
      "inline-grid",
    ];
    const BREAKPOINT_PREFIXES = ["md", "lg", "xl"];
    const RESTORE_TOKENS = BREAKPOINT_PREFIXES.flatMap((bp) =>
      DISPLAY_RESTORE_PREFIXES.map((display) => `${bp}:${display}`),
    );

    // Scans every string/template literal in the file (not only `className=` attributes, so it
    // also catches string-concatenation and template-literal class construction) for the literal
    // token `hidden` co-occurring with a display-restoring prefix in the same literal.
    const STRING_LITERAL_RE = /`[^`]*`|"[^"]*"|'[^']*'/g;

    const files = [
      ...walkTsFiles(path.join(CLIENT_ROOT, "app")),
      ...walkTsFiles(path.join(CLIENT_ROOT, "components")),
    ];

    it("scanned at least one file", () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)("%s has no `hidden` + display-restoring prefix in the same string", (file) => {
      const content = fs.readFileSync(file, "utf8");
      const violations: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = STRING_LITERAL_RE.exec(content)) !== null) {
        const literal = match[0];
        if (!/\bhidden\b/.test(literal)) continue;
        for (const token of RESTORE_TOKENS) {
          if (literal.includes(token))
            violations.push(`${token} alongside "hidden" in: ${literal}`);
        }
      }
      expect(violations).toEqual([]);
    });
  });
});
