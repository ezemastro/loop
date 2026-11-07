import fs from "fs";
import path from "path";
import { RELEASES, type ChangelogImage } from "../content/changelog/releases";
import { walkTsFiles } from "./helpers/sourceFiles";

/**
 * Guards for the public changelog (`/changelog`). The recording process is `docs/CHANGELOG.md`;
 * this file enforces what can be checked mechanically so an AI (or a person) cannot drift from it.
 */

const CLIENT_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(CLIENT_ROOT, "public");
const MAX_IMAGE_BYTES = 300 * 1024;
const SEMVER = /^\d+\.\d+\.\d+$/;
const BANNED_WORDS = [
  "venta",
  "ventas",
  "precio",
  "precios",
  "plan",
  "planes",
  "vender",
  "comprar",
];

const allChanges = RELEASES.flatMap((release) => release.changes);

function allImages(): ChangelogImage[] {
  return allChanges.flatMap((change) =>
    change.comparisons.flatMap((c) => [c.before, c.after].filter((i): i is ChangelogImage => !!i)),
  );
}

function parseSemver(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map(Number);
  return [major, minor, patch];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Every string a visitor can read, for the wording checks. */
function visibleTexts(): string[] {
  return [
    ...RELEASES.flatMap((r) => [r.title, r.summary]),
    ...allChanges.flatMap((c) => [
      c.title,
      c.why,
      c.area,
      ...c.comparisons.flatMap((cmp) => [cmp.caption ?? "", cmp.before?.alt ?? "", cmp.after.alt]),
    ]),
  ];
}

describe("changelog data", () => {
  it("has at least one release with at least one change", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(allChanges.length).toBeGreaterThan(0);
  });

  it("uses unique IDs in C-0000 format across all releases", () => {
    const ids = allChanges.map((c) => c.id);
    ids.forEach((id) => expect(id).toMatch(/^C-\d{4}$/));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses valid semver and unique versions, newest first", () => {
    RELEASES.forEach((r) => expect(r.version).toMatch(SEMVER));
    expect(new Set(RELEASES.map((r) => r.version)).size).toBe(RELEASES.length);
    for (let i = 1; i < RELEASES.length; i += 1) {
      expect(compareSemver(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    }
  });

  it("uses YYYY-MM-DD dates that never go up when reading down the page", () => {
    RELEASES.forEach((r) => expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    for (let i = 1; i < RELEASES.length; i += 1) {
      expect(RELEASES[i - 1].date >= RELEASES[i].date).toBe(true);
    }
  });

  // The top release is the app version, or exactly one step ahead of it (a release being prepared
  // before the version bump): same major, and either the next minor with patch 0 or the next patch.
  it("top release equals client/package.json version or is exactly one step ahead", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(CLIENT_ROOT, "package.json"), "utf8"));
    const [maj, min, pat] = parseSemver(pkg.version);
    const allowed = [pkg.version, `${maj}.${min}.${pat + 1}`, `${maj}.${min + 1}.0`];
    expect(allowed).toContain(RELEASES[0].version);
  });

  it("every release and change has the plain-text fields filled in", () => {
    RELEASES.forEach((r) => {
      expect(r.title.trim()).not.toBe("");
      expect(r.summary.trim()).not.toBe("");
    });
    allChanges.forEach((c) => {
      expect(c.area.trim()).not.toBe("");
      expect(c.title.trim()).not.toBe("");
      expect(c.why.trim()).not.toBe("");
      c.commits.forEach((sha) => expect(sha).toMatch(/^[0-9a-f]{7,40}$/));
    });
  });

  it("mejora and arreglo show before and after unless flagged noVisual", () => {
    allChanges
      .filter((c) => (c.kind === "mejora" || c.kind === "arreglo") && !c.noVisual)
      .forEach((c) => {
        const complete = c.comparisons.some((cmp) => cmp.before && cmp.after);
        expect({ id: c.id, complete }).toEqual({ id: c.id, complete: true });
      });
  });

  it("uses only known viewports", () => {
    allChanges
      .flatMap((c) => c.comparisons)
      .forEach((cmp) => expect(["escritorio", "celular"]).toContain(cmp.viewport));
  });
});

describe("changelog images", () => {
  const images = allImages();

  it("scanned the list without error (may be empty before the first screenshots land)", () => {
    expect(Array.isArray(images)).toBe(true);
  });

  it("every referenced image exists, is small and has alt text", () => {
    images.forEach((image) => {
      expect(image.path).toMatch(/^\/changelog\/\d+\.\d+\.\d+\/[a-z0-9-]+\.webp$/);
      const file = path.join(PUBLIC_DIR, image.path);
      expect({ path: image.path, exists: fs.existsSync(file) }).toEqual({
        path: image.path,
        exists: true,
      });
      expect(fs.statSync(file).size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
      expect(image.alt.trim()).not.toBe("");
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    });
  });

  it("no committed changelog image exceeds the size limit, referenced or not", () => {
    const root = path.join(PUBLIC_DIR, "changelog");
    if (!fs.existsSync(root)) return;
    const oversized: string[] = [];
    for (const version of fs.readdirSync(root)) {
      const dir = path.join(root, version);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        if (fs.statSync(path.join(dir, file)).size > MAX_IMAGE_BYTES)
          oversized.push(`${version}/${file}`);
      }
    }
    expect(oversized).toEqual([]);
  });
});

describe("changelog wording", () => {
  it("never mentions selling, prices or plans", () => {
    const pattern = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "i");
    const offenders = visibleTexts().filter((text) => pattern.test(text));
    expect(offenders).toEqual([]);
  });

  it("never uses em dashes", () => {
    expect(visibleTexts().filter((text) => text.includes("—"))).toEqual([]);
  });
});

describe("changelog stays unlisted", () => {
  const sitemap = fs.readFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), "utf8");
  const robots = fs.readFileSync(path.join(PUBLIC_DIR, "robots.txt"), "utf8");

  it("is not in sitemap.xml", () => {
    expect(sitemap).not.toContain("changelog");
  });

  it("is not disallowed in robots.txt (a crawler must be able to read the noindex)", () => {
    expect(robots).not.toMatch(/changelog/i);
  });

  it("the route and its screen declare noindex", () => {
    const screen = fs.readFileSync(
      path.join(CLIENT_ROOT, "components/screens/Changelog.tsx"),
      "utf8",
    );
    expect(screen).toMatch(/<meta name="robots" content="noindex"\s*\/>/);
  });

  it("no client source links to /changelog", () => {
    const own = new Set(
      [
        "app/changelog.tsx",
        "components/screens/Changelog.tsx",
        "content/changelog/releases.ts",
      ].map((f) => path.join(CLIENT_ROOT, f)),
    );
    const linkPattern = /(href|push|replace|navigate)\b[^\n]*["'`]\/?changelog/;
    const files = [
      ...walkTsFiles(path.join(CLIENT_ROOT, "app")),
      ...walkTsFiles(path.join(CLIENT_ROOT, "components")),
      ...walkTsFiles(path.join(CLIENT_ROOT, "hooks")),
      ...walkTsFiles(path.join(CLIENT_ROOT, "services")),
      path.join(CLIENT_ROOT, "config.ts"),
    ].filter((f) => !own.has(f));
    const offenders = files
      .filter((f) => linkPattern.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(CLIENT_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("is a sibling of the root Stack, outside every Stack.Protected block", () => {
    const layout = fs.readFileSync(path.join(CLIENT_ROOT, "app/_layout.tsx"), "utf8");
    expect(layout).toMatch(/<Stack\.Screen\s+name="changelog"/);
    // Strip every balanced Stack.Protected block, then the screen must still be there.
    let rest = layout;
    while (rest.includes("<Stack.Protected")) {
      const start = rest.indexOf("<Stack.Protected");
      let depth = 0;
      let cursor = start;
      let end = -1;
      while (cursor < rest.length) {
        const nextOpen = rest.indexOf("<Stack.Protected", cursor);
        const nextClose = rest.indexOf("</Stack.Protected>", cursor);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          cursor = nextOpen + "<Stack.Protected".length;
        } else {
          depth -= 1;
          cursor = nextClose + "</Stack.Protected>".length;
          if (depth === 0) {
            end = cursor;
            break;
          }
        }
      }
      if (end === -1) throw new Error("Unbalanced <Stack.Protected> block in _layout.tsx");
      rest = rest.slice(0, start) + rest.slice(end);
    }
    expect(rest).toMatch(/<Stack\.Screen\s+name="changelog"/);
  });

  it("the PWA install prompt is skipped on this route", () => {
    const layout = fs.readFileSync(path.join(CLIENT_ROOT, "app/_layout.tsx"), "utf8");
    expect(layout).toMatch(/pathname !== "\/changelog"[^\n]*<PwaInstallPrompt/);
  });
});
