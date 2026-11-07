import fs from "fs";
import path from "path";

/**
 * `isEmbedRoute` must be true only for a FRAMED `/demo`. The landing's "Probá la demo" button opens
 * `/demo` as a top-level page, which has to behave like the ordinary demo flow (persistent session,
 * immediate banner), while the hero iframe keeps its isolation guarantees.
 */

type FakeWindow = { location: { pathname: string }; self: object; top: object };

const loadFlag = (pathname: string, framed: boolean): boolean => {
  const original = (global as { window?: unknown }).window;
  const top = {};
  const fake: FakeWindow = { location: { pathname }, self: framed ? {} : top, top };
  (global as { window?: unknown }).window = fake;
  try {
    let flag = false;
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
      flag = (require("@/services/embedMode") as { isEmbedRoute: boolean }).isEmbedRoute;
    });
    return flag;
  } finally {
    (global as { window?: unknown }).window = original;
    jest.dontMock("react-native");
  }
};

describe("isEmbedRoute", () => {
  it("is true for /demo inside an iframe", () => {
    expect(loadFlag("/demo", true)).toBe(true);
  });

  it("is false for /demo opened as a top-level page", () => {
    expect(loadFlag("/demo", false)).toBe(false);
  });

  it("is false for any other path, framed or not", () => {
    expect(loadFlag("/", true)).toBe(false);
    expect(loadFlag("/home", true)).toBe(false);
  });
});

describe("Home in the embedded demo", () => {
  const home = fs.readFileSync(path.join(__dirname, "..", "components", "screens", "Home.tsx"), "utf8");

  it("shows only the feed when embedded, so the hero opens on school items", () => {
    expect(home).toMatch(/isEmbedRoute\s*\?\s*allSections\.filter\(\(\{ key \}\) => key === "feed"\)/);
  });
});
