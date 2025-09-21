import { ERROR_MESSAGES } from "../config";
import { InvalidInputError } from "../services/errors";
import {
  validateId,
  validatePaginationParams,
  validatePostMessageRequest,
} from "../services/validations";
import type { NextFunction, Request, Response } from "express";
import { successResponse } from "../utils/responses";
import { MessagesModel } from "../models/messages";
import { safeNumber } from "../utils/safeNumber";
import { parseQuery } from "../utils/parseQuery";

export class MessagesController {
  static getMessagesFromUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Validate parameters
    const parsedQuery: GetMessagesByUserIdRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    try {
      validateId(req.params.userId);
      validatePaginationParams(parsedQuery);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { userId } = req.params as GetMessagesByUserIdRequest["params"];
    const { page } = parsedQuery;

    let messages: Message[];
    let pagination: Pagination;
    try {
      ({ messages, pagination } = await MessagesModel.getMessagesFromUser({
        senderId: userId,
        recipientId: req.session!.userId,
        page: page ?? 0,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { messages }, pagination }));
  };

  static sendMessageToUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Validate parameters and body
    try {
      await validateId(req.params.userId);
      await validatePostMessageRequest(req.body);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { userId } = req.params as PostMessageRequest["params"];
    const { text, attachedListingId } = req.body as PostMessageRequest["body"];

    let message: Message;
    try {
      ({ message } = await MessagesModel.sendMessageToUser({
        senderId: req.session!.userId,
        recipientId: userId,
        text,
        attachedListingId,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(201).json(successResponse({ data: { message } }));
  };
}
