import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('BGM과 말씀카드 첫 로딩', () => {
  it('기본 BGM과 선택한 BGM을 재생 전에 미리 불러온다', () => {
    expect(page).toContain('loadArrayBufferOnce');
    expect(page).toContain('warmBgmTrack');
    expect(page).toContain("warmBgmTrack(bgmOptions[0].audioSrc)");
  });

  it('BGM을 준비하는 동안 버튼에 명확한 상태를 표시한다', () => {
    expect(page).toContain('bgmLoadingId');
    expect(page).toContain('음악 준비 중');
  });

  it('카드 보관함을 열기 전에 스프라이트 이미지를 미리 불러온다', () => {
    expect(page).toContain('WORD_CARD_SPRITE_SHEETS');
    expect(page).toContain('preloadImages(WORD_CARD_SPRITE_SHEETS)');
  });
});
