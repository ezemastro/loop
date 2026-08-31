/**
 * Identidad de la sesión demo.
 *
 * Los IDs de las entidades del seed ya vienen resueltos desde `shared/demo-data`; acá queda solo
 * lo que es propio de una sesión simulada: el token y los IDs de lo que se crea en runtime.
 */

/** Token demo: lleva el id del usuario para que los handlers sepan quién está logueado. */
export const DEMO_TOKEN_PREFIX = "demo-token";

export const demoTokenFor = (userId: UUID) => `${userId}:${DEMO_TOKEN_PREFIX}`;

export const userIdFromToken = (token: string | null): UUID | null => {
  if (!token) return null;
  const [userId] = token.split(":");
  return userId || null;
};

/** UUID v4 aleatoria para entidades creadas en runtime (listings, mensajes, etc.). */
export const newUuid = (): UUID => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
