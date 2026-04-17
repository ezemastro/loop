import { execSync } from "child_process";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const WEB_GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID ||
  process.env.WEB_GOOGLE_CLIENT_ID;

if (!API_URL) {
  console.error("❌ ERROR: EXPO_PUBLIC_API_URL no definida en el .env");
  process.exit(1);
}

if (!WEB_GOOGLE_CLIENT_ID) {
  console.error(
    "❌ ERROR: EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID/WEB_GOOGLE_CLIENT_ID no definida en el .env",
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
// Asegúrate de que el "name" en el package.json de tu app sea "loop-app" o similar
const IMAGE_NAME = `ezemastro/${pkg.name}`;
const VERSION = pkg.version;

try {
  console.log(`🌍 Usando API URL: ${API_URL}`);
  console.log(`🚀 Iniciando build WEB de Expo: ${IMAGE_NAME}:${VERSION}...`);

  // Construimos usando el archivo que está un nivel arriba y el contexto en la raíz
  execSync(
    `docker build -f ../Dockerfile.web \
    --build-arg EXPO_PUBLIC_API_URL=${API_URL} \
    --build-arg EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID=${WEB_GOOGLE_CLIENT_ID} \
    -t ${IMAGE_NAME}:${VERSION} \
    -t ${IMAGE_NAME}:latest ..`,
    { stdio: "inherit" },
  );

  console.log(`⬆️ Subiendo a Docker Hub...`);
  execSync(`docker push ${IMAGE_NAME}:${VERSION}`, { stdio: "inherit" });
  execSync(`docker push ${IMAGE_NAME}:latest`, { stdio: "inherit" });

  console.log("✅ ¡Versión Web publicada con éxito!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
