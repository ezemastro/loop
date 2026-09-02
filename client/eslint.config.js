import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import sharedConfig, { typescriptUnusedVars } from "../eslint.shared.config.mjs";

export default defineConfig([
  ...sharedConfig,
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "import/namespace": "off",
      "import/no-deprecated": "off",
      "import/no-named-as-default": "off",
      "import/no-unused-modules": "off",
    },
  },
  typescriptUnusedVars,
]);
