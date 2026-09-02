/**
 * LEGAL-REVIEW-REQUIRED
 *
 * This module is a STRUCTURE-ONLY template for the privacy policy, not reviewed legal advice.
 * Every placeholder below (`{{...}}`) MUST be filled in and the whole document signed off by a
 * named human — a lawyer, or the operator explicitly accepting the risk in writing — before the
 * `REVISIÓN LEGAL PENDIENTE` marker is removed from the rendered page (see
 * `openspec/changes/legal-public-routes/tasks.md`, task 6.6). Until then this is not fit to
 * publish or to submit to a store listing.
 *
 * `{{MENORES}}` is the highest-risk placeholder: Loop is used by school families, so a minors
 * clause is mandatory and its drafting is deliberately not attempted here.
 *
 * Section headings mirror the deleted `landing/src/pages/politica-privacidad.astro` (commit
 * `b1bd13f`) as a structural starting point — only the headings, not its (also unreviewed) body
 * copy.
 */
import { CONTACT_EMAIL } from "@/config";
import type { LegalSection } from "./types";

/** Bump when the reviewed policy changes in a way that requires re-notifying users. */
export const PRIVACY_POLICY_VERSION = "2026-09-02";

export const PRIVACY_REVIEW_MARKER = "REVISIÓN LEGAL PENDIENTE";

/**
 * The ten named placeholders this template MUST expose (spec `public-legal-pages`, "Every
 * placeholder is present"). `{{CONTACTO}}` is the one placeholder resolved automatically, from
 * `CONTACT_EMAIL` — every other one needs a human answer.
 */
export const PRIVACY_PLACEHOLDERS = {
  DATOS_RECOLECTADOS: "{{DATOS_RECOLECTADOS}}",
  FINALIDAD: "{{FINALIDAD}}",
  BASE_LEGAL: "{{BASE_LEGAL}}",
  CONSERVACION: "{{CONSERVACION}}",
  TERCEROS: "{{TERCEROS}}",
  MENORES: "{{MENORES}}",
  DERECHOS: "{{DERECHOS}}",
  CONTACTO: CONTACT_EMAIL,
  JURISDICCION: "{{JURISDICCION}}",
  VIGENCIA: "{{VIGENCIA}}",
} as const;

export function buildPrivacyPolicySections(): LegalSection[] {
  return [
    { type: "title", content: "Política de privacidad" },
    {
      type: "paragraph",
      content: `${PRIVACY_REVIEW_MARKER}: este documento es una plantilla estructural, todavía no fue revisado por un profesional legal. No debe considerarse asesoramiento legal ni una política definitiva.`,
    },
    { type: "subtitle", content: "1. Datos que recolectamos" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.DATOS_RECOLECTADOS },
    { type: "subtitle", content: "2. Finalidad del tratamiento" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.FINALIDAD },
    { type: "subtitle", content: "3. Base legal" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.BASE_LEGAL },
    { type: "subtitle", content: "4. Conservación de los datos" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.CONSERVACION },
    { type: "subtitle", content: "5. Compartición con terceros" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.TERCEROS },
    { type: "subtitle", content: "6. Menores de edad" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.MENORES },
    { type: "subtitle", content: "7. Tus derechos" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.DERECHOS },
    { type: "subtitle", content: "8. Contacto" },
    {
      type: "paragraph",
      content: `Para consultas sobre privacidad o tus datos, escribinos a ${PRIVACY_PLACEHOLDERS.CONTACTO}.`,
    },
    { type: "subtitle", content: "9. Jurisdicción" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.JURISDICCION },
    { type: "subtitle", content: "10. Vigencia" },
    { type: "paragraph", content: PRIVACY_PLACEHOLDERS.VIGENCIA },
  ];
}
