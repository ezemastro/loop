import type { NextFunction, Response, Request } from "express";
import { COOKIE_NAMES, ERROR_MESSAGES } from "../config.js";
import { parseToken } from "../services/jwt.js";
import { InvalidInputError, UnauthorizedError } from "../services/errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const adminTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies[COOKIE_NAMES.ADMIN_TOKEN];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized - Admin access required" });
  }
  try {
    const decoded = parseToken(token);
    // Verificar que el token es de admin
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    // Un token de admin sin rol es de antes de las comunidades. No se le puede inferir un rol:
    // asumir `community_admin` sin comunidad lo dejaría con el scope de un super admin, que es
    // exactamente lo contrario de lo seguro. Se lo trata como vencido — el token de admin dura 30
    // minutos, así que la ventana de re-login es despreciable.
    const isRoleUsable =
      decoded.adminRole === "super_admin" ||
      (decoded.adminRole === "community_admin" && !!decoded.adminCommunityId);
    if (!isRoleUsable) {
      return res.status(401).json({ error: "Unauthorized - Invalid admin token" });
    }

    req.session = {
      ...decoded,
      adminRole: decoded.adminRole,
      // Invariante que sostiene todo el scopeo: super admin ⇔ sin comunidad.
      adminCommunityId: decoded.adminRole === "super_admin" ? null : decoded.adminCommunityId!,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized - Invalid admin token" });
  }
};

/** Corta las rutas que tocan recursos globales (catálogos compartidos, comunidades). */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.adminRole !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: ERROR_MESSAGES.SUPER_ADMIN_REQUIRED,
      errorCode: "SUPER_ADMIN_REQUIRED",
    });
  }
  next();
};

/**
 * Comunidad con la que consultar la base para este admin.
 * - community_admin → su comunidad, siempre, ignorando lo que pida.
 * - super_admin     → lo que pida por query, o null (= todas).
 *
 * Que la comunidad efectiva salga del token y nunca del body es lo único que impide que un admin
 * de comunidad opere sobre otra: las queries de admin corren con la conexión unscoped, así que
 * este valor es el filtro.
 */
export const adminScopeCommunityId = (req: Request, requested?: UUID | null): UUID | null => {
  const session = req.session;
  if (session?.adminRole === "super_admin") {
    if (requested === undefined || requested === null || requested === "") return null;
    if (!UUID_RE.test(requested)) throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    return requested;
  }
  // Un community_admin sin comunidad no debería existir (lo garantizan el middleware de arriba y
  // un CHECK en la base). Si aparece, es preferible fallar que caer al scope global.
  if (!session?.adminCommunityId) {
    throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
  }
  return session.adminCommunityId;
};
