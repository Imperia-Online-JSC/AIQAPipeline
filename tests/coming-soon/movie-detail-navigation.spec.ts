import { test, expect } from '@playwright/test';
import { RottenTomatoesPage } from '../helpers/RottenTomatoesPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Coming Soon - SCENARIO_006', () => {
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

  test('SCENARIO_006 - first movie card navigates to its detail page', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);
    let clickedTitle = '';

    await executeStep('Open the first movie card in the list', async () => {
      clickedTitle = await app.openFirstMovieDetail();
      expect(clickedTitle.length).toBeGreaterThan(0);
    });

    await executeStep('Detail page loads for that movie', async () => {
      await expect(page).toHaveURL(/\/m\//);
      await expect(page).toHaveTitle(new RegExp(clickedTitle.split(' ')[0], 'i'));
    });
  });
});
