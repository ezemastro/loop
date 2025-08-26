import type { Request, Response } from "express";
import { validateLogin, validateRegister } from "../services/validations.js";
import { InvalidInputError } from "../services/errors.js";
import { generateToken } from "../services/jwt.js";
import { COOKIE_NAMES, cookieOptions, ERROR_MESSAGES } from "../config.js";
import { successResponse } from "../utils/responses.js";
import { AuthModel } from "../models/auth.js";

export class AuthController {
  static register = async (req: Request, res: Response) => {
    // Validar los datos de la solicitud
    try {
      await validateRegister(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    // Registrar el usuario
    const { password, firstName, lastName, schoolId, roleId, email } = req.body;
    const { user } = await AuthModel.registerUser({
      firstName,
      lastName,
      password,
      schoolId,
      roleId,
      email,
    });
    // Agregar las cookies de sesión
    const token = generateToken({ userId: user.id });
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(201).json(successResponse({ data: { user } }));
  };

  static login = async (req: Request, res: Response) => {
    // Validar los datos de la solicitud
    try {
      await validateLogin(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    // Iniciar sesión
    const { email, password } = req.body;
    const { user } = await AuthModel.loginUser({ email, password });
    // Agregar las cookies de sesión
    const token = generateToken({ userId: user.id });
    res.cookie(COOKIE_NAMES.TOKEN, token, cookieOptions);

    // Devolver la respuesta
    return res.status(200).json(successResponse({ data: { user } }));
  };
}
