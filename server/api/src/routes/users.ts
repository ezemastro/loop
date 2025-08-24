import { Router } from "express";
import { UsersController } from "../controllers/users";

export const usersRouter = Router();

usersRouter.get("/", UsersController.getUsers);
usersRouter.get("/:userId", UsersController.getUserById);
