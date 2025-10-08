import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_EXP, ADMIN_TOKEN_EXP } from "../config";
export const generateToken = ({ userId }: { userId: string }) => {
  const payload = { userId };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: (TOKEN_EXP as number) || "30d",
  });
  return token;
};
export const parseToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as {
      userId: string;
      isAdmin?: boolean;
    };
    return decoded;
  } catch {
    throw new Error("Invalid token");
  }
};
export const generateAdminToken = ({ id }: { id: string }) => {
  const payload = { userId: id, isAdmin: true };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: (ADMIN_TOKEN_EXP as number) || "30m",
  });
  return token;
};
