import { Router } from "express";
import { AuthController } from "../controllers/auth.js";
import type { AuthModel } from "../types/models.js";

export const createAuthRouter = ({ authModel }: { authModel: AuthModel }) => {
  const authRouter = Router();
  const authController = new AuthController({ authModel });

  authRouter.post("/register", authController.register);
  authRouter.post("/login", authController.login);

  return authRouter;
};
