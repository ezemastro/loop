import type { NextFunction, Request, Response } from "express";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { validateGetRolesRequest } from "../services/validations";
import { RolesModel } from "../models/roles";
import { successResponse } from "../utils/responses";
import { safeNumber } from "../utils/safeNumber";
export class RoleController {
  static getRoles = async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery: GetRolesRequest["query"] = {
      page: safeNumber(req.query.page),
      ...req.query,
    };
    const { page, sort, order, searchTerm } = parsedQuery;
    try {
      await validateGetRolesRequest({ page, sort, order, searchTerm });
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }

    let roles: Role[];
    let pagination: Pagination;
    try {
      ({ roles, pagination } = await RolesModel.getRoles({
        page,
        sort,
        order,
        searchTerm,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { roles }, pagination }));
  };
}
