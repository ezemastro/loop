import jwt from "jsonwebtoken";
import { ADMIN_JWT_SECRET, ADMIN_TOKEN_EXP, JWT_SECRET, TOKEN_EXP } from "../config";

/**
 * Versión del payload. Los tokens `v1` (los emitidos antes de que existieran las comunidades) no
 * traen `communityId`; `tokenMiddleware` los resuelve contra la base y los reemite. Cuando ya no
 * queden tokens v1 vivos —30 días después del deploy, que es lo que dura un token— se puede
 * borrar esa rama de compatibilidad.
 */
export const TOKEN_VERSION = 2;

/** Algoritmo fijo en firma y verificación (SEC-02): sin esto un token con `alg: "none"` o
 * cualquier otro algoritmo alcanzaría a verificar si `jsonwebtoken` alguna vez cambiara su
 * default. */
const SIGN_ALGORITHM: jwt.Algorithm = "HS256";
const VERIFY_OPTIONS: jwt.VerifyOptions = { algorithms: [SIGN_ALGORITHM] };

export interface UserTokenPayload {
  v?: number;
  userId: string;
  communityId?: UUID;
}

/**
 * Payload de un token de administrador. Es un tipo **separado** de `UserTokenPayload` (SEC-02,
 * D2): antes ambos eran el mismo tipo con los campos de admin opcionales, así que un payload de
 * usuario type-checkeaba donde se esperaba uno de admin. Ahora no compila.
 */
export interface AdminTokenPayload {
  v?: number;
  adminId: string;
  isAdmin: true;
  adminRole: AdminRole;
  adminCommunityId: UUID | null;
}

export const generateToken = ({ userId, communityId }: { userId: string; communityId: UUID }) => {
  const payload: UserTokenPayload = { v: TOKEN_VERSION, userId, communityId };
  return jwt.sign(payload, JWT_SECRET, { algorithm: SIGN_ALGORITHM, expiresIn: TOKEN_EXP });
};

export const parseToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, VERIFY_OPTIONS) as unknown as UserTokenPayload;
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
  const payload: AdminTokenPayload = {
    v: TOKEN_VERSION,
    adminId: id,
    isAdmin: true,
    adminRole: role,
    adminCommunityId: communityId,
  };
  return jwt.sign(payload, ADMIN_JWT_SECRET, {
    algorithm: SIGN_ALGORITHM,
    expiresIn: ADMIN_TOKEN_EXP,
  });
};

export const parseAdminToken = (token: string): AdminTokenPayload => {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET, VERIFY_OPTIONS) as unknown as AdminTokenPayload;
  } catch {
    throw new Error("Invalid admin token");
  }
};
