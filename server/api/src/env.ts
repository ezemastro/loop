import { z } from "zod";

/**
 * Contrato de entorno de arranque (SEC-01, INF-11).
 *
 * Dos schemas comparten la misma forma:
 *
 * - `permissiveSchema`: todas las variables tienen un default seguro (marcado como "de
 *   desarrollo" cuando corresponde). Nunca lanza. Es lo único que usan `config.ts` y, a través de
 *   él, `scripts/migrate.ts` / `scripts/seed.ts` — que legítimamente corren con otro juego de
 *   variables y no deben abortar solo por importar `config.ts`.
 * - `strictSchema`: exige los nueve secretos/URLs de producción sin default y rechaza los
 *   valores centinela de desarrollo. Solo lo llama `assertProductionEnv()`, que el entrypoint de
 *   la API (`index.ts`) invoca de forma síncrona antes de `app.listen`. Mantenerlo separado de
 *   `config.ts` es deliberado: así el chequeo de producción vive en el entrypoint, no como efecto
 *   secundario de importar la configuración (ver tasks.md 1.1/1.8).
 */

const DEV_SENTINELS = {
  JWT_SECRET: "jwt_secret_dev_only",
  ADMIN_JWT_SECRET: "admin_jwt_secret_dev_only",
  ADMIN_PASS_TOKEN: "admin_pass_token_dev_only",
  DB_APP_PASSWORD: "loop_app_dev",
  DB_UNSCOPED_PASSWORD: "loop_unscoped_dev",
  WEB_GOOGLE_CLIENT_ID: "web-google-client-id-dev",
  ADMIN_GOOGLE_CLIENT_ID: "admin-google-client-id-dev",
} as const;

type Tier1Key = keyof typeof DEV_SENTINELS;
const TIER1_KEYS = Object.keys(DEV_SENTINELS) as Tier1Key[];

const baseShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  TOKEN_EXP: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60), // 30 días, en segundos
  ADMIN_TOKEN_EXP: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60), // 30 minutos, en segundos

  JWT_SECRET: z.string().min(1).default(DEV_SENTINELS.JWT_SECRET),
  ADMIN_JWT_SECRET: z.string().min(1).default(DEV_SENTINELS.ADMIN_JWT_SECRET),
  ADMIN_PASS_TOKEN: z.string().min(1).default(DEV_SENTINELS.ADMIN_PASS_TOKEN),
  DB_APP_PASSWORD: z.string().min(1).default(DEV_SENTINELS.DB_APP_PASSWORD),
  DB_UNSCOPED_PASSWORD: z.string().min(1).default(DEV_SENTINELS.DB_UNSCOPED_PASSWORD),
  FRONTEND_URL: z.url().default("http://localhost:8081"),
  ADMIN_FRONTEND_URL: z.url().default("http://localhost:5173"),
  WEB_GOOGLE_CLIENT_ID: z.string().min(1).default(DEV_SENTINELS.WEB_GOOGLE_CLIENT_ID),
  ADMIN_GOOGLE_CLIENT_ID: z.string().min(1).default(DEV_SENTINELS.ADMIN_GOOGLE_CLIENT_ID),

  // Sin default: solo tienen valor en el mundo real. `googleOauth.ts` los filtra con `.filter(Boolean)`.
  ANDROID_GOOGLE_CLIENT_ID: z.string().optional(),
  IOS_GOOGLE_CLIENT_ID: z.string().optional(),

  // `z.enum` y no `z.coerce.boolean()`: `Boolean("false")` da `true`, así que un typo tiene que
  // fallar fuerte, nunca habilitar en silencio.
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Sin default acá: el default real depende de NODE_ENV y se resuelve en config.ts, porque un
  // solo campo de este objeto no puede leer el valor ya resuelto de otro campo hermano.
  EMAIL_DEBUG_LINKS: z.enum(["true", "false"]).optional(),

  PGHOST: z.string().default("db"),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  DB_APP_USER: z.string().default("loop_app"),
  DB_UNSCOPED_USER: z.string().default("loop_app_unscoped"),
  UPLOAD_DIR: z.string().default("/uploads"),
  BASE_URL: z.string().default("http://localhost:3000"),
  APP_BASE_URL: z.string().optional(),
  AUTHORIZED_ADMIN_EMAIL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).optional(),
  SALT_ROUNDS: z.string().optional(),
};

const permissiveSchema = z.object(baseShape);

export type Env = z.infer<typeof permissiveSchema>;

interface ParsedEnv {
  env: Env;
  /** Variables tier-1 que cayeron al default de desarrollo (para el warning). */
  defaultedTier1: Tier1Key[];
  defaultedFrontendUrl: boolean;
  defaultedAdminFrontendUrl: boolean;
}

const parsePermissive = (raw: NodeJS.ProcessEnv): ParsedEnv => {
  const result = permissiveSchema.safeParse(raw);
  if (!result.success) {
    // Ningún campo de este schema es requerido: solo puede fallar por un valor mal tipado (por
    // ejemplo `PORT=no-es-un-numero`). Ahí no hay default seguro que inventar, a diferencia de un
    // secreto ausente.
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`[env] Configuración inválida:\n${lines.join("\n")}`);
  }
  return {
    env: result.data,
    defaultedTier1: TIER1_KEYS.filter((key) => !raw[key]),
    defaultedFrontendUrl: !raw.FRONTEND_URL,
    defaultedAdminFrontendUrl: !raw.ADMIN_FRONTEND_URL,
  };
};

const strictSchema = z
  .object({
    ...baseShape,
    JWT_SECRET: z.string().min(1),
    ADMIN_JWT_SECRET: z.string().min(1),
    ADMIN_PASS_TOKEN: z.string().min(1),
    DB_APP_PASSWORD: z.string().min(1),
    DB_UNSCOPED_PASSWORD: z.string().min(1),
    FRONTEND_URL: z.url(),
    ADMIN_FRONTEND_URL: z.url(),
    WEB_GOOGLE_CLIENT_ID: z.string().min(1),
    ADMIN_GOOGLE_CLIENT_ID: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    // Un deploy de producción que literalmente copió el valor de desarrollo se trata como si no
    // estuviera seteado: es lo que hace que la clase de defecto de `jwt_secret_dev` no se pueda
    // repetir con otro nombre.
    for (const [key, sentinel] of Object.entries(DEV_SENTINELS)) {
      if (data[key as Tier1Key] === sentinel) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `no puede usarse el valor de desarrollo ("${sentinel}") en producción`,
        });
      }
    }
    if (data.RATE_LIMIT_ENABLED === false) {
      ctx.addIssue({
        code: "custom",
        path: ["RATE_LIMIT_ENABLED"],
        message: "no puede deshabilitarse el rate limiting en producción",
      });
    }
  });

/**
 * Chequeo estricto de producción. Lanza con **todas** las variables faltantes o inválidas a la
 * vez, en vez de una por reinicio (D1). Puro — no toca `process` ni loguea — así se puede probar
 * con un objeto sintético.
 */
export const validateProductionEnv = (raw: NodeJS.ProcessEnv): void => {
  const result = strictSchema.safeParse(raw);
  if (result.success) return;
  const lines = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  throw new Error(`[env] Configuración inválida para NODE_ENV=production:\n${lines.join("\n")}`);
};

const {
  env: parsedEnv,
  defaultedTier1,
  defaultedFrontendUrl,
  defaultedAdminFrontendUrl,
} = parsePermissive(process.env);

if (process.env.NODE_ENV !== "production") {
  for (const key of defaultedTier1) {
    console.warn(`[env] ${key} no está seteada: usando el valor de desarrollo por defecto.`);
  }
  if (defaultedFrontendUrl) {
    console.warn("[env] FRONTEND_URL no está seteada: usando el valor de desarrollo por defecto.");
  }
  if (defaultedAdminFrontendUrl) {
    console.warn(
      "[env] ADMIN_FRONTEND_URL no está seteada: usando el valor de desarrollo por defecto.",
    );
  }
}

export const env = parsedEnv;

/**
 * Debe llamarse de forma síncrona, antes de `app.listen` (D1, C11: `assertDbHardening()` corría
 * fire-and-forget; esto es lo mismo para el schema de entorno). Fuera de producción no hace nada:
 * la permisividad ya la garantiza `env`.
 */
export const assertProductionEnv = (): void => {
  if (env.NODE_ENV !== "production") return;
  try {
    validateProductionEnv(process.env);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
};
