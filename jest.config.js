// jest.config.js
module.exports = {
  // Fix: Correctly configuring test timeouts at the root level
  // The "testTimeout" is a valid Jest option (no typo)
  testTimeout: 30000,
  
  // Project-specific configurations
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.js'],
      // Unit tests need less time
      testTimeout: 15000
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.js'],
      // Integration tests need more time
      testTimeout: 30000
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/__tests__/e2e/**/*.test.js'],
      // E2E tests need even more time
      testTimeout: 60000
    }
  ],
  
  // Setup file that runs before tests
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/local/**',
    '!**/node_modules/**'
  ]
};
