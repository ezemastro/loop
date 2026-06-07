import { Resend } from "resend";
import { RESEND_API_KEY, EMAIL_FROM } from "../config.js";

console.log("[EMAIL] RESEND_API_KEY configurada:", RESEND_API_KEY ? "SI" : "NO");
console.log("[EMAIL] EMAIL_FROM:", EMAIL_FROM);

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailParams) => {
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY no configurada. Email no enviado a:", to);
    return;
  }

  console.log("[EMAIL] Intentando enviar a:", to, "desde:", EMAIL_FROM);

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

  console.log("[EMAIL] Email enviado exitosamente. ID:", data?.id);
  return data;
};

export const sendVerificationEmail = async ({
  to,
  token,
}: {
  to: string;
  token: string;
}) => {
  const verificationUrl = `${process.env.BASE_URL || "http://localhost:3000"}/auth/verify-email?token=${token}`;

  // TODO: TEMPORAL - Redirigir mails a emastropietro@northfield.edu.ar para pruebas
  const actualTo = "emastropietro@northfield.edu.ar";

  console.log("[EMAIL] Enviando email de verificacion. Destinatario original:", to, "-> redirigido a:", actualTo);

  return sendEmail({
    to: actualTo,
    subject: "Verifica tu email - Loop",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a;">Bienvenido a Loop</h2>
        <p>Gracias por registrarte. Para activar tu cuenta, por favor verificá tu dirección de email haciendo clic en el siguiente enlace:</p>
        <p style="color: #999; font-size: 12px;">[DEBUG] Destinatario original: ${to}</p>
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
