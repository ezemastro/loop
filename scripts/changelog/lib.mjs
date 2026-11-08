// Helpers shared by the changelog and landing capture scripts.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");

/** Finds Playwright from PLAYWRIGHT_FROM (default `<repo>/e2e/`). */
export function loadPlaywright() {
  const from = process.env.PLAYWRIGHT_FROM || path.join(repoRoot, "e2e") + path.sep;
  const req = createRequire(from.endsWith(path.sep) ? from : from + path.sep);
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      return req(name);
    } catch {
      // try the next package name
    }
  }
  throw new Error(
    `Playwright not found from ${from}. Set PLAYWRIGHT_FROM to a dir with node_modules/playwright.`,
  );
}

/** Removes the demo banner so captures do not show demo chrome. Works on a Page or a Frame. */
export async function hideDemoBanner(page) {
  await page.evaluate(() => {
    const matches = [...document.querySelectorAll("*")].filter((el) =>
      (el.textContent || "").trim().startsWith("Modo demo"),
    );
    // Deepest match = the text node's element; its parent is the banner row.
    const deepest = matches.filter(
      (el) => !matches.some((other) => other !== el && el.contains(other)),
    );
    for (const el of deepest) (el.parentElement || el).style.display = "none";
  });
}

/** Waits for fonts, images and a short settle time. Works on a Page or a Frame. */
export async function settle(page, ms = 500) {
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: 8000,
    })
    .catch(() => {});
  await page.waitForTimeout(ms);
}
