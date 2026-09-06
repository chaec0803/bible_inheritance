import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8').replace(/\s+/g, ' ');
const styles = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(/\s+/g, ' ');
const friendsPanel = readFileSync(join(process.cwd(), 'app/friends-panel.tsx'), 'utf8');
const giftsPanel = readFileSync(join(process.cwd(), 'app/gifts-panel.tsx'), 'utf8');

describe('화면 경로와 뒤로가기 회귀', () => {
  it('첫 진입은 현재 해시 경로를 복원하고 화면 이동은 브라우저 기록에 남긴다', () => {
    expect(page).toContain('const initialRoute = parseNavigationRoute(window.location.hash)');
    expect(page).toContain('applyNavigationRoute(initialRoute)');
    expect(page).toContain('window.history.replaceState({ verseLegacyRoute: initialRoute }');
    expect(page).not.toContain("window.history.replaceState({ verseLegacyRoute: 'home' }");
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

  it('친구와 선물은 전역 툴바가 아니라 항상 플로팅 버튼으로 제공한다', () => {
    expect(page).toContain('className="floating-route-actions"');
    expect(page).toContain('floating-route-actions');
    expect(page).toContain('className="floating-friends-button"');
    expect(page).toContain("navigateTo('friends')");
    expect(page).toContain('className="floating-gifts-button"');
    expect(page).toContain("navigateTo('gifts')");
    expect(page).not.toContain("className={appTab === 'gifts' ? 'active' : ''}");
    expect(page).not.toContain("className={appTab === 'friends' ? 'active' : ''}");
  });

  it('전역 툴바에는 현재 말씀 프로젝트와 관련된 녹음과 듣기만 둔다', () => {
    const desktopToolbar = page.slice(page.indexOf('<nav className="desktop-tabs"'), page.indexOf('</nav>}', page.indexOf('<nav className="desktop-tabs"')));
    const mobileToolbar = page.slice(page.indexOf('<nav className="mobile-nav"'), page.indexOf('</nav>}', page.indexOf('<nav className="mobile-nav"')));
    for (const toolbar of [desktopToolbar, mobileToolbar]) {
      expect(toolbar).toContain('녹음');
      expect(toolbar).toContain('듣기');
      expect(toolbar).not.toContain('선물');
      expect(toolbar).not.toContain('친구');
    }
    expect(styles).toMatch(/\.mobile-nav \{[^}]*grid-template-columns: repeat\(2, 1fr\)/);
  });

  it('홈과 선택 화면이 열려 있을 때 뒤쪽 앱 조작을 차단한다', () => {
    expect(page).toContain("onboardingStep !== 'app' ? 'onboarding-open' : ''");
    expect(page).toContain('className="onboarding-overlay"');
    expect(page).toContain('aria-modal="true"');
  });

  it('자유 녹음 진입점을 성경 읽기로 표시한다', () => {
    expect(page).toContain('<strong>성경 읽기</strong>');
    expect(page).not.toContain('<strong>내 방식대로 자유롭게</strong>');
  });

  it('Home에서 우리 말씀 여정을 표시하고 선택 프로젝트 상세로 이동한다', () => {
    expect(page).toContain('<RelayHomeJourneys');
    expect(page).toContain('onOpenList={openRelayTab}');
    expect(page).toContain("navigateTo('relay')");
  });

  it('전역 toolbar에는 이어읽기 메뉴를 두지 않는다', () => {
    expect(page).not.toContain('<span>이어읽기</span>');
    expect(page).not.toContain('<RotateCcw size={16} /> 이어읽기');
    expect(page).toContain("appTab !== 'relay' && <nav className=\"desktop-tabs\"");
    expect(page).toContain("appTab !== 'relay' && <nav className=\"mobile-nav\"");
  });
});
