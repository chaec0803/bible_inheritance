import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function zIndex(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 's'));
  return Number(match?.[1] ?? -1);
}

describe('삭제 확인창 레이어', () => {
  it('말씀 여정 전체 일정과 떠 있는 홈 버튼보다 위에서 터치를 받는다', () => {
    expect(zIndex('.confirm-retake-backdrop')).toBeGreaterThan(zIndex('.onboarding-overlay'));
    expect(zIndex('.confirm-retake-backdrop')).toBeGreaterThan(zIndex('.floating-home-button'));
  });
});
