import { Router } from "express";
import { SchoolsController } from "../controllers/schools";
import { tokenMiddleware } from "../middlewares/parseToken";

export const schoolsRouter = Router();

// El listado sigue siendo público (lo necesita la pantalla de registro): el controller resuelve
// la comunidad por query. El detalle, en cambio, se scopea a la comunidad de la sesión.
schoolsRouter.get("/", SchoolsController.getSchools);
schoolsRouter.get("/:schoolId", tokenMiddleware, SchoolsController.getSchoolById);
