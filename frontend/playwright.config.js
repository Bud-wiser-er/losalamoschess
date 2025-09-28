// frontend/playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Change this line to match your actual directory name
  testDir: './frontend_tests',  // Changed from './tests'
  
  // Rest of your config stays the same...
  testIgnore: [
    '../**/*.test.js',
    '../security/**',
    '../Server/**',
    '../unit-tests/**',
    '**/*.spec.js'
  ],
  
  testMatch: ['**/frontend_tests/**/*.test.js'], // Updated this too
  
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: 'html',
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});