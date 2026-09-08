import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', timeout: 30_000, workers: 1,
  outputDir: '/private/tmp/verse-ui-qa/results',
  reporter: [['list'], ['json', { outputFile: '/private/tmp/verse-ui-qa/results.json' }]],
  use: { baseURL: 'http://localhost:3000', screenshot: 'on', trace: 'retain-on-failure' },
  projects: [
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    { name: 'chrome-mobile', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'webkit-mobile', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'chrome-desktop', use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-small-mobile', use: { browserName: 'webkit', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
  ],
});
