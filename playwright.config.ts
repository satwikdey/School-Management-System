import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npx next start -H 127.0.0.1 -p 4100',
    url: 'http://127.0.0.1:4100/login',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
