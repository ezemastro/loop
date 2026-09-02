import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

/**
 * Unused-vars rule for TypeScript files.
 *
 * This is exported separately instead of living in the default config because the
 * rule belongs to the `@typescript-eslint` plugin, which each package registers
 * itself. Placing it in the shared array either fails to load (plugin missing) or
 * collides with the package's own `tseslint` spread ("Cannot redefine plugin").
 * Consumers must append it AFTER their own `tseslint` configuration.
 */
export const typescriptUnusedVars = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "no-unused-vars": "off",
    },
  },
  eslintConfigPrettier,
  eslintPluginPrettier,
];
