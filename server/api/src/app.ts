import express from "express";
import { PORT } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import { PostgresClient } from "./services/postgresClient.js";
import { queries } from "./services/queries.js";
import { AuthModel } from "./models/auth.js";
import { createProfileRouter } from "./routes/profile.js";
import { ProfileModel } from "./models/profile.js";
import cookieParser from "cookie-parser";
import { tokenMiddleware } from "./middlewares/parseToken.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

// Inyectar el modelo de autenticación con el servicio de base de datos
const authModel = new AuthModel({
  dbConnection: new PostgresClient(),
  queries,
});
app.use("/auth", createAuthRouter({ authModel }));

const profileModel = new ProfileModel({
  dbConnection: new PostgresClient(),
  queries,
});
app.use("/me", tokenMiddleware, createProfileRouter({ profileModel }));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
