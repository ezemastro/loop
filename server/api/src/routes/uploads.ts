import { Router } from "express";
import { UploadsController } from "../controllers/upload";
import { optimizeUploadedImage, upload } from "../services/uploads";
import { tokenMiddleware } from "../middlewares/parseToken";
import { UPLOAD_DIR } from "../config";
import express from "express";

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  tokenMiddleware,
  upload.single("file"),
  optimizeUploadedImage,
  UploadsController.upload,
);
// SEC-08: `verifySignature` gates access when `MEDIA_URL_SIGNING_ENABLED` is on, refusing an
// unsigned/tampered/expired request with 403 before it ever reaches the filesystem. It is a no-op
// pass-through while the flag is off, so `express.static` still owns 100% of today's behaviour.
uploadsRouter.use("/", UploadsController.verifySignature, express.static(UPLOAD_DIR));
