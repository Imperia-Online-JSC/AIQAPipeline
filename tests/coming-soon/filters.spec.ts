import { test, expect } from '@playwright/test';
import { RottenTomatoesPage } from '../helpers/RottenTomatoesPage';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('Coming Soon - Filters', () => {
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

  test('SCENARIO_002 - SORT: Newest applies immediately', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);

    await executeStep('Select SORT -> Newest', async () => {
      await app.selectSort('newest');
    });

    await executeStep('URL and button label reflect the sort', async () => {
      await expect(page).toHaveURL(/sort:newest/);
      await expect(page.getByRole('button', { name: 'SORT: NEWEST' })).toBeVisible();
    });
  });

  test('SCENARIO_003 - RATING: PG-13 stays checked and applies', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);

    await executeStep('Select RATING -> PG-13 and apply', async () => {
      await app.selectAndApply('RATING', 'pg_13');
    });

    await executeStep('RATING panel closes after a successful apply', async () => {
      await expect(page.locator('[data-qa="option-pg_13"]:visible')).toHaveCount(0);
    });
  });

  test('SCENARIO_004 - TOMATOMETER: Fresh applies and updates the URL', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);

    await executeStep('Select TOMATOMETER -> Fresh and apply', async () => {
      await app.selectAndApply('TOMATOMETER', 'fresh');
    });

    await executeStep('URL and button label reflect the filter', async () => {
      await expect(page).toHaveURL(/critics:fresh/);
      await expect(page.getByRole('button', { name: /TOMATOMETER.*1/i })).toBeVisible();
    });
  });

  test('SCENARIO_005 - GENRE: Horror applies and updates the URL', async ({ page }, testInfo) => {
    const app = new RottenTomatoesPage(page, testInfo.project.use.isMobile);

    await executeStep('Select GENRE -> Horror and apply', async () => {
      await app.selectAndApply('GENRE', 'horror');
    });

    await executeStep('URL reflects the filter and the panel closes', async () => {
      await expect(page).toHaveURL(/genres:horror/);
      await expect(page.locator('[data-qa="option-horror"]:visible')).toHaveCount(0);
    });
  });
});
