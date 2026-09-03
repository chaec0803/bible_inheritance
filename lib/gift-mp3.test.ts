import { describe, expect, it } from 'vitest';
import { getGiftDownloadName, getGiftMixDuration } from './gift-mp3';

describe('말씀 선물 MP3 다운로드', () => {
  it('절별 녹음 길이를 순서대로 합친 전체 길이를 계산한다', () => {
    expect(getGiftMixDuration([3.2, 4.1, 2.7])).toBe(10);
  });

  it('기기에서 안전하게 저장할 수 있는 MP3 파일명을 만든다', () => {
    expect(getGiftDownloadName('시편 23편: 말씀/선물')).toBe('시편 23편- 말씀-선물-말씀선물.mp3');
  });
});
