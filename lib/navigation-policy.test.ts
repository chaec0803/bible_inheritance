import { describe, expect, it } from 'vitest';
import { getBackStep, getNavigationHash, parseNavigationRoute } from './navigation-policy';

describe('홈 설정 화면 뒤로가기', () => {
  it('매일 말씀 읽기 선택 화면에서 홈으로 돌아간다', () => {
    expect(getBackStep('projects')).toBe('welcome');
  });
});

describe('앱 화면 경로', () => {
  it('홈과 친구 화면에 고유한 해시 경로를 만든다', () => {
    expect(getNavigationHash('home')).toBe('#home');
    expect(getNavigationHash('friends')).toBe('#friends');
  });

  it('브라우저 뒤로가기로 전달된 경로를 안전하게 해석한다', () => {
    expect(parseNavigationRoute('#friends')).toBe('friends');
    expect(parseNavigationRoute('#gifts')).toBe('gifts');
    expect(parseNavigationRoute('#unknown')).toBe('home');
    expect(parseNavigationRoute('')).toBe('home');
  });
});
