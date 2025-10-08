import type { Request, Response, NextFunction } from "express";
import {
  validateAdminLogin,
  validateAdminRegister,
} from "../services/validations";
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

  static register = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    const { email, password, passToken } =
      req.body as PostAdminRegisterRequest["body"];
    try {
      await validateAdminRegister({ email, password, passToken });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      return;
    }
    // Registrar el nuevo administrador
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.register({ email, password, passToken }));
    } catch (error) {
      next(error);
      return;
    }
    // Generar un token JWT
    const token = generateAdminToken({ id: admin.id });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(201).json(successResponse({ data: { admin } }));
  };
}
