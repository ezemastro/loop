import { Router } from "express";
import { AuthController } from "../controllers/auth.js";
import type { AuthModelInstance } from "../types/models.js";

export const createAuthRouter = ({
  authModel,
}: {
  authModel: AuthModelInstance;
}) => {
  const authRouter = Router();
  const authController = new AuthController({ authModel });

  authRouter.post("/register", authController.register);

  return authRouter;
};
