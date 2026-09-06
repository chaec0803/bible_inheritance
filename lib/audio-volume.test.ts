import { describe, expect, it } from 'vitest';
import { toAudibleBgmGain } from './audio-volume';

describe('BGM 청감 음량', () => {
  it('낮은 퍼센트 구간도 실제 음량과 선형으로 맞춰 세밀하게 조절한다', () => {
    expect(toAudibleBgmGain(0)).toBe(0);
    expect(toAudibleBgmGain(100)).toBe(1);
    expect(toAudibleBgmGain(2)).toBeCloseTo(0.02);
    expect(toAudibleBgmGain(12)).toBeCloseTo(0.12);
  });

  it('범위를 벗어난 값은 안전하게 제한한다', () => {
    expect(toAudibleBgmGain(-10)).toBe(0);
    expect(toAudibleBgmGain(150)).toBe(1);
  });
});
