/** Contexto que recibe cada handler del mock. */
export interface DemoContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  /** Bearer token de la request (sin el prefijo "Bearer "). */
  token: string | null;
}

export interface DemoResult {
  data: any;
  status?: number;
  statusText?: string;
}

/** Error HTTP simulado: el adaptador lo convierte en un `AxiosError` con `response`. */
export class DemoHttpError extends Error {
  status: number;
  errorCode?: string;
  data?: unknown;

  constructor(status: number, message: string, errorCode?: string, data?: unknown) {
    super(message);
    this.name = "DemoHttpError";
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;
  }
}

export const httpError = (status: number, message: string, errorCode?: string, data?: unknown) =>
  new DemoHttpError(status, message, errorCode, data);

type DemoHandler = (ctx: DemoContext) => DemoResult | Promise<DemoResult>;

interface DemoRoute {
  method: string;
  segments: (string | { param: string })[];
  handler: DemoHandler;
}

const routes: DemoRoute[] = [];

const toSegments = (pattern: string) =>
  pattern
    .split("/")
    .filter(Boolean)
    .map((seg) => (seg.startsWith(":") ? { param: seg.slice(1) } : seg));

/**
 * Registra un handler del mock. `pattern` usa la misma sintaxis que las rutas de Express:
 * `/listings/:listingId/offer/accept`.
 */
export const on = (method: string, pattern: string, handler: DemoHandler) => {
  routes.push({ method: method.toLowerCase(), segments: toSegments(pattern), handler });
};

interface RouteMatch {
  handler: DemoHandler;
  params: Record<string, string>;
}

/**
 * ¿Coincide `pathname` con un patrón de ruta? Se usa para clasificar la request **antes** de
 * resolverla, sin depender de que exista un handler registrado.
 */
export const matchesPattern = (pathname: string, pattern: string): boolean => {
  const pathSegments = pathname.split("/").filter(Boolean);
  const patternSegments = toSegments(pattern);
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((seg, i) => typeof seg !== "string" || seg === pathSegments[i]);
};

export const matchRoute = (method: string, pathname: string): RouteMatch | null => {
  const pathSegments = pathname.split("/").filter(Boolean);
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== pathSegments.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      const value = pathSegments[i];
      if (typeof seg === "string") {
        if (seg !== value) {
          matches = false;
          break;
        }
      } else {
        params[seg.param] = decodeURIComponent(value);
      }
    }
    if (matches) return { handler: route.handler, params };
  }
  return null;
};
