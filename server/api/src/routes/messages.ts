import { Router } from "express";
import { MessagesController } from "../controllers/messages";

export const messagesRouter = Router();

messagesRouter.get("/:userId", MessagesController.getMessagesFromUser);
messagesRouter.post("/:userId", MessagesController.sendMessageToUser);
