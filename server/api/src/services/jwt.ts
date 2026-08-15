import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_EXP, ADMIN_TOKEN_EXP } from "../config";

/**
 * Versión del payload. Los tokens `v1` (los emitidos antes de que existieran las comunidades) no
 * traen `communityId`; `tokenMiddleware` los resuelve contra la base y los reemite. Cuando ya no
 * queden tokens v1 vivos —30 días después del deploy, que es lo que dura un token— se puede
 * borrar esa rama de compatibilidad.
 */
export const TOKEN_VERSION = 2;

export interface UserTokenPayload {
  v?: number;
  userId: string;
  communityId?: UUID;
  isAdmin?: boolean;
  adminId?: string;
  adminRole?: AdminRole;
  adminCommunityId?: UUID | null;
}

export const generateToken = ({
  userId,
  communityId,
}: {
  userId: string;
  communityId: UUID;
}) => {
  const payload = { v: TOKEN_VERSION, userId, communityId };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: (TOKEN_EXP as number) || "30d",
  });
  return token;
};

export const parseToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET as string) as UserTokenPayload;
  } catch {
    throw new Error("Invalid token");
  }
};

export const generateAdminToken = ({
  id,
  role,
  communityId,
}: {
  id: string;
  role: AdminRole;
  communityId: UUID | null;
}) => {
  const payload = {
    v: TOKEN_VERSION,
    adminId: id,
    isAdmin: true,
    adminRole: role,
    adminCommunityId: communityId,
  };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: (ADMIN_TOKEN_EXP as number) || "30m",
  });
  return token;
};
