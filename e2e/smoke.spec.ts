import { test, expect } from '@playwright/test';
import { color, font } from '../src/design/tokens';

// Shell smoke + the design-guide assertion mechanism the per-screen gates reuse.
test('shell renders the pipeline by default', async ({ page }) => {
  await page.goto('/?app');
  await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
});

test('design-guide: app background matches the token', async ({ page }) => {
  await page.goto('/?app');
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(244, 244, 251)'); // #F4F4FB
  // guard token drift
  expect(color.appBg).toBe('#F4F4FB');
  expect(font.heading).toContain('Lato');
});

// a11y P0 (design review 06 §8 / master plan 2.1): keyboard focus must always
// be visible. Tab to the first interactive element and assert a real outline.
test('design-guide: keyboard focus shows a visible ring', async ({ page }) => {
  await page.goto('/?app');
  await expect(page.getByTestId('screen-title')).toHaveText('Quote pipeline');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as Element | null;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(outline).not.toBeNull();
  expect(outline!.style).not.toBe('none');
  expect(parseFloat(outline!.width)).toBeGreaterThan(0);
});

// a11y P0 (master plan 2.2): the contrast-passing token values are locked here
// the same way colors are locked to the mockup — drift fails the gate.
test('design-guide: contrast-pass token values are locked', async () => {
  expect(color.accent).toBe('#4667DB');   // white label 4.97:1
  expect(color.muted).toBe('#63659B');    // 4.96:1 on appBg
  expect(color.faint).toBe('#6A6B83');    // 5.19:1 on white
  expect(color.success).toBe('#0E7A4C');  // 5.01:1 on successBg
  expect(color.danger).toBe('#C92A42');   // 5.39:1 on white
});
