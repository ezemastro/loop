export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  setupFiles: ["<rootDir>/src/config.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1", // le saca el .js en tests
  },
};
