import { Router } from "express";
import { CommunitiesController } from "../controllers/communities.js";

export const communitiesRouter = Router();

// Ambas son públicas: corren en la pantalla de registro, antes de que exista sesión.
communitiesRouter.get("/resolve", CommunitiesController.resolve);
communitiesRouter.get("/:slug", CommunitiesController.getBySlug);
