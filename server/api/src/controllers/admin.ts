import type { Request, Response, NextFunction } from "express";
import {
  validateAdminLogin,
  validateAdminRegister,
  validateCreateMissionTemplate,
  validateUpdateMissionTemplate,
} from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { adminCookieOptions, COOKIE_NAMES, ERROR_MESSAGES } from "../config";
import { AdminModel } from "../models/admin";
import { generateAdminToken } from "../services/jwt";
import { successResponse } from "../utils/responses";

export class AdminController {
  static login = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    const { username, password } = req.body;
    try {
      await validateAdminLogin({ username, password });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    // Verificar las credenciales del administrador
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.login({ username, password }));
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
    const { username, fullName, password, passToken } =
      req.body as PostAdminRegisterRequest["body"];
    try {
      await validateAdminRegister({ username, fullName, password, passToken });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      return;
    }
    // Registrar el nuevo administrador
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.register({
        username,
        fullName,
        password,
        passToken,
      }));
    } catch (error) {
      next(error);
      return;
    }
    // Generar un token JWT
    const token = generateAdminToken({ id: admin.id });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(201).json(successResponse({ data: { admin } }));
  };

  // Gestión de usuarios
  static getUsers = async (req: Request, res: Response, next: NextFunction) => {
    const { page, search } = req.query;
    try {
      const { users, total } = await AdminModel.getUsers({
        page: page ? Number(page) : 1,
        search: search as string | undefined,
      });
      return res.status(200).json(successResponse({ data: { users, total } }));
    } catch (error) {
      next(error);
    }
  };

  static modifyUserCredits = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.params;
    const { amount, positive, meta } = req.body;
    if (!userId) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { user } = await AdminModel.modifyUserCredits({
        userId,
        amount,
        positive,
        meta,
      });
      return res.status(200).json(successResponse({ data: { user } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de escuelas
  static createSchool = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { name, mediaId } = req.body;
    try {
      const { school } = await AdminModel.createSchool({ name, mediaId });
      return res.status(201).json(successResponse({ data: { school } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de categorías
  static createCategory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const {
      name,
      description,
      parentId,
      icon,
      minPriceCredits,
      maxPriceCredits,
      statKgWaste,
      statKgCo2,
      statLH2o,
    } = req.body;
    try {
      const { category } = await AdminModel.createCategory({
        name,
        description,
        parentId,
        icon,
        minPriceCredits,
        maxPriceCredits,
        statKgWaste,
        statKgCo2,
        statLH2o,
      });
      return res.status(201).json(successResponse({ data: { category } }));
    } catch (error) {
      next(error);
    }
  };

  static updateCategory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { categoryId } = req.params;
    const {
      name,
      description,
      parentId,
      icon,
      minPriceCredits,
      maxPriceCredits,
      statKgWaste,
      statKgCo2,
      statLH2o,
    } = req.body;
    if (!categoryId) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { category } = await AdminModel.updateCategory({
        categoryId,
        name,
        description,
        parentId,
        icon,
        minPriceCredits,
        maxPriceCredits,
        statKgWaste,
        statKgCo2,
        statLH2o,
      });
      return res.status(200).json(successResponse({ data: { category } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de notificaciones
  static sendNotification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId, type, payload } = req.body;
    try {
      const { notification } = await AdminModel.sendNotification({
        userId,
        type,
        payload,
      });
      return res.status(201).json(successResponse({ data: { notification } }));
    } catch (error) {
      next(error);
    }
  };

  // Estadísticas
  static getStats = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { stats } = await AdminModel.getStats();
      return res.status(200).json(successResponse({ data: { stats } }));
    } catch (error) {
      next(error);
    }
  };

  static getSchoolStats = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { schools } = await AdminModel.getSchoolStats();
      return res.status(200).json(successResponse({ data: { schools } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de mission templates
  static createMissionTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { key, title, description, rewardCredits, active } = req.body;
    try {
      await validateCreateMissionTemplate({
        key,
        title,
        description,
        rewardCredits,
        active,
      });
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { missionTemplate } = await AdminModel.createMissionTemplate({
        key,
        title,
        description,
        rewardCredits,
        active,
      });
      return res
        .status(201)
        .json(successResponse({ data: { missionTemplate } }));
    } catch (error) {
      next(error);
    }
  };

  static updateMissionTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { missionTemplateId } = req.params;
    const { title, description, rewardCredits, active } = req.body;
    if (!missionTemplateId) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await validateUpdateMissionTemplate({
        title,
        description,
        rewardCredits,
        active,
      });
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { missionTemplate } = await AdminModel.updateMissionTemplate({
        missionTemplateId,
        title,
        description,
        rewardCredits,
        active,
      });
      return res
        .status(200)
        .json(successResponse({ data: { missionTemplate } }));
    } catch (error) {
      next(error);
    }
  };
}
