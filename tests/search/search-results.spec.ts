import { test, expect } from '@playwright/test';
import { StillfrontPage } from '../helpers/StillfrontPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Search - SCENARIO_002', () => {
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

  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('./');
    const app = new StillfrontPage(page, testInfo.project.use.isMobile);
    await app.acceptAllCookies();
  });

  test('SCENARIO_002 - header search returns matching results', async ({ page }, testInfo) => {
    const app = new StillfrontPage(page, testInfo.project.use.isMobile);

    await executeStep('Submit search for "games"', async () => {
      await app.search('games');
    });

    await executeStep('Search results page shows matches', async () => {
      await expect(page).toHaveURL(/[?&]s=games/);
      await expect(page.getByRole('heading', { name: 'Search Results' })).toBeVisible();
    });
  });
});
