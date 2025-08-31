import { CategoriesModel } from "../models/categories";
import type { NextFunction, Request, Response } from "express";
import { successResponse } from "../utils/responses";

export class CategoriesController {
  static getCategories = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    let categories: Category[];
    try {
      ({ categories } = await CategoriesModel.getCategories());
    } catch (err) {
      return next(err);
    }
    res.status(200).json(successResponse({ data: { categories } }));
  };
}
