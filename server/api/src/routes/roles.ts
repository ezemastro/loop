import { Router } from "express";
import { RoleController } from "../controllers/roles";

export const rolesRouter = Router();

rolesRouter.get("/", RoleController.getRoles);
