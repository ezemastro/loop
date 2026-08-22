#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose -p loop-e2e -f docker-compose.e2e.yml"

cleanup() {
  $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Base 100% fresca: elimina cualquier volumen previo (por ejemplo, de un `up` manual anterior).
cleanup

# Cachebuster: invalida la imagen del runner e2e en cada corrida (ver Dockerfile.e2e).
CACHEBUST=$(date +%s)
$COMPOSE build --build-arg CACHEBUST="$CACHEBUST" e2e

# Levanta el stack en background y espera a que db/api estén saludables.
# (No usamos `up --exit-code-from`: en Compose v5 implica `--abort-on-container-exit`,
# que aborta cuando `migrate` (one-shot) termina, y el shutdown graceful deja el comando
# colgado con api/db vivos.)
# El servicio e2e vive bajo `profiles: ["run"]`, así `up` NO lo arranca: la suite corre una
# sola vez contra la DB fresca, en el `run` de abajo.
$COMPOSE up -d --wait

# Corre la suite en el contenedor del runner. `--no-deps` evita que `run` toque los servicios
# que ya están arriba (el one-shot `migrate` ya corrió con el `up`).
$COMPOSE run --rm -T --no-deps e2e npx playwright test --project=e2e