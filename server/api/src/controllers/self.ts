import { SelfModel } from "../models/self";
import type { Response, Request, NextFunction } from "express";
import {
  safeValidateEmail,
  safeValidateUUID,
  validateGetSelfListingsRequest,
  validateGetSelfMessagesRequest,
  validateGetSelfNotificationsRequest,
  validatePostSelfWishRequest,
  validatePutSelfWishRequest,
  validateUpdateSelf,
  validateUpdateTokenRequest,
} from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { successResponse } from "../utils/responses";
import { parseQuery } from "../utils/parseQuery";
import { safeNumber } from "../utils/safeNumber";

export class SelfController {
  static getSelf = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    let user: PrivateUser;
    try {
      ({ user } = await SelfModel.getSelf({ userId, communityId: communityId! }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { user } }));
  };
  static updateSelf = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    try {
      await validateUpdateSelf(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    // `email` no se lee del body a propósito: el dominio del correo es lo que decide a qué
    // comunidad pertenece la cuenta, así que cambiarlo por acá las dejaría en desacuerdo.
    const { firstName, lastName, phone, profileMediaId, password, schoolIds } =
      req.body as PatchSelfRequest["body"];

    let user: PrivateUser;
    try {
      ({ user } = await SelfModel.updateSelf({
        userId,
        communityId: communityId!,
        firstName,
        lastName,
        phone,
        profileMediaId,
        password,
        schoolIds,
      }));
    } catch (err) {
      return next(err);
    }

    res.status(200).json(successResponse({ data: { user } }));
  };

  static getSelfListings = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const parsedQuery: GetSelfListingsRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      await validateGetSelfListingsRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const {
      page,
      order,
      sort,
      searchTerm,
      categoryId,
      productStatus,
      listingStatus,
      sellerId,
      buyerId,
    } = parsedQuery || {};

    let listings: Listing[];
    let pagination: Pagination;
    try {
      ({ listings, pagination } = await SelfModel.getSelfListings({
        userId,
        communityId: communityId!,
        page,
        order,
        sort,
        searchTerm,
        categoryId,
        productStatus,
        listingStatus,
        sellerId,
        buyerId,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { listings }, pagination }));
  };

  static getSelfMissions = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    let missions: UserMission[];
    try {
      ({ missions } = await SelfModel.getSelfMissions({ userId, communityId: communityId! }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { userMissions: missions } }));
  };

  static getSelfNotifications = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const parsedQuery: GetSelfNotificationsRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      await validateGetSelfNotificationsRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    let notifications: AppNotification[];
    let pagination: Pagination;
    // TODO - Add pagination
    try {
      ({ notifications, pagination } = await SelfModel.getSelfNotifications({
        userId,
        communityId: communityId!,
        page: parsedQuery.page,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { notifications }, pagination }));
  };

  static getSelfNotificationsUnread = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    let unreadNotificationsCount: number;
    try {
      ({ unreadNotificationsCount } = await SelfModel.getSelfUnreadNotificationsCount({
        userId,
        communityId: communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { unreadNotificationsCount } }));
  };

  static readAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    try {
      await SelfModel.setAllSelfNotificationsRead({ userId, communityId: communityId! });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static getSelfChats = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const parsedQuery: GetSelfMessagesRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      await validateGetSelfMessagesRequest(parsedQuery);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    const { chats, pagination } = await SelfModel.getSelfChats({
      userId,
      communityId: communityId!,
      page: parsedQuery.page,
    });
    res.status(200).json(successResponse({ data: { chats }, pagination }));
  };
  static getSelfChatsUnread = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    let unreadChatsCount: number;
    try {
      ({ unreadChatsCount } = await SelfModel.getSelfUnreadChatsCount({
        userId,
        communityId: communityId!,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { unreadChatsCount } }));
  };
  static updateNotificationToken = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const { notificationToken } = req.body as PostSelfNotificationTokenRequest["body"];
    try {
      await validateUpdateTokenRequest(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.updateNotificationToken({
        userId,
        communityId: communityId!,
        notificationToken,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static createSelfWish = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const { categoryId, comment } = req.body as PostSelfWishRequest["body"];
    // Validar categoryId
    try {
      await validatePostSelfWishRequest({ categoryId, comment });
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    let userWish: UserWish;
    try {
      ({ userWish } = await SelfModel.createSelfWish({
        userId,
        communityId: communityId!,
        categoryId,
        comment,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).send(successResponse({ data: { userWish } }));
  };

  static deleteSelfWish = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const { categoryId } = req.params as DeleteSelfWishRequest["params"];
    // Validar categoryId
    try {
      const res = await safeValidateUUID(categoryId);
      if (res.success === false) throw new Error();
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.deleteSelfWish({ userId, communityId: communityId!, categoryId });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static getSelfWishes = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    let userWishes: UserWish[];
    try {
      ({ userWishes } = await SelfModel.getSelfWishes({ userId, communityId: communityId! }));
    } catch (err) {
      return next(err);
    }
    res.status(200).send(successResponse({ data: { userWishes } }));
  };

  static modifySelfWish = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const { wishId } = req.params as PutSelfWishRequest["params"];
    const { comment, categoryId } = req.body as PutSelfWishRequest["body"];
    try {
      await validatePutSelfWishRequest({ wishId, comment, categoryId });
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.modifyWish({
        userId,
        communityId: communityId!,
        wishId,
        comment,
        categoryId,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static modifySelfPassword = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    const { oldPassword, newPassword } = req.body as PostSelfChangePasswordRequest["body"];
    try {
      await SelfModel.modifyUserPassword({
        userId,
        communityId: communityId!,
        oldPassword,
        newPassword,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static deleteSelf = async (req: Request, res: Response, next: NextFunction) => {
    const { userId, communityId } = req.session!;
    try {
      await SelfModel.deleteSelf({ userId, communityId: communityId! });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  // `deleteSelfRequest` se movió a `controllers/accountDeletion.ts`. Ver la nota en
  // `models/self.ts`: el endpoint público ya no borra nada.
}
