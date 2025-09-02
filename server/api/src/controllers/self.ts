import { SelfModel } from "../models/self";
import type { Response, Request, NextFunction } from "express";
import { validateUpdateSelf } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { successResponse } from "../utils/responses";

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
    let notifications: Notification[];
    // TODO - Add pagination
    try {
      ({ notifications } = await SelfModel.getSelfNotifications({ userId }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { notifications } }));
  };

  static postReadAllSelfNotification = async (
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

  static getSelfChats = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    const { chats } = await SelfModel.getSelfChats({ userId });
    res.status(200).json(successResponse({ data: { chats } }));
  };
}
