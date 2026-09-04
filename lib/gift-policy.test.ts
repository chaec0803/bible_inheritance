import { describe, expect, it } from 'vitest';
import { normalizeGiftRequest } from './gift-policy';

describe('말씀 선물 정책', () => {
  it('이어듣기 순서를 유지하면서 중복 녹음 ID를 제거한다', () => {
    expect(normalizeGiftRequest({
      recipientUserId: 'friend-1',
      recordingIds: ['verse-2', 'verse-1', 'verse-2'],
      title: ' 시편 23편 ',
      bgmId: 'still-waters',
      bgmVolume: 18,
    })).toEqual({
      recipientUserId: 'friend-1',
      recordingIds: ['verse-2', 'verse-1'],
      title: '시편 23편',
      bgmId: 'still-waters',
      bgmVolume: 18,
    });
  });

  it('지원하지 않는 BGM과 비어 있거나 지나치게 큰 선물을 거절한다', () => {
    expect(normalizeGiftRequest({ recipientUserId: 'friend-1', recordingIds: [], title: '선물', bgmId: 'none', bgmVolume: 0 })).toBeNull();
    expect(normalizeGiftRequest({ recipientUserId: 'friend-1', recordingIds: ['one'], title: '선물', bgmId: 'unknown', bgmVolume: 10 })).toBeNull();
    expect(normalizeGiftRequest({ recipientUserId: 'friend-1', recordingIds: ['one', 2], title: '선물', bgmId: 'none', bgmVolume: 10 })).toBeNull();
    expect(normalizeGiftRequest({ recipientUserId: 'friend-1', recordingIds: Array.from({ length: 40_001 }, (_, index) => `r-${index}`), title: '선물', bgmId: 'none', bgmVolume: 0 })).toBeNull();
  });

  it('BGM 음량은 안전한 범위로 제한한다', () => {
    expect(normalizeGiftRequest({ recipientUserId: 'friend-1', recordingIds: ['one'], title: '선물', bgmId: 'none', bgmVolume: 999 })?.bgmVolume).toBe(100);
  });
});
