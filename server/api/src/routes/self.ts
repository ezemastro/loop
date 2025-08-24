import { Router } from "express";
import { SelfController } from "../controllers/self";

export const selfRouter = Router();

selfRouter.get("/", SelfController.getSelf);
selfRouter.patch("/", SelfController.updateSelf);

selfRouter.get("/missions", SelfController.getSelfMissions);
selfRouter.get("/notifications", SelfController.getSelfNotifications);
