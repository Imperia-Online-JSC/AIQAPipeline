import { test, expect } from '@playwright/test';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Contact us - SCENARIO_005', () => {
  test.setTimeout(pipelineConfig.timeouts.simple);

  test.beforeEach(async ({ page }) => {
    await page.goto('about-us/contact-us/');
  });

  test('SCENARIO_005 - contact page shows mailto links and no login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Contact us' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ir@stillfront.com' })).toHaveAttribute(
      'href',
      'mailto:ir@stillfront.com'
    );
    await expect(page.getByRole('link', { name: 'dpo@stillfront.com' })).toHaveAttribute(
      'href',
      'mailto:dpo@stillfront.com'
    );
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
