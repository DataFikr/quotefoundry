// ============================================================================
// stage4.spec.ts — daily-loop screens gate (functional + aesthetic + design).
//   functional  : editing inputs updates the live summary; save → pipeline row
//   aesthetic   : screenshot-diff each screen vs its baseline
//   design-guide: computed colors/fonts match src/design/tokens.ts
// ============================================================================
import { test, expect, Page } from '@playwright/test';
import { color } from '../src/design/tokens';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

async function fillCanonical(page: Page) {
  await page.getByTestId('new-quote').click();
  await expect(page.locator('[data-screen="editor"]')).toBeVisible();
  const f = (name: string, val: string) => page.locator(`[data-field="${name}"]`).fill(val);
  await f('job_name', 'Stair stringers');
  await f('customer_email', 'purchasing@apex.com'); // required to save
  await f('material_weight', '240');
  await f('quantity', '1');
  await f('burn_minutes', '35');
  await f('hrs_cutting', '1.5');
  await f('hrs_fitting', '3');
  await f('hrs_welding', '4');
  await f('hrs_finishing', '1.5');
  await f('outside_services', '85');
}

test.describe('Pipeline', () => {
  test('functional: lists seeded quotes', async ({ page }) => {
    await page.goto('/?app');
    await expect(page.locator('[data-row]')).toHaveCount(3);
    await expect(page.locator('[data-row="Q-2026-001"]')).toContainText('Stair stringers');
  });

  test('design-guide: surfaces, accent button, status pills match tokens', async ({ page }) => {
    await page.goto('/?app');
    const newBtn = page.getByTestId('new-quote');
    expect(await newBtn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(color.accent));
    // won pill uses success green text
    const wonPill = page.locator('[data-row] span', { hasText: 'Won' }).first();
    expect(await wonPill.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(color.success));
  });

  test('aesthetic: pipeline matches baseline', async ({ page }) => {
    await page.goto('/?app');
    await expect(page.locator('[data-row]').first()).toBeVisible();
    await expect(page).toHaveScreenshot('pipeline.png', {
      mask: [page.locator('[data-mask]')],
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Editor', () => {
  test('functional: the ONE engine drives the live summary (canonical 1913.82)', async ({ page }) => {
    await page.goto('/?app');
    await fillCanonical(page);
    await expect(page.getByTestId('quoted-price')).toHaveText('$1,914'); // money() rounds 1913.82
  });

  test('design-guide: dark cost panel + Lato price', async ({ page }) => {
    await page.goto('/?app');
    await fillCanonical(page);
    const panel = page.getByTestId('cost-panel');
    const bgImage = await panel.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('linear-gradient');
    const price = page.getByTestId('quoted-price');
    expect((await price.evaluate((el) => getComputedStyle(el).fontFamily)).toLowerCase()).toContain('lato');
  });

  test('aesthetic: editor matches baseline', async ({ page }) => {
    await page.goto('/?app');
    await fillCanonical(page);
    await expect(page).toHaveScreenshot('editor.png', { maxDiffPixelRatio: 0.02 });
  });
});

test.describe('Detail + round trip', () => {
  test('functional: save a new quote → it appears in the pipeline and detail shows full price', async ({ page }) => {
    await page.goto('/?app');
    await fillCanonical(page);
    await page.getByTestId('save-quote').click();
    // lands on detail
    await expect(page.locator('[data-screen="detail"]')).toBeVisible();
    await expect(page.getByTestId('detail-price')).toHaveText('$1,913.82');
    // internal lock note present (customer PDF hides economics)
    await expect(page.locator('[data-screen="detail"]')).toContainText('internal');
    // back to pipeline — now 4 rows
    await page.locator('[data-screen="detail"] >> text=Pipeline').click();
    await expect(page.locator('[data-row]')).toHaveCount(4);
  });

  test('design-guide: detail price uses accentDeep', async ({ page }) => {
    await page.goto('/?app');
    await page.locator('[data-row="Q-2026-001"]').click();
    const price = page.getByTestId('detail-price');
    expect(await price.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(color.accentDeep));
  });

  test('aesthetic: detail matches baseline', async ({ page }) => {
    await page.goto('/?app');
    await page.locator('[data-row="Q-2026-001"]').click();
    await expect(page.locator('[data-screen="detail"]')).toBeVisible();
    await expect(page).toHaveScreenshot('detail.png', {
      mask: [page.locator('[data-mask]')],
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Draft deletion', () => {
  test('pipeline: draft rows delete with two-step confirm; non-drafts have no bin', async ({ page }) => {
    await page.goto('/?app');
    await expect(page.locator('[data-row]')).toHaveCount(3);
    // seeded: Q-2026-001 draft, Q-2026-002 won, Q-2026-003 sent
    const draftRow = page.locator('[data-row="Q-2026-001"]');
    await expect(draftRow.getByTestId('delete-quote')).toBeVisible();
    await expect(page.locator('[data-row="Q-2026-002"] [data-testid="delete-quote"]')).toHaveCount(0);
    await draftRow.getByTestId('delete-quote').click();          // arm
    await expect(page.locator('[data-row]')).toHaveCount(3);     // nothing yet
    await draftRow.getByTestId('delete-quote').click();          // confirm
    await expect(page.locator('[data-row]')).toHaveCount(2);
    await expect(page.locator('[data-row="Q-2026-001"]')).toHaveCount(0);
  });

  test('detail: bin enabled only for drafts; deleting returns to pipeline', async ({ page }) => {
    await page.goto('/?app');
    // sent quote → bin disabled
    await page.locator('[data-row="Q-2026-003"]').click();
    await expect(page.getByTestId('detail-delete')).toBeDisabled();
    await page.locator('[data-screen="detail"] >> text=Pipeline').click();
    // draft quote → two-step delete, lands back on pipeline
    await page.locator('[data-row="Q-2026-001"]').click();
    const bin = page.getByTestId('detail-delete');
    await expect(bin).toBeEnabled();
    await bin.click();  // arm
    await bin.click();  // confirm
    await expect(page.locator('[data-screen="pipeline"]')).toBeVisible();
    await expect(page.locator('[data-row]')).toHaveCount(2);
  });

  test('editor: multiple material types sum into the live total', async ({ page }) => {
    await page.goto('/?app');
    await fillCanonical(page);
    await page.locator('[data-field="material_spec"]').selectOption('A36 Steel');
    await expect(page.getByTestId('quoted-price')).toHaveText('$1,914');
    // add a second material line: 304 Stainless, 40 lb × 1 pc
    await page.getByTestId('add-material-line').click();
    await page.locator('[data-field="material_spec_1"]').selectOption('304 Stainless');
    await page.locator('[data-field="material_weight_1"]').fill('40');
    await page.locator('[data-field="material_qty_1"]').fill('1');
    // 40×2.10×1.15 = 96.60 more material → new price > canonical
    await expect(page.getByTestId('quoted-price')).not.toHaveText('$1,914');
  });
});
