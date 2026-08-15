import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAMES, cookieOptions } from "../config.js";
import { generateToken, parseToken, type UserTokenPayload } from "../services/jwt.js";
import { unscoped, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";

const getBearerToken = (authorization?: string | string[]) => {
  if (!authorization || Array.isArray(authorization)) return null;
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length ? token : null;
};

/**
 * Caché de `userId → communityId` para los tokens viejos.
 *
 * Solo se usa en la rama de compatibilidad: sin ella, cada request con un token v1 pagaría una
 * consulta extra. Se puede borrar junto con esa rama.
 */
const LEGACY_CACHE_TTL_MS = 5 * 60 * 1000;
const LEGACY_CACHE_MAX = 10_000;
const legacyCommunityCache = new Map<string, { communityId: UUID; expiresAt: number }>();

const resolveUserCommunity = async (userId: string): Promise<UUID | null> => {
  const cached = legacyCommunityCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.communityId;

  const communityId = await withClient(
    async (client) => {
      const [row] = await client.query(queries.userCommunityById, [userId]);
      return row?.community_id ?? null;
    },
    { scope: unscoped("auth:lookup-user") },
  );

  if (communityId) {
    // Poda barata: si creció demasiado se vacía entera en vez de llevar un LRU.
    if (legacyCommunityCache.size >= LEGACY_CACHE_MAX) legacyCommunityCache.clear();
    legacyCommunityCache.set(userId, {
      communityId,
      expiresAt: Date.now() + LEGACY_CACHE_TTL_MS,
    });
  }
  return communityId;
};

export const tokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const bearerToken = getBearerToken(req.headers.authorization);
  const token = req.cookies[COOKIE_NAMES.TOKEN] || bearerToken;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let decoded: UserTokenPayload;
  try {
    decoded = parseToken(token);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!decoded.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Compatibilidad con los tokens emitidos antes de que existieran las comunidades. Duran 30 días,
  // así que esta rama tiene que vivir al menos ese tiempo después del deploy; el claim `v` del
  // payload permite saber cuándo ya no queda ninguno y se puede borrar.
  if (!decoded.communityId) {
    let communityId: UUID | null = null;
    try {
      communityId = await resolveUserCommunity(decoded.userId);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!communityId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    decoded.communityId = communityId;

    // Se reemite el token al vuelo para que el usuario no tenga que volver a loguearse. La web usa
    // la cookie; el cliente de Expo manda Bearer, y levanta el header en su interceptor.
    const refreshed = generateToken({ userId: decoded.userId, communityId });
    res.cookie(COOKIE_NAMES.TOKEN, refreshed, cookieOptions);
    res.setHeader("X-Refreshed-Token", refreshed);
  }

  // Deliberadamente NO se mezcla el payload del token de admin, como hacía antes: una cookie de
  // admin colgada podía inyectar `isAdmin` —y ahora también una comunidad— dentro de la sesión de
  // un usuario común. El token de admin se lee solo en `adminTokenMiddleware`.
  req.session = {
    userId: decoded.userId,
    communityId: decoded.communityId,
  };
  next();
};

/**
 * Igual que `tokenMiddleware` pero sin exigir sesión: deja `req.session` armado si hay token
 * válido, y sigue de largo si no.
 *
 * Lo usa `GET /schools`, que tiene que atender tanto a la pantalla de registro (sin sesión) como a
 * un usuario logueado — y en ese segundo caso la comunidad de la sesión tiene que ganarle a
 * cualquier cosa que venga por query.
 */
export const optionalTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const bearerToken = getBearerToken(req.headers.authorization);
  const token = req.cookies[COOKIE_NAMES.TOKEN] || bearerToken;
  if (!token) return next();

  try {
    const decoded = parseToken(token);
    if (!decoded.userId) return next();

    const communityId = decoded.communityId ?? (await resolveUserCommunity(decoded.userId));
    if (!communityId) return next();

    req.session = { userId: decoded.userId, communityId };
  } catch {
    // Token inválido o vencido: se atiende el request como anónimo.
  }
  next();
};
