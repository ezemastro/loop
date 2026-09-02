/**
 * LEGAL-REVIEW-REQUIRED
 *
 * Structural template, not reviewed legal advice — same limit as `privacyPolicy.ts`. Ported from
 * `client/components/screens/Terms.tsx` (previously hardcoded at `:30-78`), replacing the old
 * hardcoded community-name constant with a `{{COMMUNITY_NAME}}` placeholder filled at render time
 * by `buildTermsSections`. The in-app screen and the public `/terminos` route both render this
 * same document — see `openspec/changes/legal-public-routes/design.md` D4.
 */
import type { LegalSection } from "./types";

/**
 * Deliberate constant, not derived from a file hash: bumping it is what re-prompts every user for
 * acceptance (design D4/D5). Format `YYYY-MM-DD`.
 */
export const TERMS_VERSION = "2026-09-02";

export const TERMS_REVIEW_MARKER = "REVISIÓN LEGAL PENDIENTE";

/** Used when no community is known (anonymous `/terminos` visitor, no `?c=` slug). */
export const NEUTRAL_COMMUNITY_LABEL = "tu comunidad";

export function buildTermsSections(communityName: string): LegalSection[] {
  return [
    {
      type: "title",
      content: "Deslinde de responsabilidades",
    },
    {
      type: "paragraph",
      content: `${TERMS_REVIEW_MARKER}: este documento es una plantilla estructural, todavía no fue revisado por un profesional legal.`,
    },
    {
      type: "subtitle",
      content: `1. ${communityName}:`,
    },
    {
      type: "list-item",
      content:
        "No garantiza el cumplimiento de los acuerdos entre usuarios ni la autenticidad de los productos ofrecidos.",
    },
    {
      type: "list-item",
      content:
        "No se responsabiliza por pérdidas, daños materiales o personales, errores de descripción, incumplimientos, ni por el uso indebido de la plataforma.",
    },
    {
      type: "list-item",
      content:
        "No será responsable por interrupciones temporales del servicio, errores técnicos, mantenimiento o actualizaciones.",
    },
    {
      type: "list-item",
      content:
        "No obtiene lucro ni beneficio económico directo por las transacciones realizadas a través de LOOP.",
    },
    {
      type: "subtitle",
      content: "2. Los usuarios:",
    },
    {
      type: "list-item",
      content:
        "Asumen plena responsabilidad por los productos ofrecidos, su estado, entrega y recepción.",
    },
    {
      type: "list-item",
      content:
        "Se comprometen a actuar de buena fe, respetando los valores de confianza, solidaridad y cuidado ambiental que inspiran la iniciativa.",
    },
    {
      type: "list-item",
      content: `Liberan a ${communityName} de cualquier reclamo judicial o extrajudicial derivado de las transacciones efectuadas a través de LOOP.`,
    },
  ];
}
