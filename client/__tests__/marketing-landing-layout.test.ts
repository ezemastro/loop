import fs from "fs";
import path from "path";
import { HOW_IT_WORKS_STEPS } from "../components/landing/content";
import { LIVE_DEMO_SRC } from "../components/landing/useLiveDemo";

/**
 * Source guards for the marketing landing redesign (`marketing-landing` T9-T11). Static checks, not
 * a render: the sections pull in expo-router's `Link`, the theme store and react-native-web-only
 * DOM APIs, the same reason `marketing-landing-routing.test.ts` parses source.
 */

const CLIENT_ROOT = path.join(__dirname, "..");
const LANDING_DIR = path.join(CLIENT_ROOT, "components", "landing");
const SCREEN_PATH = path.join(CLIENT_ROOT, "components", "screens", "MarketingLanding.tsx");

const read = (file: string) => fs.readFileSync(file, "utf8");
const landingFiles = fs
  .readdirSync(LANDING_DIR)
  .filter((name) => /\.(ts|tsx)$/.test(name))
  .map((name) => path.join(LANDING_DIR, name));

// Every page section; `LandingButton` is a control, not a section.
const SECTION_FILES = landingFiles.filter((file) =>
  /\/Landing(?!Button)[A-Z]\w*\.tsx$/.test(file.split(path.sep).join("/")),
);

describe("marketing landing layout", () => {
  it("found the section components", () => {
    expect(SECTION_FILES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(SECTION_FILES)("%s aligns to the shared container", (file) => {
    expect(read(file)).toMatch(/LANDING_CONTAINER/);
  });

  it.each(landingFiles)("%s has no em or en dash", (file) => {
    expect(read(file)).not.toMatch(/[–—]/);
  });

  it.each(landingFiles)("%s does not use Reanimated entering animations", (file) => {
    // On web they stick near zero opacity next to display classes; `Reveal` replaces them.
    expect(read(file)).not.toMatch(/react-native-reanimated|entering=/);
  });
});

describe("hero live demo", () => {
  const hero = read(path.join(LANDING_DIR, "LandingHero.tsx"));

  it("embeds the public /demo route", () => {
    expect(LIVE_DEMO_SRC).toBe("/demo");
    expect(fs.existsSync(path.join(CLIENT_ROOT, "app", "demo.tsx"))).toBe(true);
    expect(hero).toMatch(/<iframe[\s\S]*?src=\{LIVE_DEMO_SRC\}/);
  });

  it("gives the iframe an accessible title", () => {
    expect(hero).toMatch(/<iframe[\s\S]*?title="[^"]+"/);
  });

  it("keeps a static poster for small screens and before the demo is ready", () => {
    expect(hero).toMatch(/ScreenImage[\s\S]*?source=\{phoneSource\}/);
  });
});

describe("how it works", () => {
  it("passes one real capture for every step", () => {
    const screen = read(SCREEN_PATH);
    const block = screen.match(/stepScreenshots=\{\{([\s\S]*?)\}\}/);
    expect(block).not.toBeNull();
    for (const step of HOW_IT_WORKS_STEPS) {
      expect(block![1]).toMatch(
        new RegExp(`${step.id}:\\s*require\\("\\.\\./\\.\\./assets/landing/[\\w-]+\\.webp"\\)`),
      );
    }
  });
});

describe("one label per intent", () => {
  const BUTTON_RE = /<LandingButton\s+([\s\S]*?)\/>/g;

  it.each(landingFiles.filter((file) => file.endsWith(".tsx")))("%s", (file) => {
    const source = read(file);
    let match: RegExpExecArray | null;
    while ((match = BUTTON_RE.exec(source)) !== null) {
      const props = match[1];
      const href = props.match(/href="([^"]+)"/)?.[1];
      const label = props.match(/label="([^"]+)"/)?.[1];
      if (href === "/ingresar") expect(label).toBe("Ingresar");
      if (href === "/register") expect(label).toBe("Crear cuenta");
    }
  });
});
