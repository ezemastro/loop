#!/usr/bin/env node
// Rebuilds every static capture of the marketing landing from a fresh web export:
//
//   node scripts/landing/capture.mjs [--skip-export] [--only phone-home,share-image] [--port 8794]
//
// Output (filenames, format and size are part of the contract with the landing code):
//   client/assets/landing/phone-home.webp      780x1688  framed /demo first paint, scroll top
//   client/assets/landing/desktop-home.webp    1440x900  same view at desktop size
//   client/assets/landing/phone-publish.webp   780x1688  /publish with category and title filled
//   client/assets/landing/phone-chat.webp      780x1688  seeded Ana <-> Sofia conversation
//   client/assets/landing/phone-received.webp  780x1688  received listing, scrolled to the impact
//   client/public/share-image.png              1200x630  the landing hero at 1200 wide
//
// Steps: (1) `expo export -p web`, (2) serve client/dist, (3) capture the app scenes, (4) export
// again so the landing bundles the new captures, (5) capture the share image from the landing.
// `--skip-export` reuses client/dist as it is (steps 1 and 4 are skipped, so the share image shows
// whatever captures that build already holds). Needs Playwright and Chromium, same as
// scripts/changelog (PLAYWRIGHT_FROM, CHROMIUM_PATH). Node >= 22.13 (type stripping for demo ids).
//
// The app scenes load `/demo` inside an iframe, exactly as the landing hero does, so the framed
// behaviour (feed-only Home, delayed banner) matches the live phone the captures stand in for.
// In demo mode a reload exits the demo and tab clicks do not swap screens in the static export, so
// scenes move with `go()` (history API), like scripts/changelog/scenes.mjs.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { go } from "../changelog/scenes.mjs";
import { hideDemoBanner, loadPlaywright, repoRoot, settle } from "../changelog/lib.mjs";

const clientDir = path.join(repoRoot, "client");
const landingDir = path.join(clientDir, "assets", "landing");
const shareImage = path.join(clientDir, "public", "share-image.png");
const MAX_WEBP_BYTES = 250 * 1024;
const MAX_SHARE_BYTES = 300 * 1024;

const PHONE = { width: 390, height: 844, scale: 2 };
const DESKTOP = { width: 1440, height: 900, scale: 1 };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[argv[i].slice(2)] = true;
    else {
      args[argv[i].slice(2)] = next;
      i += 1;
    }
  }
  return args;
}

function runExport() {
  console.log("expo export -p web ...");
  const result = spawnSync("npx", ["expo", "export", "-p", "web"], {
    cwd: clientDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.status !== 0) throw new Error("expo export failed");
}

function waitForPort(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Nothing listening on port ${port}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

/** Derives demo entity ids the way the dataset does (`demoId` in shared/demo-data/ids.ts). */
async function demoId(kind, key) {
  const source = fs.readFileSync(path.join(repoRoot, "shared", "demo-data", "ids.ts"), "utf8");
  const js = stripTypeScriptTypes(source);
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  return mod.demoId("demo", kind, key);
}

/** Width and height of a WebP file (lossy, lossless and extended headers). */
function webpSize(buf) {
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X") return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  if (kind === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}

/** Opens a page holding only the `/demo` iframe, at the given size. Resolves with the live frame. */
async function openFramedDemo(browser, base, { width, height, scale }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.setContent(
    `<body style="margin:0"><iframe src="${base}/demo" style="border:0;width:${width}px;height:${height}px;display:block"></iframe></body>`,
  );
  let frame = null;
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    frame = page.frames().find((f) => new URL(f.url(), "http://x").pathname.includes("home"));
    if (frame) break;
    await page.waitForTimeout(250);
  }
  if (!frame) throw new Error("Framed demo never reached /home");
  await settle(frame, 1500);
  return { context, page, frame };
}

/** Captures the page as WebP (quality 80) through CDP; `scale` is the output pixel ratio. */
async function snapshotWebp(page, { width, height, scale }) {
  const session = await page.context().newCDPSession(page);
  const shot = await session.send("Page.captureScreenshot", {
    format: "webp",
    quality: 80,
    clip: { x: 0, y: 0, width, height, scale },
    captureBeyondViewport: false,
  });
  return Buffer.from(shot.data, "base64");
}

function writeWebp(name, buf, size) {
  const [w, h] = webpSize(buf);
  const expected = [size.width * size.scale, size.height * size.scale];
  if (w !== expected[0] || h !== expected[1])
    throw new Error(`${name}: got ${w}x${h}, expected ${expected.join("x")}`);
  if (buf.length > MAX_WEBP_BYTES) throw new Error(`${name}: ${buf.length} bytes is over 250 KB`);
  const file = path.join(landingDir, name);
  fs.writeFileSync(file, buf);
  console.log(`${path.relative(repoRoot, file)}  ${w}x${h}  ${(buf.length / 1024).toFixed(1)} KB`);
}

const text = (frame, value, opts = {}) => frame.getByText(value, opts).first();

/** Clicks a control and waits for `expectText` to show, retrying (a first click can be dropped). */
async function clickUntil(frame, trigger, expectText, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click({ timeout: 15000 });
    try {
      await text(frame, expectText).waitFor({ state: "visible", timeout: 4000 });
      return;
    } catch {
      // try the click again
    }
  }
  throw new Error(`"${expectText}" never appeared`);
}

const APP_SCENES = [
  { file: "phone-home.webp", size: PHONE, run: async () => {} },
  { file: "desktop-home.webp", size: DESKTOP, run: async () => {} },
  {
    file: "phone-publish.webp",
    size: PHONE,
    run: async (frame) => {
      await go(frame, "/publish");
      const trigger = text(frame, "Elegí una categoría");
      await trigger.waitFor({ state: "visible", timeout: 15000 });
      await clickUntil(frame, trigger, "Cartucheras y mochilas");
      await text(frame, "Cartucheras y mochilas").click();
      await text(frame, "Mochilas", { exact: true }).click({ timeout: 15000 });
      await text(frame, "Cartucheras y mochilas / Mochilas").waitFor({ timeout: 15000 });
      await frame
        .locator('input[placeholder^="Escrib"]')
        .first()
        .fill("Mochila escolar en buen estado");
      await frame.evaluate(() => document.activeElement && document.activeElement.blur());
    },
  },
  {
    file: "phone-chat.webp",
    size: PHONE,
    run: async (frame) => {
      // Tab-level clicks do not swap screens in the static export, so open the thread by URL.
      await go(frame, `/messages/${await demoId("user", "sofia")}`);
      await text(frame, "¿El buzo gris todavía").waitFor({ timeout: 15000 });
    },
  },
  {
    file: "phone-received.webp",
    size: PHONE,
    run: async (frame) => {
      await go(frame, `/listing/${await demoId("listing", "lapices-colores")}`);
      await text(frame, "Has recibido este artículo").waitFor({ timeout: 15000 });
      await frame.evaluate(() => {
        for (const el of document.querySelectorAll("div")) {
          if (
            el.scrollHeight > el.clientHeight + 50 &&
            ["auto", "scroll"].includes(getComputedStyle(el).overflowY)
          )
            el.scrollTop = el.scrollHeight;
        }
      });
    },
  },
];

async function captureApp(browser, base, only) {
  for (const scene of APP_SCENES) {
    if (only && !only.includes(scene.file.replace(/\.webp$/, ""))) continue;
    const { context, page, frame } = await openFramedDemo(browser, base, scene.size);
    try {
      await scene.run(frame);
      await settle(frame, 1200);
      await hideDemoBanner(frame);
      await page.mouse.move(0, 0);
      writeWebp(scene.file, await snapshotWebp(page, scene.size), scene.size);
    } finally {
      await context.close();
    }
  }
}

/** The landing hero at 1200 wide, once the live phone is showing, without the "Probala acá" hint. */
async function captureShareImage(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 700 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.waitForFunction(
      () => {
        const frame = document.querySelector("iframe");
        return frame && getComputedStyle(frame).opacity === "1";
      },
      null,
      { timeout: 40000 },
    );
    await settle(page, 2500);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("div"))
        if (el.childElementCount === 0 && el.textContent === "Probala acá")
          el.parentElement.style.visibility = "hidden";
    });
    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    if (png.length > MAX_SHARE_BYTES)
      throw new Error(`share image is ${png.length} bytes, over 300 KB`);
    fs.writeFileSync(shareImage, png);
    console.log(
      `${path.relative(repoRoot, shareImage)}  1200x630  ${(png.length / 1024).toFixed(1)} KB`,
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const only = typeof args.only === "string" ? args.only.split(",") : null;
  const port = Number(args.port || 8794);
  const skipExport = Boolean(args["skip-export"]);
  const known = [...APP_SCENES.map((s) => s.file.replace(/\.webp$/, "")), "share-image"];
  const unknown = (only || []).find((n) => !known.includes(n));
  if (unknown) throw new Error(`Unknown capture "${unknown}". Known: ${known.join(", ")}`);

  if (!skipExport) runExport();
  const server = spawn(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "changelog", "serve.mjs"),
      path.join(clientDir, "dist"),
      String(port),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const base = `http://127.0.0.1:${port}`;
  let browser;
  try {
    await waitForPort(port);
    const { chromium } = loadPlaywright();
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-gpu"],
    });
    if (!only || only.some((n) => n !== "share-image")) await captureApp(browser, base, only);
    if (!only || only.includes("share-image")) {
      if (!skipExport) runExport(); // the landing must bundle the new captures first
      await captureShareImage(browser, base);
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
