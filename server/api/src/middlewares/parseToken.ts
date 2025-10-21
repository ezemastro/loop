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
  console.log({ adminToken });
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
    console.log({ decoded });

    req.session = decoded;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};
