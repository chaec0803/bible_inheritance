import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /real-iphone\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'artifacts/browserstack/report', open: 'never' }],
    ['json', { outputFile: 'artifacts/browserstack/results.json' }],
  ],
  outputDir: 'artifacts/browserstack/test-results',
  use: {
    baseURL: process.env.QA_BASE_URL ?? 'https://verse-legacy-prototype.mlejj3.chatgpt.site',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'safari@iPhone 16 Pro:18@browserstack-mobile', use: { browserName: 'webkit' } },
    { name: 'safari@iPhone 15 Pro:17@browserstack-mobile', use: { browserName: 'webkit' } },
  ],
});
