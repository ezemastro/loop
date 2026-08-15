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
    // Validar los datos de la solicitud
    try {
      await validateRegister(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT, "VALIDATION_ERROR"));
    }
    // Registrar el usuario
    const { password, firstName, lastName, schoolIds, email, invitationToken } = req.body;
    let user: PrivateUser;
    try {
      ({ user } = await AuthModel.registerUser({
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
    // Agregar las cookies de sesión
    let token: string;
    try {
      token = generateToken({ userId: user.id, communityId: user.communityId });
    } catch {
      return next(new InternalServerError(ERROR_MESSAGES.TOKEN_GENERATION_FAILED, "TOKEN_GENERATION_FAILED"));
    }
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(201).json(successResponse({ data: { user, token } }));
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

    const { credential, schoolIds, invitationToken } =
      req.body as PostAuthGoogleLoginRequest["body"];

    if (!credential) {
      return next(new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID, "GOOGLE_CREDENTIAL_INVALID"));
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
