import fs from "fs";
import path from "path";

/**
 * Source guard for `react-hydration-mismatch-icon-fonts` (web hydration error #418, `marketing-
 * landing` T5): `@expo/vector-icons` renders an empty `<Text />` until `Font.isLoaded(fontFamily)`
 * is true, and only calls `Font.loadAsync` from its own `componentDidMount` — which never runs
 * during `expo-router`'s static web export (`ReactDOMServer.renderToString` doesn't run effects).
 * Without an eager, synchronous preload, every icon renders empty in the exported HTML while the
 * client's first commit can already see a font as loaded, which React flags as a hydration
 * mismatch and, once it regenerates that part of the tree, breaks it for the rest of the session.
 *
 * This parses `client/app/_layout.tsx` (not a full render: it pulls in expo-router's `Stack`,
 * react-query, Google sign-in, etc. — the same reason `legal-routes.test.ts` and
 * `marketing-landing-routing.test.ts` parse source instead) and asserts the preload call:
 * - exists and targets both icon sets actually used by `components/Icons.tsx` (Feather, Ionicons),
 * - runs as a plain function call in `RootLayout`'s render body, not inside `useEffect` (an effect
 *   would reintroduce exactly this bug, since effects don't run during static export).
 */

const LAYOUT_PATH = path.join(__dirname, "..", "app", "_layout.tsx");
const source = fs.readFileSync(LAYOUT_PATH, "utf8");

describe("icon font preload (hydration error #418 fix)", () => {
  it("imports the icon sets used by components/Icons.tsx", () => {
    expect(source).toMatch(/import Feather from ["']@expo\/vector-icons\/Feather["']/);
    expect(source).toMatch(/import Ionicons from ["']@expo\/vector-icons\/Ionicons["']/);
  });

  it("defines a preload helper that loads both fonts", () => {
    const helperMatch = source.match(/const preloadIconFonts = \(\) => \{([\s\S]*?)\};/);
    expect(helperMatch).not.toBeNull();
    const body = helperMatch![1];
    expect(body).toMatch(/Feather\.loadFont\(\)/);
    expect(body).toMatch(/Ionicons\.loadFont\(\)/);
  });

  it("calls the preload helper synchronously in RootLayout's render body, not inside useEffect", () => {
    const bodyMatch = source.match(/export default function RootLayout\(\) \{([\s\S]*)/);
    expect(bodyMatch).not.toBeNull();
    const body = bodyMatch![1];

    const callIndex = body.indexOf("preloadIconFonts();");
    expect(callIndex).toBeGreaterThan(-1);

    // Walk every useEffect(...) block in the component and make sure none of them contains the
    // preload call — a brace-depth scan, since a naive "is the call after some useEffect(" check
    // can't tell "inside" from "after".
    let searchFrom = 0;
    while (true) {
      const effectIdx = body.indexOf("useEffect(", searchFrom);
      if (effectIdx === -1) break;
      let depth = 0;
      let cursor = effectIdx;
      let endIdx = -1;
      for (; cursor < body.length; cursor += 1) {
        if (body[cursor] === "(") depth += 1;
        if (body[cursor] === ")") {
          depth -= 1;
          if (depth === 0) {
            endIdx = cursor;
            break;
          }
        }
      }
      expect(endIdx).toBeGreaterThan(-1);
      expect(callIndex).not.toBeGreaterThanOrEqual(effectIdx);
      searchFrom = endIdx + 1;
    }
  });
});
