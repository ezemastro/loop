import fs from "fs";
import path from "path";

/**
 * Source guards for the `/` routing split (`marketing-landing` T1). Static source checks, not a
 * full render: `Landing` and `MarketingLanding` pull in `useLoginForm` -> `useLogin` ->
 * react-query/axios, `ToastProvider`, `SafeAreaProvider`, etc., the same reason `legal-routes.test.ts`
 * parses `_layout.tsx` instead of rendering it.
 *
 * `(auth)/index.tsx` branches on `Platform.OS === "web"` instead of a `.web.tsx` platform
 * extension: this project's single `jest-expo` Jest config resolves one platform for all test
 * files, so a `HomeEntry`/`HomeEntry.web` pair would never let a test exercise the web branch.
 */

const APP_DIR = path.join(__dirname, "..", "app", "(auth)");
const INDEX_PATH = path.join(APP_DIR, "index.tsx");
const INGRESAR_PATH = path.join(APP_DIR, "ingresar.tsx");
const LAYOUT_PATH = path.join(APP_DIR, "_layout.tsx");

describe("/ingresar route", () => {
  it("exists", () => {
    expect(fs.existsSync(INGRESAR_PATH)).toBe(true);
  });

  it("renders Landing", () => {
    const source = fs.readFileSync(INGRESAR_PATH, "utf8");
    expect(source).toMatch(/import Landing from ["']@\/components\/screens\/Landing["']/);
    expect(source).toMatch(/<Landing\s*\/>/);
  });

  it("is registered in the auth tab layout as hidden (href: null)", () => {
    const source = fs.readFileSync(LAYOUT_PATH, "utf8");
    const screenMatch = source.match(/<Tabs\.Screen\s+name="ingresar"[\s\S]*?\/>/);
    expect(screenMatch).not.toBeNull();
    expect(screenMatch![0]).toMatch(/href:\s*null/);
    expect(screenMatch![0]).toMatch(/headerShown:\s*false/);
  });
});

describe("/ entry point platform split", () => {
  const source = fs.readFileSync(INDEX_PATH, "utf8");

  it("imports both Landing and MarketingLanding", () => {
    expect(source).toMatch(/import Landing from ["']@\/components\/screens\/Landing["']/);
    expect(source).toMatch(
      /import MarketingLanding from ["']@\/components\/screens\/MarketingLanding["']/,
    );
  });

  it("renders MarketingLanding on web and Landing otherwise", () => {
    expect(source).toMatch(/Platform\.OS === ["']web["']/);
    expect(source).toMatch(/<MarketingLanding\s*\/>/);
    expect(source).toMatch(/<Landing\s*\/>/);
  });
});
