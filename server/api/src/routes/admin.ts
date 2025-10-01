import { Router } from "express";
import { AdminController } from "../controllers/admin";

export const adminRouter = Router();

// Admin session
adminRouter.post("/login", AdminController.login);
