const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const monorepoRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname);

// `client/demo/` importa el dataset de `shared/demo-data`, que vive fuera de la carpeta del
// proyecto. Sin esto Metro no lo mira y el bundle falla al resolverlo.
config.watchFolders = [path.resolve(monorepoRoot, "shared")];

// Al ampliar watchFolders, Metro pasa a buscar `node_modules` también hacia arriba. Fijarlo acá
// evita que resuelva una copia distinta de react/react-native desde la raíz del monorepo.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

config.resolver.resolverMainFields = ["main", "browser", "module"];

config.resolver.sourceExts = ["js", "jsx", "ts", "tsx", "json", "cjs"];

module.exports = withNativeWind(config, { input: "./global.css" });
