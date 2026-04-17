import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Leer el package.json de forma compatible con ESM
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const IMAGE_NAME = `ezemastro/${pkg.name}`;
const VERSION = pkg.version;
const API_URL = process.env.VITE_API_URL;
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;

if (!API_URL) {
  console.error("❌ Error: VITE_API_URL no está definido en ../.env");
  process.exit(1);
}

if (!GOOGLE_CLIENT_ID) {
  console.error("❌ Error: VITE_GOOGLE_CLIENT_ID no está definido en ../.env");
  process.exit(1);
}

try {
  console.log(`🌱 Variables de entorno cargadas desde ${envPath}`);
  console.log(`🚀 Iniciando build de ${IMAGE_NAME}:${VERSION}...`);

  // 1. Build para ambas etiquetas
  execFileSync(
    "docker",
    [
      "build",
      "-f",
      "../Dockerfile.admin",
      "--build-arg",
      `VITE_API_URL=${API_URL}`,
      "--build-arg",
      `VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
      "-t",
      `${IMAGE_NAME}:${VERSION}`,
      "-t",
      `${IMAGE_NAME}:latest`,
      "..",
    ],
    { stdio: "inherit" },
  );

  // 2. Push Versión específica
  console.log(`⬆️ Subiendo versión ${VERSION}...`);
  execFileSync("docker", ["push", `${IMAGE_NAME}:${VERSION}`], {
    stdio: "inherit",
  });

  // 3. Push Latest
  console.log(`⬆️ Subiendo versión latest...`);
  execFileSync("docker", ["push", `${IMAGE_NAME}:latest`], {
    stdio: "inherit",
  });

  console.log("✅ ¡Publicación exitosa!");
} catch (error) {
  console.error("❌ Error durante la publicación:", error.message);
  process.exit(1);
}
