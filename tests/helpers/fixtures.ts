import { test as base, expect } from '@playwright/test';

// Detecting "headed" via process.argv (e.g. `--headed` in argv) only covers plain CLI runs.
// The VS Code Playwright extension's Run/Debug buttons drive tests through its own test-server
// protocol — it never puts a literal "--headed" string in argv, it sends a structured "headed"
// flag over that protocol instead. Playwright applies that as a real config override before the
// test runs, and `testInfo.project.use.headless` reflects the *effective* value regardless of
// which path (CLI flag or VS Code) set it — so checking it here works for both.
const test = base.extend<{ fillScreenWhenHeaded: void }>({
  fillScreenWhenHeaded: [
    async ({ page, browserName }, use, testInfo) => {
      // Mobile Chrome/Safari intentionally emulate a phone viewport (Pixel 5 / iPhone 13) —
      // don't blow that up to fill the screen even if someone runs one of them headed.
      if (testInfo.project.use.headless === false && !testInfo.project.use.isMobile) {
        const screen = await page.evaluate(() => ({
          left: window.screen.availLeft,
          top: window.screen.availTop,
          width: window.screen.availWidth,
          height: window.screen.availHeight,
        }));

        if (browserName === 'chromium') {
          // The VS Code extension can reuse an already-running browser (connectWsEndpoint)
          // instead of launching a fresh one, so launchOptions like --start-maximized never
          // reach that process — resizing explicitly via CDP works regardless of how the
          // browser was started.
          const cdp = await page.context().newCDPSession(page);
          const { windowId } = await cdp.send('Browser.getWindowForTarget');
          // Must leave "maximized"/"minimized" state before setting explicit bounds.
          await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
          await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: { left: screen.left, top: screen.top, width: screen.width, height: screen.height, windowState: 'normal' },
          });
        }

        // Sync the CSS viewport to match — a fixed viewport set at context creation otherwise
        // stays pinned at that size (device-metrics emulation) even after the outer window
        // itself is resized. Also the only thing available for Firefox/WebKit, which have no
        // CDP window-bounds equivalent.
        await page.setViewportSize({ width: screen.width, height: screen.height });
      }
      await use();
    },
    { auto: true },
  ],
});

export { test, expect };
