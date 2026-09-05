import { describe, expect, it } from 'vitest';
import { canShowGiftArrival, describeGiftArrivals, mergeGiftArrivals } from './gift-arrival';

const first = { id: 'one', senderNickname: '은혜', createdAt: 2 };
const second = { id: 'two', senderNickname: '사랑', createdAt: 3 };

describe('말씀 선물 도착 정책', () => {
  it('녹음 플로우가 끝날 때까지 도착 모달을 보류한다', () => {
    expect(canShowGiftArrival([first], true)).toBe(false);
    expect(canShowGiftArrival([first], false)).toBe(true);
  });

  it('폴링 결과를 중복 없이 도착 순서로 합친다', () => {
    expect(mergeGiftArrivals([second], [{ ...first }, second]).map((gift) => gift.id)).toEqual(['one', 'two']);
  });

  it('여러 선물은 발신자와 개수를 하나의 경험으로 요약한다', () => {
    expect(describeGiftArrivals([first])).toContain('은혜님');
    expect(describeGiftArrivals([first, second])).toBe('은혜님 외 1명에게 말씀 선물 2개가 도착했어요.');
  });
});
