import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
const friendsPanel = readFileSync(join(process.cwd(), 'app/friends-panel.tsx'), 'utf8');
const giftsPanel = readFileSync(join(process.cwd(), 'app/gifts-panel.tsx'), 'utf8');

describe('화면 경로와 뒤로가기 회귀', () => {
  it('첫 진입은 홈 경로로 맞추고 화면 이동은 브라우저 기록에 남긴다', () => {
    expect(page).toContain("window.history.replaceState({ verseLegacyRoute: 'home' }");
    expect(page).toContain('window.history.pushState({ verseLegacyRoute: route }');
  });

  it('브라우저와 기기 뒤로가기를 듣고 직전 화면을 복원한다', () => {
    expect(page).toContain("window.addEventListener('popstate', handlePopState)");
    expect(page).toContain("window.removeEventListener('popstate', handlePopState)");
    expect(page).toContain('applyNavigationRoute(route)');
  });

  it('친구와 선물 화면에도 직전 화면으로 돌아가는 버튼이 있다', () => {
    expect(page).toContain('onBack={() => window.history.back()}');
    expect(friendsPanel).toContain('onClick={onBack}');
    expect(giftsPanel).toContain('onClick={onBack}');
    expect(friendsPanel).toContain('뒤로가기');
    expect(giftsPanel).toContain('뒤로가기');
  });

  it('친구와 선물 화면으로 들어가는 플로팅 버튼을 항상 제공한다', () => {
    expect(page).toContain('className="floating-route-actions"');
    expect(page).toContain('className="floating-friends-button"');
    expect(page).toContain("navigateTo('friends')");
    expect(page).toContain('className="floating-gifts-button"');
    expect(page).toContain("navigateTo('gifts')");
  });

  it('자유 녹음 진입점을 성경 읽기로 표시한다', () => {
    expect(page).toContain('<strong>성경 읽기</strong>');
    expect(page).not.toContain('<strong>내 방식대로 자유롭게</strong>');
  });
});
