// ============================================================================
// stage9.spec.ts — Document Assist gate (Tier 1 + 2 + 3) through the editor UI.
//   Tier 1 (CSV)  : deterministic header match → high-confidence pre-fill
//   Tier 2 (PDF)  : text-layer extraction → medium-confidence pre-fill (verify)
//   Tier 3 (DWG)  : store-only, manual entry, no dead end
// Uses the seeded "Try a sample" files (public/samples), which exercise the
// same analyzeFile path a real drag-and-drop upload uses.
// ============================================================================
import { test, expect } from '@playwright/test';

async function openEditor(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('new-quote').click();
  await expect(page.getByTestId('doc-assist')).toBeVisible();
}

test('Tier 1 — spreadsheet pre-fills fields at HIGH confidence', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('sample-csv').click();
  await expect(page.getByTestId('doc-banner')).toContainText('Pre-filled');

  // values landed in the real editor inputs
  await expect(page.locator('[data-field="quantity"]')).toHaveValue('12');
  await expect(page.locator('[data-field="material_spec"]')).toHaveValue('A36 Steel');
  await expect(page.locator('[data-field="finish_spec"]')).toHaveValue('Powder Coat');

  // high-confidence badge says "from spreadsheet"
  const badge = page.locator('[data-prefill-badge]').first();
  await expect(badge).toContainText('from spreadsheet');

  // the extra line item is surfaced, not silently applied
  await expect(page.getByTestId('additional-rows')).toContainText('1 more line item');

  // file chip shows the tier
  await expect(page.locator('[data-doc-file]')).toContainText('Spreadsheet');
});

test('Tier 2 — text PDF pre-fills at MEDIUM confidence (flagged to verify)', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('sample-pdf').click();
  await expect(page.getByTestId('doc-banner')).toContainText('PDF text', { timeout: 15000 });

  await expect(page.locator('[data-field="quantity"]')).toHaveValue('12');
  await expect(page.locator('[data-field="material_spec"]')).toHaveValue(/A36 steel/);

  // Tier-2 fields are NEVER high confidence — badge nudges review
  const badge = page.locator('[data-prefill-badge]').first();
  await expect(badge).toContainText('review');
  await expect(page.locator('[data-doc-file]')).toContainText('Text PDF');
});

test('Tier 3 — CAD file is stored only, no pre-fill, no dead end', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('sample-dwg').click();
  await expect(page.getByTestId('doc-banner')).toContainText('manually');
  // nothing pre-filled
  await expect(page.locator('[data-prefill-badge]')).toHaveCount(0);
  await expect(page.locator('[data-field="material_spec"]')).toHaveValue('');
  await expect(page.locator('[data-doc-file]')).toContainText('Stored');
});

test('a real drag-drop upload (file input) pre-fills too', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-testid="rfq-input"]').setInputFiles('public/samples/rfq.csv');
  await expect(page.locator('[data-field="quantity"]')).toHaveValue('12');
});
