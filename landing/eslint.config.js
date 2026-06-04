import { defineConfig } from "eslint/config";
import sharedConfig from "../eslint.shared.config.js";

export default defineConfig([
  ...sharedConfig,
  {
    ignores: ["dist/*"],
  },
]);
