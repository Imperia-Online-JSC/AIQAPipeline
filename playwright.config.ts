import { defineConfig, devices } from '@playwright/test';
import pipelineConfig from './config/pipeline.config.json';

// Headed runs should fill the real screen; headless runs (the CI/default path) must keep
// the devices[...] fixed viewport (1280x720 etc) — Chromium headless falls back to a much
// smaller default window when viewport is null, which breaks layout-dependent tests that
// assume the usual desktop viewport size.
//
// This used to be handled here by sniffing `--headed` out of argv, but that only covers
// plain CLI runs. The VS Code Playwright extension's Run/Debug buttons drive tests through
// their own test-server protocol and never put a literal "--headed" string in argv, so that
// detection silently never fired for VS Code runs, leaving the viewport pinned at 1280x720
// regardless of actual window size. The fix now lives in tests/helpers/fixtures.ts, which
// checks `testInfo.project.use.headless` at test runtime instead — that reflects the
// *effective* value regardless of which path set it, and resizes explicitly via CDP, which
// also works when VS Code reuses an already-running browser instead of launching a fresh
// one (so launchOptions like --start-maximized would never even reach that process).

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
