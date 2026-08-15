import { Router } from "express";
import { UsersController } from "../controllers/users";
import { tokenMiddleware } from "../middlewares/parseToken";

export const usersRouter = Router();

// Todo lo de usuarios se scopea a la comunidad de la sesión, así que ninguna de estas rutas
// puede seguir siendo pública.
usersRouter.get("/", tokenMiddleware, UsersController.getUsers);
usersRouter.get("/:userId", tokenMiddleware, UsersController.getUserById);
usersRouter.post("/:userId/donate", tokenMiddleware, UsersController.donate);
usersRouter.get("/:userId/wishes", tokenMiddleware, UsersController.getUserWishes);
