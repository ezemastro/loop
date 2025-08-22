import { SelfModel } from "../models/self";
import type { Response, Request } from "express";

export class SelfController {
  static getSelf = async (req: Request, res: Response) => {
    const user = await SelfModel.getSelf({
      userId: req.session!.userId,
    });

    //send profile
    res.status(200).json({ user });
  };
}
