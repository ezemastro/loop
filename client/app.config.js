// `app.json` stays the static base; Expo passes it in as `config`. Cleartext HTTP is a development
// affordance for the LAN API at eas.json's `development` profile — it must never reach a store build.
module.exports = ({ config }) => {
  const isDev =
    process.env.EAS_BUILD_PROFILE === "development" || process.env.NODE_ENV !== "production";
  if (!isDev) return config;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
    ],
  };
};
