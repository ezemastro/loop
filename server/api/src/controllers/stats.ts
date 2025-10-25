import type { NextFunction, Request, Response } from "express";
import { StatsModel } from "../models/stats";
import { successResponse } from "../utils/responses";

export class StatsController {
  static async getGlobalStats(
    _req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { globalStats } = await StatsModel.getGlobalStats();
      res.status(200).json(successResponse({ data: { globalStats } }));
    } catch (error) {
      next(error);
    }
  }
}
