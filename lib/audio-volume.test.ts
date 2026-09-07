import { describe, expect, it } from 'vitest';
import { toAudibleBgmGain } from './audio-volume';

describe('BGM 청감 음량', () => {
  it('낮은 구간은 세밀하고 중·고음 구간도 차이가 나도록 제곱 곡선을 사용한다', () => {
    expect(toAudibleBgmGain(0)).toBe(0);
    expect(toAudibleBgmGain(100)).toBe(1);
    expect(toAudibleBgmGain(1)).toBeCloseTo(0.0001);
    expect(toAudibleBgmGain(2)).toBeCloseTo(0.0004);
    expect(toAudibleBgmGain(12)).toBeCloseTo(0.0144);
    expect(toAudibleBgmGain(50)).toBeCloseTo(0.25);
  });

  it('범위를 벗어난 값은 안전하게 제한한다', () => {
    expect(toAudibleBgmGain(-10)).toBe(0);
    expect(toAudibleBgmGain(150)).toBe(1);
  });
});
