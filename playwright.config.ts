import { defineConfig, devices } from '@playwright/test';
import pipelineConfig from './config/pipeline.config.json';

// Headed runs should fill the real screen; headless runs (the CI/default path) must
// keep the devices[...] fixed viewport (1280x720 etc) — Chromium headless falls back to
// a much smaller default window when viewport is null, which breaks layout-dependent
// tests that assume the usual desktop viewport size.
// This file loads twice: once in the main CLI process (which sees --headed in argv),
// and again in each worker process (whose argv is stripped down — it never contains
// --headed). Detect it in the main process, where it's visible, and stamp it onto
// process.env — env vars, unlike argv, ARE inherited by the worker processes Playwright
// spawns afterward.
if (process.argv.includes('--headed')) process.env.HEADED = '1';
const headed = process.env.HEADED === '1';

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
    // Fill the whole screen when headed instead of Playwright's default fixed window size.
    ...(headed ? { launchOptions: { args: ['--start-maximized'] } } : {}),
  },

  projects: [
    {
      name: 'target-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: pipelineConfig.app.baseURL,
        // devices['Desktop Chrome'] hard-codes a 1280x720 viewport, which would otherwise
        // silently undo --start-maximized (Playwright pins the page's content area to that
        // size regardless of the actual window size). Only clear it for headed runs —
        // headless must keep the fixed viewport (see `headed` comment above).
        ...(headed ? { viewport: null, deviceScaleFactor: undefined } : {}),
      },
    },
    {
      name: 'target-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: pipelineConfig.app.baseURL,
        ...(headed ? { viewport: null, deviceScaleFactor: undefined } : {}),
      },
    },
    {
      name: 'target-webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: pipelineConfig.app.baseURL,
        ...(headed ? { viewport: null, deviceScaleFactor: undefined } : {}),
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
