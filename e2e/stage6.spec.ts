// ============================================================================
// stage6.spec.ts — customer PDF preview + send gate (functional + aesthetic +
// design). The preview is the in-app #qf-print: scope + total only, never
// margin/overhead/cost (CLAUDE.md §4.4). Send advances the quote to 'sent'.
// ============================================================================
import { test, expect } from '@playwright/test';

async function openPreview(page: import('@playwright/test').Page) {
  await page.goto('/?app');
  await page.locator('[data-row="Q-2026-001"]').click();
  await page.getByTestId('preview-send').click();
  await expect(page.getByTestId('qf-print')).toBeVisible();
}

test('functional+invariant: customer preview hides margin/overhead/cost, shows scope + total', async ({ page }) => {
  await openPreview(page);
  const doc = page.getByTestId('qf-print');
  // total present (customer-facing)
  await expect(page.getByTestId('preview-total')).toHaveText('$1,913.82');
  await expect(page.getByTestId('shop-fees')).toBeVisible();
  // internal PROFIT SPLIT absent (margin/overhead). The subtotal equals the
  // scope-line sum by design and is allowed; the split is folded into fees.
  const text = (await doc.innerText()).toLowerCase();
  expect(text).not.toContain('margin');
  expect(text).not.toContain('overhead');
  expect(text).not.toContain('441.65'); // margin amount
  expect(text).not.toContain('224.57'); // overhead amount
  // grouped scope lines present (material + fabrication)
  await expect(doc).toContainText('Fabrication labor & machine time');
});

test('functional: sending confirms the recipient, then advances the quote to "sent"', async ({ page }) => {
  await openPreview(page);
  await page.getByTestId('send-quote').click();
  // confirm-recipient step: address is prefilled from the quote and editable
  await expect(page.getByTestId('send-recipient')).toHaveValue('purchasing@apex.com');
  await page.getByTestId('confirm-send').click();
  // explicit success feedback, then the status advances
  await expect(page.getByTestId('send-success')).toBeVisible();
  await page.getByText('Done').click();
  // detail status pill now reads Sent
  await expect(page.locator('[data-screen="detail"]')).toContainText('Sent');
});

test('aesthetic: customer preview matches baseline', async ({ page }) => {
  await openPreview(page);
  await expect(page.getByTestId('qf-print')).toHaveScreenshot('customer-preview.png', {
    maxDiffPixelRatio: 0.02,
    mask: [page.locator('[data-mask]')],
  });
});
