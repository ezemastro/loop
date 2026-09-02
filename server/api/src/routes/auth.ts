import { Router } from "express";
import { AuthController } from "../controllers/auth.js";
import {
  forgotPasswordLimiter,
  googleLoginLimiter,
  loginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
} from "../middlewares/rateLimit.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, AuthController.register);
authRouter.post("/login", loginLimiter, AuthController.login);
authRouter.post("/google-login", googleLoginLimiter, AuthController.googleLogin);
// Público a propósito: se consulta desde la pantalla de registro, antes de que exista sesión.
authRouter.get("/invitations/:token", AuthController.getInvitation);
// El link del mail de verificación cae acá, sin sesión: el token ES la credencial.
authRouter.get("/verify-email", AuthController.verifyEmail);
// Reenvío del mail de verificación: quien no puede loguear tampoco tiene sesión para pedirlo.
authRouter.post(
  "/resend-verification",
  resendVerificationLimiter,
  AuthController.resendVerification,
);

// SEC-11: reseteo de contraseña por email. Públicas por construcción — quien las llama todavía no
// tiene sesión. Rate limiters agregados por `sec-hardening-api` (D3) atendiendo el hand-off de
// arriba: `forgot-password` es un vector de email-bombing (el envío es fire-and-forget) y
// `reset-password` hashea con bcrypt en cada llamada.
authRouter.post("/forgot-password", forgotPasswordLimiter, AuthController.forgotPassword);
authRouter.post("/reset-password", resetPasswordLimiter, AuthController.resetPassword);
