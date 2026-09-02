/**
 * Pruebas puras del schema de entorno (SEC-01, D1). No tocan `process.env` global ni el módulo
 * singleton `env.ts` importa — parsean objetos sintéticos directamente contra las funciones
 * exportadas, así no hay orden de módulos ni caché que gestionar.
 */
import { validateProductionEnv } from "../env";

const completeProdEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  JWT_SECRET: "a-real-production-secret-value",
  ADMIN_JWT_SECRET: "another-real-secret-value",
  ADMIN_PASS_TOKEN: "yet-another-real-secret",
  DB_APP_PASSWORD: "real-db-app-password",
  DB_UNSCOPED_PASSWORD: "real-db-unscoped-password",
  FRONTEND_URL: "https://app.loop.example",
  ADMIN_FRONTEND_URL: "https://admin.loop.example",
  WEB_GOOGLE_CLIENT_ID: "real-web-client-id",
  ADMIN_GOOGLE_CLIENT_ID: "real-admin-client-id",
};

describe("env / validateProductionEnv", () => {
  it("succeeds when every required production variable is present", () => {
    expect(() => validateProductionEnv(completeProdEnv)).not.toThrow();
  });

  it("throws naming every missing required variable at once", () => {
    const incomplete = { ...completeProdEnv };
    delete incomplete.JWT_SECRET;
    delete incomplete.FRONTEND_URL;
    delete incomplete.ADMIN_PASS_TOKEN;

    try {
      validateProductionEnv(incomplete);
      throw new Error("expected validateProductionEnv to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("JWT_SECRET");
      expect(message).toContain("FRONTEND_URL");
      expect(message).toContain("ADMIN_PASS_TOKEN");
    }
  });

  it("throws when a required secret equals the schema's own development sentinel", () => {
    const withSentinel = { ...completeProdEnv, JWT_SECRET: "jwt_secret_dev_only" };
    expect(() => validateProductionEnv(withSentinel)).toThrow(/JWT_SECRET/);
  });

  it("rejects RATE_LIMIT_ENABLED=false in production", () => {
    const disabled = { ...completeProdEnv, RATE_LIMIT_ENABLED: "false" };
    expect(() => validateProductionEnv(disabled)).toThrow(/RATE_LIMIT_ENABLED/);
  });

  it("rejects an out-of-range PORT", () => {
    const badPort = { ...completeProdEnv, PORT: "70000" };
    expect(() => validateProductionEnv(badPort)).toThrow(/PORT/);
  });

  it("rejects a non-numeric PORT", () => {
    const badPort = { ...completeProdEnv, PORT: "not-a-number" };
    expect(() => validateProductionEnv(badPort)).toThrow(/PORT/);
  });
});

describe("env / permissive parsing (development)", () => {
  it("succeeds with no environment variables set at all", async () => {
    // El módulo real (`env.ts`) parsea `process.env` en su nivel superior, así que para probar la
    // rama permisiva sin tocar el entorno global del proceso de test se importa dinámicamente
    // dentro de un `jest.isolateModulesAsync`-like pattern: se limpia `NODE_ENV` y se re-requiere.
    jest.resetModules();
    const originalEnv = process.env;
    process.env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    try {
      const mod = await import("../env");
      expect(mod.env.NODE_ENV).toBe("development");
      expect(mod.env.JWT_SECRET).toBe("jwt_secret_dev_only");
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });

  it("coerces a string TOKEN_EXP to the equivalent number, not milliseconds", async () => {
    jest.resetModules();
    const originalEnv = process.env;
    process.env = {
      NODE_ENV: "development",
      TOKEN_EXP: "2592000",
    } as NodeJS.ProcessEnv;
    try {
      const mod = await import("../env");
      expect(mod.env.TOKEN_EXP).toBe(2592000);
      expect(typeof mod.env.TOKEN_EXP).toBe("number");
    } finally {
      process.env = originalEnv;
      jest.resetModules();
    }
  });
});
