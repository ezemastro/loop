import { Resend } from "resend";
import { BASE_URL, EMAIL_FROM, RESEND_API_KEY } from "../config.js";

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
    console.warn("[EMAIL] RESEND_API_KEY no configurada. Email NO enviado a:", to);
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

  console.log("[EMAIL] Email enviado a", to, "ID:", data?.id);
  return data;
};

export const sendVerificationEmail = async ({ to, token }: { to: string; token: string }) => {
  const verificationUrl = `${BASE_URL}/auth/verify-email?token=${token}`;

  if (!resend) {
    // Sin Resend configurado el mail no sale: el link queda en el log del api para pruebas.
    console.log(`[EMAIL] Link de verificación para ${to}: ${verificationUrl}`);
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
