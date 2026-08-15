import { ERROR_MESSAGES } from "../config.js";
import { ConflictError, InvalidInputError } from "../services/errors.js";
import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";

/**
 * Invitaciones de un solo uso.
 *
 * Sirven para el caso que la restricción por dominio deja afuera: alguien que necesita entrar y no
 * tiene correo institucional. Un admin genera un link desde el panel y quien lo use entra **a la
 * comunidad de ese admin**, saltándose la validación de dominio.
 *
 * Quien sí tiene correo institucional se registra exactamente como antes, sin link ni pasos extra.
 */

/**
 * Valida la invitación y **bloquea su fila** dentro de la transacción en curso.
 *
 * El `FOR UPDATE` es lo que garantiza el uso único: dos registros simultáneos con el mismo token se
 * serializan, y el segundo ya ve `used_by_user_id` seteado. El `AND used_by_user_id IS NULL` de
 * `consumeInvitation` es el cinturón de seguridad por si alguna vez se llama fuera de transacción.
 *
 * Devuelve `null` si no se pasó token, que es el camino normal de registro.
 */
export const lockInvitation = async ({
  client,
  token,
}: {
  client: DatabaseClient;
  token?: string | undefined;
}): Promise<DB_Invitations | null> => {
  if (!token) return null;

  const [invitation] = await client.query(queries.invitationByTokenForUpdate, [token]);
  if (!invitation) {
    throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
  }
  if (invitation.used_by_user_id) {
    throw new ConflictError(ERROR_MESSAGES.INVITATION_ALREADY_USED, "INVITATION_ALREADY_USED");
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    throw new InvalidInputError(ERROR_MESSAGES.INVITATION_INVALID, "INVITATION_INVALID");
  }

  return invitation;
};

/** Marca la invitación como usada. Si no actualizó ninguna fila, alguien se adelantó. */
export const consumeInvitation = async ({
  client,
  invitationId,
  userId,
}: {
  client: DatabaseClient;
  invitationId: UUID;
  userId: UUID;
}): Promise<void> => {
  const consumed = await client.query(queries.consumeInvitation, [userId, invitationId]);
  if (consumed.length === 0) {
    throw new ConflictError(ERROR_MESSAGES.INVITATION_ALREADY_USED, "INVITATION_ALREADY_USED");
  }
};
