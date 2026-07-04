// ============================================================================
// genOg.mjs — generate public/og.png (1200×630) by screenshotting the landing
// hero with Playwright's bundled Chromium. Re-run after landing-page changes:
//   node scripts/genOg.mjs   (expects the dev server on :5173, mock mode)
// ============================================================================
import { chromium } from '@playwright/test';

const BASE = process.env.OG_BASE_URL || 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('public/og.png written (1200x630) from ' + BASE);
