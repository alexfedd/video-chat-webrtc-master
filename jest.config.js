/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.fuzz.test.js'],
  setupFilesAfterEnv: ['jest-extended'],
  testTimeout: 30000, // Увеличиваем таймаут для фаззинг-тестов
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!fast-check/.*)'
  ],
  globals: {
    'NODE_ENV': 'test'
  }
};
