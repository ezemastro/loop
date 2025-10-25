import { SelfModel } from "../models/self";
import type { Response, Request, NextFunction } from "express";
import {
  safeValidateUUID,
  validateGetSelfListingsRequest,
  validateGetSelfMessagesRequest,
  validateGetSelfNotificationsRequest,
  validatePutSelfWhishRequest,
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
    let user: PrivateUser;
    try {
      ({ user } = await SelfModel.getSelf({
        userId: req.session!.userId,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { user } }));
  };
  static updateSelf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    try {
      await validateUpdateSelf(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const {
      email,
      firstName,
      lastName,
      phone,
      profileMediaId,
      password,
      schoolIds,
    } = req.body as PatchSelfRequest["body"];

    let user: PrivateUser;
    try {
      ({ user } = await SelfModel.updateSelf({
        userId,
        email,
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

  static getSelfListings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
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

  static getSelfMissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    let missions: UserMission[];
    try {
      ({ missions } = await SelfModel.getSelfMissions({ userId }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { userMissions: missions } }));
  };

  static getSelfNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
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
        page: parsedQuery.page,
      }));
    } catch (err) {
      return next(err);
    }
    res
      .status(200)
      .json(successResponse({ data: { notifications }, pagination }));
  };

  static getSelfNotificationsUnread = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    let unreadNotificationsCount: number;
    try {
      ({ unreadNotificationsCount } =
        await SelfModel.getSelfUnreadNotificationsCount({
          userId,
        }));
    } catch (err) {
      return next(err);
    }
    res
      .status(200)
      .json(successResponse({ data: { unreadNotificationsCount } }));
  };

  static readAllNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    try {
      await SelfModel.setAllSelfNotificationsRead({ userId });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static getSelfChats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
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
      page: parsedQuery.page,
    });
    res.status(200).json(successResponse({ data: { chats }, pagination }));
  };
  static getSelfChatsUnread = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    let unreadChatsCount: number;
    try {
      ({ unreadChatsCount } = await SelfModel.getSelfUnreadChatsCount({
        userId,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { unreadChatsCount } }));
  };
  static updateNotificationToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    const { notificationToken } = req.body as { notificationToken: string };
    try {
      await validateUpdateTokenRequest(req.body);
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.updateNotificationToken({ userId, notificationToken });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static addSelfWhish = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    const { categoryId } = req.body as PostSelfWhishRequest["body"];
    // Validar categoryId
    try {
      const res = await safeValidateUUID(categoryId);
      if (res.success === false) throw new Error();
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    let userWhish: UserWhish;
    try {
      ({ userWhish } = await SelfModel.addSelfWhish({ userId, categoryId }));
    } catch (err) {
      return next(err);
    }
    res.status(201).send(successResponse({ data: { userWhish } }));
  };

  static deleteSelfWhish = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    const { categoryId } = req.params as DeleteSelfWhishRequest["params"];
    // Validar categoryId
    try {
      const res = await safeValidateUUID(categoryId);
      if (res.success === false) throw new Error();
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.deleteSelfWhish({ userId, categoryId });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };

  static getSelfWhishes = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    let userWhishes: UserWhish[];
    try {
      ({ userWhishes } = await SelfModel.getSelfWhishes({ userId }));
    } catch (err) {
      return next(err);
    }
    res.status(200).send(successResponse({ data: { userWhishes } }));
  };

  static modifySelfWhishComment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.session!;
    const { whishId } = req.params as PutSelfWhishRequest["params"];
    const { comment } = req.body as PutSelfWhishRequest["body"];
    try {
      await validatePutSelfWhishRequest({ whishId, comment });
    } catch {
      return next(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
    }
    try {
      await SelfModel.modifyWhishComment({
        userId,
        whishId,
        comment,
      });
    } catch (err) {
      return next(err);
    }
    res.status(204).send(successResponse());
  };
}
