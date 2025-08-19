import express from "express";
import { PORT } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import database from "./services/postgres.js";
import { queries } from "./services/queries.js";
import { AuthModel } from "./models/auth.js";

const app = express();

app.use(express.json());

// Inyectar el modelo de autenticación con el servicio de base de datos
const authModel = new AuthModel({ database, queries });
app.use("/auth", createAuthRouter({ authModel }));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
