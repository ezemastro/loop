import { execSync } from "child_process";
import { readFileSync } from "fs";

// Leer el package.json de forma compatible con ESM
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const IMAGE_NAME = `ezemastro/${pkg.name}`;
const VERSION = pkg.version;

try {
  console.log(`🚀 Iniciando build de ${IMAGE_NAME}:${VERSION}...`);

  // 1. Build para ambas etiquetas
  execSync(
    `docker build -f ../Dockerfile.admin -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest ..`,
    { stdio: "inherit" },
  );

  // 2. Push Versión específica
  console.log(`⬆️ Subiendo versión ${VERSION}...`);
  execSync(`docker push ${IMAGE_NAME}:${VERSION}`, { stdio: "inherit" });

  // 3. Push Latest
  console.log(`⬆️ Subiendo versión latest...`);
  execSync(`docker push ${IMAGE_NAME}:latest`, { stdio: "inherit" });

  console.log("✅ ¡Publicación exitosa!");
} catch (error) {
  console.error("❌ Error durante la publicación:", error.message);
  process.exit(1);
}
