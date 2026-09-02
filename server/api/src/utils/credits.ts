import { ERROR_MESSAGES } from "../config.js";
import { InvalidInputError, NotFoundError } from "../services/errors.js";
import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";

/**
 * El único choque de dinero de toda la aplicación (design D2, credit-ledger: "Single Mutation
 * Choke Point"). Cada razón está pinneada a exactamente un sitio de la aplicación — ver design D5.
 */
export type CreditReason =
  | "genesis_opening_balance"
  | "offer_lock"
  | "offer_unlock_withdrawn"
  | "offer_unlock_rejected"
  | "accept_buyer_adjust"
  | "accept_seller_lock"
  | "receive_buyer_settle"
  | "receive_seller_credit"
  | "cancel_buyer_refund"
  | "cancel_seller_unlock"
  | "deletion_release"
  | "mission_reward"
  | "donation_sent"
  | "donation_received"
  | "admin_grant"
  | "admin_debit";

const REASON_TRANSACTION_TYPE: Record<CreditReason, TransactionType> = {
  genesis_opening_balance: "admin",
  offer_lock: "loop",
  offer_unlock_withdrawn: "loop",
  offer_unlock_rejected: "loop",
  accept_buyer_adjust: "loop",
  accept_seller_lock: "loop",
  receive_buyer_settle: "loop",
  receive_seller_credit: "loop",
  cancel_buyer_refund: "loop",
  cancel_seller_unlock: "loop",
  deletion_release: "loop",
  mission_reward: "mission",
  donation_sent: "donation",
  donation_received: "donation",
  admin_grant: "admin",
  admin_debit: "admin",
};

export interface CreditMovement {
  userId: UUID;
  /** Delta con signo aplicado a `credits_balance`. Puede ser 0 si el movimiento no toca ese bucket. */
  balanceDelta: number;
  /** Delta con signo aplicado a `credits_locked`. Puede ser 0 si el movimiento no toca ese bucket. */
  lockedDelta: number;
  reason: CreditReason;
  /** Publicación, misión o usuario contraparte que motiva el movimiento. */
  referenceId: UUID | null;
  meta?: JsonObject | null;
  /**
   * Filtro de comunidad para el guard `WHERE`. Por defecto `client.communityId`, que alcanza para
   * cualquier flujo scopeado (`inCommunity`). Los callers `unscoped("admin")` lo tienen que pasar
   * explícito: `client.communityId` es siempre `null` en esa conexión, y no representa la
   * restricción real (la comunidad del admin, o `null` para super admin). El `community_id` que
   * termina en el ledger nunca sale de acá — sale del `RETURNING` de la fila de `users` afectada,
   * así que siempre es el valor real de esa fila, nunca el del filtro.
   */
  scopeCommunityId?: UUID | null;
}

/**
 * Aplica un lote de movimientos de crédito en una única transacción: un `UPDATE` relativo y
 * guardado por usuario (design D1), seguido de una fila de ledger por movimiento (design D2).
 *
 * Ordena el lote por `userId` antes de tocar nada (design D3, regla 3): dos callers que arman el
 * mismo lote en orden distinto emiten los mismos `UPDATE`, en el mismo orden, así que no hay ciclo
 * de deadlock posible entre dos transacciones que muevan a los mismos dos usuarios.
 *
 * Nunca abre su propia conexión: corre dentro de la transacción del caller. Si el caller no abrió
 * una (`transaction: true`), esto no es atómico con el resto de sus queries — es responsabilidad del
 * caller, no de este helper, exigir la transacción.
 */
export const applyCreditMovements = async (
  client: DatabaseClient,
  movements: CreditMovement[],
): Promise<void> => {
  if (movements.length === 0) return;

  for (const movement of movements) {
    if (movement.balanceDelta === 0 && movement.lockedDelta === 0) {
      // Nunca debería pasar en producción: es un error de programación del caller, no un caso de
      // negocio. Una fila de ledger sin cambio real es puro ruido (credit-ledger: "Ledger Entry On
      // Every Movement").
      throw new Error(
        `applyCreditMovements: el movimiento "${movement.reason}" para el usuario ${movement.userId} ` +
          `no cambia ningún bucket (balanceDelta y lockedDelta son 0)`,
      );
    }
  }

  const sorted = [...movements].sort((a, b) =>
    a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0,
  );

  for (const movement of sorted) {
    const scopeCommunityId =
      movement.scopeCommunityId !== undefined ? movement.scopeCommunityId : client.communityId;

    const [updated] = await client.query(queries.applyCreditDelta, [
      movement.balanceDelta,
      movement.lockedDelta,
      movement.userId,
      scopeCommunityId,
    ]);

    if (!updated) {
      // Cero filas es ambiguo (design D1): puede ser "fondos insuficientes" o "usuario fuera de la
      // comunidad". Esta lectura de más solo corre en el camino de error, así que no cuesta nada en
      // el caso feliz.
      const [userDb] = await client.query(queries.userById, [movement.userId, scopeCommunityId]);
      if (!userDb) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
    }

    // `amount`/`positive` son la vista "legada" del movimiento (design D4): se derivan del bucket
    // que efectivamente cambió, priorizando `balanceDelta` cuando ambos son distintos de 0 (nunca
    // pasa hoy, pero deja la regla determinística si algún día pasara).
    const amount =
      movement.balanceDelta !== 0
        ? Math.abs(movement.balanceDelta)
        : Math.abs(movement.lockedDelta);
    const positive =
      movement.balanceDelta !== 0 ? movement.balanceDelta > 0 : movement.lockedDelta > 0;

    await client.query(queries.insertCreditLedgerEntry, [
      movement.userId,
      REASON_TRANSACTION_TYPE[movement.reason],
      positive,
      amount,
      movement.balanceDelta,
      movement.lockedDelta,
      Number(updated.credits_balance),
      Number(updated.credits_locked),
      movement.reason,
      movement.referenceId,
      movement.meta ? JSON.stringify(movement.meta) : null,
      updated.community_id,
    ]);
  }
};
