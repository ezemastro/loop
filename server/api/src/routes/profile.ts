import { Router } from "express";
import type { ProfileModel } from "../types/models";
import { ProfileController } from "../controllers/profile";

export const createProfileRouter = ({
  profileModel,
}: {
  profileModel: ProfileModel;
}) => {
  const profileRouter = Router();
  const profileController = new ProfileController({ profileModel });

  profileRouter.get("/", profileController.getProfile);

  return profileRouter;
};
