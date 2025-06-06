// jest.setup.js
jest.setTimeout(60000); // default timeout 60 seconds
require('jest-extended');

// Mock console.error to reduce noise in tests
console.error = (...args) => {
  if (args[0]?.includes('ExperimentalWarning')) return;
  console.log(...args);
};
