-- Auditoría de emails duplicados (pre-flight de la migración 0009).
--
-- Solo lectura. Corré esto contra producción ANTES de aplicar 0009: si hay algún resultado,
-- la migración va a abortar por diseño (design D1, `email-identity-uniqueness` spec —
-- "Migration Refuses To Deduplicate Silently"). Resolver los duplicados es una decisión de un
-- operador humano: no hay una regla automática segura, porque cada fila duplicada puede tener
-- publicaciones, mensajes, saldo y colegios propios.
--
-- Para cada grupo de `lower(email)` repetido, muestra cada fila involucrada con lo necesario
-- para decidir cuál conservar: fecha de alta, saldo y cantidad de publicaciones.
SELECT
    lower(u.email)                                       AS email_lower,
    dupes.row_count,
    u.id,
    u.email,
    u.created_at,
    u.credits_balance,
    (SELECT count(*) FROM listings l WHERE l.seller_id = u.id) AS listing_count
FROM users u
JOIN (
    SELECT lower(email) AS email_lower, count(*) AS row_count
      FROM users
     GROUP BY lower(email)
    HAVING count(*) > 1
) dupes ON dupes.email_lower = lower(u.email)
ORDER BY email_lower, u.created_at;
