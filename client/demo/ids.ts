/** IDs fijos para las entidades del seed: estables entre renders y sesiones. */
export const IDS = {
  COMMUNITY: "00000000-0000-4000-8000-000000000001",

  SCHOOL_PRIMARY: "00000000-0000-4000-8000-000000000101",
  SCHOOL_SECONDARY: "00000000-0000-4000-8000-000000000102",
  SCHOOL_TECHNICAL: "00000000-0000-4000-8000-000000000103",

  USER_DEMO: "00000000-0000-4000-8000-000000000201",
  USER_CARLOS: "00000000-0000-4000-8000-000000000202",
  USER_LUCIA: "00000000-0000-4000-8000-000000000203",
  USER_MARTIN: "00000000-0000-4000-8000-000000000204",
  USER_SOFIA: "00000000-0000-4000-8000-000000000205",
  USER_JULIAN: "00000000-0000-4000-8000-000000000206",
} as const;

/** Token demo: lleva el id del usuario para que los handlers sepan quién está logueado. */
export const DEMO_TOKEN_PREFIX = "demo-token";

export const demoTokenFor = (userId: UUID) => `${userId}:${DEMO_TOKEN_PREFIX}`;

export const userIdFromToken = (token: string | null): UUID | null => {
  if (!token) return null;
  const [userId] = token.split(":");
  return userId || null;
};

/** UUID v4 determinista a partir de un string, sin depender de crypto nativo. */
export const uuidFromSeed = (seed: string): UUID => {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const chars = [...seed];
  const bytes = new Array(16).fill(0).map((_, i) => {
    let h = 0;
    for (const c of chars) h = (h * 31 + c.charCodeAt(0)) % 251;
    return (h + i * 37) % 256;
  });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const b = bytes.map(hex).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
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
