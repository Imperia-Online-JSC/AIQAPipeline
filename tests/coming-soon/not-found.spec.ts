import { test, expect } from '@playwright/test';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Coming Soon - SCENARIO_008', () => {
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

  test('SCENARIO_008 - unknown top-level path returns a proper 404', async ({ page }) => {
    let response;

    await executeStep('Navigate to an unmatched top-level path', async () => {
      response = await page.goto('/this-page-does-not-exist-xyz-123');
    });

    await executeStep('Server responds with 404, not a raw error', async () => {
      expect(response?.status()).toBe(404);
    });
  });
});
