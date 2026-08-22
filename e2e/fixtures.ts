import { test as base, expect, type APIRequestContext } from "@playwright/test";
import type { Pool } from "pg";
import { ENV } from "./helpers/config";
import { db } from "./helpers/db";

/**
 * Fixtures base de los E2E de Loop.
 *
 * - `api`: contexto de request apuntando a la API real (sin headers por defecto; cada helper
 *   recibe el token explícitamente).
 * - `db`: pool de superusuario para sembrar datos de prueba y para las ASSERTIONS en base.
 * - `uniqueEmail`: genera correos únicos por corrida (evita colisiones si la base no es fresca).
 */
interface LoopFixtures {
  api: APIRequestContext;
  db: Pool;
  uniqueEmail: (domain: string, prefix?: string) => string;
}

export const test = base.extend<LoopFixtures>({
  api: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: ENV.API_URL });
    await use(ctx);
    await ctx.dispose();
  },

  db: async ({}, use) => {
    await use(db);
  },

  uniqueEmail: async ({}, use) => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await use((domain, prefix = "e2e") => `${prefix}-${stamp}@${domain}`);
  },
});

export { expect };
export type { LoopFixtures };