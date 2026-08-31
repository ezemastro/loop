/**
 * Modo demo: solo lectura, y nada sale a la red.
 *
 * Dos reglas, y las dos son de seguridad, no de producto:
 *
 * 1. **Ninguna request llega a la API.** Con el modo activo el adaptador resuelve *todo* contra el
 *    dataset en memoria. No hay ruta de escape: las rutas que no conoce devuelven 404 en lugar de
 *    delegar en la red, así que un endpoint nuevo sin handler falla ruidosamente acá y no termina
 *    escribiendo en la base real.
 * 2. **Nada muta contenido.** Aun sin red, dejar que la demo simule publicar o donar confunde:
 *    parece que hiciste algo que no existe. Las escrituras devuelven 403 con un mensaje claro.
 *
 * La excepción de (2) es la lista de abajo: escrituras que solo llevan la contabilidad de la propia
 * sesión y que la app dispara sola al navegar.
 */
import { matchesPattern } from "./router";

/** Código con el que viaja el 403 del modo demo. `client/api/loop.ts` lo convierte en un aviso. */
export const DEMO_READ_ONLY_ERROR_CODE = "DEMO_MODE_READ_ONLY";

export const DEMO_READ_ONLY_MESSAGE =
  "Estás en modo demo: podés recorrer toda la app, pero no guardar cambios.";

/**
 * Escrituras permitidas. Ninguna crea contenido ni mueve créditos: son estado de lectura de la
 * sesión, y la app las dispara sola al abrir una pantalla. Bloquearlas haría que navegar tire un
 * error, que es exactamente lo contrario de lo que la demo tiene que transmitir.
 */
const ALLOWED_WRITES: { method: string; pattern: string }[] = [
  // Entrar a la demo. Lo resuelve el mock, no la API.
  { method: "post", pattern: "/auth/login" },
  // Marcar notificaciones y mensajes como leídos: se dispara al abrir esas pantallas.
  { method: "post", pattern: "/me/notifications/read-all" },
  { method: "post", pattern: "/messages/:userId/read" },
  // Registro del token de push: lo manda el contexto de notificaciones al montarse.
  { method: "post", pattern: "/me/notification-token" },
];

export const isReadOnlyBlocked = (method: string, pathname: string): boolean => {
  if (method === "get" || method === "head" || method === "options") return false;
  return !ALLOWED_WRITES.some(
    (allowed) => allowed.method === method && matchesPattern(pathname, allowed.pattern),
  );
};
