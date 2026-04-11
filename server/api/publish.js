import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

// Leemos el package.json de la carpeta actual (server/api)
const pkgPath = join(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const IMAGE_NAME = `ezemastro/${pkg.name}`;
const VERSION = pkg.version;

if (!VERSION || VERSION === "undefined") {
  console.error("❌ Error: No se pudo determinar la versión del package.json");
  process.exit(1);
}

try {
  console.log(`🚀 Iniciando build de la API: ${IMAGE_NAME}:${VERSION}...`);

  // El contexto es ../.. (la raíz del proyecto Loop)
  // El Dockerfile está en ../../Dockerfile.api
  execSync(
    `docker build -f ../../Dockerfile.api -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest ../..`,
    { stdio: "inherit" },
  );

  console.log(`⬆️ Subiendo a Docker Hub...`);
  execSync(`docker push ${IMAGE_NAME}:${VERSION}`, { stdio: "inherit" });
  execSync(`docker push ${IMAGE_NAME}:latest`, { stdio: "inherit" });

  console.log("✅ ¡API publicada con éxito!");
} catch (error) {
  console.error("❌ Error durante la publicación:", error.message);
  process.exit(1);
}
