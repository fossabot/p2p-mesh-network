module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  roots: [
    "<rootDir>/src"
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  verbose: true,
  clearMocks: true,
  coverageDirectory: "coverage",
  setupFiles: ["<rootDir>/src/tests/jest.setup.js"]
};