import type { Request, Response } from "express";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { validateGetRolesRequest } from "../services/validations";
import { RolesModel } from "../models/roles";
export class RoleController {
  static getRoles = async (req: Request, res: Response) => {
    const { page, sort, order, searchTerm } =
      (req.query as GetRolesRequest["query"]) || {};
    try {
      await validateGetRolesRequest({ page, sort, order, searchTerm });
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { roles, pagination } = await RolesModel.getRoles({
      page,
      sort,
      order,
      searchTerm,
    });
    res.status(200).json({ roles, pagination });
  };
}
