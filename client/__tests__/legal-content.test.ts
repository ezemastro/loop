import fs from "fs";
import path from "path";
import { PRIVACY_PLACEHOLDERS } from "../content/legal/privacyPolicy";

/**
 * Task 2.7: every one of the ten named placeholders (spec `public-legal-pages`, "Template Status
 * Is Visible") is present in the privacy template, and `{{MENORES}}` is non-empty — it is the
 * mandatory minors clause, and is explicitly not drafted by this change.
 *
 * Task 3.8: the literal old community name never reappears in `Terms.tsx` or
 * `termsDocument.ts` — the whole point of `legal-public-routes` is that the community is dynamic.
 */

const REQUIRED_PLACEHOLDER_KEYS = [
  "DATOS_RECOLECTADOS",
  "FINALIDAD",
  "BASE_LEGAL",
  "CONSERVACION",
  "TERCEROS",
  "MENORES",
  "DERECHOS",
  "CONTACTO",
  "JURISDICCION",
  "VIGENCIA",
] as const;

describe("privacy template placeholders", () => {
  it("exposes all ten named placeholder keys", () => {
    for (const key of REQUIRED_PLACEHOLDER_KEYS) {
      expect(PRIVACY_PLACEHOLDERS).toHaveProperty(key);
    }
  });

  it("MENORES is non-empty", () => {
    expect(PRIVACY_PLACEHOLDERS.MENORES.trim().length).toBeGreaterThan(0);
  });
});

describe("no hardcoded community name remains", () => {
  const TERMS_SCREEN_PATH = path.join(__dirname, "..", "components", "screens", "Terms.tsx");
  const TERMS_DOCUMENT_PATH = path.join(__dirname, "..", "content", "legal", "termsDocument.ts");

  it.each([TERMS_SCREEN_PATH, TERMS_DOCUMENT_PATH])("%s does not contain 'Red Itinere'", (file) => {
    const source = fs.readFileSync(file, "utf-8");
    expect(source).not.toMatch(/Red Itinere/i);
  });
});
