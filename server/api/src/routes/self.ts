import { Router } from "express";
import { SelfController } from "../controllers/self";

export const selfRouter = Router();

selfRouter.get("/", SelfController.getSelf);
selfRouter.patch("/", SelfController.updateSelf);

selfRouter.get("/missions", SelfController.getSelfMissions);
selfRouter.get("/notifications", SelfController.getSelfNotifications);
selfRouter.get(
  "/notifications/unread",
  SelfController.getSelfNotificationsUnread,
);
selfRouter.post(
  "/notifications/read-all",
  SelfController.postReadAllSelfNotification,
);
selfRouter.get("/messages", SelfController.getSelfChats);
selfRouter.get("/messages/unread", SelfController.getSelfChatsUnread);
