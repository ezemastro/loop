/**
 * Escapa los caracteres especiales de `LIKE` (`%`, `_`) y el propio carácter de escape (`\`) en un
 * término de búsqueda arbitrario (SEC-13, D10).
 *
 * El backslash se escapa en la **misma** clase de caracteres que `%` y `_`, no en una pasada
 * aparte: escapar primero `%`/`_` y recién después el `\` insertaría barras nuevas que también
 * habría que escapar, y viceversa dejaría un patrón mal formado. Cada `LIKE` que use este helper
 * debe declarar `ESCAPE '\'` en la cláusula.
 */
export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (char) => `\\${char}`);
