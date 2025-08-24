import type { Request, Response } from "express";
import { validateGetUsersRequest } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { UsersModel } from "../models/users";

export class UsersController {
  static getUsers = async (req: Request, res: Response) => {
    const { page, sort, order, searchTerm, roleId, schoolId } =
      (req.query as GetUsersRequest["query"]) || {};
    try {
      await validateGetUsersRequest({
        page,
        sort,
        order,
        searchTerm,
        roleId,
        schoolId,
      });
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { users, pagination } = await UsersModel.getUsers({
      page,
      sort,
      order,
      searchTerm,
      roleId,
      schoolId,
    });
    res.status(200).json({ users, pagination });
  };
}
