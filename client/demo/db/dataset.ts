/**
 * Puente entre el modo demo y el dataset compartido.
 *
 * Es el **único** archivo del cliente que sabe dónde vive `shared/demo-data`. El resto de
 * `client/demo/db/` importa de acá y se ocupa nada más de hidratar el dato crudo a las formas que
 * devuelve la API real (`PrivateUser`, `Listing`, …), que es lo único que los handlers conocen.
 *
 * El mismo dataset lo siembra `server/api/src/scripts/seed.ts` en Postgres para desarrollo. Si una
 * pantalla se ve distinta en dev y en la demo, la diferencia está en un adaptador, no en los datos.
 */
import {
  DEMO_CATEGORIES as SHARED_CATEGORIES,
  DEMO_COMMUNITY as SHARED_COMMUNITY,
  DEMO_MISSION_TEMPLATES as SHARED_MISSIONS,
} from "../../../shared/demo-data";
import type { DemoMedia } from "../../../shared/demo-data";

export { SHARED_CATEGORIES, SHARED_COMMUNITY, SHARED_MISSIONS };

/**
 * Antigüedad relativa → fecha ISO.
 *
 * El dataset guarda "hace cuántas horas" en lugar de una fecha fija a propósito: así la demo
 * siempre se ve recién usada, en vez de envejecer con cada mes que pasa desde que se escribió.
 * Sobre el cable la API manda las fechas como string, y el modo demo hace lo mismo.
 */
export const isoHoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

export const toMedia = (media: DemoMedia): Media => ({
  id: media.id,
  url: media.url,
  mime: media.mime,
  mediaType: media.mediaType,
});
