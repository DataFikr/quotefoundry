// ============================================================================
// stage5.spec.ts — customers + rates gate (functional + aesthetic + design).
// ============================================================================
import { test, expect } from '@playwright/test';
import { color } from '../src/design/tokens';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe('Customers', () => {
  test('functional: lists seeded customers, searches, and adds', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="customers"]').click();
    await expect(page.locator('[data-customer]')).toHaveCount(3);

    await page.getByTestId('customer-search').fill('apex');
    await expect(page.locator('[data-customer]')).toHaveCount(1);
    await page.getByTestId('customer-search').fill('');

    await page.getByTestId('add-customer').click();
    await page.getByTestId('new-company').fill('Granite Steelworks');
    await page.getByTestId('save-customer').click();
    await expect(page.locator('[data-customer="Granite Steelworks"]')).toBeVisible();
    await expect(page.locator('[data-customer]')).toHaveCount(4);
  });

  test('aesthetic: customers grid matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="customers"]').click();
    await expect(page.locator('[data-customer]').first()).toBeVisible();
    await expect(page).toHaveScreenshot('customers.png', { maxDiffPixelRatio: 0.02 });
  });
});

test.describe('Rates', () => {
  test('design-guide: amber "new quotes only" banner present', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="rates"]').click();
    const banner = page.getByTestId('rates-banner');
    await expect(banner).toContainText('new quotes only');
    expect(await banner.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(color.warnBg));
  });

  test('functional+invariant: editing rates changes NEW quotes only, never existing ones', async ({ page }) => {
    await page.goto('/');
    // existing quote price before
    await page.locator('[data-row="Q-2026-001"]').click();
    await expect(page.getByTestId('detail-price')).toHaveText('$1,913.82');
    await page.locator('[data-screen="detail"] >> text=Pipeline').click();

    // bump the steel price and save
    await page.locator('[data-nav="rates"]').click();
    await page.locator('[data-rate="price_steel"]').fill('1.20');
    await page.getByTestId('save-rates').click();
    await expect(page.getByTestId('rates-status')).toHaveText('Saved');

    // existing quote is UNCHANGED (priced from its frozen snapshot)
    await page.locator('[data-nav="pipeline"]').click();
    await page.locator('[data-row="Q-2026-001"]').click();
    await expect(page.getByTestId('detail-price')).toHaveText('$1,913.82');

    // a NEW quote picks up the new rate (price differs)
    await page.getByTestId('new-quote').click();
    const f = (n: string, v: string) => page.locator(`[data-field="${n}"]`).fill(v);
    await f('material_weight', '240'); await f('quantity', '1'); await f('burn_minutes', '35');
    await f('hrs_cutting', '1.5'); await f('hrs_fitting', '3'); await f('hrs_welding', '4');
    await f('hrs_finishing', '1.5'); await f('outside_services', '85');
    await expect(page.getByTestId('quoted-price')).not.toHaveText('$1,914');
  });

  test('aesthetic: rates screen matches baseline', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="rates"]').click();
    await expect(page.getByTestId('rates-banner')).toBeVisible();
    await expect(page).toHaveScreenshot('rates.png', { maxDiffPixelRatio: 0.02 });
  });
});
