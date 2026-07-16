import { test, expect } from '@playwright/test';
import { RottenTomatoesPage } from '../helpers/RottenTomatoesPage';
import pipelineConfig from '../../config/pipeline.config.json';

// Documents a known bug (see .agents/feedback.md, Critical Issues): clicking "Add to
// watchlist" while logged out is a silent no-op — no request, no login prompt, no
// feedback at all.
test.describe('Coming Soon - SCENARIO_007 (known bug)', () => {
  test.setTimeout(pipelineConfig.timeouts.simple);

  const executeStep = async (name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      console.log(`✅ ${name} -> passed (${((Date.now() - start) / 1000).toFixed(2)}s)`);
    } catch (e) {
      console.log(`❌ ${name} -> failed after ${((Date.now() - start) / 1000).toFixed(2)}s: ${(e as Error).message}`);
      throw e;
    }
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await new RottenTomatoesPage(page).acceptCookies();
  });

  test('SCENARIO_007 - watchlist click gives no feedback while logged out', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);
    const requestsAfterClick: string[] = [];

    await executeStep('Click the first "Add to watchlist" button', async () => {
      page.on('request', (req) => requestsAfterClick.push(req.url()));
      await app.clickFirstWatchlistButton();
      await page.waitForTimeout(1000);
    });

    await executeStep('BUG: no network request fired for the watchlist action', async () => {
      const watchlistCalls = requestsAfterClick.filter((url) => /watchlist/i.test(url));
      expect(watchlistCalls).toHaveLength(0);
    });

    await executeStep('BUG: still unauthenticated, header shows no login prompt', async () => {
      await expect(page.getByRole('button', { name: 'LOGIN/SIGNUP' })).toBeVisible();
    });
  });
});
