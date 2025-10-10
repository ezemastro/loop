import type { NextFunction, Response, Request } from "express";
import { COOKIE_NAMES } from "../config";
import { parseToken } from "../services/jwt";

export const adminTokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies[COOKIE_NAMES.ADMIN_TOKEN];
  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized - Admin access required" });
  }
  try {
    const decoded = parseToken(token);
    // Verificar que el token es de admin
    if (!decoded.isAdmin) {
      return res
        .status(403)
        .json({ error: "Forbidden - Admin access required" });
    }
    req.session = decoded;
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Unauthorized - Invalid admin token" });
  }
};
