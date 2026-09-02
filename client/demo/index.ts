import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { DemoHttpError, matchRoute } from "./router";
import { simulateLatency } from "./latency";
import { registerAuthHandlers } from "./handlers/auth";
import { registerCommunityHandlers } from "./handlers/community";
import { registerSchoolsHandlers } from "./handlers/schools";
import { registerCategoriesHandlers } from "./handlers/categories";
import { registerListingsHandlers } from "./handlers/listings";
import { registerMeHandlers } from "./handlers/me";
import { registerUsersHandlers } from "./handlers/users";
import { registerMessagesHandlers } from "./handlers/messages";
import { registerStatsHandlers } from "./handlers/stats";
import { registerUploadsHandlers } from "./handlers/uploads";
import { resetDemoDb } from "./state";
import { DEMO_READ_ONLY_ERROR_CODE, DEMO_READ_ONLY_MESSAGE, isReadOnlyBlocked } from "./readOnly";

export { DEMO_READ_ONLY_ERROR_CODE, DEMO_READ_ONLY_MESSAGE } from "./readOnly";

/**
 * Cuenta con la que entra el modo demo. El seed de desarrollo comparte el mismo email; la
 * contraseña no se re-exporta acá porque `demo/handlers/auth.ts` la ignora por completo, así que
 * ningún consumidor fuera de `client/demo/` la necesita.
 */
export { DEMO_SHOWCASE_EMAIL } from "./db/users";

let enabled = false;
let registered = false;

const ensureRegistered = () => {
  if (registered) return;
  registered = true;
  registerAuthHandlers();
  registerCommunityHandlers();
  registerSchoolsHandlers();
  registerCategoriesHandlers();
  registerListingsHandlers();
  registerMeHandlers();
  registerUsersHandlers();
  registerMessagesHandlers();
  registerStatsHandlers();
  registerUploadsHandlers();
};

export const isDemoModeEnabled = () => enabled;

/**
 * Activa el modo demo. Reinicia el estado simulado para que cada entrada a la demo arranque
 * con los datos de seed (una sesión demo no debería heredar mutaciones de la anterior).
 */
export const enableDemoMode = () => {
  ensureRegistered();
  resetDemoDb();
  enabled = true;
};

export const disableDemoMode = () => {
  enabled = false;
};

const STATUS_TEXTS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

const toAxiosError = (err: DemoHttpError, config: InternalAxiosRequestConfig) => {
  const body: Record<string, unknown> = { success: false, error: err.message };
  if (err.errorCode) body.errorCode = err.errorCode;
  if (err.data !== undefined) body.data = err.data;
  const code = err.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST";
  return new AxiosError(
    err.message,
    code,
    config,
    {},
    {
      data: body,
      status: err.status,
      statusText: STATUS_TEXTS[err.status] ?? "Error",
      headers: {},
      config,
      request: {},
    },
  );
};

const parseRequest = (config: InternalAxiosRequestConfig) => {
  const raw = config.url ?? "";
  const [pathPart, queryString] = raw.split("?");
  let pathname = pathPart;
  try {
    pathname = new URL(pathPart, "http://demo.local").pathname;
  } catch {
    // path relativo (sin baseURL) — se usa tal cual
  }
  const query: Record<string, string> = {};
  if (queryString) {
    for (const [key, value] of new URLSearchParams(queryString)) query[key] = value;
  }
  const params = config.params as Record<string, unknown> | undefined;
  if (params && typeof params === "object") {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) query[key] = String(value);
    }
  }
  return { pathname, query };
};

const getBearerToken = (config: InternalAxiosRequestConfig): string | null => {
  const headers = config.headers as unknown as {
    Authorization?: string;
    get?: (name: string) => string | undefined;
  };
  const auth = headers?.Authorization ?? headers?.get?.("Authorization");
  if (!auth) return null;
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : auth;
};

/**
 * Adaptador axios del modo demo: intercepta cada request y la resuelve contra los handlers
 * simulados. Cuando el modo demo está apagado delega en el adaptador real, así el toggle en
 * runtime no obliga a reinstalar nada.
 *
 * Con el modo **activo no delega nunca**: una ruta sin handler devuelve 404 en lugar de salir a la
 * red. Esa es la garantía de la que depende todo lo demás — el día que se agregue un endpoint y se
 * olviden de mockearlo, la demo falla a la vista en vez de escribir en la base real.
 */
export const demoAdapter = async (
  config: InternalAxiosRequestConfig,
  fallback?: AxiosAdapter,
): Promise<AxiosResponse> => {
  if (!enabled) {
    if (!fallback) {
      throw new AxiosError(
        "Modo demo desactivado y sin adaptador de respaldo",
        "ERR_DEMO_DISABLED",
        config,
      );
    }
    return fallback(config);
  }

  await simulateLatency();

  const method = (config.method ?? "get").toLowerCase();
  const { pathname, query } = parseRequest(config);
  const token = getBearerToken(config);

  // Antes de resolver nada: la demo no muta contenido. Va primero que el ruteo a propósito, así
  // una escritura a una ruta todavía sin handler también queda cubierta.
  if (isReadOnlyBlocked(method, pathname)) {
    throw toAxiosError(
      new DemoHttpError(403, DEMO_READ_ONLY_MESSAGE, DEMO_READ_ONLY_ERROR_CODE),
      config,
    );
  }

  const match = matchRoute(method, pathname);

  if (!match) {
    throw toAxiosError(
      new DemoHttpError(
        404,
        `Ruta no disponible en modo demo: ${method.toUpperCase()} ${pathname}`,
      ),
      config,
    );
  }

  try {
    const result = await match.handler({
      params: match.params,
      query,
      body: config.data,
      token,
    });
    return {
      data: result.data,
      status: result.status ?? 200,
      statusText: result.statusText ?? "OK",
      headers: {},
      config,
      request: {},
    };
  } catch (err) {
    if (err instanceof DemoHttpError) throw toAxiosError(err, config);
    throw err;
  }
};
