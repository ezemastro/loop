import type { Request, Response, NextFunction } from "express";

/** Nadie legítimo anida un body más de 10 niveles; un valor mayor es hostil, no un caso real. */
const MAX_DEPTH = 10;

/**
 * Recorta strings recursivamente (SEC-13, D16). Antes solo recorría el nivel superior con
 * `for…in`, que además camina propiedades heredadas enumerables — acá se usa `Object.entries`, que
 * no lo hace. El chequeo de `Object.getPrototypeOf(value) === Object.prototype` es lo que evita
 * mangling en `Date`/`Buffer`/clases: solo se recorre un objeto plano.
 */
const deepTrim = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((v) => deepTrim(v, depth + 1));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, deepTrim(v, depth + 1)]),
    );
  }
  return value;
};

export const trimBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    req.body = deepTrim(req.body);
  }
  next();
};
