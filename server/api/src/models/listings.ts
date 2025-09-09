import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import {
  InternalServerError,
  InvalidInputError,
  UnauthorizedError,
} from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import {
  getCategoryById,
  getMediasByListingId,
  getMediaById,
  getUserById,
  getListingById,
} from "../utils/helpersDb";
import {
  parseListingBaseFromDb,
  parseListingFromBase,
  parsePagination,
  parseUserBaseFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

export class ListingsModel {
  static getListings = async (query: GetListingsRequest["query"]) => {
    const {
      page = 1,
      order,
      sort = "created_at",
      categoryId,
      productStatus,
      schoolId,
      searchTerm,
      userId,
    } = query || {};
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const listingsSearchDb = await client.query(queries.searchListings, [
        searchTerm ?? null,
        categoryId ?? null,
        productStatus ?? null,
        schoolId ?? null,
        userId ?? null,
        sort,
        order,
        PAGE_SIZE,
        page ? (page - 1) * PAGE_SIZE : 0,
      ]);
      const totalRecords = safeNumber(listingsSearchDb[0]?.total_records) ?? 0;
      const listingsBase = listingsSearchDb.map(parseListingBaseFromDb);
      const listings = await Promise.all(
        listingsBase.map(async (listingBase) =>
          parseListingFromBase({
            listing: listingBase,
            buyer: listingBase.buyerId
              ? await getUserById({ client, userId: listingBase.buyerId })
              : null,
            seller: await getUserById({ client, userId: listingBase.sellerId }),
            category: await getCategoryById({
              client,
              categoryId: listingBase.categoryId,
            }),
            media: await getMediasByListingId({
              client,
              listingId: listingBase.id,
            }),
          }),
        ),
      );
      return {
        listings,
        pagination: parsePagination({ currentPage: page, totalRecords }),
      };
    } finally {
      await client.release();
    }
  };

  static createListing = async ({
    title,
    description,
    price,
    categoryId,
    userId,
    productStatus,
    mediaIds,
  }: {
    title: string;
    description: string | null;
    price: number;
    categoryId: string;
    userId: string;
    productStatus: ProductStatus;
    mediaIds: string[];
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const listingStatus: ListingStatus = "published";
      const [newListing] = await client.query(queries.createListing, [
        title,
        description,
        price,
        categoryId,
        userId,
        productStatus,
        listingStatus,
      ]);
      if (!newListing?.id) {
        console.error("Id mal obtenido en listings");
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }
      await Promise.all(
        mediaIds.map((mediaId) =>
          client.query(queries.linkMediaToListing, [newListing.id, mediaId]),
        ),
      );
      const listing = parseListingFromBase({
        listing: {
          id: newListing.id,
          title,
          description,
          price,
          categoryId,
          sellerId: userId,
          buyerId: null,
          createdAt: new Date(),
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

      return { listing };
    } finally {
      await client.release();
    }
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
  }: {
    listingId: string;
    title?: string;
    description?: string | null;
    price?: number;
    categoryId?: string;
    userId: string;
    productStatus?: ProductStatus;
    mediaIds?: string[];
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
      await client.begin();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener información de la publicación
      const [oldListingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!oldListingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const oldListingBase = parseListingBaseFromDb(oldListingDb);
      // Validar si es el propietario
      if (oldListingBase.sellerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
      }
      // Validar si el estado de la lista es "Publicado"
      if (oldListingBase.listingStatus !== "published") {
        throw new InvalidInputError(
          ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_MODIFY,
        );
      }
      // Actualizar la información de la publicación
      try {
        await client.query(queries.updateListingById, [
          title ?? oldListingBase.title,
          description ?? oldListingBase.description,
          price ?? oldListingBase.price,
          categoryId ?? oldListingBase.categoryId,
          productStatus ?? oldListingBase.productStatus,
          listingId,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      try {
        if (mediaIds) {
          await client.query(queries.unlinkAllMediaFromListing, [listingId]);
          await Promise.all(
            mediaIds.map((mediaId) =>
              client.query(queries.linkMediaToListing, [listingId, mediaId]),
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
          createdAt: new Date(),
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
          ? await Promise.all(
              mediaIds.map((mediaId) => getMediaById({ client, mediaId })),
            )
          : await getMediasByListingId({ client, listingId }),
      });

      await client.commit();
      return { listing };
    } catch {
      await client.rollback();
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    } finally {
      await client.release();
    }
  };

  static getListingById = async ({ listingId }: { listingId: UUID }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const listing = await getListingById({ client, listingId });
      return { listing };
    } finally {
      await client.release();
    }
  };

  static newOffer = async ({
    listingId,
    userId,
    price,
  }: {
    listingId: UUID;
    userId: UUID;
    price: number;
  }) => {
    // Obtener cliente de base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
      // Iniciar transacción
      await client.begin();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener publicación
      const [listingBaseDb] = await client.query(queries.listingById, [
        listingId,
      ]);
      if (!listingBaseDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const listingBase = parseListingBaseFromDb(listingBaseDb);
      // Verificar el estado de la publicación
      if (listingBase.listingStatus !== "published") {
        throw new InvalidInputError(
          ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_OFFER,
        );
      }
      // Validar precio
      if (price < 0 || price > listingBase.price) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_OFFER_PRICE);
      }
      // Almacenar la oferta
      await client.query(queries.newOffer, [price, userId, listingId]);
      const listing = parseListingFromBase({
        listing: {
          ...listingBase,
          offeredCredits: price,
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
      // TODO - Enviar notificación al vendedor
      // Confirmar transacción
      await client.commit();
      // Devolver publicación
      return { listing };
    } catch (err) {
      // Cancelar transacción
      await client.rollback();
      throw err;
    } finally {
      await client.release();
    }
  };

  static deleteOffer = async ({
    listingId,
    userId,
  }: {
    listingId: UUID;
    userId: UUID;
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener publicación
      const [oldListingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!oldListingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const oldListing = parseListingBaseFromDb(oldListingDb);
      // Validar que el que quiere cancelar la oferta es el que la hizo
      if (oldListing.buyerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
      }
      // Validar que el estado de la publicación es el correcto
      if (oldListing.listingStatus !== "offered") {
        throw new InvalidInputError(
          ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE_OFFER,
        );
      }
      await client.query(queries.deleteOffer, [listingId]);
    } finally {
      await client.release();
    }
  };

  static rejectOffer = async ({
    listingId,
    userId,
  }: {
    listingId: UUID;
    userId: UUID;
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener publicación
      const [oldListingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!oldListingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const oldListing = parseListingBaseFromDb(oldListingDb);
      // Validar que el que quiere cancelar la oferta es el dueño de la publicación
      if (oldListing.sellerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
      }
      // Validar que el estado de la publicación es el correcto
      if (oldListing.listingStatus !== "offered") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
      }
      await client.query(queries.deleteOffer, [listingId]);

      // TODO - Enviar notificación
    } finally {
      await client.release();
    }
  };

  static acceptOffer = async ({
    listingId,
    userId,
    tradingListingIds,
  }: {
    listingId: UUID;
    userId: UUID;
    tradingListingIds: UUID[];
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();
      // Obtener publicación
      const [oldListingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!oldListingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const oldListing = parseListingBaseFromDb(oldListingDb);
      // Validar que el que quiere aceptar la oferta es el dueño de la publicación
      if (oldListing.sellerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
      }
      // Validar que el estado de la publicación es el correcto
      if (oldListing.listingStatus !== "offered") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
      }
      // Verificar que haya precio ofertado
      if (oldListing.offeredCredits === null) {
        throw new InvalidInputError(ERROR_MESSAGES.OFFERED_CREDITS_NOT_FOUND);
      }
      // Validar las publicaciones que quiere intercambiar
      let tradingListings: ListingBase[] = [];
      if (tradingListingIds.length > 0) {
        const tradingListingsDb = await Promise.all(
          tradingListingIds.map((id) =>
            client.query(queries.getListingById, [id]),
          ),
        );
        // Validar que existan
        if (tradingListingsDb.some(([db]) => !db)) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        tradingListings = tradingListingsDb.map(([db]) =>
          parseListingBaseFromDb(db!),
        );
        // Validar que el comprador sea el dueño
        if (
          tradingListings.some(
            (listing) => listing.sellerId !== oldListing.buyerId,
          )
        ) {
          throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
        }
      }
      // Calcular precio a pagar
      const totalPrice =
        oldListing.price -
        tradingListings.reduce((acc, listing) => acc + listing.price, 0);
      // Verificar que el precio esté dentro de lo ofrecido
      if (totalPrice > oldListing.offeredCredits) {
        throw new InvalidInputError(ERROR_MESSAGES.TOTAL_PRICE_EXCEEDED);
      }
      // Si el precio total es negativo, descontar del vendedor
      if (totalPrice < 0) {
        const [sellerDb] = await client.query(queries.userById, [userId]);
        if (!sellerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const sellerBase = parseUserBaseFromDb(sellerDb);
        // Verificar que el saldo del vendedor sea suficiente
        if (sellerBase.credits.balance < totalPrice) {
          throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
        }
        await client.query(queries.updateUserBalance, [
          sellerBase.credits.balance - totalPrice,
          sellerBase.credits.locked + totalPrice,
          sellerDb.id,
        ]);
        // TODO - Registrar transacción
      }
      // Si el precio es positivo, descontar al comprador
      if (totalPrice > 0) {
        const [buyerDb] = await client.query(queries.userById, [
          oldListing.buyerId,
        ]);
        if (!buyerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const buyerBase = parseUserBaseFromDb(buyerDb);
        // Devolver desde el locked del comprador si es que sobra
        const buyerLockedSurplus = oldListing.offeredCredits - totalPrice;
        const newLocked = buyerBase.credits.locked - buyerLockedSurplus;
        const newBalance = buyerBase.credits.balance + buyerLockedSurplus;
        await client.query(queries.updateUserBalance, [
          newBalance,
          newLocked,
          buyerDb.id,
        ]);
        // TODO - Registrar transacción
      }
      // Almacenar trade
      try {
        await Promise.all(
          tradingListings.map(async (listing) => {
            await client.query(queries.storeTrade, [oldListing.id, listing.id]);
          }),
        );
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Actualizar las publicaciones que se intercambiaron
      try {
        if (totalPrice < 0 && tradingListings.length > 0) {
          // Repartir los créditos del vendedor entre las publicaciones
          const tradingListingsTotalPrice = tradingListings.reduce(
            (acc, listing) => acc + listing.price,
            0,
          );
          let accumulated = 0;
          await Promise.all(
            tradingListings.map((listing, index) => {
              const offeredCredits =
                index !== tradingListings.length - 1
                  ? Math.floor(
                      (listing.price / tradingListingsTotalPrice) * -totalPrice,
                    )
                  : -totalPrice - accumulated;
              accumulated += offeredCredits;
              return client.query(queries.markListingAsSold, [
                userId,
                offeredCredits,
                listing.id,
              ]);
            }),
          );
          // Poner en 0 los créditos ofrecidos a la publicación original
          await client.query(queries.markListingAsSold, [
            oldListing.buyerId,
            null,
            oldListing.id,
          ]);
        }
        // Si las publicaciones a intercambiar no cubren el precio total
        if (totalPrice >= 0) {
          // Marcar como vendidas las publicaciones a intercambiar
          await Promise.all(
            tradingListings.map((listing) => {
              return client.query(queries.markListingAsSold, [
                userId,
                null,
                listing.id,
              ]);
            }),
          );
          // Marcar como vendida la publicación original actualizando
          // el precio ofrecido
          await client.query(queries.markListingAsSold, [
            oldListing.buyerId,
            totalPrice,
            oldListing.id,
          ]);
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // TODO - Enviar notificación al comprador
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      await client.release();
    }
  };

  static receiveListing = async ({
    listingId,
    userId,
  }: {
    listingId: UUID;
    userId: UUID;
  }) => {
    // Obtener cliente de base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Iniciar transacción
      await client.begin();
      // Obtener publicación
      const [listingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!listingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const listingBase = parseListingBaseFromDb(listingDb);
      // Verificar que el usuario sea el comprador
      if (listingBase.buyerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
      }
      // Verificar el estado de la publicación
      if (listingBase.listingStatus !== "accepted") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
      }
      // Transferir los créditos del comprador
      try {
        // Obtener comprador
        const [buyerDb] = await client.query(queries.userById, [
          listingBase.buyerId,
        ]);
        if (!buyerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const buyer = parseUserBaseFromDb(buyerDb);
        // Descontar créditos
        await client.query(queries.updateUserBalance, [
          buyer.credits.balance,
          buyer.credits.locked - (listingBase.offeredCredits ?? 0),
          buyer.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Transferir los créditos al vendedor
      try {
        // Obtener vendedor
        const [sellerDb] = await client.query(queries.userById, [
          listingBase.sellerId,
        ]);
        if (!sellerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const seller = parseUserBaseFromDb(sellerDb);
        // Transferir créditos
        await client.query(queries.updateUserBalance, [
          seller.credits.balance + (listingBase.offeredCredits ?? 0),
          seller.credits.locked,
          seller.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Marcar la publicación como recibida
      await client.query(queries.markListingAsReceived, [listingId]);
      // TODO - Enviar notificación al comprador
      // Finalizar transacción
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      await client.release();
    }
  };
  // TODO - Cancelar pedido ("accepted")
  // 1. Verificar si la publicación es la principal o una de intercambio
  // 2. Si era usada como medio de pago, descontar créditos
  // 3. Ajustar offered_credits de las demás publicaciones

  // TODO - Ruta para saber cuanto deberán pagar si se quiere cancelar
}
