-- Roles de base de datos y Row-Level Security.
--
-- Contexto imprescindible: en la imagen oficial `postgres:16`, el usuario creado por POSTGRES_USER
-- es SUPERUSER, y **los superusuarios ignoran RLS por completo**. Si la API siguiera conectándose
-- con él, todas las policies de este archivo serían decorativas. Por eso se crean dos roles sin
-- privilegios de superusuario y la API pasa a usar esos:
--
--   loop_app           — sujeto a RLS. Atiende todo el tráfico de usuarios.
--   loop_app_unscoped  — con BYPASSRLS. Solo para los caminos que por definición no pueden estar
--                        scopeados: login, resolver la comunidad por dominio, y el panel de admin.
--
-- Son dos roles y no un flag a propósito: desde la conexión scopeada no existe ningún SQL que
-- permita salirse de la comunidad. Con un flag, cualquier código capaz de ejecutar `set_config`
-- podría apagar el aislamiento.
--
-- Deliberadamente NO se usa FORCE ROW LEVEL SECURITY: dejar exento al dueño mantiene funcionando
-- las migraciones, los backups y los fixtures de e2e.

-- ── 1. Roles ───────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    app_user      TEXT := current_setting('app.db_app_user', true);
    app_pass      TEXT := current_setting('app.db_app_password', true);
    unscoped_user TEXT := current_setting('app.db_unscoped_user', true);
    unscoped_pass TEXT := current_setting('app.db_unscoped_password', true);
BEGIN
    IF COALESCE(app_pass, '') = '' OR COALESCE(unscoped_pass, '') = '' THEN
        RAISE EXCEPTION
            'Faltan DB_APP_PASSWORD y/o DB_UNSCOPED_PASSWORD en el entorno del runner de migraciones';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOINHERIT', app_user, app_pass);
    ELSE
        EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', app_user, app_pass);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = unscoped_user) THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOINHERIT BYPASSRLS', unscoped_user, unscoped_pass);
    ELSE
        EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER BYPASSRLS', unscoped_user, unscoped_pass);
    END IF;

    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I, %I', current_database(), app_user, unscoped_user);
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I, %I', app_user, unscoped_user);
    EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I, %I',
        app_user, unscoped_user);
    -- Para las tablas que creen las migraciones futuras
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I, %I',
        app_user, unscoped_user);
    -- Ninguno de los dos toca el registro de migraciones ni tiene DDL.
    EXECUTE format('REVOKE ALL ON "schema_migrations" FROM %I, %I', app_user, unscoped_user);
END $$;

-- ── 2. La comunidad activa de la conexión ──────────────────────────────────────────────────────
-- `postgresClient.ts` la fija con `set_config('app.community_id', ..., false)` justo después de
-- tomar la conexión del pool.
--
-- STABLE (y no VOLATILE) es obligatorio: es lo que permite al planner plegar la función dentro de
-- la condición del índice en lugar de evaluarla fila por fila.
CREATE OR REPLACE FUNCTION app_community_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.community_id', true), '')::uuid
$$;

-- ── 3. Policies ────────────────────────────────────────────────────────────────────────────────
-- Se generan en un loop para que sean idénticas y no puedan derivar entre tablas.
--
-- Semántica fail-closed: si el GUC no está seteado, `app_community_id()` es NULL, y
-- `community_id = NULL` evalúa a NULL (no a TRUE), así que la consulta devuelve **cero filas**.
-- Olvidarse de fijar el scope produce listas vacías, nunca una fuga.
--
-- En los INSERT, `WITH CHECK` obliga a que cada fila nueva traiga su `community_id`. Si falta,
-- PostgreSQL levanta 42501 — un error ruidoso, no un silencio.
DO $$
DECLARE
    tabla TEXT;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'schools', 'users', 'user_schools', 'listings', 'listing_media', 'listing_trades',
        'messages', 'notifications', 'user_missions', 'wallet_transactions', 'users_wishes',
        'global_stats'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tabla);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON %I
            FOR ALL
            USING      (community_id = app_community_id())
            WITH CHECK (community_id = app_community_id())
        $f$, tabla);
    END LOOP;
END $$;

-- `media` es el único caso especial: community_id NULL = recurso compartido (logos de comunidad y
-- de colegio), visible desde cualquier comunidad. Escribir, en cambio, siempre exige comunidad.
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "media";
CREATE POLICY tenant_isolation ON "media"
FOR ALL
USING      (community_id IS NULL OR community_id = app_community_id())
WITH CHECK (community_id = app_community_id());

-- Sin RLS, a propósito:
--   communities, community_email_domains  → catálogo público (pantalla de registro)
--   categories, mission_templates         → catálogos compartidos entre comunidades
--   admins, admin_valid_emails            → solo se alcanzan por el camino unscoped del panel
--   invitations, account_deletion_requests→ se leen por token *antes* de conocer la comunidad
