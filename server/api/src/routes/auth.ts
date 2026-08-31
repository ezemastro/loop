import { Router } from "express";
import { AuthController } from "../controllers/auth.js";

export const authRouter = Router();

authRouter.post("/register", AuthController.register);
authRouter.post("/login", AuthController.login);
authRouter.post("/google-login", AuthController.googleLogin);
// Público a propósito: se consulta desde la pantalla de registro, antes de que exista sesión.
authRouter.get("/invitations/:token", AuthController.getInvitation);
// El link del mail de verificación cae acá, sin sesión: el token ES la credencial.
authRouter.get("/verify-email", AuthController.verifyEmail);
// Reenvío del mail de verificación: quien no puede loguear tampoco tiene sesión para pedirlo.
authRouter.post("/resend-verification", AuthController.resendVerification);
