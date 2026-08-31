/**
 * IDs deterministas del dataset de demostración.
 *
 * Ninguna entidad del dataset lleva un UUID escrito a mano: todos se derivan de una semilla
 * textual (`comunidad/tipo/clave`). Eso da dos garantías que el seed necesita:
 *
 *   1. El mismo dataset produce siempre los mismos IDs, así que sembrar dos veces actualiza las
 *      filas en lugar de duplicarlas.
 *   2. El servidor (Postgres) y el cliente (modo demo en memoria) llegan al mismo ID sin
 *      coordinarse, que es lo que permite comparar una pantalla de dev contra una de demo.
 */

/** FNV-1a de 32 bits. Barato, sin dependencias y con buena dispersión para semillas cortas. */
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/**
 * UUID v4 derivado de una semilla. Se calculan cuatro hashes con prefijos distintos para llenar
 * los 16 bytes: con uno solo se repetirían los últimos 12 y las colisiones serían frecuentes.
 */
export const uuidFromSeed = (seed: string): UUID => {
  const bytes = new Uint8Array(16);
  for (let block = 0; block < 4; block++) {
    const hash = fnv1a(`${block}|${seed}`);
    bytes[block * 4] = (hash >>> 24) & 0xff;
    bytes[block * 4 + 1] = (hash >>> 16) & 0xff;
    bytes[block * 4 + 2] = (hash >>> 8) & 0xff;
    bytes[block * 4 + 3] = hash & 0xff;
  }
  // Marcas de versión (4) y variante (RFC 4122) para que Postgres lo acepte como uuid válido.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Namespace de IDs de una comunidad: `demoId("demo", "user", "ana")`. */
export const demoId = (scope: string, kind: string, key: string): UUID =>
  uuidFromSeed(`loop-demo/${scope}/${kind}/${key}`);
