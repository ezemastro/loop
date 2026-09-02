import { Router } from "express";
import { MessagesController } from "../controllers/messages";
import { messageLimiter } from "../middlewares/rateLimit.js";

export const messagesRouter = Router();

messagesRouter.get("/:userId", MessagesController.getMessagesFromUser);
messagesRouter.post("/:userId", messageLimiter, MessagesController.sendMessageToUser);
messagesRouter.post("/:userId/read", MessagesController.readAllMessages);
