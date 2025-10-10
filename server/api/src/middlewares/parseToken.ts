import type { NextFunction, Response, Request } from "express";
import { COOKIE_NAMES } from "../config";
import { parseToken } from "../services/jwt";

export const tokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies[COOKIE_NAMES.TOKEN];
  const adminToken = req.cookies[COOKIE_NAMES.ADMIN_TOKEN];
  if (!token && !adminToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    let decoded;
    if (token) {
      decoded = parseToken(token);
    }
    if (adminToken) {
      decoded = { ...decoded, ...parseToken(adminToken) };
    }

    req.session = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
