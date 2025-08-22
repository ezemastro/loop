import { Router } from "express";
import { AuthController } from "../controllers/auth.js";

export const authRouter = Router();

authRouter.post("/register", AuthController.register);
authRouter.post("/login", AuthController.login);
