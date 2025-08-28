import { ERROR_MESSAGES } from "../config";
import { InvalidInputError } from "../services/errors";
import {
  validateId,
  validatePaginationParams,
  validatePostMessageRequest,
} from "../services/validations";
import type { Request, Response } from "express";
import { successResponse } from "../utils/responses";
import { MessagesModel } from "../models/messages";

export class MessagesController {
  static getMessagesFromUser = async (req: Request, res: Response) => {
    // Validate parameters
    try {
      validateId(req.params.userId);
      validatePaginationParams(req.query);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { userId } = req.params as GetMessagesByUserIdRequest["params"];
    const { page } = req.query as GetMessagesByUserIdRequest["query"];
    const messages = await MessagesModel.getMessagesFromUser({
      senderId: userId,
      recipientId: req.session!.userId,
      page: page ?? 0,
    });
    res.status(200).json(successResponse({ data: { messages } }));
  };

  static sendMessageToUser = async (req: Request, res: Response) => {
    // Validate parameters and body
    try {
      await validateId(req.params.userId);
      await validatePostMessageRequest(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { userId } = req.params as PostMessageRequest["params"];
    const { text, attachedListingId } = req.body as PostMessageRequest["body"];
    const message = await MessagesModel.sendMessageToUser({
      senderId: req.session!.userId,
      recipientId: userId,
      text,
      attachedListingId,
    });
    res.status(201).json(successResponse({ data: { message } }));
  };
}
