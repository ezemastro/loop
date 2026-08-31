import fs from "fs";
import path from "path";
import { pageContentClassName, WIDTH_CAPS } from "../components/bases/MainView";
import { walkTsFiles } from "./helpers/sourceFiles";

/**
 * `pageContentClassName(width, className)` is a pure function (see MainView.tsx for why it is not
 * a context-reading hook): each screen calls it in the same component that renders its own
 * `<MainView>`, i.e. a sibling, not a descendant, so a `useContext`-based hook could never read
 * the value that screen just passed.
 */

const CLIENT_ROOT = path.join(__dirname, "..");

describe("pageContentClassName", () => {
  describe("width caps", () => {
    it("wide contains max-w-6xl and xl:max-w-[1400px]", () => {
      const className = pageContentClassName("wide");
      expect(className).toContain("max-w-6xl");
      expect(className).toContain("xl:max-w-[1400px]");
    });

    it("narrow contains max-w-3xl", () => {
      const className = pageContentClassName("narrow");
      expect(className).toContain("max-w-3xl");
    });

    it("full emits no max-w- token", () => {
      const className = pageContentClassName("full");
      expect(className).not.toMatch(/\bmax-w-/);
    });
  });

  describe("shared base classes", () => {
    it.each(Object.keys(WIDTH_CAPS) as (keyof typeof WIDTH_CAPS)[])(
      "%s includes w-full and self-center",
      (width) => {
        const className = pageContentClassName(width);
        expect(className).toContain("w-full");
        expect(className).toContain("self-center");
      },
    );

    // `self-center` (`align-self`) is used instead of `mx-auto` (`margin`) because tailwind-merge
    // treats every `mx-*` class as one conflict group: a caller combining this with a grid's
    // negative-margin gutter class (e.g. `ListingGrid`'s `-mx-1.5`) would silently lose one of the
    // two. See MainView.tsx.
    it.each(Object.keys(WIDTH_CAPS) as (keyof typeof WIDTH_CAPS)[])(
      "%s never emits mx-auto",
      (width) => {
        const className = pageContentClassName(width, "-mx-1.5");
        expect(className).not.toMatch(/\bmx-auto\b/);
      },
    );
  });

  describe("caller className merging", () => {
    it("merges a caller-supplied className into the output", () => {
      const className = pageContentClassName("narrow", "p-4 gap-2");
      expect(className).toContain("p-4");
      expect(className).toContain("gap-2");
      expect(className).toContain("max-w-3xl");
    });
  });
});

describe("Source guard: no hand-rolled page-level width cap", () => {
  // `MainView.tsx` owns `WIDTH_CAPS`; every other page-level cap must go through
  // `pageContentClassName`, or the width system drifts. Pre-existing, legitimate exceptions:
  //   - `screens/Landing.tsx`: marketing page, not a `MainView` screen.
  //   - `bases/CustomModal.tsx`: modal dialog width, unrelated to page content width.
  const ALLOW_LIST = new Set([
    "components/screens/Landing.tsx",
    "components/bases/CustomModal.tsx",
  ]);
  const FORBIDDEN_TOKENS = ["max-w-6xl", "max-w-3xl"];

  const files = [
    ...walkTsFiles(path.join(CLIENT_ROOT, "app")),
    ...walkTsFiles(path.join(CLIENT_ROOT, "components")),
  ].filter(
    (file) =>
      path.relative(CLIENT_ROOT, file).split(path.sep).join("/") !==
      "components/bases/MainView.tsx",
  );

  it("scanned at least one file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)(
    "%s has no page-level max-w-6xl/max-w-3xl literal outside the allow-list",
    (file) => {
      const rel = path.relative(CLIENT_ROOT, file).split(path.sep).join("/");
      if (ALLOW_LIST.has(rel)) return;
      const content = fs.readFileSync(file, "utf8");
      const found = FORBIDDEN_TOKENS.filter((token) => content.includes(token));
      expect(found).toEqual([]);
    },
  );
});
