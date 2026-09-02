#!/usr/bin/env bash
# Construye y publica las tres imágenes multi-arquitectura (`linux/amd64,linux/arm64`) que
# `compose.yml` consume: `ezemastro/loop-api`, `ezemastro/loop-web` y `ezemastro/loop-admin`.
#
# Reemplaza los cinco caminos de build previos (`build:server`, `scripts/docker-build.js`,
# `scripts/docker-push.js`, y los tres `*/publish.js`): uno solo, con `docker buildx`, sin tocar
# ningún archivo del repo ni crear commits.
#
# Uso:
#   bash scripts/build-images.sh                # construye y publica las tres imágenes
#   bash scripts/build-images.sh api             # solo la imagen de la API
#   bash scripts/build-images.sh web admin       # solo web y admin
#
# Variables de entorno esperadas (build args públicos, no secretos — EXPO_PUBLIC_*/VITE_* viajan
# igual al bundle del cliente):
#   EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID   (imagen web)
#   VITE_API_URL, VITE_GOOGLE_CLIENT_ID                     (imagen admin)
#
# Requiere: `docker buildx` con un builder que soporte `linux/amd64,linux/arm64` (QEMU en runners
# x86-64; nativo en un host arm64), y sesión iniciada contra el registro de destino.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PLATFORMS="linux/amd64,linux/arm64"

# Cada versión sale del `package.json` del propio paquete — no del root (1.4.3, sin relación con
# las imágenes) — igual que hacían los tres `publish.js` que este script reemplaza.
pkg_version() {
  node -p "require('./$1/package.json').version"
}

build_api() {
  local version
  version="$(pkg_version server/api)"
  echo "==> Building ezemastro/loop-api:${version}"
  docker buildx build \
    --platform "$PLATFORMS" \
    -f Dockerfile.api \
    --target production \
    -t "ezemastro/loop-api:${version}" \
    -t "ezemastro/loop-api:latest" \
    --push \
    .
}

build_web() {
  local version
  version="$(pkg_version client)"
  : "${EXPO_PUBLIC_API_URL:?EXPO_PUBLIC_API_URL is required to build the web image}"
  : "${EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID:?EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID is required to build the web image}"
  echo "==> Building ezemastro/loop-web:${version}"
  # Cada `--build-arg` es su propio elemento de array: un valor con espacios o `;` llega intacto,
  # a diferencia de `client/publish.js:38-39`, que los interpolaba en un string de shell.
  docker buildx build \
    --platform "$PLATFORMS" \
    -f Dockerfile.web \
    --build-arg "EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}" \
    --build-arg "EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID=${EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID}" \
    -t "ezemastro/loop-web:${version}" \
    -t "ezemastro/loop-web:latest" \
    --push \
    .
}

build_admin() {
  local version
  version="$(pkg_version adminClient)"
  : "${VITE_API_URL:?VITE_API_URL is required to build the admin image}"
  : "${VITE_GOOGLE_CLIENT_ID:?VITE_GOOGLE_CLIENT_ID is required to build the admin image}"
  echo "==> Building ezemastro/loop-admin:${version}"
  docker buildx build \
    --platform "$PLATFORMS" \
    -f Dockerfile.admin \
    --build-arg "VITE_API_URL=${VITE_API_URL}" \
    --build-arg "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" \
    -t "ezemastro/loop-admin:${version}" \
    -t "ezemastro/loop-admin:latest" \
    --push \
    .
}

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=(api web admin)
fi

for target in "${targets[@]}"; do
  case "$target" in
    api) build_api ;;
    web) build_web ;;
    admin) build_admin ;;
    *)
      echo "Unknown target: $target (expected: api, web, admin)" >&2
      exit 1
      ;;
  esac
done
