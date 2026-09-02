import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import sharedConfig, { typescriptUnusedVars } from "../../eslint.shared.config.mjs";

export default defineConfig([
  // Flat config does not auto-ignore build output the way a legacy `.eslintignore` did — without
  // this, a local `dist/` from `npm run build`/`build:docker` gets linted as source and floods the
  // report with findings against compiled JS.
  { ignores: ["dist/**"] },
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
