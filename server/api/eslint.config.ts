import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import sharedConfig from "../../eslint.shared.config.js";

export default defineConfig([
  ...sharedConfig,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  tseslint.configs.recommended,
]);
