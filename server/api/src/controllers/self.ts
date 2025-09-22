import { SelfModel } from "../models/self";
import type { Response, Request, NextFunction } from "express";
import {
  validateGetSelfListingsRequest,
  validateGetSelfMessagesRequest,
  validateGetSelfNotificationsRequest,
  validateUpdateSelf,
} from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { successResponse } from "../utils/responses";
import { parseQuery } from "../utils/parseQuery";
import { safeNumber } from "../utils/safeNumber";

export class SelfController {
  static getSelf = async (req: Request, res: Response, next: NextFunction) => {
    let user: User;
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
    const { email, firstName, lastName, phone, profileMediaId, password } =
      req.body;

    let user: User;
    try {
      ({ user } = await SelfModel.updateSelf({
        userId,
        email,
        firstName,
        lastName,
        phone,
        profileMediaId,
        password,
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
    res.status(200).json(successResponse({ data: { missions } }));
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
    let notifications: Notification[];
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
}
