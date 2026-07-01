// ============================================================================
// stage8.spec.ts — auth gating + provisioning round-trip, exercised on the mock
// via ?auth (which installs the mock client but skips the dev auto-login). This
// verifies the SAME AuthProvider/authService path the live client uses; the
// live DB round-trip itself runs against a real Supabase project (see
// SUPABASE_SETUP.md) once credentials are provided.
// ============================================================================
import { test, expect } from '@playwright/test';

test('signed-out users see the auth screen', async ({ page }) => {
  await page.goto('/?auth');
  await expect(page.locator('[data-screen="auth"]')).toBeVisible();
});

test('sign-up provisions a shop and lands in the app', async ({ page }) => {
  await page.goto('/?auth');
  await page.getByTestId('to-signup').click();
  await page.locator('[data-field="shopName"]').fill('Granite Steelworks');
  await page.locator('[data-field="fullName"]').fill('Dana Reyes');
  await page.locator('[data-field="email"]').fill('dana@granite.com');
  await page.locator('[data-field="password"]').fill('passw0rd');
  await page.getByTestId('auth-submit').click();

  // lands on the pipeline of the NEW shop (its name in the subheader, no quotes)
  await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
  await expect(page.locator('main')).toContainText('Granite Steelworks');
  await expect(page.locator('[data-row]')).toHaveCount(0);

  // and the new shop can create a quote end-to-end
  await page.getByTestId('new-quote').click();
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

test('bad login shows an error, stays signed out', async ({ page }) => {
  await page.goto('/?auth');
  await page.locator('[data-field="email"]').fill('nobody@nowhere.com');
  await page.locator('[data-field="password"]').fill('wrong');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('auth-error')).toBeVisible();
  await expect(page.locator('[data-screen="auth"]')).toBeVisible();
});
