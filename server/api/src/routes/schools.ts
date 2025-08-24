import { Router } from "express";
import { SchoolsController } from "../controllers/schools";

export const schoolsRouter = Router();

schoolsRouter.get("/", SchoolsController.getSchools);
schoolsRouter.get("/:schoolId", SchoolsController.getSchoolById);
