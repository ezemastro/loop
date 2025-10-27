import { Router } from "express";
import { UsersController } from "../controllers/users";
import { tokenMiddleware } from "../middlewares/parseToken";

export const usersRouter = Router();

usersRouter.get("/", UsersController.getUsers);
usersRouter.get("/:userId", UsersController.getUserById);
usersRouter.post("/:userId/donate", tokenMiddleware, UsersController.donate);
usersRouter.get("/:userId/wishes", UsersController.getUserWishes);
