// ============================================================================
// stage7.spec.ts — responsive pass gate (run with --project=mobile, 390px).
//   layout : pipeline table → cards, editor/detail two-panel → stacked
//   touch  : interactive targets ≥ 40px
//   visual : mobile screenshot baselines
// ============================================================================
import { test, expect } from '@playwright/test';

test('pipeline renders stacked cards (not the desktop table) on mobile', async ({ page }) => {
  await page.goto('/?app');
  await expect(page.locator('[data-row-mobile]')).toHaveCount(3);
  // a quote card still opens detail
  await page.locator('[data-row="Q-2026-001"]').click();
  await expect(page.locator('[data-screen="detail"]')).toBeVisible();
});

test('touch targets are at least 40px', async ({ page }) => {
  await page.goto('/?app');
  for (const sel of ['[data-testid="new-quote"]', '[data-nav="rates"]', '[data-row-mobile] button']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }
});

test('editor stacks to a single column on mobile (cost panel not sticky)', async ({ page }) => {
  await page.goto('/?app');
  await page.getByTestId('new-quote').click();
  const pos = await page.getByTestId('cost-panel').evaluate((el) => getComputedStyle(el).position);
  expect(pos).toBe('static'); // sticky only on desktop
  // editing still drives the live total
  await page.locator('[data-field="material_weight"]').fill('240');
  await page.locator('[data-field="quantity"]').fill('1');
  await page.locator('[data-field="burn_minutes"]').fill('35');
  await page.locator('[data-field="hrs_cutting"]').fill('1.5');
  await page.locator('[data-field="hrs_fitting"]').fill('3');
  await page.locator('[data-field="hrs_welding"]').fill('4');
  await page.locator('[data-field="hrs_finishing"]').fill('1.5');
  await page.locator('[data-field="outside_services"]').fill('85');
  await expect(page.getByTestId('quoted-price')).toHaveText('$1,914');
});

// design P0 2.4: the live price must never be off-screen while typing on a
// phone — the fixed mini-total bar carries it, and tracks the engine live.
test('mobile editor keeps the live quoted price visible (sticky mini-total)', async ({ page }) => {
  await page.goto('/?app');
  await page.getByTestId('new-quote').click();
  const bar = page.getByTestId('mobile-total-bar');
  await expect(bar).toBeVisible();
  // scroll to the top of the form — the bar must still be in the viewport
  await page.locator('[data-field="job_name"]').scrollIntoViewIfNeeded();
  await expect(bar).toBeInViewport();
  // and it tracks the live engine total (canonical job → $1,914)
  await page.locator('[data-field="material_weight"]').fill('240');
  await page.locator('[data-field="quantity"]').fill('1');
  await page.locator('[data-field="burn_minutes"]').fill('35');
  await page.locator('[data-field="hrs_cutting"]').fill('1.5');
  await page.locator('[data-field="hrs_fitting"]').fill('3');
  await page.locator('[data-field="hrs_welding"]').fill('4');
  await page.locator('[data-field="hrs_finishing"]').fill('1.5');
  await page.locator('[data-field="outside_services"]').fill('85');
  await expect(page.getByTestId('mobile-total')).toHaveText('$1,914');
  await expect(bar).toBeInViewport();
});

test('aesthetic: mobile pipeline matches baseline', async ({ page }) => {
  await page.goto('/?app');
  await expect(page.locator('[data-row-mobile]').first()).toBeVisible();
  await page.evaluate(() => (document as any).fonts.ready);
  // screenshot the stable screen container (deterministic regardless of scroll)
  await expect(page.locator('[data-screen="pipeline"]')).toHaveScreenshot('pipeline-mobile.png', {
    mask: [page.locator('[data-mask]')],
    maxDiffPixelRatio: 0.05,
  });
});

test('aesthetic: mobile detail matches baseline', async ({ page }) => {
  await page.goto('/?app');
  await page.locator('[data-row="Q-2026-001"]').click();
  await expect(page.locator('[data-screen="detail"]')).toBeVisible();
  await page.evaluate(() => (document as any).fonts.ready);
  // the main detail card is one contiguous block — stable to screenshot
  await expect(page.getByTestId('detail-card')).toHaveScreenshot('detail-mobile.png', {
    maxDiffPixelRatio: 0.05,
  });
});
