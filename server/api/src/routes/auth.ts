import { Router } from "express";
import { AuthController } from "../controllers/auth.js";

export const authRouter = Router();

authRouter.post("/register", AuthController.register);
authRouter.post("/login", AuthController.login);
authRouter.post("/google-login", AuthController.googleLogin);
// Público a propósito: se consulta desde la pantalla de registro, antes de que exista sesión.
authRouter.get("/invitations/:token", AuthController.getInvitation);
