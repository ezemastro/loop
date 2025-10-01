import type { Request, Response, NextFunction } from "express";
import { validateAdminLogin } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { adminCookieOptions, COOKIE_NAMES, ERROR_MESSAGES } from "../config";
import { AdminModel } from "../models/admin";
import { generateAdminToken } from "../services/jwt";
import { successResponse } from "../utils/responses";

export class AdminController {
  static login = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    const { email, password } = req.body;
    try {
      await validateAdminLogin({ email, password });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    // Verificar las credenciales del administrador
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.login({ email, password }));
    } catch (error) {
      next(error);
      return;
    }

    // Generar un token JWT
    const token = generateAdminToken({ id: admin.id });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(200).json(successResponse({ data: { admin } }));
  };
}
