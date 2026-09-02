import type { NextFunction, Request, Response } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RATE_LIMIT_ENABLED } from "../config.js";

/**
 * Limita la tasa de requests en los endpoints abusables (SEC-03, D3): login, registro, reenvío de
 * verificación, Google sign-in, borrado de cuenta y mensajes.
 *
 * No puede gatearse por `NODE_ENV` (D3): el stack de e2e corre la API como `development`
 * (`docker-compose.e2e.yml`), no `test`, y emite cientos de requests desde una sola IP de
 * contenedor. `RATE_LIMIT_ENABLED` es la variable explícita para eso — `env.ts` la rechaza en
 * `false` cuando `NODE_ENV=production` (D1), así que no sirve para apagar la protección en un
 * deploy real.
 */

type KeySource = (req: Request) => string;

/** Clave adicional a partir del email del body. Vacía si no viene: el rate limit igual aplica por IP. */
const byEmail: KeySource = (req) => {
  const email = req.body?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

/** Clave adicional a partir del usuario autenticado (lo fija `tokenMiddleware`, que corre antes). */
const bySessionUserId: KeySource = (req) => req.session?.userId ?? "";

export const makeLimiter = ({
  windowMs,
  max,
  name,
  keySource,
}: {
  windowMs: number;
  max: number;
  name: string;
  keySource?: KeySource;
}) => {
  if (!RATE_LIMIT_ENABLED) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // IP + un discriminador por cuenta: solo IP se evade con un botnet, solo email deja que
    // cualquiera bloquee a una víctima ajena adivinando su dirección.
    keyGenerator: (req) => {
      const ipKey = ipKeyGenerator(req.ip ?? "unknown");
      const extra = keySource ? keySource(req) : "";
      return `${name}:${ipKey}:${extra}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: "Demasiados intentos. Probá de nuevo en unos minutos.",
        errorCode: "RATE_LIMITED",
      });
    },
  });
};

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: "login",
  keySource: byEmail,
});
// Gasta cuota de un tercero (Resend): límite más estricto que el resto (D3).
export const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "register",
});
export const resendVerificationLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  name: "resend-verification",
  keySource: byEmail,
});
export const googleLoginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: "google-login",
});
export const adminLoginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: "admin-login",
  keySource: byEmail,
});
export const adminRegisterLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: "admin-register",
  keySource: byEmail,
});
export const deleteRequestLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  name: "delete-request",
  keySource: byEmail,
});
export const messageLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
  name: "messages",
  keySource: bySessionUserId,
});

// Hand-off del cambio `legal-public-routes` (SEC-11, ver `routes/auth.ts`): estas dos rutas nacen
// sin rate limit y el propio TODO que dejaron pide uno antes de producción. `forgot-password`
// manda mail (mismo perfil de abuso que `resend-verification`); `reset-password` hashea con
// bcrypt en cada llamada y el token es la única credencial, así que también se limita por IP.
export const forgotPasswordLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  name: "forgot-password",
  keySource: byEmail,
});
export const resetPasswordLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: "reset-password",
});
