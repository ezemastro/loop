import express from "express";
import { PORT } from "./config.js";
import cookieParser from "cookie-parser";
import { tokenMiddleware } from "./middlewares/parseToken.js";
import { authRouter } from "./routes/auth.js";
import { selfRouter } from "./routes/self.js";

export const app = express();
console.log(process.env.NODE_ENV);

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/me", tokenMiddleware, selfRouter);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
