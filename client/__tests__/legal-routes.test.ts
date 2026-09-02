import fs from "fs";
import path from "path";

/**
 * Source guard for `public-legal-pages`: "No legal route sits behind a guard".
 *
 * A failing `Stack.Protected` guard removes its screen from the navigator entirely
 * (`expo-router/build/useScreens.js`), which would bounce an anonymous store reviewer to the
 * login screen after hydration. This parses `client/app/_layout.tsx` and asserts that none of
 * `privacidad`, `terminos`, `borrar-cuenta` is declared inside ANY `<Stack.Protected>` block —
 * not even one whose guard happens to be `true` today, since that can change.
 */

const LAYOUT_PATH = path.join(__dirname, "..", "app", "_layout.tsx");
const LEGAL_ROUTE_NAMES = ["privacidad", "terminos", "borrar-cuenta"];

/** Extracts the text of every balanced `<Stack.Protected ...> ... </Stack.Protected>` block. */
function extractProtectedBlocks(source: string): string[] {
  const OPEN = "<Stack.Protected";
  const CLOSE = "</Stack.Protected>";
  const blocks: string[] = [];
  let searchFrom = 0;

  while (true) {
    const openIdx = source.indexOf(OPEN, searchFrom);
    if (openIdx === -1) break;

    // `Stack.Protected` never self-closes and never nests another `Stack.Protected` with the
    // same literal tag name inside this file's actual structure except deliberately (the
    // isLoggedIn/hasAcceptedTerms pair) — so a depth counter over the substring correctly finds
    // the matching close even for that nested case.
    let depth = 0;
    let cursor = openIdx;
    let closeIdx = -1;
    while (cursor < source.length) {
      const nextOpen = source.indexOf(OPEN, cursor);
      const nextClose = source.indexOf(CLOSE, cursor);
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

    blocks.push(source.slice(openIdx, closeIdx));
    searchFrom = closeIdx;
  }

  return blocks;
}

describe("legal routes are never behind a guard", () => {
  const source = fs.readFileSync(LAYOUT_PATH, "utf-8");
  const protectedBlocks = extractProtectedBlocks(source);

  it("_layout.tsx declares at least one Stack.Protected block (sanity check on the parser)", () => {
    expect(protectedBlocks.length).toBeGreaterThan(0);
  });

  it.each(LEGAL_ROUTE_NAMES)('declares <Stack.Screen name="%s"> at all', (routeName) => {
    expect(source).toMatch(new RegExp(`<Stack\\.Screen\\s+name="${routeName}"`));
  });

  it.each(LEGAL_ROUTE_NAMES)("%s is not nested inside any Stack.Protected block", (routeName) => {
    const needle = `name="${routeName}"`;
    const foundInsideGuard = protectedBlocks.some((block) => block.includes(needle));
    expect(foundInsideGuard).toBe(false);
  });
});
