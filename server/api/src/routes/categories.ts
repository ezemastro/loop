import { Router } from "express";
import { CategoriesController } from "../controllers/categories";

export const categoriesRouter = Router();

categoriesRouter.get("/", CategoriesController.getCategories);
