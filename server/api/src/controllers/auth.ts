import type { NextFunction, Request, Response } from "express";
import {
  validateLogin,
  validateRegister,
  validateResendVerification,
  validateUserGoogleLogin,
} from "../services/validations.js";
import { InternalServerError, InvalidInputError } from "../services/errors.js";
import { generateToken } from "../services/jwt.js";
import { APP_BASE_URL, COOKIE_NAMES, cookieOptions, ERROR_MESSAGES } from "../config.js";
import { successResponse } from "../utils/responses.js";
import { AuthModel } from "../models/auth.js";

export class AuthController {
  static register = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    try {
      await validateRegister(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }
    // Registrar el usuario
    const { password, firstName, lastName, schoolIds, email, invitationToken } = req.body;
    let requireEmailVerification: boolean;
    try {
      ({ requireEmailVerification } = await AuthModel.registerUser({
        firstName,
        lastName,
        password,
        schoolIds,
        email,
        invitationToken,
      }));
    } catch (err) {
      return next(err);
    }

    // La cuenta nace sin verificar: nada de cookies ni auto-login. El mail de verificación que se
    // mandó en el registro es la llave para poder entrar. Sin Resend configurado (dev) no hace
    // falta ese paso: la cuenta ya nace verificada y puede loguearse directo.
    return res.status(201).json(
      successResponse({
        data: {
          message: requireEmailVerification
            ? "Cuenta creada. Revisá tu email para verificarla."
            : "Cuenta creada. Ya podés iniciar sesión.",
        },
      }),
    );
  };

  static login = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    try {
      await validateLogin(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }
    // Iniciar sesión
    const { email, password } = req.body;
    let user: PrivateUser;
    try {
      ({ user } = await AuthModel.loginUser({ email, password }));
    } catch (err) {
      return next(err);
    }
    // Agregar las cookies de sesión
    let token: string;
    try {
      token = generateToken({ userId: user.id, communityId: user.communityId });
    } catch {
      return next(
        new InternalServerError(ERROR_MESSAGES.TOKEN_GENERATION_FAILED, "TOKEN_GENERATION_FAILED"),
      );
    }
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(200).json(successResponse({ data: { user, token } }));
  };

  static googleLogin = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    try {
      await validateUserGoogleLogin(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }

    const { credential, schoolIds, invitationToken } =
      req.body as PostAuthGoogleLoginRequest["body"];

    if (!credential) {
      return next(
        new InvalidInputError(
          ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID,
          "GOOGLE_CREDENTIAL_INVALID",
        ),
      );
    }

    let user: PrivateUser;
    try {
      ({ user } = await AuthModel.googleLogin({
        credential,
        ...(schoolIds ? { schoolIds } : {}),
        ...(invitationToken ? { invitationToken } : {}),
      }));
    } catch (error) {
      return next(error);
    }

    // Agregar las cookies de sesión
    let token: string;
    try {
      token = generateToken({ userId: user.id, communityId: user.communityId });
    } catch (err) {
      return next(err);
    }
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(200).json(successResponse({ data: { user, token } }));
  };

  /**
   * Endpoint que abre el link del mail de verificación. Responde HTML para que funcione mandando
   * al mail, sin depender de la app: el clic confirma la cuenta y el usuario cierra para entrar.
   */
  static verifyEmail = async (req: Request, res: Response, _next: NextFunction) => {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).send(verificationErrorHtml);
    }
    try {
      await AuthModel.verifyEmail(token);
    } catch {
      return res.status(400).send(verificationErrorHtml);
    }
    return res.status(200).send(verificationSuccessHtml);
  };

  /**
   * Reenvío del mail de verificación (si no llegó o expiró). La respuesta es deliberadamente
   * genérica para no revelar si una dirección está registrada.
   */
  static resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateResendVerification(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }
    const { email } = req.body;
    try {
      await AuthModel.resendVerificationEmail({ email });
    } catch (err) {
      return next(err);
    }
    return res
      .status(200)
      .json(successResponse({ data: { message: ERROR_MESSAGES.EMAIL_VERIFICATION_SENT } }));
  };

  /**
   * Endpoint público que consulta si un link de invitación sirve. No expone quién lo creó ni nada
   * del admin: solo el id y la comunidad, que es lo que el registro necesita para filtrar los
   * colegios y pintarse con los colores correctos.
   */
  static getInvitation = async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params as unknown as GetAuthInvitationRequest["params"];
    if (!token) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID"));
    }
    try {
      const result = await AuthModel.getInvitation({ token });
      return res.status(200).json(successResponse({ data: result }));
    } catch (err) {
      return next(err);
    }
  };
}

const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

const crossSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

const verificationPage = ({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Loop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 48px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { margin-bottom: 16px; }
    h1 { color: #16a34a; font-size: 24px; margin-bottom: 12px; }
    p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="${APP_BASE_URL}" class="btn">Ir a Loop</a>
  </div>
</body>
</html>`;

const verificationSuccessHtml = verificationPage({
  icon: checkSvg,
  title: "Email verificado",
  body: "Tu direcci&oacute;n de email fue verificada correctamente.<br>Ya pod&eacute;s iniciar sesi&oacute;n en la app.",
});

const verificationErrorHtml = verificationPage({
  icon: crossSvg,
  title: "Link inv&aacute;lido",
  body: "El enlace de verificaci&oacute;n no es v&aacute;lido o ya fue usado.<br>Si el mail no lleg&oacute;, pod&eacute;s pedir uno nuevo desde el login.",
});
