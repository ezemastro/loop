#!/usr/bin/env node
// Captures changelog screenshots from a running build of the web app.
//
//   node scripts/changelog/capture.mjs --base http://localhost:8801 --version 1.5.0 \
//     --label antes --scenes home,chat --viewports escritorio,celular [--out dir]
//     [--community-color "#0288D1" --suffix comunidad]
//
// --community-color previews another community's colour on the same demo data, the way
// `ThemeProvider` would derive it. A caption must say it is an example, not a real community.
//
// Output: <out>/<scene>-<viewport>-<label>.webp  (default out: client/public/changelog/<version>)
// Env: PLAYWRIGHT_FROM (dir whose node_modules has playwright, default <repo>/e2e/),
//      CHROMIUM_PATH (default /usr/bin/chromium).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SCENES } from "./scenes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const MAX_BYTES = 300 * 1024;

const VIEWPORTS = {
  escritorio: {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1.5,
    isMobile: false,
    hasTouch: false,
  },
  celular: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    args[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function loadPlaywright() {
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

/** Removes the demo banner so captures do not show demo chrome. */
async function hideDemoBanner(page) {
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

async function applyCommunityColor(page, color) {
  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
  const { darkenToContrast, AA_NORMAL_TEXT } = await import(
    path.join(repoRoot, "client", "services", "color.ts")
  );
  const values = {
    "--color-secondary": channels(color),
    "--color-accent": channels(darkenToContrast(color, "#FFFFFF", AA_NORMAL_TEXT)),
  };
  await page.evaluate((vars) => {
    const hosts = [...document.querySelectorAll("*")].filter((el) =>
      el.style?.getPropertyValue("--color-secondary"),
    );
    for (const el of [document.documentElement, ...hosts])
      for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
  }, values);
}

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: 8000,
    })
    .catch(() => {});
  await page.waitForTimeout(500);
}

/** PNG -> WebP through a canvas, so no image dependency is needed. */
async function toWebp(converter, png) {
  const dataUrl = await converter.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", 0.8);
  }, png.toString("base64"));
  if (!dataUrl.startsWith("data:image/webp")) throw new Error("Browser could not encode WebP");
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function captureOne(browser, converter, scene, viewportName, opts) {
  const vp = VIEWPORTS[viewportName];
  const height = scene.height ?? vp.height;
  const context = await browser.newContext({
    viewport: { width: vp.width, height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const ctx = { base: opts.base };
    if (scene.demo) {
      await page.goto(`${opts.base}/demo`, { waitUntil: "load" });
      await page.waitForFunction(() => location.pathname.includes("home"), null, {
        timeout: 30000,
      });
    }
    await scene.run(page, ctx);
    await settle(page);
    if (scene.demo) await hideDemoBanner(page);
    if (opts.communityColor) await applyCommunityColor(page, opts.communityColor);
    const png = await page.screenshot({ type: "png" });
    const webp = await toWebp(converter, png);
    const file = path.join(opts.out, `${scene.name}-${viewportName}-${opts.label}${opts.suffix}.webp`);
    fs.writeFileSync(file, webp);
    const kb = webp.length / 1024;
    const warn = webp.length > MAX_BYTES ? "  WARNING: over 300 KB" : "";
    console.log(
      `${path.relative(repoRoot, file)}  ${kb.toFixed(0)} KB  ${vp.width}x${height}${warn}`,
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { base, version, label } = args;
  if (!base || !version || !["antes", "despues"].includes(label)) {
    console.error(
      "Usage: capture.mjs --base <url> --version <v> --label antes|despues [--scenes a,b] [--viewports escritorio,celular] [--out dir]",
    );
    process.exit(2);
  }
  const sceneNames = args.scenes ? args.scenes.split(",") : SCENES.map((s) => s.name);
  const viewportNames = args.viewports ? args.viewports.split(",") : Object.keys(VIEWPORTS);
  const unknownScene = sceneNames.find((n) => !SCENES.some((s) => s.name === n));
  if (unknownScene)
    throw new Error(
      `Unknown scene "${unknownScene}". Known: ${SCENES.map((s) => s.name).join(", ")}`,
    );
  const unknownViewport = viewportNames.find((n) => !VIEWPORTS[n]);
  if (unknownViewport)
    throw new Error(
      `Unknown viewport "${unknownViewport}". Known: ${Object.keys(VIEWPORTS).join(", ")}`,
    );

  const out = path.resolve(
    args.out || path.join(repoRoot, "client", "public", "changelog", version),
  );
  fs.mkdirSync(out, { recursive: true });
  const opts = {
    base: base.replace(/\/$/, ""),
    label,
    out,
    communityColor: args["community-color"],
    suffix: args.suffix ? `-${args.suffix}` : "",
  };

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const failures = [];
  try {
    const converterContext = await browser.newContext();
    const converter = await converterContext.newPage();
    for (const name of sceneNames) {
      const scene = SCENES.find((s) => s.name === name);
      for (const viewportName of viewportNames) {
        try {
          await captureOne(browser, converter, scene, viewportName, opts);
        } catch (error) {
          failures.push(`${name} (${viewportName})`);
          console.error(`FAILED ${name} (${viewportName}): ${error.message.split("\n")[0]}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} scene(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
