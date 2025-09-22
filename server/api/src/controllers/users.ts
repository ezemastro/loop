import type { NextFunction, Request, Response } from "express";
import { validateGetUsersRequest, validateId } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { UsersModel } from "../models/users";
import { successResponse } from "../utils/responses";
import { safeNumber } from "../utils/safeNumber";
import { parseQuery } from "../utils/parseQuery";

export class UsersController {
  static getUsers = async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery: GetUsersRequest["query"] = {
      ...parseQuery(req.query),
      page: safeNumber(req.query.page),
    };
    const { page, sort, order, searchTerm, roleId, schoolId, userId } =
      parsedQuery;
    try {
      await validateGetUsersRequest({
        page,
        sort,
        order,
        searchTerm,
        roleId,
        schoolId,
        userId,
      });
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }

    let users: PublicUser[];
    let pagination: Pagination;
    try {
      ({ users, pagination } = await UsersModel.getUsers({
        page,
        sort,
        order,
        searchTerm,
        roleId,
        schoolId,
        userId,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { users }, pagination }));
  };

  static getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId } = req.params;
    try {
      validateId(userId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    let user: PublicUser;
    try {
      ({ user } = await UsersModel.getUserById({ userId: userId! }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { user } }));
  };
}
