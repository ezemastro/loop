import { Expo } from "expo-server-sdk";

const expo = new Expo();

/**
 * Envía una push. Resuelve siempre (nunca rechaza): un fallo de push no puede tumbar la operación
 * de negocio que la disparó (aceptar una oferta, completar una misión) — SEC-12.
 *
 * Antes la llamada al SDK no se esperaba (`expo.sendPushNotificationsAsync(...)` sin `await`),
 * así que era una unhandled rejection en potencia, y el `await` de los callers
 * (`utils/notifications.ts`) era inerte: el wrapper ya había retornado. Ahora se espera, se
 * envuelve en `try/catch`, y además se inspecciona el `status` por ticket — el SDK de Expo
 * resuelve exitosamente aunque reporte un error por dispositivo, así que un `await` solo no
 * alcanza para detectar esos casos.
 */
export const sendPushNotification = async ({
  notificationToken,
  title,
  body,
  categoryId,
}: {
  notificationToken: string;
  title: string;
  body: string;
  categoryId?: string;
}): Promise<void> => {
  if (!Expo.isExpoPushToken(notificationToken)) {
    // No se loguea el token: es una credencial del dispositivo (SEC-16).
    console.error("[push] token de push inválido, rechazado");
    return;
  }
  try {
    const tickets = await expo.sendPushNotificationsAsync([
      { to: notificationToken, title, body, categoryId },
    ]);
    const failed = tickets.filter((t) => t.status === "error");
    if (failed.length) {
      console.error(
        "[push] envío rechazado",
        failed.map((f) => f.details?.error),
      );
    }
  } catch (err) {
    console.error("[push] error enviando notificación", err instanceof Error ? err.message : err);
  }
};
