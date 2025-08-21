import type { NextFunction, Response, Request } from "express";
import { COOKIE_NAMES } from "../config";
import { parseToken } from "../services/jwt";

export const tokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies[COOKIE_NAMES.TOKEN];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = parseToken(token);
    req.session = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
