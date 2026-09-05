import { describe, expect, it } from 'vitest';
import { toAudibleBgmGain } from './audio-volume';

describe('BGM 청감 음량', () => {
  it('0%와 100%는 그대로 유지하고 낮은 퍼센트는 음성에 묻히지 않게 보정한다', () => {
    expect(toAudibleBgmGain(0)).toBe(0);
    expect(toAudibleBgmGain(100)).toBe(1);
    expect(toAudibleBgmGain(16)).toBeCloseTo(0.4);
  });

  it('범위를 벗어난 값은 안전하게 제한한다', () => {
    expect(toAudibleBgmGain(-10)).toBe(0);
    expect(toAudibleBgmGain(150)).toBe(1);
  });
});
