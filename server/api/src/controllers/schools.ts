import type { NextFunction, Request, Response } from "express";
import { validateGetSchoolsRequest, validateId } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { SchoolsModel } from "../models/schools";
import { successResponse } from "../utils/responses";

export class SchoolsController {
  static getSchools = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await validateGetSchoolsRequest(req.query);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { page, sort, order, searchTerm } =
      (req.query as GetSchoolsRequest["query"]) || {};

    let schools: School[];
    let pagination: Pagination;
    try {
      ({ schools, pagination } = await SchoolsModel.getSchools({
        page,
        sort,
        order,
        searchTerm,
      }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { schools }, pagination }));
  };
  static getSchoolById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const { schoolId } = req.params;
    try {
      await validateId(schoolId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    let school: School;
    try {
      ({ school } = await SchoolsModel.getSchoolById({ schoolId: schoolId! }));
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { school } }));
  };
}
