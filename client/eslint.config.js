import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import sharedConfig from "../eslint.shared.config.js";

export default defineConfig([
  ...sharedConfig,
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
    rules: {
      "import/namespace": "off",
      "import/no-deprecated": "off",
      "import/no-named-as-default": "off",
      "import/no-unused-modules": "off",
    },
  },
]);
