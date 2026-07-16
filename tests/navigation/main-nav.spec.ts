import { test, expect } from '@playwright/test';
import { StillfrontPage } from '../helpers/StillfrontPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Main navigation - SCENARIO_003 / SCENARIO_004', () => {
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

  test('SCENARIO_003 - Games link navigates to Our Games page', async ({ page }, testInfo) => {
    const app = new StillfrontPage(page, testInfo.project.use.isMobile);
    await page.goto('./');
    await app.acceptAllCookies();

    await executeStep('Click Games in main nav', async () => {
      await app.clickMainNavLink('Games');
    });

    await executeStep('Our Games page loaded', async () => {
      await expect(page).toHaveURL(/\/games\/?$/);
      await expect(page.getByRole('heading', { name: 'Our Games' })).toBeVisible();
    });
  });

  test('SCENARIO_004 - About us redirects to This is Stillfront page', async ({ page }) => {
    await executeStep('Navigate directly to about-us/', async () => {
      await page.goto('about-us/');
    });

    await executeStep('Redirected to This is Stillfront, not a 404', async () => {
      await expect(page).toHaveURL(/\/about-us\/this-is-stillfront\/?$/);
      await expect(page).toHaveTitle(/This is Stillfront/);
    });
  });
});
