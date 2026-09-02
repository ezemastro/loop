import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import sharedConfig, { typescriptUnusedVars } from "../../eslint.shared.config.mjs";

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
  typescriptUnusedVars,
]);
