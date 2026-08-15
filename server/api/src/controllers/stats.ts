import type { NextFunction, Request, Response } from "express";
import { StatsModel } from "../models/stats";
import { successResponse } from "../utils/responses";

export class StatsController {
  static async getGlobalStats(req: Request, res: Response, next: NextFunction) {
    // Las estadísticas ambientales son por comunidad, así que el endpoint pasó a requerir sesión.
    const { communityId } = req.session!;
    try {
      const { globalStats } = await StatsModel.getGlobalStats({ communityId: communityId! });
      res.status(200).json(successResponse({ data: { globalStats } }));
    } catch (error) {
      next(error);
    }
  }
}
