import { NODE_ENV, REQUIRE_SUPER_ADMIN_ON_BOOT } from "../config.js";
import { queries } from "./queries.js";
import { unscoped, withClient } from "./postgresClient.js";

/** Ruta relativa desde la raíz del repo, para que el mensaje de arranque le diga al operador
 * exactamente dónde seguir. */
const RUNBOOK_PATH = "docs/runbook-super-admin-recovery.md";

/**
 * Verifica al arrancar que exista al menos un `super_admin`.
 *
 * Warn-by-default: la ausencia de super admin es un estado de *datos* legítimo en un deploy nuevo
 * antes del primer registro — a diferencia de `assertDbHardening()`, que chequea estado de
 * *catálogo* nunca legítimamente ausente (D2). Solo corta el arranque cuando `NODE_ENV ===
 * "production"` **y** `REQUIRE_SUPER_ADMIN_ON_BOOT === "true"`; en cualquier otro caso, avisa y
 * sigue.
 *
 * Causa raíz real que motivó este chequeo: `scripts/migrate.ts` reenvía
 * `AUTHORIZED_ADMIN_EMAIL ?? ""`, y un valor vacío hace que el `NULLIF` de la migración `0006` no
 * promueva a nadie — ver `docs/runbook-super-admin-recovery.md`.
 */
export const assertSuperAdminExists = async (): Promise<void> => {
  const { count } = await withClient(
    async (client) => {
      const rows = await client.query(queries.countSuperAdmins);
      return rows[0] ?? { count: 0 };
    },
    { scope: unscoped("bootstrap") },
  );

  if (count > 0) return;

  const message =
    `No existe ningún admin con role='super_admin': el panel de admin queda sin nadie que ` +
    `pueda autorizar otros admins ni operar los catálogos globales. Recuperación: ${RUNBOOK_PATH}`;

  if (NODE_ENV === "production" && REQUIRE_SUPER_ADMIN_ON_BOOT) {
    throw new Error(message);
  }

  console.error(`\n⚠️  ${message}\n`);
};
