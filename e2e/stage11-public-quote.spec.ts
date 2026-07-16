import { test, expect } from '@playwright/test';

// ============================================================================
// stage11 — the public quote link (#/q/<token>), Day-2 pre-outbound feature.
// The dev server has no /api routes, so the endpoint is mocked with
// page.route(): this exercises the real screen (mount-before-auth, document
// render, confirm step, accept POST, banner swap) in a real browser.
// ============================================================================

const TOKEN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

// exactly the shape /api/quote-view returns (buildPublicPayload allowlist)
const PAYLOAD = {
  ok: true,
  quote: {
    state: 'open',
    quote_number: 'Q-2026-051',
    job_name: 'Stair stringers',
    part_number: 'SS-104',
    customer_name: 'Apex Industrial',
    created_at: '2026-07-10T12:00:00Z',
    quantity: 2,
    lead_time: '2-3 weeks',
    pdf_style: 'classic',
    lines: [
      { label: 'Material', detail: 'A36 steel', amount: 234.6 },
      { label: 'Fabrication labor & machine time', detail: 'cut, fit, weld, finish · incl. consumables', amount: 928 },
      { label: 'Outside services', detail: 'primer + topcoat', amount: 85 },
    ],
    subtotal: 1247.6,
    fees: 666.22,
    total: 1913.82,
    per_unit: 956.91,
    shop: { name: 'Ironside Fabrication' },
  },
};

test('bad/unknown token renders the not-found card (no app chrome, no oracle)', async ({ page }) => {
  await page.route('**/api/quote-view*', (r) =>
    r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Quote not found.' }) }));
  await page.goto(`/#/q/${TOKEN}`);
  await expect(page.getByTestId('public-not-found')).toBeVisible();
  // customer page never shows the shop's app UI
  await expect(page.getByTestId('screen-title')).toHaveCount(0);
});

test('customer sees scope + total, accepts, and the banner confirms', async ({ page }) => {
  await page.route('**/api/quote-view*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAYLOAD) }));
  await page.route('**/api/quote-respond', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, state: 'accepted', responded_at: '2026-07-16T09:00:00Z' }) }));

  await page.goto(`/#/q/${TOKEN}`);

  // the document: grouped scope + total, §4.4 vocabulary only
  await expect(page.getByTestId('public-quote-doc')).toBeVisible();
  await expect(page.getByTestId('public-total')).toHaveText('$1,913.82');
  const body = await page.textContent('body');
  expect(body).toContain('Fabrication labor & machine time');
  expect(body).toContain('Shop fees & handling');
  expect(body?.toLowerCase()).not.toContain('margin');
  expect(body?.toLowerCase()).not.toContain('overhead');

  // accept flows through the confirm step, then the banner replaces the buttons
  await page.getByTestId('public-accept').click();
  await page.getByTestId('public-confirm-accept').click();
  await expect(page.getByTestId('public-accepted')).toBeVisible();
  await expect(page.getByTestId('public-accept')).toHaveCount(0);
});

test('an already-decided quote shows its outcome and no buttons', async ({ page }) => {
  const decided = { ok: true, quote: { ...PAYLOAD.quote, state: 'declined', responded_at: '2026-07-12T08:00:00Z' } };
  await page.route('**/api/quote-view*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(decided) }));
  await page.goto(`/#/q/${TOKEN}`);
  await expect(page.getByTestId('public-declined')).toBeVisible();
  await expect(page.getByTestId('public-accept')).toHaveCount(0);
  await expect(page.getByTestId('public-decline')).toHaveCount(0);
});
