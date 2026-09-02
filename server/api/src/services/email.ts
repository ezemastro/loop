import { Resend } from "resend";
import {
  APP_BASE_URL,
  BASE_URL,
  EMAIL_DEBUG_LINKS,
  EMAIL_FROM,
  RESEND_API_KEY,
} from "../config.js";

// Sin API key el servicio queda desactivado: en dev se loguea el link de verificación para
// poder probar el flujo sin mandar mails de verdad.
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailParams) => {
  if (!resend) {
    // Sin la dirección: es PII y no hace falta para diagnosticar el problema (SEC-16, D17).
    console.warn("[EMAIL] RESEND_API_KEY no configurada. Email NO enviado.");
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[EMAIL] Error enviando email:", JSON.stringify(error));
    throw error;
  }

  // Sin la dirección del destinatario: solo el id de Resend, que alcanza para correlacionar con su
  // dashboard (SEC-16, D17).
  console.log("[EMAIL] Email enviado. ID:", data?.id);
  return data;
};

export const sendVerificationEmail = async ({ to, token }: { to: string; token: string }) => {
  const verificationUrl = `${BASE_URL}/auth/verify-email?token=${token}`;

  if (!resend) {
    // El único guard acá solía ser que `RESEND_API_KEY` faltara: un deploy de producción con la
    // key rotada logueaba en texto plano un token capaz de tomar la cuenta (SEC-16, D17). Ahora
    // el link solo se loguea fuera de producción (o si se pide explícito), igual que
    // `sendPasswordResetEmail`. Dev y los tests lo necesitan; el e2e no — lee el token de la base.
    if (EMAIL_DEBUG_LINKS) {
      console.log(`[EMAIL] Link de verificación para ${to}: ${verificationUrl}`);
    } else {
      console.warn("[EMAIL] RESEND_API_KEY no configurada. Verificación de email NO enviada.");
    }
    return null;
  }

  return sendEmail({
    to,
    subject: "Verificá tu email - Loop",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a;">Bienvenido a Loop</h2>
        <p>Gracias por registrarte. Para activar tu cuenta, verificá tu dirección de email haciendo clic en el siguiente enlace:</p>
        <a href="${verificationUrl}"
           style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verificar email
        </a>
        <p style="color: #666; font-size: 14px;">Si no creaste esta cuenta, podés ignorar este mensaje.</p>
        <p style="color: #666; font-size: 14px;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
        <p style="color: #16a34a; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
      </div>
    `,
  });
};

/**
 * Mail de reseteo de password (SEC-11). El link va a `APP_BASE_URL` (el front web/app, no la
 * API): a diferencia de la verificación de email, que es un clic sin más datos, resetear la
 * contraseña necesita un formulario para tipear la nueva — así que abre la propia app/web, no una
 * página HTML de la API. `task 5.9` de `openspec/changes/legal-public-routes/tasks.md` registra
 * esta decisión.
 */
export const sendPasswordResetEmail = async ({ to, token }: { to: string; token: string }) => {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${token}`;

  if (!resend) {
    // Sin Resend configurado el mail no sale: el link queda en el log del api para pruebas — pero
    // solo fuera de producción (o si se pide explícitamente), porque loguear el token en
    // cleartext es una credencial de toma de cuenta (SEC-16, mismo criterio que `config.ts`
    // aplica a `EMAIL_DEBUG_LINKS`).
    if (EMAIL_DEBUG_LINKS) {
      console.log(`[EMAIL] Link de reseteo de contraseña para ${to}: ${resetUrl}`);
    } else {
      console.warn(
        "[EMAIL] RESEND_API_KEY no configurada. Reseteo de contraseña NO enviado a:",
        to,
      );
    }
    return null;
  }

  return sendEmail({
    to,
    subject: "Restablecé tu contraseña - Loop",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a;">Restablecé tu contraseña</h2>
        <p>Recibimos un pedido para restablecer la contraseña de tu cuenta de Loop. Hacé clic en el siguiente enlace para elegir una nueva:</p>
        <a href="${resetUrl}"
           style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Restablecer contraseña
        </a>
        <p style="color: #666; font-size: 14px;">Este enlace vence en 1 hora y solo se puede usar una vez.</p>
        <p style="color: #666; font-size: 14px;">Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue siendo válida.</p>
        <p style="color: #666; font-size: 14px;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
        <p style="color: #16a34a; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      </div>
    `,
  });
};
