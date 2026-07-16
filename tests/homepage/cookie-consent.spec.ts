import { test, expect } from '@playwright/test';
import { StillfrontPage } from '../helpers/StillfrontPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Homepage - SCENARIO_001', () => {
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
  });

  test('SCENARIO_001 - cookie consent banner can be accepted', async ({ page }, testInfo) => {
    const app = new StillfrontPage(page, testInfo.project.use.isMobile);

    await executeStep('Cookie consent banner is visible', async () => {
      await expect(page.getByRole('heading', { name: 'This website uses cookies' })).toBeVisible();
    });

    await executeStep('Accept all cookies', async () => {
      await app.acceptAllCookies();
    });

    await executeStep('Banner dismissed and homepage content visible', async () => {
      await expect(page.getByRole('heading', { name: 'This website uses cookies' })).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Universe of positive gaming experiences.' })).toBeVisible();
    });
  });
});
