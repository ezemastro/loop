import { Router } from "express";
import { AdminController } from "../controllers/admin.js";
import { adminTokenMiddleware, requireSuperAdmin } from "../middlewares/parseAdminToken.js";

export const adminRouter = Router();

/**
 * Dos niveles de acceso:
 *
 * - `adminTokenMiddleware`: cualquier admin. Lo que ve queda scopeado a su comunidad, que sale
 *   del token (`adminScopeCommunityId`), nunca del body ni del query.
 * - `requireSuperAdmin`: además, solo el super admin. Se usa para lo que es global —los catálogos
 *   compartidos (categorías y misiones), las comunidades y mover un usuario de comunidad—, donde
 *   un admin de comunidad afectaría a todas.
 */

// Admin session (sin autenticación)
adminRouter.post("/login", AdminController.login);
adminRouter.post("/register", AdminController.register);
adminRouter.post("/google-login", AdminController.googleLogin);
// Agregar nuevo email autorizado para registro de admin (solo un super admin puede autorizar
// otro super admin; el resto queda atado a la comunidad de quien autoriza)
adminRouter.post(
  "/authorize-email",
  adminTokenMiddleware,
  AdminController.addValidEmailForRegistration,
);

// Gestión de usuarios (requiere autenticación de admin)
adminRouter.get("/users", adminTokenMiddleware, AdminController.getUsers);
adminRouter.post("/users/:userId/credits", adminTokenMiddleware, AdminController.modifyUserCredits);
adminRouter.post(
  "/users/:userId/reset-password",
  adminTokenMiddleware,
  AdminController.resetUserPassword,
);
// Cambiar a un usuario de comunidad cruza la frontera de aislamiento: solo super admin.
adminRouter.post(
  "/users/:userId/community",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.moveUserToCommunity,
);

// Gestión de escuelas
adminRouter.post("/schools", adminTokenMiddleware, AdminController.createSchool);

adminRouter.patch("/schools/:schoolId", adminTokenMiddleware, AdminController.updateSchool);

// Gestión de categorías — catálogo compartido entre comunidades: editarlo cambia los precios de
// todas, así que es solo super admin.
adminRouter.post(
  "/categories",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.createCategory,
);
adminRouter.patch(
  "/categories/:categoryId",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.updateCategory,
);

// Gestión de notificaciones
adminRouter.post("/notifications", adminTokenMiddleware, AdminController.sendNotification);

// Estadísticas
adminRouter.get("/stats", adminTokenMiddleware, AdminController.getStats);
adminRouter.get("/schools/stats", adminTokenMiddleware, AdminController.getSchoolStats);

// Gestión de mission templates — catálogo compartido, igual que las categorías. Además, crear una
// misión la asigna a los usuarios de todas las comunidades.
adminRouter.get(
  "/missions",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.getMissionTemplates,
);
adminRouter.post(
  "/missions",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.createMissionTemplate,
);
adminRouter.patch(
  "/missions/:missionTemplateId",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.updateMissionTemplate,
);

// Gestión de comunidades (solo super admin)
adminRouter.get(
  "/communities",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.getCommunities,
);
adminRouter.post(
  "/communities",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.createCommunity,
);
adminRouter.patch(
  "/communities/:communityId",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.updateCommunity,
);
adminRouter.post(
  "/communities/:communityId/domains",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.addCommunityDomain,
);
adminRouter.delete(
  "/communities/:communityId/domains/:domainId",
  adminTokenMiddleware,
  requireSuperAdmin,
  AdminController.removeCommunityDomain,
);

// Invitaciones (scopeadas a la comunidad del admin)
adminRouter.get("/invitations", adminTokenMiddleware, AdminController.getInvitations);
adminRouter.post("/invitations", adminTokenMiddleware, AdminController.createInvitation);
adminRouter.delete(
  "/invitations/:invitationId",
  adminTokenMiddleware,
  AdminController.deleteInvitation,
);
