const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.resolverMainFields = ["main", "browser", "module"];

config.resolver.sourceExts = ["js", "jsx", "ts", "tsx", "json", "cjs"];

module.exports = withNativeWind(config, { input: "./global.css" });
