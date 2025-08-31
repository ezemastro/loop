import type { NextFunction, Request, Response } from "express";
import { validateLogin, validateRegister } from "../services/validations.js";
import { InvalidInputError } from "../services/errors.js";
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
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    // Registrar el usuario
    const { password, firstName, lastName, schoolId, roleId, email } = req.body;
    let user: User;
    try {
      ({ user } = await AuthModel.registerUser({
        firstName,
        lastName,
        password,
        schoolId,
        roleId,
        email,
      }));
    } catch (err) {
      return next(err);
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
    return res.status(201).json(successResponse({ data: { user } }));
  };

  static login = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    try {
      await validateLogin(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    // Iniciar sesión
    const { email, password } = req.body;
    let user: User;
    try {
      ({ user } = await AuthModel.loginUser({ email, password }));
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
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
    return res.status(200).json(successResponse({ data: { user } }));
  };
}
