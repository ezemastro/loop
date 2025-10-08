import "express";

declare global {
  namespace Express {
    interface Request {
      cookies: {
        [key: string]: string;
      };
      session?: {
        userId: string;
        isAdmin?: boolean;
      };
    }
  }
}
