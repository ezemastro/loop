import type { Request, Response, NextFunction } from "express";

export const trimBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
};
