import { test, expect } from '@playwright/test';
import { RottenTomatoesPage } from '../helpers/RottenTomatoesPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Coming Soon - SCENARIO_001', () => {
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
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);

    await executeStep('Cookie consent dialog is visible', async () => {
      await expect(page.getByRole('button', { name: 'I Accept' })).toBeVisible();
    });

    await executeStep('Accept cookies', async () => {
      await app.acceptCookies();
    });

    await executeStep('Banner dismissed and page content visible', async () => {
      await expect(page.getByRole('button', { name: 'I Accept' })).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'New 2026 Movies Coming Soon' })).toBeVisible();
    });
  });
});
