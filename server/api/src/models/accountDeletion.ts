import { ERROR_MESSAGES, PAGE_SIZE } from "../config.js";
import { NotFoundError } from "../services/errors.js";
import { unscoped, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries.js";
import { getUsersByIds } from "../utils/helpersDb.js";
import { parsePagination } from "../utils/parseDb.js";
import { SelfModel } from "./self.js";

/**
 * Solicitudes de borrado de cuenta.
 *
 * Reemplaza al viejo `POST /me/delete-request`, que estaba montado **sin autenticación** y borraba
 * en el acto la cuenta de cualquier correo que se le pasara. Ahora solo deja constancia del pedido
 * y el borrado lo ejecuta un admin desde el panel.
 *
 * El borrado inmediato sigue disponible para el propio usuario, autenticado, en `DELETE /me`.
 */
export class AccountDeletionModel {
  /**
   * Registra la solicitud. **Nunca revela si el correo existe**: el controller responde 204 pase lo
   * que pase, para que el endpoint no sirva para averiguar qué direcciones están registradas.
   */
  static requestDeletion = async ({ email }: { email: string }) => {
    return withClient(
      async (client) => {
        const [userDb] = await client.query(queries.userByEmailCaseInsensitive, [email]);
        if (!userDb) return;

        await client.query(queries.createAccountDeletionRequest, [
          userDb.id,
          userDb.community_id,
          userDb.email,
        ]);
      },
      { scope: unscoped("token-lookup") },
    );
  };

  static listRequests = async ({
    status,
    communityId,
    page,
  }: {
    status?: DB_AccountDeletionStatus | undefined;
    communityId: UUID | null;
    page?: number | undefined;
  }) => {
    return withClient(
      async (client) => {
        const currentPage = page && page > 0 ? page : 1;
        const rows = await client.query(queries.accountDeletionRequestsByStatus, [
          status ?? null,
          communityId,
          PAGE_SIZE,
          (currentPage - 1) * PAGE_SIZE,
        ]);

        const usersById = await getUsersByIds({
          client,
          userIds: [...new Set(rows.map((row) => row.user_id))],
        });

        const deletionRequests: AccountDeletionRequest[] = rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          communityId: row.community_id,
          email: row.email,
          status: row.status,
          createdAt: new Date(row.created_at).toISOString(),
          resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
          user: usersById.get(row.user_id) ?? null,
        }));

        return {
          deletionRequests,
          pagination: parsePagination({
            currentPage,
            totalRecords: Number(rows[0]?.total_records ?? 0),
          }),
        };
      },
      { scope: unscoped("admin") },
    );
  };

  /**
   * Cierra la solicitud. Con `completed` se borra la cuenta de verdad, delegando en la misma
   * cascada que usa `DELETE /me` para no tener dos implementaciones del borrado.
   */
  static resolveRequest = async ({
    requestId,
    action,
    adminId,
    communityId,
  }: {
    requestId: UUID;
    action: Exclude<DB_AccountDeletionStatus, "pending">;
    adminId: UUID;
    communityId: UUID | null;
  }) => {
    const request = await withClient(
      async (client) => {
        const [row] = await client.query(queries.accountDeletionRequestById, [
          requestId,
          communityId,
        ]);
        return row ?? null;
      },
      { scope: unscoped("admin") },
    );

    if (!request || request.status !== "pending") {
      throw new NotFoundError(ERROR_MESSAGES.DELETE_REQUEST_INVALID, "DELETE_REQUEST_INVALID");
    }

    // Se marca antes de borrar: `account_deletion_requests` cae por CASCADE al borrar el usuario,
    // así que si se hiciera al revés la fila ya no existiría.
    await withClient(
      async (client) => {
        await client.query(queries.resolveAccountDeletionRequest, [action, adminId, requestId]);
      },
      { scope: unscoped("admin") },
    );

    if (action === "completed") {
      await SelfModel.deleteSelf({
        userId: request.user_id,
        communityId: request.community_id,
      });
    }
  };
}
