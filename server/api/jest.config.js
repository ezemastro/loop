export default {
  testEnvironment: "node",
  projects: [
    {
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1", // le saca el .js en tests
      },
      roots: ["<rootDir>/src"],
      preset: "ts-jest",
      displayName: "api",
      testMatch: ["**/tests/**/*.test.ts"],
      globalTeardown: "./src/tests/teardown.ts",
      setupFilesAfterEnv: ["./src/tests/setupAfterEnv.ts"],
    },
    {
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1", // le saca el .js en tests
      },
      roots: ["<rootDir>/src"],
      preset: "ts-jest",
      displayName: "unit",
      testMatch: [
        "**/models/**/*.test.ts",
        "**/controllers/**/*.test.ts",
        "**/routes/**/*.test.ts",
        "**/utils/**/*.test.ts",
        "**/services/**/*.test.ts",
      ],
    },
  ],
};
