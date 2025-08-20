// jest.config.js
export default {
  preset: "ts-jest",

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1", // le saca el .js en tests
  },
};
