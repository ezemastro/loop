import express from "express";
import { NODE_ENV, PORT } from "./config.js";
import cookieParser from "cookie-parser";
import { tokenMiddleware } from "./middlewares/parseToken.js";
import { authRouter } from "./routes/auth.js";
import { selfRouter } from "./routes/self.js";
import { usersRouter } from "./routes/users.js";
import { schoolsRouter } from "./routes/schools.js";
import { categoriesRouter } from "./routes/categories.js";
import { listingsRouter } from "./routes/listings.js";
import { messagesRouter } from "./routes/messages.js";
import { adminRouter } from "./routes/admin.js";
import { errorMiddleware } from "./middlewares/errors.js";
import { uploadsRouter } from "./routes/uploads.js";
import { safeNumber } from "./utils/safeNumber.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());
if (NODE_ENV === "development") {
  import("morgan").then((module) => {
    const morgan = module.default;
    app.use(morgan("dev"));
  });
}

app.get("/status", (req, res) => {
  res.status(200).send(`Server is running. Environment: ${NODE_ENV}`);
});

app.use("/auth", authRouter);
app.use("/me", tokenMiddleware, selfRouter);
app.use("/users", usersRouter);
app.use("/categories", categoriesRouter);
app.use("/schools", schoolsRouter);
app.use("/listings", listingsRouter);
app.use("/messages", tokenMiddleware, messagesRouter);
app.use("/uploads", uploadsRouter);
app.use("/admin", adminRouter);

app.use(errorMiddleware);

// Iniciar el servidor
export const server = app.listen(safeNumber(PORT) || 3000, "0.0.0.0", () => {
  console.log(`Servidor corriendo. Entorno: ${NODE_ENV} en el puerto ${PORT}`);
});
