import { buildSupportMail, type SupportMailTemplate } from "../services/supportMail";

/**
 * `buildSupportMail` (design.md D4): exact Spanish subjects, the diagnostic block, a blank
 * writing area, and the credential-leak guard — the one thing jest can genuinely assert about a
 * body it never renders.
 */

const CONTEXT = { version: "1.2.3", platform: "ios", route: "/settings" };
const TEMPLATES: SupportMailTemplate[] = ["bug", "suggestion", "contact"];

describe("buildSupportMail", () => {
  it("each template yields its exact Spanish subject", () => {
    expect(buildSupportMail("bug", CONTEXT).subject).toBe("Loop — Reporte de error");
    expect(buildSupportMail("suggestion", CONTEXT).subject).toBe("Loop — Sugerencia");
    expect(buildSupportMail("contact", CONTEXT).subject).toBe("Loop — Consulta");
  });

  it("the three subjects are distinct", () => {
    const subjects = TEMPLATES.map((template) => buildSupportMail(template, CONTEXT).subject);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  describe("diagnostic block and writing area", () => {
    it.each(TEMPLATES)("%s body contains version, platform and route", (template) => {
      const { body } = buildSupportMail(template, CONTEXT);
      expect(body).toContain(CONTEXT.version);
      expect(body).toContain(CONTEXT.platform);
      expect(body).toContain(CONTEXT.route);
    });

    it.each(TEMPLATES)("%s body leaves at least one explicit blank writing line", (template) => {
      const { body } = buildSupportMail(template, CONTEXT);
      expect(body.split("\n")).toContain("");
    });
  });

  describe("credential-leak guard", () => {
    const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const FORBIDDEN_WORDS = ["token", "bearer", "authorization"];

    it.each(TEMPLATES)("%s body contains no email address", (template) => {
      const { body } = buildSupportMail(template, CONTEXT);
      expect(body.match(EMAIL_RE) ?? []).toEqual([]);
    });

    it.each(TEMPLATES)("%s subject and body contain no auth-related keyword", (template) => {
      const { subject, body } = buildSupportMail(template, CONTEXT);
      const combined = `${subject}\n${body}`.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        expect(combined).not.toContain(word);
      }
    });
  });
});
