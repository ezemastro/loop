/**
 * Helpers para inspeccionar errores de `pg` sin acoplarse al shape exacto del driver.
 *
 * `node-postgres` adjunta `code` (el SQLSTATE) y, para violaciones de constraint, `constraint`
 * (el nombre exacto) a los errores que lanza. Ambos campos son opcionales en el tipo `Error` base,
 * así que se leen con un cast defensivo en vez de asumir la forma.
 */

/**
 * `true` si el error es una violación de unicidad (SQLSTATE `23505`).
 *
 * Si se pasa `constraintName`, además exige que sea la constraint que violó — necesario cuando una
 * tabla tiene más de un índice único y cada uno significa un conflicto de negocio distinto (por
 * ejemplo `users` tiene tanto `idx_users_email_lower_uq` como `users_google_id_key`: un choque de
 * `google_id` no es "el email ya existe").
 */
export const isUniqueViolation = (err: unknown, constraintName?: string): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr.code !== "23505") return false;
  return constraintName ? pgErr.constraint === constraintName : true;
};
