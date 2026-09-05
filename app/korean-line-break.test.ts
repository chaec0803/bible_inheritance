import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('한글 줄바꿈 회귀', () => {
  it('앱 전체에서 한글 어절을 중간에 자르지 않는다', () => {
    const bodyRule = css.match(/body\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bodyRule).toContain('word-break: keep-all');
    expect(bodyRule).toContain('overflow-wrap: break-word');
    expect(bodyRule).toContain('line-break: strict');
  });

  it('말씀 카드 본문도 전역 어절 줄바꿈 규칙을 덮어쓰지 않는다', () => {
    const cardRule = css.match(/\.word-card-back h3\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(cardRule).not.toContain('word-break: break-all');
    expect(cardRule).not.toContain('overflow-wrap: anywhere');
  });
});
