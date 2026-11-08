import fs from "fs";
import path from "path";

/**
 * `isEmbedRoute` must be true only for a FRAMED `/demo`. The landing's "Probá la demo" button opens
 * `/demo` as a top-level page, which has to behave like the ordinary demo flow (persistent session,
 * immediate banner), while the hero iframe keeps its isolation guarantees.
 */

type FakeWindow = { location: { pathname: string }; self: object; top: object };

const loadFlags = (pathname: string, framed: boolean) => {
  const original = (global as { window?: unknown }).window;
  const top = {};
  const fake: FakeWindow = { location: { pathname }, self: framed ? {} : top, top };
  (global as { window?: unknown }).window = fake;
  try {
    let flags = { isDemoBootPath: false, isFramedDemo: false };
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      flags = require("@/services/embedMode");
    });
    return { boot: flags.isDemoBootPath, framed: flags.isFramedDemo };
  } finally {
    (global as { window?: unknown }).window = original;
    jest.dontMock("react-native");
  }
};

describe("isDemoBootPath (storage isolation)", () => {
  it("is true for /demo whether framed or at top level", () => {
    expect(loadFlags("/demo", true).boot).toBe(true);
    expect(loadFlags("/demo", false).boot).toBe(true);
  });

  it("is false for any other path", () => {
    expect(loadFlags("/", true).boot).toBe(false);
    expect(loadFlags("/home", false).boot).toBe(false);
  });
});

describe("isFramedDemo (UI only)", () => {
  it("is true only for /demo inside an iframe", () => {
    expect(loadFlags("/demo", true).framed).toBe(true);
    expect(loadFlags("/demo", false).framed).toBe(false);
  });

  it("is false on other paths even when framed", () => {
    expect(loadFlags("/", true).framed).toBe(false);
  });
});

describe("storage follows the boot path, not the framing", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "services", "webStorage.ts"), "utf8");

  it("swaps to memory storage on isDemoBootPath and never reads isFramedDemo", () => {
    expect(source).toMatch(/isDemoBootPath \? memoryStorage : AsyncStorage/);
    expect(source).not.toMatch(/isFramedDemo/);
  });
});

describe("Home in the framed demo", () => {
  const home = fs.readFileSync(
    path.join(__dirname, "..", "components", "screens", "Home.tsx"),
    "utf8",
  );

  it("shows only the feed when embedded, so the hero opens on school items", () => {
    expect(home).toMatch(
      /isFramedDemo\s*\?\s*allSections\.filter\(\(\{ key \}\) => key === "feed"\)/,
    );
  });
});
