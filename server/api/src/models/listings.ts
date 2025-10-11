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
  progressMission,
} from "../utils/helpersDb";
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

export class ListingsModel {
  static getListings = async (query: GetListingsRequest["query"]) => {
    const {
      page = 1,
      order,
      sort,
      categoryId,
      productStatus,
      schoolId,
      searchTerm,
      userId,
      sellerId,
    } = query || {};
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const listingsSearchDb = await client.query(
        queries.searchListings({
          sort: getSortValue(sort),
          order: getOrderValue(order),
        }),
        [
          searchTerm ?? null,
          categoryId ?? null,
          productStatus ?? null,
          schoolId ?? null,
          sellerId ?? null,
          userId ?? null,
          PAGE_SIZE,
          page ? (page - 1) * PAGE_SIZE : 0,
        ],
      );
      const totalRecords = safeNumber(listingsSearchDb[0]?.total_records) ?? 0;
      const listingsBase = listingsSearchDb.map(parseListingBaseFromDb);
      const listings = await Promise.all(
        listingsBase.map(async (listingBase) => {
          const seller = await getUserById({
            client,
            userId: listingBase.sellerId,
          });
          const buyer = listingBase.buyerId
            ? await getUserById({ client, userId: listingBase.buyerId })
            : null;
          return parseListingFromBase({
            listing: listingBase,
            buyer,
            seller,
            category: await getCategoryById({
              client,
              categoryId: listingBase.categoryId,
            }),
            media: await getMediasByListingId({
              client,
              listingId: listingBase.id,
            }),
          });
        }),
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
      // Validar que el precio sea valido para la categoría
      const [categoryDb] = await client.query(queries.categoryById, [
        categoryId,
      ]);
      if (!categoryDb) {
        throw new InvalidInputError(ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      }
      const category = parseCategoryBaseFromDb(categoryDb);
      if (
        category.price &&
        category.price?.max !== null &&
        category.price?.min !== null
      ) {
        if (price > category.price.max || price < category.price.min) {
          throw new InvalidInputError(
            ERROR_MESSAGES.INVALID_PRICE_FOR_CATEGORY,
          );
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
      ]);
      if (!newListing?.id) {
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

      // Progresar misiones del usuario
      await progressMission({
        client,
        userId,
        missionKey: "publish-listing-1",
      });
      await progressMission({
        client,
        userId,
        missionKey: "publish-listing-2",
      });
      await progressMission({
        client,
        userId,
        missionKey: "publish-listing-3",
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

  static deleteListing = async ({
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
      // Validar que sea el dueño
      const [listingDb] = await client.query(queries.getListingById, [
        listingId,
      ]);
      if (!listingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      if (listingDb.seller_id !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
      }
      // Validar que el estado de la publicación sea "Publicado"
      if (listingDb.listing_status !== "published") {
        throw new InvalidInputError(
          ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE,
        );
      }
      try {
        await client.query(queries.deleteListingById, [listingId, userId]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
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
    offeredCredits,
  }: {
    listingId: UUID;
    userId: UUID;
    offeredCredits: number;
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
      if (offeredCredits < 0 || offeredCredits > listingBase.price) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_OFFER_PRICE);
      }
      // Validar que no sea el mismo usuario
      if (listingBase.sellerId === userId) {
        throw new InvalidInputError(ERROR_MESSAGES.CANNOT_OFFER_OWN_LISTING);
      }
      // Validar que el usuario tenga créditos suficientes
      const [userDb] = await client.query(queries.userById, [userId]);
      if (!userDb) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const user = parseUserBaseFromDb(userDb);
      if (user.credits.balance < offeredCredits) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }
      // Almacenar la oferta
      await client.query(queries.newOffer, [offeredCredits, userId, listingId]);
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
      // Descontar los créditos del comprador
      await client.query(queries.updateUserBalance, [
        user.credits.balance - offeredCredits,
        user.credits.locked + offeredCredits,
        user.id,
      ]);
      // Enviar notificación al vendedor
      await sendLoopNotification({
        userId: listingBase.sellerId,
        listingId: listingBase.id,
        client,
        toListingStatus: "offered",
        toOfferedCredits: offeredCredits,
        buyerId: userId,
        type: "new_offer",
      });
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
      client.begin();
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
      // Eliminar la oferta
      await client.query(queries.deleteOffer, [listingId]);
      // Devolver los créditos al comprador
      const [buyerDb] = await client.query(queries.userById, [userId]);
      if (!buyerDb) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const buyer = parseUserBaseFromDb(buyerDb);
      await client.query(queries.updateUserBalance, [
        buyer.credits.balance + (oldListing.offeredCredits || 0),
        buyer.credits.locked - (oldListing.offeredCredits || 0),
        buyer.id,
      ]);

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
      // Enviar notificación al vendedor
      await sendLoopNotification({
        userId: listing.seller.id,
        listingId: listing.id,
        client,
        toListingStatus: "published",
        toOfferedCredits: null,
        buyerId: null,
        type: "offer_deleted",
      });
      await client.commit();
      return {
        listing,
      };
    } catch (err) {
      await client.rollback();
      throw err;
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

      // Enviar notificación al comprador
      await sendLoopNotification({
        userId: oldListing.buyerId!,
        listingId: oldListing.id,
        client,
        toListingStatus: "published",
        toOfferedCredits: null,
        type: "offer_rejected",
        buyerId: null,
      });
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
        const accumulated = newOfferedCredits.reduce(
          (acc, curr) => acc + curr.offeredCredits,
          0,
        );
        if (accumulated < newSellerLocked) {
          const lastOfferedCreditsObj =
            newOfferedCredits[newOfferedCredits.length - 1];
          if (lastOfferedCreditsObj) {
            lastOfferedCreditsObj.offeredCredits +=
              newSellerLocked - accumulated;
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
      // Validaciones
      if (newBuyerLocked > oldListing.offeredCredits) {
        throw new InvalidInputError(ERROR_MESSAGES.TOTAL_PRICE_EXCEEDED);
      }
      let sellerBase: UserBase;
      try {
        const [sellerDb] = await client.query(queries.userById, [userId]);
        sellerBase = parseUserBaseFromDb(sellerDb!);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (newSellerLocked > sellerBase.credits.balance) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }
      // Almacenar en la base de datos
      try {
        // Actualizar los precios ofrecidos
        await Promise.all(
          newOfferedCredits.map(({ id, offeredCredits }) => {
            client.query(queries.updateListingOfferedCreditsById, [
              offeredCredits,
              id,
            ]);
          }),
        );
        // Actualizar la publicación principal
        await client.query(queries.acceptOffer, [listingId]);
        // Actualizar las publicaciones de intercambio
        await Promise.all(
          tradingListingIds.map((id) =>
            client.query(queries.updateListingStatus, [
              "accepted" as ListingStatus,
              userId,
              id,
            ]),
          ),
        );
        // Actualizar los créditos del vendedor
        if (newSellerLocked > 0) {
          await client.query(queries.updateUserBalance, [
            sellerBase.credits.balance - newSellerLocked,
            sellerBase.credits.locked + newSellerLocked,
            sellerBase.id,
          ]);
        }
        // Actualizar los créditos del comprador
        if (newBuyerLocked > 0) {
          const [buyerDb] = await client.query(queries.userById, [
            oldListing.buyerId!,
          ]);
          const buyerBase = parseUserBaseFromDb(buyerDb!);
          await client.query(queries.updateUserBalance, [
            buyerBase.credits.balance +
              oldListing.offeredCredits! -
              newBuyerLocked,
            buyerBase.credits.locked +
              newBuyerLocked -
              oldListing.offeredCredits!,
            buyerBase.id,
          ]);
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      // TODO - Registrar transacción
      // TODO - Enviar notificación al comprador
      await sendLoopNotification({
        userId: oldListing.buyerId!,
        listingId: oldListing.id,
        client,
        toListingStatus: "accepted",
        toOfferedCredits: null,
        buyerId: oldListing.buyerId!,
        type: "offer_accepted",
      });
      // Enviar notificación de las publicaciones de intercambio
      await Promise.all(
        tradingListingIds.map((id) => {
          return sendLoopNotification({
            userId: oldListing.buyerId!,
            listingId: id,
            client,
            toListingStatus: "accepted",
            toOfferedCredits: null,
            buyerId: userId,
            type: "listing_sold",
          });
        }),
      );
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
      // Enviar notificación al comprador
      await sendLoopNotification({
        userId: listingBase.buyerId!,
        listingId: listingBase.id,
        client,
        toListingStatus: "received",
        toOfferedCredits: null,
        type: "listing_received",
        buyerId: listingBase.buyerId!,
      });
      // Finalizar transacción
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      await client.release();
    }
  };

  static cancelListing = async ({
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
      // Verificar que el usuario sea el vendedor
      if (listingBase.sellerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
      }
      // Verificar el estado de la publicación
      if (listingBase.listingStatus !== "accepted") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
      }
      // Verificar que el usuario tenga el dinero suficiente
      let sellerBase: UserBase;
      try {
        const [sellerDb] = await client.query(queries.userById, [userId]);
        if (!sellerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        sellerBase = parseUserBaseFromDb(sellerDb);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      const sellerShouldPay =
        listingBase.price - (listingBase.offeredCredits ?? 0);
      if (sellerBase.credits.balance < sellerShouldPay) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }
      // Transferir los créditos del vendedor
      try {
        // Descontar créditos del vendedor
        await client.query(queries.updateUserBalance, [
          sellerBase.credits.balance - sellerShouldPay,
          sellerBase.credits.locked,
          sellerBase.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Transferir los créditos al vendedor
      try {
        // Obtener comprador
        const [buyerDb] = await client.query(queries.userById, [
          listingBase.buyerId,
        ]);
        const buyerBase = parseUserBaseFromDb(buyerDb!);

        // Transferir créditos al comprador
        await client.query(queries.updateUserBalance, [
          buyerBase.credits.balance + listingBase.price,
          buyerBase.credits.locked - (listingBase.offeredCredits ?? 0),
          buyerBase.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Devolver la publicación a estado "Publicado"
      await client.query(queries.updateListingStatus, [
        "published" as ListingStatus,
        null,
        listingId,
      ]);

      // Enviar notificación al comprador
      await sendLoopNotification({
        userId: listingBase.buyerId!,
        listingId: listingBase.id,
        client,
        toListingStatus: "published",
        toOfferedCredits: null,
        buyerId: null,
        type: "listing_cancelled",
      });
      // Finalizar transacción
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      await client.release();
    }
  };

  // Ruta para saber cuanto deberán pagar si se quiere cancelar no es necesaria
  // El vendedor debe pagar listing.price - listing.offeredCredits
}
