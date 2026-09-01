/**
 * Pure subject/body builders for the settings screen's contact entries. `SupportMailContext` is
 * a closed three-field type, so there is no field through which a token, an authorization header
 * or the user's own email could reach a body — the leak prevention is structural.
 */
export type SupportMailTemplate = "bug" | "suggestion" | "contact";

export interface SupportMailContext {
  version: string;
  platform: string;
  route: string;
}

export interface SupportMail {
  subject: string;
  body: string;
}

const GREETING = "Hola equipo de Loop,";

const diagnosticsLines = (context: SupportMailContext): string[] => [
  "",
  "--- Datos técnicos ---",
  `Versión: ${context.version}`,
  `Plataforma: ${context.platform}`,
  `Pantalla: ${context.route}`,
];

export function buildSupportMail(
  template: SupportMailTemplate,
  context: SupportMailContext,
): SupportMail {
  switch (template) {
    case "bug":
      return {
        subject: "Loop — Reporte de error",
        body: [
          GREETING,
          "",
          "Qué pasó:",
          "",
          "Qué esperabas:",
          "",
          "Pasos para reproducir:",
          "",
          ...diagnosticsLines(context),
        ].join("\n"),
      };
    case "suggestion":
      return {
        subject: "Loop — Sugerencia",
        body: [GREETING, "", "Tu sugerencia:", "", ...diagnosticsLines(context)].join("\n"),
      };
    case "contact":
      return {
        subject: "Loop — Consulta",
        body: [GREETING, "", "Tu mensaje:", "", ...diagnosticsLines(context)].join("\n"),
      };
  }
}
