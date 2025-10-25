import { Router } from "express";
import { StatsController } from "../controllers/stats";

export const statsRouter = Router();

statsRouter.get("/", StatsController.getGlobalStats);
