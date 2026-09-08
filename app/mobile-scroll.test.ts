import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('아이폰 모달과 스크롤', () => {
  it.each(['.continuous-player-modal', '.completion-modal', '.recording-manage-sheet', '.word-card-modal'])('%s 안에서 세로 스크롤할 수 있다', (selector) => {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain('overflow-y: auto');
    expect(block).toContain('touch-action: pan-y');
    expect(block).toContain('-webkit-overflow-scrolling: touch');
  });

  it('모바일 구절 탭은 가로 스크롤과 페이지 세로 스크롤을 모두 허용한다', () => {
    expect(css).not.toContain('touch-action: pan-x');
    expect(css).toContain('touch-action: auto');
    expect(css).toContain('overscroll-behavior-inline: contain');
  });
});
