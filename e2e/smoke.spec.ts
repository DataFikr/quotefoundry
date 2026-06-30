import { test, expect } from '@playwright/test';
import { color, font } from '../src/design/tokens';

// Shell smoke + the design-guide assertion mechanism the per-screen gates reuse.
test('shell renders the pipeline by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
});

test('design-guide: app background matches the token', async ({ page }) => {
  await page.goto('/');
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(244, 244, 251)'); // #F4F4FB
  // guard token drift
  expect(color.appBg).toBe('#F4F4FB');
  expect(font.heading).toContain('Lato');
});
