import { defineConfig, devices } from '@playwright/test';
import pipelineConfig from './config/pipeline.config.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    // Cap how long a single action (click/fill/etc.) auto-waits for its element.
    // Without this, a click on an element that never appears hangs until the whole
    // test's setTimeout instead of failing fast.
    actionTimeout: 20000,
  },

  projects: [
    {
      name: 'target-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: pipelineConfig.app.baseURL,
      },
    },
    {
      name: 'target-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: pipelineConfig.app.baseURL,
      },
    },
    {
      name: 'target-webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: pipelineConfig.app.baseURL,
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        baseURL: pipelineConfig.app.baseURL,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
        baseURL: pipelineConfig.app.baseURL,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
