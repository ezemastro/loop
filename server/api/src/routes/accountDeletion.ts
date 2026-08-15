import { Router } from "express";
import { AccountDeletionController } from "../controllers/accountDeletion.js";
import { adminTokenMiddleware } from "../middlewares/parseAdminToken.js";

/**
 * Va en su propio router —y no dentro de `routes/admin.ts`— porque el borrado de cuenta es un
 * flujo completo en sí mismo: tiene una punta pública (la landing) y una punta de administración,
 * y conviene poder leerlas juntas.
 */
export const accountDeletionAdminRouter = Router();

accountDeletionAdminRouter.get(
  "/",
  adminTokenMiddleware,
  AccountDeletionController.listRequests,
);
accountDeletionAdminRouter.post(
  "/:requestId/resolve",
  adminTokenMiddleware,
  AccountDeletionController.resolveRequest,
);
