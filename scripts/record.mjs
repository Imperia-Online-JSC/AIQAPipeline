// Opens a MAXIMIZED Chromium and drops into Playwright's recorder (the Inspector's Record button),
// so a recording session fills the screen just like headed/headless test runs now do.
//
// Why not `npx playwright codegen`? codegen ignores playwright.config.ts and has no maximize flag
// (only --viewport-size), so it can't reliably open fullscreen. Launching the browser ourselves
// lets us pass --start-maximized for a real maximized window. Recording is inherently interactive,
// so this always runs headed.
//
// Usage:  npm run record            (records against config app.baseURL)
//         npm run record <url>      (records against a specific URL)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(here, '../config/pipeline.config.json'), 'utf8'));
const url = process.argv[2] || config.app.baseURL;

const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
// viewport: null lets the page fill the maximized window instead of being pinned to a fixed size.
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

try {
  await page.goto(url);
  // Opens the Playwright Inspector; click its Record button to turn actions into test code.
  // Close the browser window to end the session.
  await page.pause();
} catch {
  // Closing the browser mid-session rejects the pending pause() — that's a normal exit, ignore it.
} finally {
  await browser.close().catch(() => {});
}
