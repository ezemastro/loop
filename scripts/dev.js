const os = require("os");
const { spawn } = require("child_process");

/**
 * Resuelve la IP privada del host para que los clientes de dev apunten a la máquina que corre
 * Docker y no a su propio `localhost`. Sin esto, el navegador de otra notebook o el celular
 * resuelven `localhost` contra sí mismos y la API queda inalcanzable.
 * Prioridad: DEV_HOST explícito → primera IPv4 privada no interna → localhost.
 */
function resolveDevHost() {
  if (process.env.DEV_HOST) return process.env.DEV_HOST;

  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);

  // Las interfaces de Docker (172.16/12) y las VPN suelen aparecer primero, pero la que ven los
  // dispositivos de la LAN es la 192.168/16.
  const lan = candidates.find((address) => address.startsWith("192.168."));

  return lan || candidates[0] || "localhost";
}

const devHost = resolveDevHost();

if (devHost === "localhost") {
  console.warn("⚠️  No se detectó una IP de LAN. Los clientes de dev usarán localhost.");
  console.warn("   Definí DEV_HOST=<tu-ip> para probar desde otro dispositivo.");
} else {
  console.log(`🌐 DEV_HOST=${devHost}`);
  console.log(`   API   → http://${devHost}:3000`);
  console.log(`   Web   → http://${devHost}:8081`);
  console.log(`   Admin → http://${devHost}:5173`);
}

const args = ["compose", "-f", "docker-compose.dev.yml", "up", "--build", "--watch"];
const child = spawn("docker", args, {
  stdio: "inherit",
  env: { ...process.env, DEV_HOST: devHost },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
