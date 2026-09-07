import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const artifactRoot = path.resolve('artifacts/browserstack/screenshots');

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await mkdir(artifactRoot, { recursive: true });
  const project = testInfo.project.name.replace(/[^a-zA-Z0-9.-]+/g, '-');
  await page.screenshot({ path: path.join(artifactRoot, `${project}-${name}.png`), fullPage: true });
}

async function assertResponsive(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.innerWidth, 'real device CSS viewport width').toBeLessThanOrEqual(500);
  expect(metrics.scrollWidth, 'horizontal overflow').toBeLessThanOrEqual(metrics.innerWidth + 1);
  return metrics;
}

async function authenticate(page: Page) {
  const sitesToken = process.env.SITES_QA_BYPASS_TOKEN;
  if (sitesToken) {
    await page.context().setExtraHTTPHeaders({ 'OAI-Sites-Authorization': `Bearer ${sitesToken}` });
    return;
  }
  const email = process.env.QA_EMAIL;
  const password = process.env.QA_PASSWORD;
  if (!email || !password) {
    throw new Error('Set SITES_QA_BYPASS_TOKEN, or both QA_EMAIL and QA_PASSWORD.');
  }
  await page.goto('/');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
}

function observeFailures(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(
    `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`,
  ));
  return { consoleErrors, failedRequests };
}

test('v116 production real iPhone Safari smoke and media workflow', async ({ page }, testInfo) => {
  const runtime = observeFailures(page);
  await authenticate(page);
  await page.goto('/#home');
  await expect(page.getByText('매일 말씀 읽기 시작하기')).toBeVisible();
  await expect(page.getByText('함께 말씀 이어읽기')).toBeVisible();
  await expect(page.getByText('우리 말씀 여정', { exact: true })).toBeVisible();
  const viewport = await assertResponsive(page);
  testInfo.annotations.push({ type: 'viewport', description: JSON.stringify(viewport) });
  await capture(page, testInfo, '01-home');

  await page.getByText('우리 말씀 여정', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '우리 말씀 여정' })).toBeVisible();
  await assertResponsive(page);
  await capture(page, testInfo, '02-relay-list');

  const title = process.env.QA_RELAY_PROJECT_TITLE;
  const projectCard = title
    ? page.getByRole('button', { name: new RegExp(title) }).first()
    : page.locator('.running-project-list button').first();
  await expect(projectCard, 'QA account needs a relay project').toBeVisible();
  await projectCard.click();
  await expect(page.getByRole('button', { name: /녹음/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /듣기/ }).first()).toBeVisible();
  await assertResponsive(page);
  await capture(page, testInfo, '03-relay-detail');

  const listen = page.getByRole('button', { name: /듣기/ }).first();
  if (await listen.isEnabled()) {
    await listen.click();
    const player = page.getByRole('dialog').filter({ hasText: 'CONTINUOUS PLAYBACK' });
    await expect(player).toBeVisible();
    const slider = player.getByLabel('이어듣기 재생 중 배경음악 음량');
    for (const value of ['0', '10', '50', '100']) {
      await slider.evaluate((node, next) => {
        const input = node as HTMLInputElement;
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      await expect(slider).toHaveValue(value);
      await expect(player.getByText(`${value}%`, { exact: true })).toBeVisible();
    }
    await player.getByRole('button', { name: '목록' }).click();
    const list = player.getByLabel('녹음된 절 목록');
    await expect(list).toBeVisible();
    await capture(page, testInfo, '04-relay-playback-list');
    const entries = list.getByRole('button');
    const count = await entries.count();
    if (count) {
      const target = entries.nth(Math.min(1, count - 1));
      await target.click();
      await expect(target).toHaveClass(/playing/);
      expect((await player.locator('small').first().textContent()) ?? '').toMatch(/\d+\s*\/\s*\d+/);
    }
    await player.getByRole('button', { name: /일시정지|계속 듣기/ }).click();
    await player.getByRole('button', { name: '목록' }).click();
    await player.getByRole('button', { name: '종료' }).click();
  }

  await page.getByRole('button', { name: /녹음/ }).first().click();
  const inactive = page.getByRole('dialog').filter({ hasText: /차례를 기다리고|답을 기다리고|완성했어요/ });
  if (await inactive.isVisible().catch(() => false)) {
    testInfo.annotations.push({ type: 'recording', description: 'QA project is not recordable for this account.' });
    await capture(page, testInfo, '05-recording-inactive');
  } else {
    await expect(page.getByText(/버튼을 누르면 마이크 권한을 요청해요|녹음 전/).first()).toBeVisible();
    await assertResponsive(page);
    await capture(page, testInfo, '05-recording-ready');
    await page.getByRole('button', { name: /이어 녹음|녹음 시작/ }).first().click();
    await expect(page.getByText(/실제 마이크 음성을 녹음하고 있어요|녹음 중/).first()).toBeVisible();
    await page.waitForTimeout(2_000);
    await page.getByRole('button', { name: /현재 절까지 저장|이 절 저장|녹음 마치기/ }).first().click();
    await expect(page.getByText(/녹음 완료|재생 가능|녹음을 확인/).first()).toBeVisible({ timeout: 45_000 });
    await capture(page, testInfo, '06-recording-saved');
  }

  const errors = runtime.consoleErrors.filter((item) => !/favicon|ResizeObserver/i.test(item));
  const failures = runtime.failedRequests.filter((item) => !/favicon|analytics|telemetry/i.test(item));
  await testInfo.attach('runtime-errors.json', {
    body: Buffer.from(JSON.stringify({ consoleErrors: errors, failedRequests: failures }, null, 2)),
    contentType: 'application/json',
  });
  expect(errors, 'page console/page errors').toEqual([]);
  expect(failures, 'failed production requests').toEqual([]);
});
