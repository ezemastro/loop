import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { NODE_ENV, PORT } from "./config.js";
import cookieParser from "cookie-parser";
import { tokenMiddleware } from "./middlewares/parseToken.js";
import { authRouter } from "./routes/auth.js";
import { selfRouter } from "./routes/self.js";
import { rolesRouter } from "./routes/roles.js";
import { usersRouter } from "./routes/users.js";
import { schoolsRouter } from "./routes/schools.js";
import { categoriesRouter } from "./routes/categories.js";
import { listingsRouter } from "./routes/listings.js";
import { messagesRouter } from "./routes/messages.js";
import morgan from "morgan";

export const app = express();

app.use(express.json());
app.use(cookieParser());
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/auth", authRouter);
app.use("/me", tokenMiddleware, selfRouter);
app.use("/roles", rolesRouter);
app.use("/users", usersRouter);
app.use("/categories", categoriesRouter);
app.use("/schools", schoolsRouter);
app.use("/listings", listingsRouter);
app.use("/messages", tokenMiddleware, messagesRouter);

// Middleware para manejo de errores
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("Error en la aplicación:", err);
  res.status(500).json({ error: err.message });
});

// Iniciar el servidor
export const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
