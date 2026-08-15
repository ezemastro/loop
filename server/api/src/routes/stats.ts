import { Router } from "express";
import { StatsController } from "../controllers/stats";
import { tokenMiddleware } from "../middlewares/parseToken";

export const statsRouter = Router();

// Las estadísticas son por comunidad, así que dejaron de ser públicas.
statsRouter.get("/", tokenMiddleware, StatsController.getGlobalStats);
