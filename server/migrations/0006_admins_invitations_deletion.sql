-- Tres cosas que dependen de que las comunidades ya existan:
--   1. Roles de administrador (super admin global vs. admin de una comunidad).
--   2. Invitaciones de un solo uso, que permiten registrarse con un correo fuera de los dominios
--      institucionales. La invitación lleva la comunidad de quien la creó.
--   3. Confirmación por correo del borrado de cuenta, que hoy no existe (ver nota al final).

-- ── 1. Roles de administrador ──────────────────────────────────────────────────────────────────
CREATE TYPE admin_role AS ENUM ('super_admin', 'community_admin');

ALTER TABLE "admins"
    ADD COLUMN "role" admin_role NOT NULL DEFAULT 'community_admin';
ALTER TABLE "admin_valid_emails"
    ADD COLUMN "role" admin_role NOT NULL DEFAULT 'community_admin';

-- Los admins que ya existían administran Red Itinere...
UPDATE "admins"
SET community_id = (SELECT id FROM communities WHERE slug = 'red-itinere')
WHERE community_id IS NULL;

UPDATE "admin_valid_emails"
SET community_id = (SELECT id FROM communities WHERE slug = 'red-itinere')
WHERE community_id IS NULL;

-- ...salvo el admin autorizado por entorno, que es el super admin y no pertenece a ninguna.
UPDATE "admins"
SET role = 'super_admin', community_id = NULL
WHERE lower(email) = lower(NULLIF(current_setting('app.authorized_admin_email', true), ''));

UPDATE "admin_valid_emails"
SET role = 'super_admin', community_id = NULL
WHERE lower(email) = lower(NULLIF(current_setting('app.authorized_admin_email', true), ''));

-- El invariante: super admin ⇔ sin comunidad. Se agrega después del backfill para que las filas
-- existentes ya cumplan.
ALTER TABLE "admins" ADD CONSTRAINT "admins_role_scope_chk" CHECK (
    (role = 'super_admin'     AND community_id IS NULL) OR
    (role = 'community_admin' AND community_id IS NOT NULL)
);
ALTER TABLE "admin_valid_emails" ADD CONSTRAINT "admin_valid_emails_role_scope_chk" CHECK (
    (role = 'super_admin'     AND community_id IS NULL) OR
    (role = 'community_admin' AND community_id IS NOT NULL)
);

-- ── 2. Invitaciones de un solo uso ─────────────────────────────────────────────────────────────
-- El token se guarda en texto plano con índice único: son credenciales de bajo privilegio y de un
-- solo uso, y así el panel puede volver a mostrar el link mientras siga sin usarse.
CREATE TABLE "invitations" (
    "id"                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "token"               TEXT NOT NULL UNIQUE,
    -- La comunidad a la que entra quien use el link. Sale del admin que lo creó, nunca del body.
    "community_id"        UUID NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
    "created_by_admin_id" UUID NOT NULL REFERENCES "admins"("id"),
    "used_by_user_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "used_at"             TIMESTAMP(0),
    "expires_at"          TIMESTAMP(0),
    "note"                TEXT,
    "created_at"          TIMESTAMP(0) DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_invitations_community ON "invitations"("community_id", "created_at" DESC);

-- `domain_exempt` es la puerta que consulta el login: quien entró por invitación puede tener un
-- correo fuera de los dominios de su comunidad y aun así seguir entrando.
-- `invitation_id` queda solo para auditoría.
ALTER TABLE "users" ADD COLUMN "invitation_id"  UUID REFERENCES "invitations"("id");
ALTER TABLE "users" ADD COLUMN "domain_exempt"  BOOLEAN NOT NULL DEFAULT FALSE;

-- Los usuarios actuales se registraron todos con correo institucional, así que FALSE es correcto
-- para ellos y no hace falta backfill. La verificación previa está en el runbook de migración.

-- ── 3. Solicitudes de borrado de cuenta ────────────────────────────────────────────────────────
--
-- Hasta ahora `POST /me/delete-request` (montado sin ningún middleware de autenticación) borraba
-- de forma inmediata y permanente la cuenta indicada por email: publicaciones, mensajes,
-- transacciones y usuario. Cualquiera que supiera el correo de otro podía borrarle la cuenta.
--
-- El endpoint es público a propósito —la landing lo usa para cumplir el requisito de borrado de
-- cuenta de las tiendas— así que la solución no puede ser pedir sesión. Lo natural sería confirmar
-- por correo, pero el proyecto no tiene ninguna infraestructura de envío de mails. Así que el
-- endpoint pasa a **registrar una solicitud pendiente** y el borrado real lo ejecuta un admin
-- desde el panel, que es el flujo de "validación manual por soporte" que la propia landing ya
-- anuncia.
--
-- El borrado inmediato sigue existiendo para el dueño de la cuenta, autenticado, en `DELETE /me`.
CREATE TYPE account_deletion_status AS ENUM ('pending', 'completed', 'rejected');

CREATE TABLE "account_deletion_requests" (
    "id"                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id"             UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "community_id"        UUID NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
    "email"               TEXT NOT NULL,
    "status"              account_deletion_status NOT NULL DEFAULT 'pending',
    "resolved_by_admin_id" UUID REFERENCES "admins"("id"),
    "resolved_at"         TIMESTAMP(0),
    "created_at"          TIMESTAMP(0) DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_account_deletion_requests_user ON "account_deletion_requests"("user_id");
-- Una sola solicitud pendiente por usuario: pedirlo de nuevo no acumula filas.
CREATE UNIQUE INDEX idx_account_deletion_requests_pending
    ON "account_deletion_requests"("user_id") WHERE status = 'pending';
