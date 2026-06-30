import { defineConfig, devices } from '@playwright/test';

// Aesthetic gate (screenshot diff vs mockup baselines) + design-guide gate
// (computed-style assertions vs src/design/tokens.ts). Specs live in e2e/.
export default defineConfig({
  testDir: './e2e',
  snapshotDir: './e2e/__screenshots__',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // desktop runs every spec EXCEPT the mobile-only responsive gate
    { name: 'desktop', testIgnore: /stage7\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    // mobile runs ONLY the responsive gate (390px)
    { name: 'mobile', testMatch: /stage7\.spec\.ts/, use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
