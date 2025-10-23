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
import cors from "cors";
import { trimBody } from "./middlewares/trimBody.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: "*",
  }),
);
if (NODE_ENV === "development") {
  import("morgan").then((module) => {
    const morgan = module.default;
    app.use(morgan("dev"));
  });
}

app.get("/status", (req, res) => {
  res.status(200).send(`Server is running. Environment: ${NODE_ENV}`);
});

app.use("/auth", trimBody, authRouter);
app.use("/me", trimBody, tokenMiddleware, selfRouter);
app.use("/users", trimBody, usersRouter);
app.use("/categories", trimBody, categoriesRouter);
app.use("/schools", trimBody, schoolsRouter);
app.use("/listings", trimBody, listingsRouter);
app.use("/messages", trimBody, tokenMiddleware, messagesRouter);
app.use("/uploads", trimBody, uploadsRouter);
app.use("/admin", trimBody, adminRouter);

app.use(errorMiddleware);

// Iniciar el servidor
export const server = app.listen(safeNumber(PORT) || 3000, "0.0.0.0", () => {
  console.log(`Servidor corriendo. Entorno: ${NODE_ENV} en el puerto ${PORT}`);
});
