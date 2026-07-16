import { test, expect } from '@playwright/test';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('404 handling - SCENARIO_006', () => {
  test.setTimeout(pipelineConfig.timeouts.simple);

  test('SCENARIO_006 - unknown URL shows a friendly 404 page', async ({ page }) => {
    await page.goto('this-page-does-not-exist-xyz/');
    await expect(page).toHaveTitle(/Page not found/);
  });
});
