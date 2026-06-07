import type { NextFunction, Request, Response } from "express";
import {
  validateLogin,
  validateRegister,
  validateUserGoogleLogin,
} from "../services/validations.js";
import { InternalServerError, InvalidInputError } from "../services/errors.js";
import { generateToken } from "../services/jwt.js";
import { COOKIE_NAMES, cookieOptions, ERROR_MESSAGES } from "../config.js";
import { successResponse } from "../utils/responses.js";
import { AuthModel } from "../models/auth.js";

export class AuthController {
  static register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateRegister(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }

    const { password, firstName, lastName, schoolIds, email } = req.body;
    try {
      await AuthModel.registerUser({
        firstName,
        lastName,
        password,
        schoolIds,
        email,
      });
    } catch (err) {
      return next(err);
    }

    return res.status(201).json(
      successResponse({
        data: { message: "Cuenta creada. Revisá tu email para verificarla." },
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
      token = generateToken({ userId: user.id });
    } catch {
      return next(new InternalServerError(ERROR_MESSAGES.TOKEN_GENERATION_FAILED, "TOKEN_GENERATION_FAILED"));
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

    const { credential, schoolIds } = req.body as PostAuthGoogleLoginRequest["body"];

    if (!credential) {
      return next(new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID, "GOOGLE_CREDENTIAL_INVALID"));
    }

    let user: PrivateUser;
    try {
      ({ user } = await AuthModel.googleLogin({
        credential,
        schoolIds,
      }));
    } catch (error) {
      return next(error);
    }

    // Agregar las cookies de sesión
    let token: string;
    try {
      token = generateToken({ userId: user.id });
    } catch (err) {
      return next(err);
    }
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(200).json(successResponse({ data: { user, token } }));
  };

  static verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
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
}

const verificationSuccessHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email verificado - Loop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0fdf4;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: white; border-radius: 16px; padding: 48px 32px;
      max-width: 420px; width: 100%; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #16a34a; font-size: 24px; margin-bottom: 12px; }
    p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block; background: #16a34a; color: white;
      padding: 12px 32px; border-radius: 8px; text-decoration: none;
      font-size: 16px; font-weight: 600; transition: background 0.2s;
    }
    .btn:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Email verificado</h1>
    <p>Tu direcci&oacute;n de email fue verificada correctamente.<br>Ya pod&eacute;s iniciar sesi&oacute;n en la app.</p>
    <a href="/" class="btn">Ir a Loop</a>
  </div>
</body>
</html>`;

const verificationErrorHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Loop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fef2f2;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: white; border-radius: 16px; padding: 48px 32px;
      max-width: 420px; width: 100%; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #dc2626; font-size: 24px; margin-bottom: 12px; }
    p { color: #4b5563; font-size: 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Enlace inv&aacute;lido</h1>
    <p>Este enlace de verificaci&oacute;n no es v&aacute;lido o ya fue usado.<br>Si necesit&aacute;s ayuda, contactate con soporte.</p>
  </div>
</body>
</html>`;
