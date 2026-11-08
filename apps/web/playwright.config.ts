import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: [
    ...(process.env.TEST_LIVE_CATALOG === '1'
      ? []
      : [
          {
            command: 'node e2e/catalog-fixture.cjs',
            url: 'http://127.0.0.1:4101/api/v1/categories',
            reuseExistingServer: false
          }
        ]),
    {
      command: 'pnpm exec next start -p 3100',
      url: 'http://localhost:3100/admin/connexion',
      reuseExistingServer: false,
      env:
        process.env.TEST_LIVE_CATALOG === '1'
          ? {}
          : { API_INTERNAL_BASE_URL: 'http://127.0.0.1:4101/api/v1' },
      timeout: 120_000
    }
  ]
});
