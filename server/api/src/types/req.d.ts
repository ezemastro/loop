import "express";

declare global {
  namespace Express {
    interface Request {
      cookies: {
        [key: string]: string;
      };
      session?: {
        userId: string;
        /**
         * Comunidad del usuario de la sesión. Es el scope con el que se abren todas las conexiones
         * a la base para este request.
         *
         * Los tokens emitidos antes de esta versión no la traen; `tokenMiddleware` la resuelve
         * contra la base y reemite el token.
         */
        communityId?: UUID;
        isAdmin?: boolean;
        adminId?: string;
        adminRole?: AdminRole;
        /**
         * Comunidad del admin. Va en una clave distinta de `communityId` a propósito: el
         * middleware histórico mezclaba los payloads del token de usuario y el de admin, así que
         * una sola clave dejaría que una cookie de admin pisara el scope del usuario.
         *
         * `null` ⇔ super admin (ve todas las comunidades).
         */
        adminCommunityId?: UUID | null;
      };
    }
  }
}
