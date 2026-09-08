import { test, expect, type Page } from '@playwright/test';

async function home(page: Page) {
  await page.getByRole('button', {name:'말씀 여정과 성경 읽기를 선택하는 홈으로 이동'}).click();
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
});

test('long reading plan has one page scroller and survives navigation', async ({page}, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  if (info.project.name.startsWith('webkit')) await page.getByRole('button', {name:'다크 모드로 전환'}).click();
  await page.getByText('매일 말씀 읽기 시작하기', {exact:true}).click();
  await page.getByRole('tab', {name:'나만의 읽기 계획'}).click();
  await page.getByRole('button', {name:'성경 통독', exact:false}).click();
  await page.getByRole('button', {name:'1년', exact:true}).click();
  await expect(page.locator('.custom-plan-preview li')).toHaveCount(60);
  await noOverflow(page);
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.workspace')).toBeHidden();
  expect(await page.locator('.onboarding-overlay').evaluate(el => getComputedStyle(el).position)).toBe('relative');
  if (!info.project.name.endsWith('desktop')) {
    expect(await page.locator('.custom-plan-preview').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
  await page.getByRole('button', {name:'이 계획 시작하기', exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.screenshot({path:`/private/tmp/verse-ui-qa/${info.project.name}-plan-bottom.png`});
  const oldY=await page.evaluate(() => scrollY);
  await page.mouse.move(100,200);
  if (info.project.name.startsWith('webkit') && info.project.name !== 'webkit-desktop') {
    await page.evaluate(() => window.scrollBy(0,-400));
  } else {
    await page.mouse.wheel(0,-400);
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(oldY);
  await home(page);
  await page.getByRole('button', {name:'친구 보기', exact:true}).click();
  await expect(page.locator('.onboarding-overlay')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText('무엇을 선택할까요?')).toBeVisible();
  await home(page);
  expect(errors).toEqual([]);
});

test('gift friend modal remains clickable and does not scroll the background', async ({page}, info) => {
  await page.route('**/api/friends', route => route.fulfill({json:{friends:Array.from({length:30},(_,i)=>({userId:`ui-fixture-${i}`,nickname:`테스트 친구 ${i}`,emailHint:`friend${i}@example.test`}))}}));
  await page.getByText('말씀 선물하기', {exact:true}).click();
  await page.getByRole('button', {name:'친구 선택하기', exact:true}).click();
  const modal=page.getByRole('dialog', {name:'누구에게 선물할까요?'});
  await expect(modal).toBeVisible();
  await expect(page.locator('.floating-route-actions')).toBeHidden();
  await noOverflow(page);
  const before=await page.evaluate(() => scrollY);
  await page.mouse.move(2,200);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
  if (!info.project.name.startsWith('webkit') || info.project.name === 'webkit-desktop') await page.mouse.wheel(0,500);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await modal.getByRole('button', {name:/테스트 친구 29/}).click();
  await expect(modal.getByRole('button', {name:/테스트 친구 29/}).last()).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:`/private/tmp/verse-ui-qa/${info.project.name}-modal.png`});
  await page.getByRole('button', {name:'친구 선택 닫기'}).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.floating-route-actions')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
  await page.evaluate(() => window.scrollTo(0,document.body.scrollHeight));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await home(page);
});

test('page route restores recording and library controls after home', async ({page}) => {
  await page.goto('/#recording');
  await expect(page.locator('.workspace')).toBeVisible();
  await noOverflow(page);
  await expect(page.locator('.topbar')).toBeVisible();
  await home(page);
  await expect(page.locator('.workspace')).toBeHidden();
  await page.goBack();
  await expect(page.locator('.workspace')).toBeVisible();
  await expect(page.locator('.topbar')).toBeVisible();
  await page.goto('/#library');
  await expect(page.locator('.onboarding-overlay')).toHaveCount(0);
  await noOverflow(page);
  await home(page);
});
