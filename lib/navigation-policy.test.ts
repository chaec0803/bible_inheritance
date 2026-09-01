import { describe, expect, it } from 'vitest';
import { getBackStep } from './navigation-policy';

describe('홈 설정 화면 뒤로가기', () => {
  it('매일 말씀 읽기 선택 화면에서 홈으로 돌아간다', () => {
    expect(getBackStep('projects')).toBe('welcome');
  });
});
