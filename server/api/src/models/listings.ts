import { ERROR_MESSAGES, MISSION_KEYS, PAGE_SIZE } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  UnauthorizedError,
} from "../services/errors";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type {
  AcceptOfferPayload,
  CreateListingPayload,
  GetListingByIdPayload,
  GetListingsPayload,
  ListingActionPayload,
  NewOfferPayload,
  UpdateListingPayload,
} from "../types/models.js";
import type { CreditMovement } from "../utils/credits.js";
import { applyCreditMovements } from "../utils/credits.js";
import {
  getCategoryById,
  getMediasByListingId,
  getMediasByListingIds,
  getMediaById,
  getUserById,
  getUsersByIds,
  getListingById,
  progressMission,
} from "../utils/helpersDb";
import { computeLoopEscrow } from "../utils/loopEscrow.js";
import { sendLoopNotification } from "../utils/notifications";
import {
  parseCategoryBaseFromDb,
  parseListingBaseFromDb,
  parseListingFromBase,
  parsePagination,
  parseUserBaseFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";
import { escapeLike } from "../utils/escapeLike";

export class ListingsModel {
  static getListings = async (query: GetListingsPayload) => {
    const {
      communityId,
      page = 1,
      order,
      sort,
      categoryId,
      productStatus,
      schoolId,
      searchTerm,
      userId,
      sellerId,
    } = query;

    return withClient(
      async (client) => {
        const listingsSearchDb = await client.query(
          queries.searchListings({
            sort: getSortValue(sort),
            order: getOrderValue(order),
          }),
          [
            searchTerm ? escapeLike(searchTerm) : null,
            categoryId ?? null,
            productStatus ?? null,
            schoolId ?? null,
            sellerId ?? null,
            userId ?? null,
            PAGE_SIZE,
            page ? (page - 1) * PAGE_SIZE : 0,
            client.communityId,
          ],
        );
        const totalRecords = safeNumber(listingsSearchDb[0]?.total_records) ?? 0;
        const listingsBase = listingsSearchDb.map(parseListingBaseFromDb);

        const uniqueSellerIds = [...new Set(listingsBase.map((l) => l.sellerId))];
        const uniqueBuyerIds = [
          ...new Set(listingsBase.map((l) => l.buyerId).filter(Boolean) as UUID[]),
        ];
        const listingIds = listingsBase.map((l) => l.id);

        const [sellersMap, buyersMap, mediaByListingMap] = await Promise.all([
          getUsersByIds({ client, userIds: uniqueSellerIds }),
          getUsersByIds({ client, userIds: uniqueBuyerIds }),
          getMediasByListingIds({ client, listingIds }),
        ]);

        const listings = await Promise.all(
          listingsBase.map(async (listingBase) => {
            return parseListingFromBase({
              listing: listingBase,
              buyer: listingBase.buyerId ? (buyersMap.get(listingBase.buyerId) ?? null) : null,
              seller: sellersMap.get(listingBase.sellerId)!,
              category: await getCategoryById({
                client,
                categoryId: listingBase.categoryId,
              }),
              media: mediaByListingMap.get(listingBase.id) ?? [],
            });
          }),
        );

        return {
          listings,
          pagination: parsePagination({ currentPage: page, totalRecords }),
        };
      },
      { scope: inCommunity(communityId) },
    );
  };

  /**
   * Transaccional (listing-lifecycle: "Transactional Listing Creation With Category Bounds",
   * ECO-08): antes no llevaba `transaction: true` y otorgaba crédito de misión hasta tres veces sin
   * ninguna atomicidad — una falla a mitad de camino podía dejar créditos minteados contra una
   * publicación que ni siquiera llegó a existir.
   */
  static createListing = async ({
    title,
    description,
    price,
    categoryId,
    userId,
    productStatus,
    mediaIds,
    communityId,
  }: CreateListingPayload) => {
    return withClient(
      async (client) => {
        // `price_credits` es INTEGER en la base; `validations.ts:postListingsRequestBody` no le
        // agrega `.int()` (ese schema lo posee otro bloque de la auditoría), así que la cota entera
        // se aplica acá, junto con el rango de la categoría.
        if (!Number.isInteger(price) || price < 0) {
          throw new InvalidInputError(
            ERROR_MESSAGES.INVALID_PRICE_FOR_CATEGORY,
            "INVALID_PRICE_FOR_CATEGORY",
          );
        }

        const [categoryDb] = await client.query(queries.categoryById, [categoryId]);
        if (!categoryDb) {
          throw new InvalidInputError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
        }
        const minPrice =
          categoryDb.min_price_credits !== null ? Number(categoryDb.min_price_credits) : null;
        const maxPrice =
          categoryDb.max_price_credits !== null ? Number(categoryDb.max_price_credits) : null;
        if ((minPrice !== null && price < minPrice) || (maxPrice !== null && price > maxPrice)) {
          throw new InvalidInputError(
            ERROR_MESSAGES.INVALID_PRICE_FOR_CATEGORY,
            "INVALID_PRICE_FOR_CATEGORY",
          );
        }

        if (mediaIds.length > 0) {
          const mediaRowsDb = await client.query(queries.mediaByIds(mediaIds), [
            mediaIds,
            client.communityId,
          ]);
          const ownedIds = new Set(
            mediaRowsDb.filter((m) => m.uploaded_by === userId).map((m) => m.id),
          );
          if (mediaIds.some((id) => !ownedIds.has(id))) {
            throw new InvalidInputError(ERROR_MESSAGES.MEDIA_NOT_OWNED, "MEDIA_NOT_OWNED");
          }
        }

        const listingStatus: ListingStatus = "published";
        const [newListing] = await client.query(queries.createListing, [
          title,
          description,
          price,
          categoryId,
          userId,
          productStatus,
          listingStatus,
          communityId,
        ]);
        if (!newListing?.id) {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
        }
        // Nunca Promise.all sobre la misma conexión (design D3 regla 5): cada INSERT se ejecuta uno
        // por uno.
        for (const mediaId of mediaIds) {
          await client.query(queries.linkMediaToListing, [newListing.id, mediaId, communityId]);
        }
        const listing = parseListingFromBase({
          listing: {
            id: newListing.id,
            title,
            description,
            price,
            categoryId,
            sellerId: userId,
            buyerId: null,
            createdAt: new Date().toISOString(),
            disabled: false,
            listingStatus: "published",
            offeredCredits: null,
            productStatus,
          },
          buyer: null,
          seller: await getUserById({ client, userId }),
          category: await getCategoryById({ client, categoryId }),
          media: await getMediasByListingId({ client, listingId: newListing.id }),
        });

        await progressMission({
          client,
          userId,
          missionKey: MISSION_KEYS.PUBLISH_LISTING_1,
        });
        await progressMission({
          client,
          userId,
          missionKey: MISSION_KEYS.PUBLISH_LISTING_2,
        });
        await progressMission({
          client,
          userId,
          missionKey: MISSION_KEYS.PUBLISH_LISTING_3,
        });
        return { listing };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static updateListing = async ({
    listingId,
    title,
    description,
    price,
    categoryId,
    userId,
    productStatus,
    mediaIds,
    communityId,
  }: UpdateListingPayload) => {
    return withClient(
      async (client) => {
        const [oldListingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!oldListingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const oldListingBase = parseListingBaseFromDb(oldListingDb);
        if (oldListingBase.sellerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
        }
        if (oldListingBase.listingStatus !== "published") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_MODIFY);
        }

        try {
          await client.query(queries.updateListingById, [
            title ?? oldListingBase.title,
            description ?? oldListingBase.description,
            price ?? oldListingBase.price,
            categoryId ?? oldListingBase.categoryId,
            productStatus ?? oldListingBase.productStatus,
            listingId,
            client.communityId,
          ]);
        } catch {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }

        try {
          if (mediaIds) {
            await client.query(queries.unlinkAllMediaFromListing, [listingId, client.communityId]);
            await Promise.all(
              mediaIds.map((mediaId) =>
                client.query(queries.linkMediaToListing, [listingId, mediaId, communityId]),
              ),
            );
          }
        } catch {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
        }

        const listing = parseListingFromBase({
          listing: {
            id: listingId,
            title: title ?? oldListingBase.title,
            description: description ?? oldListingBase.description,
            price: price ?? oldListingBase.price,
            categoryId: categoryId ?? oldListingBase.categoryId,
            sellerId: userId,
            buyerId: null,
            createdAt: new Date().toISOString(),
            disabled: false,
            listingStatus: "published",
            offeredCredits: null,
            productStatus: productStatus ?? oldListingBase.productStatus,
          },
          buyer: null,
          seller: await getUserById({ client, userId }),
          category: await getCategoryById({
            client,
            categoryId: categoryId ?? oldListingBase.categoryId,
          }),
          media: mediaIds
            ? await Promise.all(mediaIds.map((mediaId) => getMediaById({ client, mediaId })))
            : await getMediasByListingId({ client, listingId }),
        });

        return { listing };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static deleteListing = async ({ listingId, userId, communityId }: ListingActionPayload) => {
    return withClient(
      async (client) => {
        const [listingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!listingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        if (listingDb.seller_id !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
        }
        if (listingDb.listing_status !== "published") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE);
        }
        await client.query(queries.deleteListingById, [listingId, userId, client.communityId]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getListingById = async ({ listingId, communityId }: GetListingByIdPayload) => {
    return withClient(
      async (client) => {
        const listing = await getListingById({ client, listingId });
        return { listing };
      },
      { scope: inCommunity(communityId) },
    );
  };

  /**
   * ECO-03: `queries.newOffer` ahora es un UPDATE guardado sobre `published`/sin comprador
   * (listing-lifecycle: "A second buyer cannot overwrite the first"). Cero filas significa que otro
   * comprador ganó la carrera, o que el listing cambió de estado entre la lectura de arriba y este
   * UPDATE — 409, nunca un 200 silencioso sobre un estado que ya no existe.
   */
  static newOffer = async ({ listingId, userId, offeredCredits, communityId }: NewOfferPayload) => {
    return withClient(
      async (client) => {
        const [listingBaseDb] = await client.query(queries.listingById, [
          listingId,
          client.communityId,
        ]);
        if (!listingBaseDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const listingBase = parseListingBaseFromDb(listingBaseDb);
        if (listingBase.listingStatus !== "published") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_OFFER);
        }
        if (offeredCredits < 0 || offeredCredits > listingBase.price) {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_OFFER_PRICE);
        }
        if (listingBase.sellerId === userId) {
          throw new InvalidInputError(ERROR_MESSAGES.CANNOT_OFFER_OWN_LISTING);
        }

        const [sellerDb] = await client.query(queries.userById, [
          listingBase.sellerId,
          client.communityId,
        ]);
        if (!sellerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const sellerBase = parseUserBaseFromDb(sellerDb);

        const [updatedListingDb] = await client.query(queries.newOffer, [
          offeredCredits,
          userId,
          listingId,
          client.communityId,
        ]);
        if (!updatedListingDb) {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_OFFER);
        }

        // El lock de créditos es el único movimiento del choque: si el usuario no tiene fondos
        // suficientes, `applyCreditMovements` levanta `INSUFFICIENT_CREDITS` y toda la transacción
        // (incluido el UPDATE de arriba) se revierte.
        await applyCreditMovements(client, [
          {
            userId,
            balanceDelta: -offeredCredits,
            lockedDelta: offeredCredits,
            reason: "offer_lock",
            referenceId: listingId,
          },
        ]);

        const listing = parseListingFromBase({
          listing: {
            ...listingBase,
            offeredCredits,
            buyerId: userId,
            listingStatus: "offered",
          },
          buyer: await getUserById({ client, userId }),
          category: await getCategoryById({
            client,
            categoryId: listingBase.categoryId,
          }),
          media: await getMediasByListingId({
            client,
            listingId: listingBase.id,
          }),
          seller: await getUserById({ client, userId: listingBase.sellerId }),
        });

        await sendLoopNotification({
          userId: listingBase.sellerId,
          notificationToken: sellerBase.notificationToken,
          listingId: listingBase.id,
          client,
          toListingStatus: "offered",
          toOfferedCredits: offeredCredits,
          buyerId: userId,
          type: "new_offer",
        });

        return { listing };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static deleteOffer = async ({ listingId, userId, communityId }: ListingActionPayload) => {
    return withClient(
      async (client) => {
        const [oldListingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!oldListingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const oldListing = parseListingBaseFromDb(oldListingDb);
        if (oldListing.buyerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
        }
        if (oldListing.listingStatus !== "offered") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE_OFFER);
        }

        // `queries.deleteOffer` está guardado (`listing_status = 'offered'`) y devuelve, en el mismo
        // statement, cuánto tenía bloqueado el comprador ANTES del update — la única forma de leerlo
        // sin una segunda consulta que ya sería stale (listing-lifecycle/credit-ledger).
        const [updatedDb] = await client.query(queries.deleteOffer, [
          listingId,
          client.communityId,
        ]);
        if (!updatedDb) {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE_OFFER);
        }
        const refund =
          updatedDb.previous_offered_credits !== null
            ? Number(updatedDb.previous_offered_credits)
            : 0;
        if (refund > 0) {
          await applyCreditMovements(client, [
            {
              userId,
              balanceDelta: refund,
              lockedDelta: -refund,
              reason: "offer_unlock_withdrawn",
              referenceId: listingId,
            },
          ]);
        }

        let sellerBase: UserBase;
        try {
          const [sellerDb] = await client.query(queries.userById, [
            oldListing.sellerId,
            client.communityId,
          ]);
          sellerBase = parseUserBaseFromDb(sellerDb!);
        } catch {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        const listing = parseListingFromBase({
          listing: {
            ...oldListing,
            offeredCredits: null,
            buyerId: null,
            listingStatus: "published",
          },
          buyer: null,
          category: await getCategoryById({
            client,
            categoryId: oldListing.categoryId,
          }),
          media: await getMediasByListingId({
            client,
            listingId: oldListing.id,
          }),
          seller: await getUserById({ client, userId: oldListing.sellerId }),
        });

        await sendLoopNotification({
          userId: listing.seller.id,
          notificationToken: sellerBase.notificationToken,
          listingId: listing.id,
          client,
          toListingStatus: "published",
          toOfferedCredits: null,
          buyerId: null,
          type: "offer_deleted",
        });

        return { listing };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static rejectOffer = async ({ listingId, userId, communityId }: ListingActionPayload) => {
    return withClient(
      async (client) => {
        const [oldListingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!oldListingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const oldListing = parseListingBaseFromDb(oldListingDb);
        if (oldListing.sellerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
        }
        if (oldListing.listingStatus !== "offered") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }

        const [updatedDb] = await client.query(queries.deleteOffer, [
          listingId,
          client.communityId,
        ]);
        if (!updatedDb) {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }
        const buyerId = updatedDb.previous_buyer_id ?? oldListing.buyerId;
        const refund =
          updatedDb.previous_offered_credits !== null
            ? Number(updatedDb.previous_offered_credits)
            : 0;
        if (!buyerId) {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }
        if (refund > 0) {
          await applyCreditMovements(client, [
            {
              userId: buyerId,
              balanceDelta: refund,
              lockedDelta: -refund,
              reason: "offer_unlock_rejected",
              referenceId: listingId,
            },
          ]);
        }

        let buyerBase: UserBase;
        try {
          const [buyerDb] = await client.query(queries.userById, [buyerId, client.communityId]);
          buyerBase = parseUserBaseFromDb(buyerDb!);
        } catch {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        await sendLoopNotification({
          userId: buyerId,
          notificationToken: buyerBase.notificationToken,
          listingId: oldListing.id,
          client,
          toListingStatus: "published",
          toOfferedCredits: null,
          type: "offer_rejected",
          buyerId: null,
        });
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  /**
   * ECO-04. Corrección al audit (design.md "Corrections to the Audit" #2): la pertenencia de cada
   * trade YA se validaba (`sellerId !== oldListing.buyerId`); lo que faltaba era que esa lectura no
   * tomaba lock y no exigía que el listing siguiera `published`/sin comprador. Ahora el listing
   * principal y todos los tradeados se bloquean en un único `SELECT … FOR UPDATE … ORDER BY id`
   * (design D3 regla 2) antes de mover ningún crédito, y cada claim posterior es un UPDATE guardado
   * — cero filas en cualquiera de los dos hace fallar TODA la aceptación con 409, sin dejar ningún
   * balance a medio mover (`withClient` revierte la transacción entera).
   */
  static acceptOffer = async ({
    listingId,
    userId,
    tradingListingIds,
    communityId,
  }: AcceptOfferPayload) => {
    return withClient(
      async (client) => {
        // Pre-chequeo liviano, sin lock: evita tomar filas por una request inválida de entrada.
        const [oldListingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!oldListingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const preCheck = parseListingBaseFromDb(oldListingDb);
        if (preCheck.sellerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
        }
        if (preCheck.listingStatus !== "offered") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }
        if (preCheck.offeredCredits === null) {
          throw new InvalidInputError(ERROR_MESSAGES.OFFERED_CREDITS_NOT_FOUND);
        }

        // Lock autoritativo: listing principal + tradeados, en una sola sentencia, orden ascendente.
        const allIds = [listingId, ...tradingListingIds];
        const lockedRowsDb = await client.query(queries.listingsByIdsForUpdate(allIds), [
          allIds,
          client.communityId,
        ]);
        const lockedById = new Map(lockedRowsDb.map((row) => [row.id, row]));

        const oldListingLockedDb = lockedById.get(listingId);
        if (!oldListingLockedDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const oldListing = parseListingBaseFromDb(oldListingLockedDb);
        // Re-chequeo bajo lock: el pre-chequeo de arriba pudo haber quedado stale mientras se
        // esperaba el lock.
        if (oldListing.sellerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
        }
        if (oldListing.listingStatus !== "offered") {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }
        if (oldListing.offeredCredits === null) {
          throw new InvalidInputError(ERROR_MESSAGES.OFFERED_CREDITS_NOT_FOUND);
        }

        if (tradingListingIds.some((id) => !lockedById.has(id))) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const tradingListings: ListingBase[] = tradingListingIds.map((id) =>
          parseListingBaseFromDb(lockedById.get(id)!),
        );
        if (tradingListings.some((listing) => listing.sellerId !== oldListing.buyerId)) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
        }

        const tradingListingsTotalPrice = tradingListings.reduce(
          (acc, listing) => acc + listing.price,
          0,
        );
        let newSellerLocked = 0;
        let newBuyerLocked = 0;
        let newOfferedCredits: {
          id: UUID;
          offeredCredits: number;
        }[] = [];

        if (tradingListingsTotalPrice > oldListing.price) {
          newSellerLocked = tradingListingsTotalPrice - oldListing.price;
          newOfferedCredits = tradingListings.map((listing) => ({
            id: listing.id,
            offeredCredits: Math.floor(
              newSellerLocked * (listing.price / tradingListingsTotalPrice),
            ),
          }));
          const accumulated = newOfferedCredits.reduce((acc, curr) => acc + curr.offeredCredits, 0);
          if (accumulated < newSellerLocked) {
            const lastOfferedCreditsObj = newOfferedCredits[newOfferedCredits.length - 1];
            if (lastOfferedCreditsObj) {
              lastOfferedCreditsObj.offeredCredits += newSellerLocked - accumulated;
            }
          }
          newOfferedCredits.push({
            id: oldListing.id,
            offeredCredits: 0,
          });
        } else {
          newBuyerLocked = oldListing.price - tradingListingsTotalPrice;
          newOfferedCredits = [
            {
              id: oldListing.id,
              offeredCredits: newBuyerLocked,
            },
          ];
        }

        // listing-lifecycle: "Preserved Offer Pricing Rule" (ECO-07, deferred a propósito) — un
        // offer por debajo del precio sin trades sigue sin poder aceptarse. Comportamiento
        // intocado; ver proposal.md "Deferred — needs a product decision".
        if (newBuyerLocked > oldListing.offeredCredits) {
          throw new InvalidInputError(ERROR_MESSAGES.TOTAL_PRICE_EXCEEDED);
        }

        // El chequeo de saldo del vendedor ya no se pre-lee acá: lo hace `applyCreditMovements` de
        // forma atómica más abajo, contra el guard de `applyCreditDelta` (credit-ledger: "Guard
        // fires before the database constraint").
        let buyerBase: UserBase;
        try {
          const [buyerDb] = await client.query(queries.userById, [
            oldListing.buyerId!,
            client.communityId,
          ]);
          buyerBase = parseUserBaseFromDb(buyerDb!);
        } catch {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }

        // Reclama la oferta principal (guardado: 'offered' y vendedor dueño).
        const [acceptedDb] = await client.query(queries.acceptOffer, [
          listingId,
          client.communityId,
          userId,
        ]);
        if (!acceptedDb) {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }

        // Ordenado, nunca Promise.all sobre la misma conexión (design D3 regla 5).
        for (const { id, offeredCredits } of newOfferedCredits) {
          await client.query(queries.updateListingOfferedCreditsById, [
            offeredCredits,
            id,
            client.communityId,
          ]);
        }

        // Reclama cada tradeado (guardado: 'published', sin comprador, del comprador de la oferta
        // principal) y persiste el trade — listing-lifecycle: "Validated And Persisted Trades",
        // "Accepted trades are recorded". Cero filas en cualquiera hace fallar TODA la aceptación.
        for (const tradedListing of tradingListings) {
          const [claimedDb] = await client.query(queries.markListingAsSold, [
            userId,
            tradedListing.id,
            client.communityId,
            oldListing.buyerId,
          ]);
          if (!claimedDb) {
            throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
          }
          await client.query(queries.storeTrade, [listingId, tradedListing.id, client.communityId]);
        }

        const movements: CreditMovement[] = [];
        if (newSellerLocked > 0) {
          movements.push({
            userId,
            balanceDelta: -newSellerLocked,
            lockedDelta: newSellerLocked,
            reason: "accept_seller_lock",
            referenceId: listingId,
          });
        }
        const buyerAdjust = oldListing.offeredCredits - newBuyerLocked;
        if (buyerAdjust !== 0) {
          movements.push({
            userId: oldListing.buyerId!,
            balanceDelta: buyerAdjust,
            lockedDelta: -buyerAdjust,
            reason: "accept_buyer_adjust",
            referenceId: listingId,
          });
        }
        if (movements.length > 0) {
          await applyCreditMovements(client, movements);
        }

        await sendLoopNotification({
          userId: oldListing.buyerId!,
          notificationToken: buyerBase.notificationToken,
          listingId: oldListing.id,
          client,
          toListingStatus: "accepted",
          toOfferedCredits: null,
          buyerId: oldListing.buyerId!,
          type: "offer_accepted",
        });

        for (const tradedListing of tradingListings) {
          await sendLoopNotification({
            userId: oldListing.buyerId!,
            notificationToken: buyerBase.notificationToken,
            listingId: tradedListing.id,
            client,
            toListingStatus: "accepted",
            toOfferedCredits: null,
            buyerId: userId,
            type: "listing_sold",
            disablePush: true,
          });
        }
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  /**
   * ECO-01 (corrección puntual, design "Corrections to the Audit" — consecuencia de la vieja
   * escritura absoluta de saldo): esta era la única escritura de toda la app que reescribía
   * `credits_balance` a su propio valor "por las dudas" mientras solo pretendía tocar
   * `credits_locked` — un lost-update sin ningún propósito, y la razón por la que credit-ledger
   * exige "Only the intended bucket changes". Ahora el bucket que no cambia directamente NO
   * aparece en el UPDATE en absoluto.
   */
  static receiveListing = async ({ listingId, userId, communityId }: ListingActionPayload) => {
    return withClient(
      async (client) => {
        const [listingDb] = await client.query(queries.getListingById, [
          listingId,
          client.communityId,
        ]);
        if (!listingDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const listingBase = parseListingBaseFromDb(listingDb);
        if (listingBase.buyerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
        }
        if (listingBase.listingStatus !== "accepted") {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }

        const [receivedDb] = await client.query(queries.markListingAsReceived, [
          listingId,
          client.communityId,
          userId,
        ]);
        if (!receivedDb) {
          throw new ConflictError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
        }

        const offered = listingBase.offeredCredits ?? 0;
        const movements: CreditMovement[] = [];
        if (offered > 0) {
          movements.push(
            {
              userId: listingBase.buyerId!,
              balanceDelta: 0,
              lockedDelta: -offered,
              reason: "receive_buyer_settle",
              referenceId: listingId,
            },
            {
              userId: listingBase.sellerId,
              balanceDelta: offered,
              lockedDelta: 0,
              reason: "receive_seller_credit",
              referenceId: listingId,
            },
          );
        }
        if (movements.length > 0) {
          await applyCreditMovements(client, movements);
        }

        let sellerBase: UserBase;
        try {
          const [sellerDb] = await client.query(queries.userById, [
            listingBase.sellerId,
            client.communityId,
          ]);
          sellerBase = parseUserBaseFromDb(sellerDb!);
        } catch {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        await sendLoopNotification({
          userId: listingBase.sellerId!,
          notificationToken: sellerBase.notificationToken,
          listingId: listingBase.id,
          client,
          toListingStatus: "received",
          toOfferedCredits: null,
          type: "listing_received",
          buyerId: listingBase.buyerId!,
        });

        try {
          const [categoryDb] = await client.query(queries.categoryById, [listingBase.categoryId]);
          const categoryBase = parseCategoryBaseFromDb(categoryDb!);
          await client.query(queries.increaseUserStats, [
            categoryBase.stats?.kgWaste || 0,
            categoryBase.stats?.kgCo2 || 0,
            categoryBase.stats?.lH2o || 0,
            sellerBase.id,
            client.communityId,
          ]);
          await client.query(queries.increaseUserStats, [
            categoryBase.stats?.kgWaste || 0,
            categoryBase.stats?.kgCo2 || 0,
            categoryBase.stats?.lH2o || 0,
            listingBase.buyerId!,
            client.communityId,
          ]);

          const sellerSchoolsDb = await client.query(queries.userSchoolsByUserId, [
            sellerBase.id,
            client.communityId,
          ]);
          const buyerSchoolsDb = await client.query(queries.userSchoolsByUserId, [
            listingBase.buyerId!,
            client.communityId,
          ]);
          const schoolsIds = [...sellerSchoolsDb, ...buyerSchoolsDb].map((db) => db.school_id);
          const uniqueSchoolsIds = Array.from(new Set(schoolsIds));
          for (const schoolId of uniqueSchoolsIds) {
            await client.query(queries.increaseSchoolStats, [
              categoryBase.stats?.kgWaste || 0,
              categoryBase.stats?.kgCo2 || 0,
              categoryBase.stats?.lH2o || 0,
              schoolId,
              client.communityId,
            ]);
          }
          // `increaseGlobalStats` exige la comunidad sí o sí ($4 no es opcional): `global_stats`
          // tiene 3 filas por comunidad, y sin el filtro este loop le sumaría su impacto ambiental
          // a todas las comunidades a la vez. Por eso va `communityId` del payload y no
          // `client.communityId`, que es nullable.
          await client.query(queries.increaseGlobalStats, [
            safeNumber(categoryBase.stats?.kgWaste) || 0,
            safeNumber(categoryBase.stats?.kgCo2) || 0,
            safeNumber(categoryBase.stats?.lH2o) || 0,
            communityId,
          ]);
        } catch {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  /**
   * ECO-05 (design D7 transiciones 7/8, listing-lifecycle: "Cancellation Of An Accepted Loop").
   * Reemplaza por completo la implementación vieja, que provablemente nunca corrió — un bug de
   * aridad documentado en el propio código (la query de update siempre tuvo 4 parámetros y acá se
   * le pasaban 3) hacía que cualquier intento explotara. No hay comportamiento que preservar: el
   * viejo código cobraba `price - offeredCredits` de bolsillo al vendedor y le acreditaba el
   * `price` completo al comprador en vez de lo que tenía bloqueado — "cancelar" salía caro. La
   * regla nueva es simétrica: cada parte recupera exactamente lo que esta publicación le tenía
   * bloqueado, ni más ni menos, y puede cancelar cualquiera de las dos partes, no solo el vendedor.
   */
  static cancelListing = async ({ listingId, userId, communityId }: ListingActionPayload) => {
    return withClient(
      async (client) => {
        const [listingLockedDb] = await client.query(queries.listingsByIdsForUpdate([listingId]), [
          [listingId],
          client.communityId,
        ]);
        if (!listingLockedDb) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        const listingBase = parseListingBaseFromDb(listingLockedDb);
        if (listingBase.sellerId !== userId && listingBase.buyerId !== userId) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_PARTY, "NOT_LISTING_PARTY");
        }
        if (listingBase.listingStatus !== "accepted") {
          throw new InvalidInputError(
            ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_CANCEL,
            "INVALID_LISTING_STATUS_TO_CANCEL",
          );
        }

        // Reconstruye lo que cada parte tiene bloqueado por ESTE loop puntual, a partir de
        // `listing_trades` (persistido gracias a ECO-04) y de `offered_credits` — nunca de un saldo
        // total, que mezclaría este loop con cualquier otro que el usuario tenga abierto.
        const { buyerLocked, sellerLocked, tradedListingIds } = await computeLoopEscrow({
          client,
          listing: listingLockedDb,
        });

        const [cancelledDb] = await client.query(queries.cancelAcceptedListing, [
          listingId,
          userId,
          client.communityId,
        ]);
        if (!cancelledDb) {
          throw new ConflictError(
            ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_CANCEL,
            "INVALID_LISTING_STATUS_TO_CANCEL",
          );
        }

        if (tradedListingIds.length > 0) {
          await client.query(queries.revertTradedListings(tradedListingIds), [
            tradedListingIds,
            client.communityId,
          ]);
          await client.query(queries.deleteTradesByListingId, [listingId, client.communityId]);
        }

        const movements: CreditMovement[] = [];
        if (buyerLocked > 0) {
          movements.push({
            userId: listingBase.buyerId!,
            balanceDelta: buyerLocked,
            lockedDelta: -buyerLocked,
            reason: "cancel_buyer_refund",
            referenceId: listingId,
          });
        }
        if (sellerLocked > 0) {
          movements.push({
            userId: listingBase.sellerId,
            balanceDelta: sellerLocked,
            lockedDelta: -sellerLocked,
            reason: "cancel_seller_unlock",
            referenceId: listingId,
          });
        }
        if (movements.length > 0) {
          await applyCreditMovements(client, movements);
        }

        // Se notifica a la contraparte de quien canceló — igual que el resto del ciclo de vida,
        // donde quien dispara la acción no se notifica a sí mismo.
        const counterpartyId =
          userId === listingBase.sellerId ? listingBase.buyerId! : listingBase.sellerId;
        let counterpartyBase: UserBase | null = null;
        try {
          const [counterpartyDb] = await client.query(queries.userById, [
            counterpartyId,
            client.communityId,
          ]);
          counterpartyBase = counterpartyDb ? parseUserBaseFromDb(counterpartyDb) : null;
        } catch {
          counterpartyBase = null;
        }

        await sendLoopNotification({
          userId: counterpartyId,
          notificationToken: counterpartyBase?.notificationToken ?? null,
          listingId: listingBase.id,
          client,
          toListingStatus: "published",
          toOfferedCredits: null,
          buyerId: null,
          type: "listing_cancelled",
        });
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };
}
