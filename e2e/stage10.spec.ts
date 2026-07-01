// ============================================================================
// stage10.spec.ts — landing/login + customer selection + material-driven price.
// ============================================================================
import { test, expect } from '@playwright/test';

test.describe('Landing + login (no-auth enters the app)', () => {
  test('landing renders and "Log in" drops into the app', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-screen="landing"]')).toBeVisible();
    await page.getByTestId('landing-login').click();
    await expect(page.locator('[data-screen="auth"]')).toBeVisible();
    await page.getByTestId('auth-submit').click(); // demo: any details enter
    await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
  });

  test('"Start free" opens sign-up and enters', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-start').click();
    await expect(page.locator('[data-field="shopName"]')).toBeVisible(); // signup mode
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
  });
});

test.describe('Customer selection', () => {
  test('new quote from main → searchable dropdown fills customer + email + panel header', async ({ page }) => {
    await page.goto('/?app');
    await page.getByTestId('new-quote').click();
    await page.getByTestId('customer-select').click();
    await page.getByTestId('customer-select').fill('apex');
    await page.locator('[data-customer-option="Apex Industrial"]').click();

    await expect(page.locator('[data-field="customer_name"]')).toHaveValue('Apex Industrial');
    await expect(page.locator('[data-field="customer_email"]')).toHaveValue('purchasing@apex.com');
    await expect(page.getByTestId('cost-customer')).toContainText('Apex Industrial');
  });

  test('new quote from a customer card → customer + email auto-populate', async ({ page }) => {
    await page.goto('/?app');
    await page.locator('[data-nav="customers"]').click();
    await page.locator('[data-customer="Bolt & Beam"] [data-testid="cust-new-quote"]').click();
    await expect(page.locator('[data-screen="editor"]')).toBeVisible();
    await expect(page.locator('[data-field="customer_name"]')).toHaveValue('Bolt & Beam');
    await expect(page.locator('[data-field="customer_email"]')).toHaveValue('sam@boltbeam.com');
    await expect(page.getByTestId('cost-customer')).toContainText('Bolt & Beam');
  });
});

test.describe('Material library drives quote price', () => {
  test('add a material in Rates → select it in a quote → it prices the job', async ({ page }) => {
    await page.goto('/?app');
    await page.locator('[data-nav="rates"]').click();
    await page.locator('[data-tab="material"]').click();
    await page.getByTestId('new-material-name').fill('Galvanized Sheet');
    await page.getByTestId('new-material-price').fill('1.40');
    await page.getByTestId('add-material').click();
    await expect(page.locator('[data-material="Galvanized Sheet"]')).toBeVisible();
    await page.getByTestId('save-rates').click();
    await expect(page.getByTestId('rates-status')).toHaveText('Saved');

    // new quote: the new material is selectable and changes the price vs A36
    await page.getByTestId('new-quote').click();
    const f = (n: string, v: string) => page.locator(`[data-field="${n}"]`).fill(v);
    await f('material_weight', '240'); await f('quantity', '1'); await f('burn_minutes', '35');
    await f('hrs_cutting', '1.5'); await f('hrs_fitting', '3'); await f('hrs_welding', '4');
    await f('hrs_finishing', '1.5'); await f('outside_services', '85');

    await page.locator('[data-field="material_spec"]').selectOption('A36 Steel');
    await expect(page.getByTestId('quoted-price')).toHaveText('$1,914'); // 0.85/lb → canonical
    await page.locator('[data-field="material_spec"]').selectOption('Galvanized Sheet');
    await expect(page.getByTestId('quoted-price')).not.toHaveText('$1,914'); // 1.40/lb → higher
  });
});
