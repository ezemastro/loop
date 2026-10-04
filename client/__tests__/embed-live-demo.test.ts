import fs from "fs";
import path from "path";

/**
 * Source guards for the embeddable live-demo route (`marketing-landing` T7): `/demo`, meant to
 * run inside the landing hero's `<iframe>` and boot straight into demo mode for a logged-out
 * visitor. Parses source instead of rendering — `app/demo.tsx` pulls in `expo-router`'s
 * `useRouter`, react-query (`useLogin`), and the session store, the same resolution-gap reasons
 * `legal-routes.test.ts` and `marketing-landing-routing.test.ts` parse source too.
 */

const LAYOUT_PATH = path.join(__dirname, "..", "app", "_layout.tsx");
const DEMO_ROUTE_PATH = path.join(__dirname, "..", "app", "demo.tsx");

describe("/demo is registered outside every Stack.Protected guard", () => {
  const layoutSource = fs.readFileSync(LAYOUT_PATH, "utf-8");

  it('declares <Stack.Screen name="demo">', () => {
    expect(layoutSource).toMatch(/<Stack\.Screen\s+name="demo"/);
  });

  it("is not nested inside any Stack.Protected block", () => {
    // Same balanced-block walk as legal-routes.test.ts, inlined: a failing guard would remove
    // this screen from the navigator entirely (expo-router/build/useScreens.js), which is exactly
    // what a public, no-login-required demo entry point can't tolerate.
    const OPEN = "<Stack.Protected";
    const CLOSE = "</Stack.Protected>";
    const blocks: string[] = [];
    let searchFrom = 0;
    while (true) {
      const openIdx = layoutSource.indexOf(OPEN, searchFrom);
      if (openIdx === -1) break;
      let depth = 0;
      let cursor = openIdx;
      let closeIdx = -1;
      while (cursor < layoutSource.length) {
        const nextOpen = layoutSource.indexOf(OPEN, cursor);
        const nextClose = layoutSource.indexOf(CLOSE, cursor);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          cursor = nextOpen + OPEN.length;
        } else {
          depth -= 1;
          cursor = nextClose + CLOSE.length;
          if (depth === 0) {
            closeIdx = nextClose + CLOSE.length;
            break;
          }
        }
      }
      if (closeIdx === -1) throw new Error("Unbalanced <Stack.Protected> block in _layout.tsx");
      blocks.push(layoutSource.slice(openIdx, closeIdx));
      searchFrom = closeIdx;
    }

    expect(blocks.length).toBeGreaterThan(0); // sanity check on the parser
    expect(blocks.some((block) => block.includes('name="demo"'))).toBe(false);
  });
});

describe("app/demo.tsx boots demo mode without requiring a click", () => {
  const source = fs.readFileSync(DEMO_ROUTE_PATH, "utf-8");

  it("enters demo mode before logging in, same order as the manual link", () => {
    const enterIdx = source.indexOf("enterDemoMode()");
    const loginIdx = source.indexOf("login(");
    expect(enterIdx).toBeGreaterThan(-1);
    expect(loginIdx).toBeGreaterThan(-1);
    expect(enterIdx).toBeLessThan(loginIdx);
  });

  it("logs in as the demo showcase account", () => {
    expect(source).toMatch(/import \{ DEMO_SHOWCASE_EMAIL \} from ["']@\/demo["']/);
    expect(source).toMatch(/email:\s*DEMO_SHOWCASE_EMAIL/);
  });

  it("redirects to the home feed on successful login", () => {
    expect(source).toMatch(/onSuccess:\s*\(\)\s*=>\s*router\.replace\(["']\/\(main\)\/\(tabs\)\/home["']\)/);
  });
});
