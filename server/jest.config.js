module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['routes/**/*.ts', 'middleware/**/*.ts', 'lib/**/*.ts'],
};
