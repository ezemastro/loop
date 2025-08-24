import type { Request, Response } from "express";
import { validateGetSchoolsRequest, validateId } from "../services/validations";
import { InvalidInputError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { SchoolsModel } from "../models/schools";

export class SchoolsController {
  static getSchools = async (req: Request, res: Response) => {
    try {
      await validateGetSchoolsRequest(req.query);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const { page, sort, order, searchTerm } =
      (req.query as GetSchoolsRequest["query"]) || {};
    const { schools, pagination } = await SchoolsModel.getSchools({
      page,
      sort,
      order,
      searchTerm,
    });
    res.status(200).json({ schools, pagination });
  };
  static getSchoolById = async (req: Request, res: Response) => {
    const { schoolId } = req.params;
    try {
      await validateId(schoolId);
    } catch {
      throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
    }
    const school = await SchoolsModel.getSchoolById({ schoolId: schoolId! });
    res.status(200).json(school);
  };
}
