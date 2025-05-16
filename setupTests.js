// setupTests.js
// Global setup file for Jest tests

// Fix: Add timeout based on test type
// This helps prevent timeouts in E2E tests that are naturally slower
const setupTestTimeout = () => {
  const testPath = process.env.JEST_WORKER_ID || '';
  
  if (testPath.includes('e2e')) {
    // E2E tests need more time
    jest.setTimeout(60000); // 60 seconds
  } else if (testPath.includes('integration')) {
    // Integration tests need moderate time
    jest.setTimeout(30000); // 30 seconds
  } else {
    // Unit tests need less time
    jest.setTimeout(15000); // 15 seconds
  }
};

// Set proper environment variables for testing
const setupEnvironmentVariables = () => {
  // Ensure we're running in test mode
  process.env.NODE_ENV = 'test';
  
  // Set table prefix for tests
  process.env.TABLE_PREFIX = 'test';
  
  // Set DynamoDB endpoint
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  
  // Use custom port for DynamoDB to avoid conflicts
  process.env.DYNAMODB_LOCAL_PORT = '8000';
  
  // Configure mock API by default
  if (process.env.USE_API_MOCKS === undefined) {
    process.env.USE_API_MOCKS = 'true';
  }
  
  // Set API endpoint for tests
  process.env.API_ENDPOINT = 'http://localhost:3000/dev';
  
  // Set mock server port
  process.env.MOCK_SERVER_PORT = '3001';
  
  // Fix: Add sample API keys for tests
  process.env.YAHOO_FINANCE_API_KEY = 'test-api-key';
  process.env.YAHOO_FINANCE_API_HOST = 'yh-finance.p.rapidapi.com';
  process.env.EXCHANGE_RATE_API_KEY = 'test-api-key';
};

// Configure global setup
const setupGlobals = () => {
  // Fix: Add global mock store for tests that can't access DynamoDB
  global.mockStore = {
    sessions: {},
    cache: {},
    blacklist: {}
  };
  
  // Add helper to check test type
  global.isUnitTest = () => {
    return process.env.JEST_WORKER_ID && !process.env.JEST_WORKER_ID.includes('e2e') && !process.env.JEST_WORKER_ID.includes('integration');
  };
  
  global.isIntegrationTest = () => {
    return process.env.JEST_WORKER_ID && process.env.JEST_WORKER_ID.includes('integration');
  };
  
  global.isE2ETest = () => {
    return process.env.JEST_WORKER_ID && process.env.JEST_WORKER_ID.includes('e2e');
  };
};

// Run all setup functions
setupTestTimeout();
setupEnvironmentVariables();
setupGlobals();

// Print the test environment info
console.log('==== TEST SETUP INFO ====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Test Type:', global.isUnitTest() ? 'Unit' : global.isIntegrationTest() ? 'Integration' : global.isE2ETest() ? 'E2E' : 'Unknown');
console.log('Timeout:', jest.getTimerCount() || 'Default');
console.log('========================');
