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
      const totalRecords = listingsSearchDb[0]?.total_records ?? 0;
      const listingsBase = listingsSearchDb.map(parseListingBaseFromDb);
      const listings = listingsBase.map(async (listingBase) =>
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
      );
      return {
        listings,
        pagination: parsePagination({ currentPage: page, totalRecords }),
      };
    } finally {
      client.release();
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
      client.release();
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
      client.release();
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
      client.release();
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
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
      await client.begin();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
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
      // TODO - Validar precio

      // Almacenar la oferta
      const [newListingDb] = await client.query(queries.newOffer, [
        price,
        userId,
        listingId,
      ]);
      const newListingBase = parseListingBaseFromDb(newListingDb!);
      const listing = await parseListingFromBase({
        listing: newListingBase,
        buyer: await getUserById({ client, userId: newListingBase.buyerId! }),
        category: await getCategoryById({
          client,
          categoryId: newListingBase.categoryId!,
        }),
        media: await getMediasByListingId({
          client,
          listingId: newListingBase.id!,
        }),
        seller: await getUserById({ client, userId: newListingBase.sellerId! }),
      });

      await client.commit();
      return { listing };
    } catch {
      await client.rollback();
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    } finally {
      client.release();
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
      client.release();
    }
  };

  static cancelOffer = async ({
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
      client.release();
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
        await Promise.all(
          tradingListings.map((listing) => {
            client.query(queries.markListingAsSold, [userId, listing.id]);
          }),
        );
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // TODO - Enviar notificación al comprador
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      client.release();
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
      // Obtener publicación
      const [listingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!listingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const listing = parseListingBaseFromDb(listingDb);
      // Verificar que el usuario sea el comprador
      if (listing.buyerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_BUYER);
      }
      // TODO - Terminar esta funcionalidad (actualizar listing)
    } finally {
      client.release();
    }
  };
}
