import { queries } from "../services/queries.js";
import type { DatabaseClient } from "../types/dbClient.js";

export interface LoopEscrow {
  /** Cuánto tiene bloqueado el comprador **por este loop puntual**. */
  buyerLocked: number;
  /** Cuánto tiene bloqueado el vendedor por este loop, solo > 0 si el trade-in superó el precio. */
  sellerLocked: number;
  /** Listings tradeados como parte de este loop (vacío si nunca se aceptó ninguno). */
  tradedListingIds: UUID[];
}

/**
 * Reconstruye cuánto crédito bloqueado le corresponde a cada parte de un loop `offered`/`accepted`,
 * a partir de columnas durables — no existe ninguna columna que guarde el lock del vendedor
 * directamente, así que se recalcula con la misma fórmula que `acceptOffer` usó para fijarlo
 * (design D7: "Cancel is symmetric and free"; también la usa `deleteSelf` para liberar a la
 * contraparte cuando el usuario que se borra tenía un loop abierto).
 *
 * Requiere `listing_trades` persistido (ECO-04): sin esa fila no hay forma de saber qué listings
 * se tradearon, y por lo tanto tampoco cuánto bloqueó el vendedor de más.
 */
export const computeLoopEscrow = async ({
  client,
  listing,
}: {
  client: DatabaseClient;
  listing: DB_Listings;
}): Promise<LoopEscrow> => {
  const buyerLocked = listing.offered_credits !== null ? Number(listing.offered_credits) : 0;

  const trades = await client.query(queries.tradesByListingId, [listing.id, client.communityId]);
  const tradedListingIds = trades.map((t) => t.trade_listing_id);

  let sellerLocked = 0;
  if (tradedListingIds.length > 0) {
    const tradedListingsDb = await client.query(queries.listingsByIds(tradedListingIds), [
      tradedListingIds,
      client.communityId,
    ]);
    const tradingListingsTotalPrice = tradedListingsDb.reduce(
      (acc, l) => acc + Number(l.price_credits),
      0,
    );
    sellerLocked = Math.max(tradingListingsTotalPrice - Number(listing.price_credits), 0);
  }

  return { buyerLocked, sellerLocked, tradedListingIds };
};
