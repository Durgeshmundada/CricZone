module.exports = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/setup/setupTestDb.js"],
  collectCoverageFrom: [
    "controllers/**/*.js",
    "services/**/*.js",
    "!controllers/turfController.js"
  ],
  coverageReporters: ["text", "text-summary", "lcov"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: { statements: 70, lines: 70 },
    "./controllers/": { statements: 70, functions: 70, lines: 70 },
    "./services/": { statements: 70, functions: 70, lines: 70 }
  }
};
