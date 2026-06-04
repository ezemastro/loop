import { ERROR_MESSAGES, MISSION_KEYS, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError, UnauthorizedError } from "../services/errors";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
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

    return withClient(async (client) => {
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

      const uniqueSellerIds = [...new Set(listingsBase.map((l) => l.sellerId))];
      const uniqueBuyerIds = [...new Set(
        listingsBase.map((l) => l.buyerId).filter(Boolean) as UUID[],
      )];
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
            buyer: listingBase.buyerId ? buyersMap.get(listingBase.buyerId) ?? null : null,
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
    });
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
    return withClient(async (client) => {
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
    });
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
    return withClient(async (client) => {
      const [oldListingDb] = await client.query(queries.getListingById, [listingId]);
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
          ? await Promise.all(mediaIds.map((mediaId) => getMediaById({ client, mediaId })))
          : await getMediasByListingId({ client, listingId }),
      });

      return { listing };
    }, { transaction: true });
  };

  static deleteListing = async ({ listingId, userId }: { listingId: UUID; userId: UUID }) => {
    return withClient(async (client) => {
      const [listingDb] = await client.query(queries.getListingById, [listingId]);
      if (!listingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      if (listingDb.seller_id !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
      }
      if (listingDb.listing_status !== "published") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS_TO_DELETE);
      }
      await client.query(queries.deleteListingById, [listingId, userId]);
    });
  };

  static getListingById = async ({ listingId }: { listingId: UUID }) => {
    return withClient(async (client) => {
      const listing = await getListingById({ client, listingId });
      return { listing };
    });
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
    return withClient(async (client) => {
      const [listingBaseDb] = await client.query(queries.listingById, [listingId]);
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

      const [userDb] = await client.query(queries.userById, [userId]);
      if (!userDb) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const user = parseUserBaseFromDb(userDb);
      if (user.credits.balance < offeredCredits) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }

      const [sellerDb] = await client.query(queries.userById, [listingBase.sellerId]);
      if (!sellerDb) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const sellerBase = parseUserBaseFromDb(sellerDb);

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

      await client.query(queries.updateUserBalance, [
        user.credits.balance - offeredCredits,
        user.credits.locked + offeredCredits,
        user.id,
      ]);

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
    }, { transaction: true });
  };

  static deleteOffer = async ({ listingId, userId }: { listingId: UUID; userId: UUID }) => {
    return withClient(async (client) => {
      const [oldListingDb] = await client.query(queries.getListingById, [listingId]);
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

      await client.query(queries.deleteOffer, [listingId]);

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

      let sellerBase: UserBase;
      try {
        const [sellerDb] = await client.query(queries.userById, [oldListing.sellerId]);
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
    }, { transaction: true });
  };

  static rejectOffer = async ({ listingId, userId }: { listingId: UUID; userId: UUID }) => {
    return withClient(async (client) => {
      const [oldListingDb] = await client.query(queries.getListingById, [listingId]);
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

      await client.query(queries.deleteOffer, [listingId]);

      let buyerBase: UserBase;
      try {
        const [buyerDb] = await client.query(queries.userById, [oldListing.buyerId]);
        buyerBase = parseUserBaseFromDb(buyerDb!);
      } catch {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Restore credits to buyer
      await client.query(queries.updateUserBalance, [
        buyerBase.credits.balance + (oldListing.offeredCredits || 0),
        buyerBase.credits.locked - (oldListing.offeredCredits || 0),
        buyerBase.id,
      ]);

      await sendLoopNotification({
        userId: oldListing.buyerId!,
        notificationToken: buyerBase.notificationToken,
        listingId: oldListing.id,
        client,
        toListingStatus: "published",
        toOfferedCredits: null,
        type: "offer_rejected",
        buyerId: null,
      });
    }, { transaction: true });
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
    return withClient(async (client) => {
      const [oldListingDb] = await client.query(queries.getListingById, [listingId]);
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
      if (oldListing.offeredCredits === null) {
        throw new InvalidInputError(ERROR_MESSAGES.OFFERED_CREDITS_NOT_FOUND);
      }

      let tradingListings: ListingBase[] = [];
      if (tradingListingIds.length > 0) {
        const tradingListingsDb = await Promise.all(
          tradingListingIds.map((id) => client.query(queries.getListingById, [id])),
        );
        if (tradingListingsDb.some(([db]) => !db)) {
          throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
        }
        tradingListings = tradingListingsDb.map(([db]) => parseListingBaseFromDb(db!));
        if (tradingListings.some((listing) => listing.sellerId !== oldListing.buyerId)) {
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

      let buyerBase: UserBase;
      try {
        const [buyerDb] = await client.query(queries.userById, [oldListing.buyerId!]);
        buyerBase = parseUserBaseFromDb(buyerDb!);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      try {
        await Promise.all(
          newOfferedCredits.map(({ id, offeredCredits }) =>
            client.query(queries.updateListingOfferedCreditsById, [offeredCredits, id]),
          ),
        );
        await client.query(queries.acceptOffer, [listingId]);
        await Promise.all(
          tradingListingIds.map((id) => client.query(queries.markListingAsSold, [userId, id])),
        );
        if (newSellerLocked > 0) {
          await client.query(queries.updateUserBalance, [
            sellerBase.credits.balance - newSellerLocked,
            sellerBase.credits.locked + newSellerLocked,
            sellerBase.id,
          ]);
        }
        if (newBuyerLocked >= 0) {
          await client.query(queries.updateUserBalance, [
            buyerBase.credits.balance + oldListing.offeredCredits! - newBuyerLocked,
            buyerBase.credits.locked + newBuyerLocked - oldListing.offeredCredits!,
            buyerBase.id,
          ]);
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
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

      await Promise.all(
        tradingListingIds.map((id) =>
          sendLoopNotification({
            userId: oldListing.buyerId!,
            notificationToken: buyerBase.notificationToken,
            listingId: id,
            client,
            toListingStatus: "accepted",
            toOfferedCredits: null,
            buyerId: userId,
            type: "listing_sold",
            disablePush: true,
          }),
        ),
      );
    }, { transaction: true });
  };

  static receiveListing = async ({ listingId, userId }: { listingId: UUID; userId: UUID }) => {
    return withClient(async (client) => {
      const [listingDb] = await client.query(queries.getListingById, [listingId]);
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

      try {
        const [buyerDb] = await client.query(queries.userById, [listingBase.buyerId]);
        if (!buyerDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const buyer = parseUserBaseFromDb(buyerDb);
        await client.query(queries.updateUserBalance, [
          buyer.credits.balance,
          buyer.credits.locked - (listingBase.offeredCredits ?? 0),
          buyer.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      let sellerBase: UserBase;
      try {
        const [sellerDb] = await client.query(queries.userById, [listingBase.sellerId]);
        sellerBase = parseUserBaseFromDb(sellerDb!);
      } catch {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      try {
        await client.query(queries.updateUserBalance, [
          sellerBase.credits.balance + (listingBase.offeredCredits ?? 0),
          sellerBase.credits.locked,
          sellerBase.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      await client.query(queries.markListingAsReceived, [listingId]);

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
        ]);
        await client.query(queries.increaseUserStats, [
          categoryBase.stats?.kgWaste || 0,
          categoryBase.stats?.kgCo2 || 0,
          categoryBase.stats?.lH2o || 0,
          listingBase.buyerId!,
        ]);

        const sellerSchoolsDb = await client.query(queries.userSchoolsByUserId, [sellerBase.id]);
        const buyerSchoolsDb = await client.query(queries.userSchoolsByUserId, [
          listingBase.buyerId!,
        ]);
        const schoolsIds = [...sellerSchoolsDb, ...buyerSchoolsDb].map((db) => db.school_id);
        const uniqueSchoolsIds = Array.from(new Set(schoolsIds));
        for (const schoolId of uniqueSchoolsIds) {
          await client.query(queries.increaseSchoolStats, [
            categoryBase.stats?.kgWaste || 0,
            categoryBase.stats?.kgCo2 || 0,
            categoryBase.stats?.lH2o || 0,
            schoolId,
          ]);
        }
        await client.query(queries.increaseGlobalStats, [
          safeNumber(categoryBase.stats?.kgWaste) || 0,
          safeNumber(categoryBase.stats?.kgCo2) || 0,
          safeNumber(categoryBase.stats?.lH2o) || 0,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
    }, { transaction: true });
  };

  static cancelListing = async ({ listingId, userId }: { listingId: UUID; userId: UUID }) => {
    return withClient(async (client) => {
      const [listingDb] = await client.query(queries.getListingById, [listingId]);
      if (!listingDb) {
        throw new InvalidInputError(ERROR_MESSAGES.LISTING_NOT_FOUND);
      }
      const listingBase = parseListingBaseFromDb(listingDb);
      if (listingBase.sellerId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.NOT_LISTING_SELLER);
      }
      if (listingBase.listingStatus !== "accepted") {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_LISTING_STATUS);
      }

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

      const sellerShouldPay = listingBase.price - (listingBase.offeredCredits ?? 0);
      if (sellerBase.credits.balance < sellerShouldPay) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }

      try {
        await client.query(queries.updateUserBalance, [
          sellerBase.credits.balance - sellerShouldPay,
          sellerBase.credits.locked,
          sellerBase.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      let buyerBase: UserBase;
      try {
        const [buyerDb] = await client.query(queries.userById, [listingBase.buyerId]);
        buyerBase = parseUserBaseFromDb(buyerDb!);
      } catch {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      try {
        await client.query(queries.updateUserBalance, [
          buyerBase.credits.balance + listingBase.price,
          buyerBase.credits.locked - (listingBase.offeredCredits ?? 0),
          buyerBase.id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      await client.query(queries.updateListingStatus, [
        "published" as ListingStatus,
        null,
        listingId,
      ]);

      await sendLoopNotification({
        userId: listingBase.buyerId!,
        notificationToken: buyerBase.notificationToken,
        listingId: listingBase.id,
        client,
        toListingStatus: "published",
        toOfferedCredits: null,
        buyerId: null,
        type: "listing_cancelled",
      });
    }, { transaction: true });
  };
}
