import { SelfModel } from "../models/self";
import type { Response, Request } from "express";
import { validateUpdateSelf } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";

export class SelfController {
  static getSelf = async (req: Request, res: Response) => {
    const { user } = await SelfModel.getSelf({
      userId: req.session!.userId,
    });

    //send profile
    res.status(200).json({ user });
  };
  static updateSelf = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    try {
      await validateUpdateSelf(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { email, firstName, lastName, phone, profileMediaId, password } =
      req.body;

    const { user } = await SelfModel.updateSelf({
      userId,
      email,
      firstName,
      lastName,
      phone,
      profileMediaId,
      password,
    });

    res.status(200).json({ user });
  };

  static getSelfMissions = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    const { missions } = await SelfModel.getSelfMissions({ userId });
    res.status(200).json({ missions });
  };

  static getSelfNotifications = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    const { notifications } = await SelfModel.getSelfNotifications({ userId });
    res.status(200).json({ notifications });
  };

  static postReadAllSelfNotification = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    await SelfModel.setAllSelfNotificationsRead({ userId });
    res.status(204).send();
  };

  static getSelfChats = async (req: Request, res: Response) => {
    const { userId } = req.session!;
    const { chats } = await SelfModel.getSelfChats({ userId });
    res.status(200).json({ chats });
  };
}
