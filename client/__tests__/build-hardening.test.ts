import fs from "fs";
import path from "path";
import { walkTsFiles } from "./helpers/sourceFiles";

const CLIENT_ROOT = path.join(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(CLIENT_ROOT, relativePath), "utf8");

describe("app.json declares no unused permission and no unconditional cleartext", () => {
  const appJson = JSON.parse(read("app.json"));

  it("declares no RECORD_AUDIO permission", () => {
    const permissions: string[] = appJson.expo?.android?.permissions ?? [];
    expect(permissions).not.toContain("android.permission.RECORD_AUDIO");
  });

  it("declares no unconditional usesCleartextTraffic plugin entry", () => {
    const plugins: unknown[] = appJson.expo?.plugins ?? [];
    const hasCleartextPlugin = plugins.some(
      (plugin) =>
        Array.isArray(plugin) &&
        plugin[0] === "expo-build-properties" &&
        (plugin[1] as { android?: { usesCleartextTraffic?: boolean } })?.android
          ?.usesCleartextTraffic === true,
    );
    expect(hasCleartextPlugin).toBe(false);
  });
});

describe("app.config.js adds cleartext only for the development profile", () => {
  const content = read("app.config.js");

  it("gates the expo-build-properties plugin on the development profile", () => {
    expect(content).toMatch(/EAS_BUILD_PROFILE\s*===\s*["']development["']/);
    expect(content).toContain("expo-build-properties");
    expect(content).toContain("usesCleartextTraffic");
  });
});

describe("config.ts fails loudly instead of logging", () => {
  const content = read("config.ts");

  it("contains no console.log", () => {
    expect(content).not.toMatch(/console\.log/);
  });

  it("throws when EXPO_PUBLIC_API_URL is missing, rather than concatenating undefined", () => {
    expect(content).toMatch(/throw new Error/);
    expect(content).not.toMatch(/API_URL\s*\+\s*["']\/uploads\//);
  });
});

describe("every eas.json build profile defines EXPO_PUBLIC_API_URL", () => {
  const easJson = JSON.parse(read("eas.json"));

  it.each(Object.keys(easJson.build))("profile %s defines EXPO_PUBLIC_API_URL", (profile) => {
    expect(easJson.build[profile].env?.EXPO_PUBLIC_API_URL).toBeTruthy();
  });
});

describe("package.json's test script terminates", () => {
  const packageJson = JSON.parse(read("package.json"));

  it("does not run --watchAll without =false", () => {
    const script: string = packageJson.scripts.test;
    const hasBareWatchAll = /--watchAll(?!=false)/.test(script);
    expect(hasBareWatchAll).toBe(false);
  });

  it("runs with --ci", () => {
    expect(packageJson.scripts.test).toMatch(/--ci\b/);
  });
});

describe("the demo password is never referenced outside client/demo", () => {
  it("no application module contains DEMO_PASSWORD or its literal value", () => {
    // The credential identifier itself, split so this guard's own source does not self-match.
    const forbidden = ["DEMO_" + "PASSWORD", "Demo" + "1234"];
    const files = walkTsFiles(CLIENT_ROOT).filter(
      (file) =>
        !file.includes(`${path.sep}demo${path.sep}`) &&
        !file.includes(`${path.sep}__tests__${path.sep}`),
    );
    const offenders = files.filter((file) => {
      const content = fs.readFileSync(file, "utf8");
      return forbidden.some((needle) => content.includes(needle));
    });
    expect(offenders).toEqual([]);
  });
});

describe("public/sw.js excludes the API and non-GET requests from its cache", () => {
  const content = read("public/sw.js");

  it("returns early for /api before respondWith", () => {
    const respondWithIndex = content.indexOf("event.respondWith");
    const apiGuardIndex = content.indexOf("/api");
    expect(apiGuardIndex).toBeGreaterThan(-1);
    expect(apiGuardIndex).toBeLessThan(respondWithIndex);
  });

  it("returns early for non-GET methods before respondWith", () => {
    const respondWithIndex = content.indexOf("event.respondWith");
    const methodGuardIndex = content.indexOf('method !== "GET"');
    expect(methodGuardIndex).toBeGreaterThan(-1);
    expect(methodGuardIndex).toBeLessThan(respondWithIndex);
  });
});
