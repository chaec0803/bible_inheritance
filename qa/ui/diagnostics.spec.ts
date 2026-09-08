import { test, expect } from '@playwright/test';

test('library HTTP failures retain the status and server request ID', async ({ page }) => {
  await page.route('**/api/recordings', route => route.fulfill({ status: 401, headers: { 'X-Recording-Request-Id': '11111111-1111-4111-8111-111111111111' }, json: { error: 'login required' } }));
  const sent = page.waitForResponse(response => response.url().endsWith('/api/recording-diagnostics'));
  await page.goto('/');
  expect((await sent).status()).toBe(204);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('verse-recording-diagnostics') ?? '[]'))).toEqual(expect.arrayContaining([expect.objectContaining({ stage: 'library-load', status: 401, requestId: '11111111-1111-4111-8111-111111111111' })]));
});

test('native audio loading errors are logged without voice content or URLs', async ({ page }) => {
  await page.route('**/api/user-state', route => route.fulfill({ json: { state: null } }));
  await page.route('**/api/recordings', route => route.fulfill({ json: { recordings: [{ id: 'diagnostic-fixture', projectId: 'free-recording', projectTitle: '자유 녹음', book: '창세기', chapter: 1, verse: 1, verseText: 'private fixture verse', bgmId: 'still-waters', mimeType: 'audio/wav', sizeBytes: 100, durationSeconds: 3, createdAt: Date.now() }] } }));
  await page.route('**/api/recordings/*/audio', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
  await page.goto('/#library');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('verse-recording-diagnostics') ?? '[]'))).toEqual(expect.arrayContaining([expect.objectContaining({ stage: 'audio-load', mediaCode: 4 })]));
  const log = await page.evaluate(() => localStorage.getItem('verse-recording-diagnostics'));
  expect(log).not.toContain('private fixture verse');
  expect(log).not.toContain('diagnostic-fixture');
});
