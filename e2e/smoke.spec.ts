import { test, expect } from '@playwright/test';
import { color, font } from '../src/design/tokens';

// Stage 0 smoke + design-guide gate foundation. Confirms the scaffold renders
// and that the design tokens are actually applied to the DOM (the mechanism
// the per-screen gates in Stage 4+ reuse). Per-screen screenshot baselines are
// captured when those screens exist.

test('scaffold renders the QuoteForge shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('QuoteForge')).toBeVisible();
});

test('design-guide: app background and brand color match tokens', async ({ page }) => {
  await page.goto('/');
  const bodyBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // #F4F4FB
  expect(bodyBg).toBe('rgb(244, 244, 251)');

  const brand = page.getByText('QuoteForge');
  const brandColor = await brand.evaluate((el) => getComputedStyle(el).color);
  expect(brandColor).toBe('rgb(27, 81, 229)'); // accentDeep #1B51E5

  const family = await brand.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toContain('lato');

  // sanity: the imported tokens are the values we asserted (guards drift)
  expect(color.appBg).toBe('#F4F4FB');
  expect(color.accentDeep).toBe('#1B51E5');
  expect(font.heading).toContain('Lato');
});
