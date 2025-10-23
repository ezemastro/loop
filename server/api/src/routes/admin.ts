import { Router } from "express";
import { AdminController } from "../controllers/admin";
import { adminTokenMiddleware } from "../middlewares/parseAdminToken";

export const adminRouter = Router();

// Admin session (sin autenticación)
adminRouter.post("/login", AdminController.login);
adminRouter.post("/register", AdminController.register);

// Gestión de usuarios (requiere autenticación de admin)
adminRouter.get("/users", adminTokenMiddleware, AdminController.getUsers);
adminRouter.post(
  "/users/:userId/credits",
  adminTokenMiddleware,
  AdminController.modifyUserCredits,
);

// Gestión de escuelas
adminRouter.post(
  "/schools",
  adminTokenMiddleware,
  AdminController.createSchool,
);

// Gestión de categorías
adminRouter.post(
  "/categories",
  adminTokenMiddleware,
  AdminController.createCategory,
);
adminRouter.patch(
  "/categories/:categoryId",
  adminTokenMiddleware,
  AdminController.updateCategory,
);

// Gestión de notificaciones
adminRouter.post(
  "/notifications",
  adminTokenMiddleware,
  AdminController.sendNotification,
);

// Estadísticas
adminRouter.get("/stats", adminTokenMiddleware, AdminController.getStats);
adminRouter.get(
  "/schools/stats",
  adminTokenMiddleware,
  AdminController.getSchoolStats,
);

// Gestión de mission templates
adminRouter.post(
  "/missions",
  adminTokenMiddleware,
  AdminController.createMissionTemplate,
);
adminRouter.patch(
  "/missions/:missionTemplateId",
  adminTokenMiddleware,
  AdminController.updateMissionTemplate,
);
