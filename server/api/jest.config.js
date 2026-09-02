export default {
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/tests/**", "!src/scripts/**", "!src/**/*.test.ts"],
  coverageReporters: ["text-summary", "lcov"],
  projects: [
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
    {
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1", // le saca el .js en tests
      },
      roots: ["<rootDir>/src"],
      preset: "ts-jest",
      displayName: "integration",
      testMatch: ["**/tests/**/*.test.ts"],
    },
  ],
};
