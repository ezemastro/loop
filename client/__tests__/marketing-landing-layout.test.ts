import fs from "fs";
import path from "path";
import { FAQ_ITEMS, HOW_IT_WORKS_STEPS, SCHOOL_LOGOS } from "../components/landing/content";
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
  /\/Landing(?!Button|Text)[A-Z]\w*\.tsx$/.test(file.split(path.sep).join("/")),
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
  const LABELS: Record<string, string> = {
    "/ingresar": "Ingresar",
    "/register": "Crear cuenta",
    "/demo": "Probá la demo",
  };

  const buttonsIn = (file: string) =>
    [...read(file).matchAll(BUTTON_RE)].map((match) => ({
      href: match[1].match(/href="([^"]+)"/)?.[1] ?? "",
      label: match[1].match(/label="([^"]+)"/)?.[1] ?? "",
    }));

  it.each(landingFiles.filter((file) => file.endsWith(".tsx")))("%s", (file) => {
    for (const { href, label } of buttonsIn(file)) {
      if (href in LABELS) expect(label).toBe(LABELS[href]);
    }
  });

  it("puts Ingresar in the nav only, never in the hero or the final CTA", () => {
    expect(buttonsIn(path.join(LANDING_DIR, "LandingNav.tsx")).map((b) => b.href)).toEqual([
      "/ingresar",
    ]);
    for (const name of ["LandingHero.tsx", "LandingFinalCta.tsx"]) {
      const hrefs = buttonsIn(path.join(LANDING_DIR, name)).map((b) => b.href);
      expect(hrefs).toEqual(["/register", "/demo"]);
    }
  });
});

describe("signed-in landing", () => {
  const nav = read(path.join(LANDING_DIR, "LandingNav.tsx"));

  it("turns Ingresar and Crear cuenta into entries to the app, keeping the Ingresar label", () => {
    expect(nav).toMatch(/whenSignedIn=\{\{\}\}/);
    for (const name of ["LandingHero.tsx", "LandingFinalCta.tsx"]) {
      expect(read(path.join(LANDING_DIR, name))).toMatch(/whenSignedIn=\{\{ label: "Ir a la app"/);
    }
  });

  it("only shows the signed-in variant after mounting, so the pre-rendered markup still hydrates", () => {
    const hook = read(path.join(LANDING_DIR, "useLandingAccess.ts"));
    expect(hook).toMatch(/useEffect\(\(\) => setMounted\(true\), \[\]\)/);
    expect(hook).toMatch(/signedIn = mounted && isLoggedIn/);
  });
});

describe("demo button", () => {
  it("loads /demo as a new document so its storage isolation sees the boot path", () => {
    const button = read(path.join(LANDING_DIR, "LandingButton.tsx"));
    expect(button).toMatch(/FULL_PAGE_LOAD = new Set<string>\(\["\/demo"\]\)/);
    expect(button).toMatch(/window\.location\.assign\(href\)/);
  });
});

describe("how it works follows the real exchange order", () => {
  it("lists publish, search, coordinate, receive loopies", () => {
    expect(HOW_IT_WORKS_STEPS.map((step) => step.id)).toEqual([
      "publicar",
      "buscar",
      "coordinar",
      "recibir",
    ]);
    expect(HOW_IT_WORKS_STEPS.map((step) => step.title)).toEqual([
      "Publicá",
      "Buscá y loopeá",
      "Coordiná la entrega",
      "Recibí tus loopies",
    ]);
  });

  it("only claims what the code does", () => {
    const copy = JSON.stringify([HOW_IT_WORKS_STEPS, FAQ_ITEMS]);
    // There is no rating feature, and contact is never "unlocked" by an offer.
    expect(copy).not.toMatch(/califica|calificaci|reseñ|destraba/i);
    // The seller is credited on receipt, never on publish.
    expect(HOW_IT_WORKS_STEPS[0].description).not.toMatch(/loopies que|recibís loopies/i);
  });

  it("keeps the hero subtext within 20 words", () => {
    const hero = read(path.join(LANDING_DIR, "LandingHero.tsx"));
    const subtext = hero.match(/Intercambiá[\s\S]*?colegio\./)?.[0] ?? "";
    expect(subtext.split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  it("never mentions selling, pricing or plans on the page", () => {
    const text = landingFiles.map(read).join("\n");
    expect(text).not.toMatch(
      /\b(vend[eé]r?|comprar|licencia|suscripci|contact(á|a) a ventas|implementá)/i,
    );
  });
});

describe("typography and palette", () => {
  it.each(
    landingFiles.filter((file) => file.endsWith(".tsx") && !file.endsWith("LandingText.tsx")),
  )("%s takes Text from LandingText, not react-native", (file) => {
    const imports = read(file).match(/import \{[^}]*\} from "react-native";/g) ?? [];
    for (const line of imports) expect(line).not.toMatch(/\bText\b/);
  });

  it("self-hosts Figtree with swap and keeps its license next to the file", () => {
    const html = read(path.join(CLIENT_ROOT, "app", "+html.tsx"));
    expect(html).toMatch(/font-display: swap/);
    expect(html).toMatch(/\/fonts\/figtree-latin-wght-normal\.woff2/);
    expect(
      fs.existsSync(path.join(CLIENT_ROOT, "public", "fonts", "figtree-latin-wght-normal.woff2")),
    ).toBe(true);
    expect(read(path.join(CLIENT_ROOT, "public", "fonts", "Figtree-OFL.txt"))).toMatch(
      /SIL OPEN FONT LICENSE/,
    );
    expect(read(SCREEN_PATH)).toMatch(/rel="preload"[\s\S]*?as="font"/);
  });

  it("uses no teal on the landing: navy and orange only", () => {
    for (const file of landingFiles) {
      expect(read(file)).not.toMatch(/tertiary|TERTIARY/);
    }
  });
});

describe("schools band", () => {
  const schools = read(path.join(LANDING_DIR, "LandingSchools.tsx"));

  it("shows the five real logos, each with alt text", () => {
    for (const { id, name } of SCHOOL_LOGOS) {
      expect(
        fs.existsSync(path.join(CLIENT_ROOT, "assets", "landing", "schools", `${id}.webp`)),
      ).toBe(true);
      expect(name.length).toBeGreaterThan(0);
    }
    expect(SCHOOL_LOGOS).toHaveLength(5);
    expect(schools).toMatch(/accessibilityLabel=\{name\}/);
  });

  it("states the availability and the number of campuses", () => {
    expect(schools).toContain("Disponible en todos los colegios de Red Itínere");
    expect(schools).toContain("Nueve sedes en Argentina y Uruguay");
  });

  it("replaced the old for-whom band", () => {
    expect(fs.existsSync(path.join(LANDING_DIR, "LandingForWhom.tsx"))).toBe(false);
  });
});

describe("heading outline", () => {
  const HEADER_TAG_RE = /<Text\b[^>]*?accessibilityRole="header"[^>]*?>/gs;
  const tsxFiles = [...landingFiles.filter((file) => file.endsWith(".tsx")), SCREEN_PATH];

  const headings = tsxFiles.flatMap((file) =>
    (read(file).match(HEADER_TAG_RE) ?? []).map((tag) => ({ file, tag })),
  );

  it("finds the section headings", () => {
    expect(headings.length).toBeGreaterThanOrEqual(6);
  });

  it("has exactly one level-1 heading, the hero", () => {
    const levelOne = headings.filter(({ tag }) => /aria-level=\{1\}/.test(tag));
    expect(levelOne).toHaveLength(1);
    expect(levelOne[0].file).toMatch(/LandingHero\.tsx$/);
  });

  it("gives every other heading an explicit level of 2 or 3", () => {
    // react-native-web renders `accessibilityRole="header"` as an <h1> when no level is given.
    for (const { file, tag } of headings) {
      if (/aria-level=\{1\}/.test(tag)) continue;
      expect({ file, ok: /aria-level=\{[23]\}/.test(tag) }).toEqual({ file, ok: true });
    }
  });
});

describe("sharing metadata", () => {
  const screen = read(SCREEN_PATH);

  it("declares canonical, Open Graph and Twitter tags in the page head", () => {
    for (const needle of [
      'rel="canonical"',
      'property="og:title"',
      'property="og:description"',
      'property="og:type"',
      'property="og:url"',
      'property="og:image"',
      'property="og:locale" content="es_AR"',
      'name="twitter:card" content="summary_large_image"',
    ]) {
      expect(screen).toContain(needle);
    }
  });

  it("ships robots.txt and sitemap.xml with the expected rules", () => {
    const robots = read(path.join(CLIENT_ROOT, "public", "robots.txt"));
    expect(robots).toMatch(/^Allow: \/$/m);
    // A crawler blocked by robots never reads the demo's `noindex`, so /demo must stay crawlable.
    expect(robots).not.toMatch(/^Disallow:/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/loop\.reditinere\.com\/sitemap\.xml$/m);
    const sitemap = read(path.join(CLIENT_ROOT, "public", "sitemap.xml"));
    // The legal pages still carry the pending-review marker, so only the landing is listed.
    expect(sitemap.match(/<loc>[^<]+<\/loc>/g)).toEqual([
      "<loc>https://loop.reditinere.com/</loc>",
    ]);
  });

  it("ships a 1200x630 share image under 300 KB that the page points at", () => {
    const file = path.join(CLIENT_ROOT, "public", "share-image.png");
    const bytes = fs.readFileSync(file);
    expect(bytes.length).toBeLessThan(300 * 1024);
    // PNG header: 8-byte signature, then IHDR with big-endian width and height at offsets 16 and 20.
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    expect(read(path.join(LANDING_DIR, "content.ts"))).toMatch(/share-image\.png/);
  });

  it("keeps the sample-data demo out of search results", () => {
    expect(read(path.join(CLIENT_ROOT, "app", "demo.tsx"))).toMatch(
      /name="robots" content="noindex"/,
    );
  });

  it("declares the document language in the root HTML", () => {
    expect(read(path.join(CLIENT_ROOT, "app", "+html.tsx"))).toMatch(/<html lang="es-AR">/);
  });

  it("does not describe Loop as a marketplace in the manifest copy", () => {
    for (const file of ["app.json", path.join("public", "manifest.json")]) {
      expect(read(path.join(CLIENT_ROOT, file))).not.toMatch(/marketplace|comprá|vendé/i);
    }
  });
});

describe("navigation", () => {
  it("uses an opaque header background", () => {
    expect(read(path.join(LANDING_DIR, "LandingNav.tsx"))).not.toMatch(/bg-white\/\d+/);
  });
});
