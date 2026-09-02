-- Privilegios mínimos para `loop_app` en las cinco tablas sin RLS (auditoría 2026-09, SEC-09).
--
-- `0007_db_roles_and_rls.sql:46-52` le dio a `loop_app` `SELECT, INSERT, UPDATE, DELETE` sobre
-- TODAS las tablas, incluidas las cinco que deliberadamente no tienen RLS
-- (`0007_db_roles_and_rls.sql:106-110`): `admins`, `admin_valid_emails`, `invitations`,
-- `communities`, `community_email_domains`. Sin RLS, esas cinco dependen enteramente del filtro
-- explícito de cada query — la primera de las tres capas de aislamiento, no la última — para no
-- filtrar entre comunidades o hacia el panel de admin.
--
-- La matriz de abajo salió de leer cada UPDATE/INSERT/DELETE que el código ejecuta sobre estas
-- tablas por la conexión `loop_app` (scopeada), no de aplicar la recomendación de la auditoría tal
-- cual. Aplicada literalmente, esa recomendación (revocar todo el DML) rompe el registro por
-- invitación y el auto-borrado de cuenta:
--
--   | Tabla                    | SELECT | INSERT | UPDATE | DELETE | Por qué                        |
--   |---------------------------|:------:|:------:|:------:|:------:|---------------------------------|
--   | admins                    | revoke | revoke | revoke | revoke | Ningún acceso desde loop_app.   |
--   | admin_valid_emails        | revoke | revoke | revoke | revoke | Ídem — todo es unscoped/boot.   |
--   | invitations               | keep   | revoke | keep   | revoke | Ver nota de abajo.              |
--   | communities               | keep   | revoke | revoke | revoke | Solo lectura scopeada (login).  |
--   | community_email_domains   | keep   | revoke | revoke | revoke | Solo lectura vía join de arriba.|
--
-- La excepción de `invitations`. Tres escrituras scopeadas existen hoy, las tres por la conexión
-- `loop_app`:
--   - `queries.ts:726-731` `UPDATE invitations SET used_by_user_id = $1, used_at = NOW() …`,
--     alcanzada desde `utils/invitations.ts:58` → `models/auth.ts:208` (POST /auth/register) y
--     `models/auth.ts:472` (POST /auth/google), ambas bajo `inCommunity(communityId)`.
--   - `queries.ts:1048-1051` `UPDATE invitations SET used_by_user_id = NULL …`, desde
--     `models/self.ts:516` bajo `inCommunity` (DELETE /me).
-- Y una cuarta dependencia no obvia: `queries.ts:708-711`
-- `SELECT * FROM invitations WHERE token = $1 FOR UPDATE`, usada por `lockInvitation`
-- (`utils/invitations.ts:34`) desde `models/auth.ts:180` y `:445`. Según la referencia de GRANT de
-- PostgreSQL, `SELECT … FOR UPDATE` exige el privilegio **UPDATE** además de SELECT. Revocar
-- `UPDATE` en `invitations` rompería con `42501` en el lock de la fila — *antes* de consumirla — y
-- ese lock es precisamente lo que garantiza que una invitación se use una sola vez. `INSERT` y
-- `DELETE` en `invitations` son admin-only (`models/admin.ts:926`, `:1003`, ambos `unscoped`) y se
-- pueden revocar sin riesgo.
--
-- El comentario de `0007:106-110` que dice que `invitations` "se lee por token" (solo lectura) está
-- desactualizado; este archivo lo corrige acá como documentación.
--
-- ADVERTENCIA para quien lea esto en el futuro: la línea de `invitations` es la que se aparta de la
-- recomendación textual de la auditoría. Si alguna vez alguien la "prolija" de vuelta a un
-- `REVOKE ALL`, va a romper el registro por invitación y el borrado de cuenta en producción. No lo
-- hagas sin repetir la derivación de arriba contra el código actual.

DO $$
DECLARE
    app_user TEXT := current_setting('app.db_app_user', true);
BEGIN
    IF COALESCE(app_user, '') = '' THEN
        RAISE EXCEPTION 'Falta app.db_app_user en el entorno del runner de migraciones';
    END IF;

    -- admins / admin_valid_emails: ningún acceso de loop_app.
    EXECUTE format('REVOKE ALL ON admins, admin_valid_emails FROM %I', app_user);

    -- communities / community_email_domains: solo lectura.
    EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON communities, community_email_domains FROM %I', app_user);

    -- invitations: SELECT + UPDATE se conservan (ver nota arriba); INSERT/DELETE son admin-only.
    EXECUTE format('REVOKE INSERT, DELETE ON invitations FROM %I', app_user);

    -- Corrige `0007:50-52`: sin esto, cualquier tabla nueva heredaría DML completo para loop_app.
    -- `loop_app_unscoped` queda sin tocar — es el camino admin/pre-tenant y necesita DML legítimo.
    -- Consecuencia documentada: toda migración futura que agregue una tabla scopeada tiene que
    -- otorgarle el DML que necesite explícitamente.
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM %I',
        app_user);
END $$;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- DO $$
-- DECLARE
--     app_user TEXT := current_setting('app.db_app_user', true);
-- BEGIN
--     EXECUTE format(
--         'GRANT SELECT, INSERT, UPDATE, DELETE ON admins, admin_valid_emails, invitations, '
--         'communities, community_email_domains TO %I', app_user);
--     EXECUTE format(
--         'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
--         app_user);
-- END $$;
