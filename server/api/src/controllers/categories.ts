import { CategoriesModel } from "../models/categories";
import type { Request, Response } from "express";

export class CategoriesController {
  static getCategories = async (req: Request, res: Response) => {
    const result = await CategoriesModel.getCategories();
    res.status(200).json(result);
  };
}
