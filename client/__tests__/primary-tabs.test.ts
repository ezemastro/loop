import fs from "fs";
import path from "path";
import { PRIMARY_TABS } from "../components/header/primaryTabs";

/**
 * `PRIMARY_TABS` is the single source of truth consumed by both the bottom tab bar
 * (`app/(main)/(tabs)/_layout.tsx`) and the desktop header nav (`DesktopNavLinks.tsx`). See
 * design.md/requirement 2 of `feat/ui-10-desktop-nav`: the two navigations must never drift apart.
 */

const CLIENT_ROOT = path.join(__dirname, "..");

describe("PRIMARY_TABS", () => {
  it("has exactly the five primary tabs, in tab-bar order", () => {
    expect(PRIMARY_TABS.map((tab) => tab.key)).toEqual([
      "home",
      "myListings",
      "publish",
      "wishlist",
      "profile",
    ]);
  });

  it("every tab has a non-empty label, href, matchPath, and Icon", () => {
    for (const tab of PRIMARY_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(String(tab.href).length).toBeGreaterThan(0);
      expect(tab.matchPath.length).toBeGreaterThan(0);
      expect(tab.Icon).toBeDefined();
    }
  });

  it("matchPath is the route-group-stripped form of href (what usePathname() resolves to)", () => {
    for (const tab of PRIMARY_TABS) {
      expect(String(tab.href)).toBe(`/(main)/(tabs)${tab.matchPath}`);
    }
  });

  it("has no duplicate keys or matchPaths", () => {
    const keys = PRIMARY_TABS.map((tab) => tab.key);
    const matchPaths = PRIMARY_TABS.map((tab) => tab.matchPath);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(matchPaths).size).toBe(matchPaths.length);
  });
});

describe("Source guard: header nav and tab bar share PRIMARY_TABS", () => {
  it("app/(main)/(tabs)/_layout.tsx imports PRIMARY_TABS from components/header/primaryTabs", () => {
    const content = fs.readFileSync(
      path.join(CLIENT_ROOT, "app/(main)/(tabs)/_layout.tsx"),
      "utf8",
    );
    expect(content).toContain("@/components/header/primaryTabs");
    expect(content).toContain("PRIMARY_TABS");
  });

  it("DesktopNavLinks.tsx imports PRIMARY_TABS from the same module", () => {
    const content = fs.readFileSync(
      path.join(CLIENT_ROOT, "components/header/DesktopNavLinks.tsx"),
      "utf8",
    );
    expect(content).toContain("./primaryTabs");
    expect(content).toContain("PRIMARY_TABS");
  });
});
