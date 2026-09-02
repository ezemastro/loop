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
  DATOS_RECOLECTADOS:
    "Recolectamos los datos que nos das al crear tu cuenta y usar Loop: nombre, apellido, email, teléfono (si lo cargás), foto de perfil, la comunidad escolar a la que pertenecés, y tu actividad dentro de la plataforma (publicaciones, intercambios, loopies ganados y canjeados). También guardamos metadatos técnicos básicos (fecha de registro, últimos accesos) necesarios para el funcionamiento y la seguridad del servicio.",
  FINALIDAD:
    "Usamos estos datos para crear y administrar tu cuenta, verificar tu identidad, permitirte publicar e intercambiar productos dentro de tu comunidad escolar, procesar tus loopies, enviarte comunicaciones operativas (verificación de email, recuperación de contraseña, avisos de la plataforma) y prevenir fraude, abuso o uso indebido del servicio.",
  BASE_LEGAL:
    "Tratamos tus datos con tu consentimiento, otorgado al registrarte y aceptar los Términos de uso, y en la medida necesaria para ejecutar el contrato de prestación del servicio. Cuando corresponde, también nos basamos en un interés legítimo para prevenir fraude y garantizar la seguridad de la plataforma, conforme a la Ley 25.326 de Protección de Datos Personales de la República Argentina.",
  CONSERVACION:
    "Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la baja de tu cuenta (por ejemplo desde /borrar-cuenta), tus datos personales se conservan hasta 2 años adicionales por razones administrativas, de seguridad y para cumplir obligaciones legales, y luego se eliminan o anonimizan, salvo que una norma exija un plazo mayor.",
  TERCEROS:
    "Compartimos datos con proveedores que nos ayudan a operar Loop: Resend (envío de emails transaccionales), Google (si elegís iniciar sesión con tu cuenta de Google) y, opcionalmente, un servicio de monitoreo de errores (Sentry) que solo se activa si lo configuramos explícitamente. No vendemos ni compartimos tus datos con terceros con fines publicitarios.",
  MENORES:
    "Loop está destinado a personas mayores de 18 años. Las cuentas son creadas y administradas exclusivamente por un adulto (madre, padre o tutor) responsable dentro de la comunidad escolar. Los menores de edad no pueden registrar ni operar una cuenta propia en la plataforma. Si un adulto publica productos o gestiona intercambios que involucran a un menor a su cargo, es responsable de resguardar los datos personales del menor y de no exponer información innecesaria en publicaciones o mensajes.",
  DERECHOS:
    "Tenés derecho a acceder, rectificar, actualizar, suprimir, limitar el uso y pedir la portabilidad de tus datos personales. Podés ejercer estos derechos, incluida la baja de tu cuenta, desde /borrar-cuenta o escribiéndonos a nuestro email de contacto. La Agencia de Acceso a la Información Pública, como Órgano de Control de la Ley 25.326, tiene la atribución de atender denuncias y reclamos de quienes resulten afectados en sus derechos.",
  CONTACTO: CONTACT_EMAIL,
  JURISDICCION:
    "Esta política se rige por las leyes de la República Argentina, en particular la Ley 25.326 de Protección de Datos Personales. Ante cualquier controversia serán competentes los tribunales ordinarios del domicilio de Redi Tinere, sin perjuicio de los fueros que la ley disponga como irrenunciables para los usuarios en su carácter de consumidores.",
  VIGENCIA:
    "Esta versión de la política rige desde el 02/09/2026 y permanece vigente hasta que publiquemos una versión posterior en esta misma página.",
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
