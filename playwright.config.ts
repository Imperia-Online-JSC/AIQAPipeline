import { defineConfig, devices } from '@playwright/test';
import pipelineConfig from './config/pipeline.config.json';
import { getScreenSize } from './tests/_shared/screen';

// Every desktop project runs "fullscreen", but Chromium and Firefox/WebKit get there differently:
//
// Chromium (target-chromium) uses viewport: null — the page fills the real browser window instead
// of being pinned to a fixed size. That's the key to filling *whatever monitor the window opens on*
// (a fixed viewport pinned to one screen's size leaves a gap when the window lands on a wider one —
// exactly what happened with VS Code recording on an external display). Sizing comes from launch
// args: --start-maximized fills the screen when headed/recording, --window-size sets the headless
// window (headless ignores --start-maximized). For headed runs that reuse a browser (the VS Code
// extension), tests/_shared/fixtures.ts also resizes the live window via CDP — see fixtures.ts.
//
// Firefox/WebKit have no CDP window-bounds API, so they keep a fixed viewport = the detected screen
// size (getScreenSize()). That gives a full-size render for both headed and headless; fixtures.ts
// re-syncs it to the real screen at runtime for headed.
const screen = getScreenSize();

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
        // NB: intentionally not spreading devices['Desktop Chrome'] — its deviceScaleFactor is
        // incompatible with viewport: null (Playwright throws). chromium is the default browser
        // for a project with no device anyway.
        baseURL: pipelineConfig.app.baseURL,
        viewport: null,
        launchOptions: {
          args: [
            '--start-maximized',                              // headed/recording: fill the screen (no-op headless)
            `--window-size=${screen.width},${screen.height}`, // headless: size the window (headed ignores it)
          ],
        },
      },
    },
    {
      name: 'target-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: pipelineConfig.app.baseURL,
        viewport: screen,
      },
    },
    {
      name: 'target-webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: pipelineConfig.app.baseURL,
        viewport: screen,
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
