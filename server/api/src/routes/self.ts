import { Router } from "express";
import { SelfController } from "../controllers/self";

export const selfRouter = Router();

selfRouter.get("/", SelfController.getSelf);
selfRouter.patch("/", SelfController.updateSelf);

selfRouter.get("/listings", SelfController.getSelfListings);
selfRouter.get("/missions", SelfController.getSelfMissions);
selfRouter.get("/notifications", SelfController.getSelfNotifications);
selfRouter.get(
  "/notifications/unread",
  SelfController.getSelfNotificationsUnread,
);
selfRouter.post("/notifications/read-all", SelfController.readAllNotifications);
selfRouter.get("/messages", SelfController.getSelfChats);
selfRouter.get("/messages/unread", SelfController.getSelfChatsUnread);
selfRouter.post("/notification-token", SelfController.updateNotificationToken);
selfRouter.post("/change-password", SelfController.modifySelfPassword);

selfRouter.get("/whishes", SelfController.getSelfWhishes);
selfRouter.post("/whishes", SelfController.addSelfWhish);
selfRouter.delete("/whishes/:categoryId", SelfController.deleteSelfWhish);
selfRouter.put("/whishes/:whishId", SelfController.modifySelfWhishComment);
