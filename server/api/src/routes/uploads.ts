import { Router } from "express";
import { UploadsController } from "../controllers/upload";
import { upload } from "../services/uploads";
import { tokenMiddleware } from "../middlewares/parseToken";
import { UPLOAD_DIR } from "../config";
import express from "express";

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  tokenMiddleware,
  upload.single("file"),
  UploadsController.upload,
);
uploadsRouter.use("/", express.static(UPLOAD_DIR));
