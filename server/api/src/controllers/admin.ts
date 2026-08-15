import type { Request, Response, NextFunction } from "express";
import {
  validateAdminGoogleLogin,
  validateAdminLogin,
  validateAdminRegister,
  validateCreateMissionTemplate,
  validateId,
  validateUpdateMissionTemplate,
} from "../services/validations.js";
import { InvalidInputError, UnauthorizedError } from "../services/errors.js";
import { adminCookieOptions, COOKIE_NAMES, ERROR_MESSAGES } from "../config.js";
import { AdminModel } from "../models/admin.js";
import { generateAdminToken } from "../services/jwt.js";
import { successResponse } from "../utils/responses.js";
import { adminScopeCommunityId } from "../middlewares/parseAdminToken.js";

/** Un valor de query string utilizable, o `undefined`. Express admite arrays y objetos anidados. */
const queryString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const requireAdminId = (req: Request): UUID => {
  const adminId = req.session?.adminId;
  if (!adminId) throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
  return adminId;
};

/**
 * Comunidad sobre la que **escribir**. A diferencia de la de lectura, no puede ser null: un
 * super admin tiene que decir explícitamente en qué comunidad está creando.
 */
const requireScopeCommunityId = (req: Request, requested?: UUID | null): UUID => {
  const communityId = adminScopeCommunityId(req, requested);
  if (!communityId) throw new InvalidInputError(ERROR_MESSAGES.COMMUNITY_REQUIRED);
  return communityId;
};

export class AdminController {
  static login = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    const { email, password } = req.body as PostAdminLoginRequest["body"];
    try {
      await validateAdminLogin({ email, password });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      return;
    }

    // Verificar las credenciales del administrador
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.login({ email, password }));
    } catch (error) {
      next(error);
      return;
    }

    // Generar un token JWT: el rol y la comunidad viajan en el token, y de ahí sale el scope.
    const token = generateAdminToken({
      id: admin.id,
      role: admin.role,
      communityId: admin.communityId,
    });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(200).json(successResponse({ data: { admin } }));
  };

  static register = async (req: Request, res: Response, next: NextFunction) => {
    // Validar los datos de la solicitud
    const { email, fullName, password } = req.body as PostAdminRegisterRequest["body"];
    try {
      await validateAdminRegister({ email, fullName, password });
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      return;
    }
    // Registrar el nuevo administrador. El rol y la comunidad se heredan de la allowlist.
    let admin: Admin;
    try {
      ({ admin } = await AdminModel.register({
        email,
        fullName,
        password,
      }));
    } catch (error) {
      next(error);
      return;
    }
    // Generar un token JWT
    const token = generateAdminToken({
      id: admin.id,
      role: admin.role,
      communityId: admin.communityId,
    });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(201).json(successResponse({ data: { admin } }));
  };

  static googleLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validateAdminGoogleLogin(req.body);
    } catch {
      next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      return;
    }
    const { credential } = req.body as PostAdminGoogleLoginRequest["body"];

    if (!credential) {
      next(new InvalidInputError(ERROR_MESSAGES.GOOGLE_CREDENTIAL_INVALID));
      return;
    }

    let admin: Admin;
    try {
      // Pasar credencial al modelo para manejar login/registro
      ({ admin } = await AdminModel.googleLogin({ credential }));
    } catch (error) {
      next(error);
      return;
    }
    // Generar un token JWT
    const token = generateAdminToken({
      id: admin.id,
      role: admin.role,
      communityId: admin.communityId,
    });
    res.cookie(COOKIE_NAMES.ADMIN_TOKEN, token, adminCookieOptions);
    return res.status(200).json(successResponse({ data: { admin } }));
  };

  /**
   * Autorizar un correo es delegar permisos, así que se limita al alcance del que autoriza:
   * un community_admin solo puede sumar admins a su comunidad, y solo un super admin puede
   * crear otro super admin.
   */
  static addValidEmailForRegistration = async (req: Request, res: Response, next: NextFunction) => {
    const { email, role, communityId } = req.body as PostAdminAuthorizeEmailRequest["body"] & {
      role?: AdminRole;
      communityId?: UUID;
    };
    const requestedRole: AdminRole = role === "super_admin" ? "super_admin" : "community_admin";
    if (requestedRole === "super_admin" && req.session?.adminRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: ERROR_MESSAGES.SUPER_ADMIN_REQUIRED,
        errorCode: "SUPER_ADMIN_REQUIRED",
      });
    }
    try {
      await AdminModel.addValidEmailForRegistration({
        email,
        role: requestedRole,
        // super_admin ⇔ sin comunidad (lo exige un CHECK en la base).
        communityId:
          requestedRole === "super_admin" ? null : requireScopeCommunityId(req, communityId),
      });
      return res.status(201).json(successResponse({}));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de usuarios
  static getUsers = async (req: Request, res: Response, next: NextFunction) => {
    const { page, search, communityId } = req.query;
    try {
      const { users, total } = await AdminModel.getUsers({
        page: page ? Number(page) : 1,
        search: queryString(search),
        communityId: adminScopeCommunityId(req, queryString(communityId)),
      });
      return res.status(200).json(successResponse({ data: { users, total } }));
    } catch (error) {
      next(error);
    }
  };

  static modifyUserCredits = async (req: Request, res: Response, next: NextFunction) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
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
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({ data: { user } }));
    } catch (error) {
      next(error);
    }
  };

  static resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
    const { newPassword } = req.body as PostAdminUserResetPasswordRequest["body"];
    const { userId } = req.params as PostAdminUserResetPasswordRequest["params"];
    try {
      await validateId(userId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    // No hay validaciones porque es administrador
    try {
      await AdminModel.resetUserPassword({
        userId,
        newPassword,
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({ data: { userId } }));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mueve una cuenta de comunidad. Solo super admin: es la única operación del panel que cruza
   * la frontera de aislamiento.
   */
  static moveUserToCommunity = async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params as { userId: UUID };
    const { communityId, schoolIds } = req.body as {
      communityId?: UUID;
      schoolIds?: UUID[];
    };
    if (!communityId || !Array.isArray(schoolIds)) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await validateId(userId);
      await validateId(communityId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { user } = await AdminModel.moveUserToCommunity({ userId, communityId, schoolIds });
      return res.status(200).json(successResponse({ data: { user } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de escuelas
  static createSchool = async (req: Request, res: Response, next: NextFunction) => {
    const { name, mediaId, communityId } = req.body as PostAdminSchoolsRequest["body"] & {
      communityId?: UUID;
    };
    try {
      const { school } = await AdminModel.createSchool({
        name,
        mediaId,
        // Un colegio nace en una comunidad concreta: un super admin tiene que indicarla.
        communityId: requireScopeCommunityId(req, communityId),
      });
      return res.status(201).json(successResponse({ data: { school } }));
    } catch (error) {
      next(error);
    }
  };

  static updateSchool = async (req: Request, res: Response, next: NextFunction) => {
    const schoolId = Array.isArray(req.params.schoolId)
      ? req.params.schoolId[0]
      : req.params.schoolId;
    const { name, mediaId } = req.body;

    if (!schoolId) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }

    try {
      const { school } = await AdminModel.updateSchool({
        schoolId,
        name,
        mediaId,
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({ data: { school } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de categorías (catálogo compartido: solo super admin, ver routes/admin.ts)
  static createCategory = async (req: Request, res: Response, next: NextFunction) => {
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

  static updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    const categoryId = Array.isArray(req.params.categoryId)
      ? req.params.categoryId[0]
      : req.params.categoryId;
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
  static sendNotification = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, type, payload } = req.body;
    try {
      const { notification } = await AdminModel.sendNotification({
        userId,
        type,
        payload,
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(201).json(successResponse({ data: { notification } }));
    } catch (error) {
      next(error);
    }
  };

  // Estadísticas
  static getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stats } = await AdminModel.getStats({
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({ data: { stats } }));
    } catch (error) {
      next(error);
    }
  };

  static getSchoolStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schools } = await AdminModel.getSchoolStats({
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({ data: { schools } }));
    } catch (error) {
      next(error);
    }
  };

  // Gestión de mission templates (catálogo compartido: solo super admin, ver routes/admin.ts)
  static getMissionTemplates = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { missionTemplates } = await AdminModel.getMissionTemplates();
      return res.status(200).json(successResponse({ data: { missionTemplates } }));
    } catch (error) {
      next(error);
    }
  };

  static createMissionTemplate = async (req: Request, res: Response, next: NextFunction) => {
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
      return res.status(201).json(successResponse({ data: { missionTemplate } }));
    } catch (error) {
      next(error);
    }
  };

  static updateMissionTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const missionTemplateId = Array.isArray(req.params.missionTemplateId)
      ? req.params.missionTemplateId[0]
      : req.params.missionTemplateId;
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
      return res.status(200).json(successResponse({ data: { missionTemplate } }));
    } catch (error) {
      next(error);
    }
  };

  // ── Comunidades (solo super admin, ver routes/admin.ts) ──

  static getCommunities = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { communities } = await AdminModel.getCommunities();
      return res.status(200).json(successResponse({ data: { communities } }));
    } catch (error) {
      next(error);
    }
  };

  static createCommunity = async (req: Request, res: Response, next: NextFunction) => {
    const { slug, name, mediaId, theme, domains } = req.body as PostAdminCommunityRequest["body"];
    if (!slug || !name) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { community } = await AdminModel.createCommunity({
        slug,
        name,
        mediaId,
        theme,
        domains,
      });
      return res.status(201).json(successResponse({ data: { community } }));
    } catch (error) {
      next(error);
    }
  };

  static updateCommunity = async (req: Request, res: Response, next: NextFunction) => {
    const { communityId } = req.params as PatchAdminCommunityRequest["params"];
    const { name, mediaId, theme, active } = req.body as PatchAdminCommunityRequest["body"];
    try {
      await validateId(communityId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const { community } = await AdminModel.updateCommunity({
        communityId,
        name,
        mediaId,
        theme,
        active,
      });
      return res.status(200).json(successResponse({ data: { community } }));
    } catch (error) {
      next(error);
    }
  };

  static addCommunityDomain = async (req: Request, res: Response, next: NextFunction) => {
    const { communityId } = req.params as PostAdminCommunityDomainRequest["params"];
    const { domain } = req.body as PostAdminCommunityDomainRequest["body"];
    if (!domain) {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await validateId(communityId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      const result = await AdminModel.addCommunityDomain({ communityId, domain });
      return res.status(201).json(successResponse({ data: { domain: result.domain } }));
    } catch (error) {
      next(error);
    }
  };

  static removeCommunityDomain = async (req: Request, res: Response, next: NextFunction) => {
    const { communityId, domainId } = req.params as DeleteAdminCommunityDomainRequest["params"];
    try {
      await validateId(communityId);
      await validateId(domainId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await AdminModel.removeCommunityDomain({ communityId, domainId });
      return res.status(200).json(successResponse({}));
    } catch (error) {
      next(error);
    }
  };

  // ── Invitaciones ──

  static createInvitation = async (req: Request, res: Response, next: NextFunction) => {
    const { communityId, note, expiresInDays } = req.body as PostAdminInvitationRequest["body"];
    try {
      const { invitation } = await AdminModel.createInvitation({
        // La comunidad de la invitación sale del admin, nunca del body de un community_admin.
        communityId: requireScopeCommunityId(req, communityId),
        adminId: requireAdminId(req),
        note,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      return res.status(201).json(successResponse({ data: { invitation } }));
    } catch (error) {
      next(error);
    }
  };

  static getInvitations = async (req: Request, res: Response, next: NextFunction) => {
    const { page, communityId } = req.query;
    try {
      const { invitations, pagination } = await AdminModel.getInvitations({
        communityId: adminScopeCommunityId(req, queryString(communityId)),
        page: page ? Number(page) : 1,
      });
      return res.status(200).json(successResponse({ data: { invitations }, pagination }));
    } catch (error) {
      next(error);
    }
  };

  static deleteInvitation = async (req: Request, res: Response, next: NextFunction) => {
    const { invitationId } = req.params as DeleteAdminInvitationRequest["params"];
    try {
      await validateId(invitationId);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await AdminModel.deleteInvitation({
        invitationId,
        communityId: adminScopeCommunityId(req, queryString(req.query.communityId)),
      });
      return res.status(200).json(successResponse({}));
    } catch (error) {
      next(error);
    }
  };
}
