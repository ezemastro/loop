import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_EXP } from "../config";
export const generateToken = ({ userId }: { userId: string }) => {
  const payload = { userId };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: (TOKEN_EXP as jwt.SignOptions["expiresIn"]) || "30d",
  });
  return token;
};
export const parseToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as {
      userId: string;
    };
    return decoded;
  } catch {
    throw new Error("Invalid token");
  }
};
