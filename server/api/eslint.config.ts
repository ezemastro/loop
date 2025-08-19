import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettier,
  {
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
    },
  },
]);
