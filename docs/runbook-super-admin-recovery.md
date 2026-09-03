# Runbook: Recuperación de Super Admin

## 0. Cuándo usar este runbook

`admins` se quedó sin ninguna fila con `role = 'super_admin'`. Sin al menos un super admin, nadie
puede autorizar nuevos admins de rol `super_admin` ni operar los catálogos globales (categorías,
mission templates, comunidades) — están reservados a `requireSuperAdmin`
(`server/api/src/middlewares/parseAdminToken.ts:45-54`).

Este incidente ya ocurrió en producción una vez. Causa raíz confirmada: `scripts/migrate.ts`
reenvía `AUTHORIZED_ADMIN_EMAIL ?? ""` (`migrate.ts:172`) hacia el setting de sesión que lee la
migración `0006`. Esa migración promueve por:

```sql
WHERE lower(email) = lower(NULLIF(current_setting('app.authorized_admin_email', true), ''));
```

Con `AUTHORIZED_ADMIN_EMAIL` vacía, `NULLIF(..., '')` da `NULL`, la comparación `lower(email) =
lower(NULL)` no matchea ninguna fila, y la promoción es un no-op silencioso: todo admin
pre-existente queda con el `role` y `community_id` que tenía antes de correr `0006` — en el
incidente real, backfileado a la comunidad `red-itinere` (`0006_admins_invitations_deletion.sql:16
-18`).

Desde este cambio, dos avisos detectan la misma condición antes de que vuelva a pasar
desapercibida:

- **Al arrancar la API** (`services/bootstrapChecks.ts`): si `admins` tiene cero filas
  `super_admin`, se loguea una advertencia y el arranque continúa igual (warn-by-default). Para que
  el arranque se niegue a abrir el puerto en ese caso, setear `REQUIRE_SUPER_ADMIN_ON_BOOT=true` —
  solo corta el arranque si además `NODE_ENV=production`.
- **Al correr `npm run migrate`** (`scripts/migrate.ts`): si `AUTHORIZED_ADMIN_EMAIL` está vacía y
  la migración que va a aplicarse depende de ese valor, se loguea una advertencia antes de
  ejecutarla.

Ninguno de los dos avisos repara el estado — solo lo hace visible. La reparación es el
procedimiento manual de abajo.

## 1. Verificación (solo lectura, primero siempre)

Antes de tocar nada, confirmar identidad de la fila objetivo y la versión de esquema aplicada:

```bash
docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT id, email, role, community_id
FROM admins
WHERE lower(email) = lower('admin@ejemplo.com');

SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
SQL
```

Guardar el resultado completo de la primera consulta (`id`, `email`, `role`, `community_id`
originales) antes de seguir — es lo que permite deshacer la promoción en la sección 3 si hace
falta.

No continuar sin haber corrido esta verificación: la sección 2 exige haber capturado la fila
original.

## 2. Promoción

**Dos restricciones que no son opcionales:**

1. **`role` y `community_id` tienen que cambiar en la misma sentencia.** El constraint
   `admins_role_scope_chk` (`server/migrations/0006_admins_invitations_deletion.sql:35-42`) exige
   `role = 'super_admin' AND community_id IS NULL`, o `role = 'community_admin' AND community_id IS
   NOT NULL`, sin estado intermedio permitido. Una sentencia que solo cambie `role` (dejando
   `community_id` con su valor de comunidad) o solo `community_id` viola el CHECK y Postgres
   rechaza el `UPDATE` completo.
2. **El admin promovido tiene que cerrar sesión y volver a entrar.** El rol viaja adentro del JWT y
   no se vuelve a leer de la base en cada request (`server/api/src/middlewares/parseAdminToken.ts:
   14-25`, `req.session` se arma una sola vez, al decodificar el token). El token de admin dura 30
   minutos (`ADMIN_TOKEN_EXP`, `server/api/src/config.ts`) — una sesión activa sigue operando con el
   rol viejo hasta que ese token venza o el admin vuelva a loguearse.

```bash
docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
BEGIN;

UPDATE admins
SET role = 'super_admin', community_id = NULL
WHERE lower(email) = lower('admin@ejemplo.com');

UPDATE admin_valid_emails
SET role = 'super_admin', community_id = NULL
WHERE lower(email) = lower('admin@ejemplo.com');

COMMIT;
SQL
```

Después de correrlo: pedirle al admin promovido que cierre sesión (`POST /admin/logout`) y vuelva a
loguearse antes de asumir que el nuevo rol ya está activo.

**Idempotencia:** volver a correr la misma sentencia sobre una fila que ya quedó en
`role = 'super_admin', community_id = NULL` no cambia nada — el `WHERE` sigue matcheando esa fila,
pero el `UPDATE` no tiene efecto observable porque los valores ya son los mismos. Es seguro
re-ejecutar el bloque completo si algo interrumpió la corrida anterior antes del `COMMIT` (el
`BEGIN`/`COMMIT` ya deja esa corrida entera sin aplicar).

## 3. Rollback (deshacer la promoción)

Usa los valores originales capturados en la sección 1. Ejemplo con un admin que antes de la
promoción era `community_admin` de una comunidad con id
`11111111-1111-4111-8111-111111111111`:

```bash
docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
BEGIN;

UPDATE admins
SET role = 'community_admin', community_id = '11111111-1111-4111-8111-111111111111'
WHERE lower(email) = lower('admin@ejemplo.com');

UPDATE admin_valid_emails
SET role = 'community_admin', community_id = '11111111-1111-4111-8111-111111111111'
WHERE lower(email) = lower('admin@ejemplo.com');

COMMIT;
SQL
```

Igual que en la promoción: `role` y `community_id` cambian en la misma sentencia (el mismo
constraint aplica en ambos sentidos), y el admin afectado tiene que volver a loguearse para que el
rol anterior se refleje en un token nuevo.

## 4. Por qué no hay una migración para esto

Ver `openspec/changes/admin-community-roles/design.md`, Decisión 2b: el enum, el invariante
`admins_role_scope_chk` y la promoción de arranque ya existen en `0006`. El defecto es un estado de
*datos* en una base de producción puntual, no un gap de esquema — una migración nueva volvería a
correr la misma promoción condicionada a `AUTHORIZED_ADMIN_EMAIL` en *todos* los entornos, o
hardcodearía un correo, ninguna de las dos auditable. La recuperación es este `UPDATE` de una sola
fila, revisado, con la fila original capturada antes de mutarla.
